"""End-to-end API tests; requires PHP CLI with zip, fileinfo and session."""
import base64
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
import zipfile

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=')
PROJECT = Path(__file__).resolve().parents[1]

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which('php'):
            raise RuntimeError('PHP CLI is required; API tests have not run.')
        for extension in ('zip', 'fileinfo', 'session'):
            subprocess.run(['php', '-r', f'exit(extension_loaded("{extension}") ? 0 : 1);'], check=True)
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        cls.books = cls.root / 'books'
        cls.books.mkdir()
        cls.archive = cls.books / 'sample.zip'
        with zipfile.ZipFile(cls.archive, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('10.png', PNG + b'PAGE10')
            z.writestr('2.png', PNG + b'PAGE2')
            z.writestr('1.png', PNG + b'PAGE1')
            z.writestr('notes.txt', 'not an image')
            z.writestr('__MACOSX/no.png', PNG)
        with zipfile.ZipFile(cls.books / 'disguised.zip', 'w') as z:
            z.writestr('fake.png', '<html>not an image</html>')
        (cls.root / 'outside.cbz').write_bytes(cls.archive.read_bytes())
        (cls.books / 'link.cbz').symlink_to(cls.root / 'outside.cbz')
        cls.original = hashlib.sha256(cls.archive.read_bytes()).hexdigest()
        password_hash = subprocess.check_output(['php', '-r', 'echo password_hash("test-password-only", PASSWORD_DEFAULT);'], text=True)
        cls.config = cls.root / 'config.php'
        cls.config.write_text("<?php return ['root'=>" + repr(str(cls.books)) + ", 'password_hash'=>" + repr(password_hash) + ", 'secure_cookie'=>false];")
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
        cls.url = f'http://127.0.0.1:{port}/api.php'
        cls.log = (cls.root / 'php.log').open('w')
        cls.server = subprocess.Popen(['php', '-d', 'opcache.enable=0', '-d', 'opcache.enable_cli=0', '-S', f'127.0.0.1:{port}', '-t', str(PROJECT / 'public')], env={**os.environ, 'COMIC_READER_CONFIG':str(cls.config)}, stdout=cls.log, stderr=cls.log)
        for _ in range(50):
            try:
                urllib.request.urlopen(cls.url + '?action=status', timeout=1).close()
                return
            except urllib.error.URLError:
                time.sleep(.1)
        cls.server.terminate()
        raise RuntimeError('PHP server failed to start')

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=5)
        cls.log.close()
        cls.temp.cleanup()

    def setUp(self):
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, action, payload=None, header=True, **params):
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(self.url + '?' + urllib.parse.urlencode({'action':action, **params}), data=data)
        if data is not None:
            req.add_header('Content-Type', 'application/json')
            if header:
                req.add_header('X-Comic-Reader', '1')
        try:
            with self.client.open(req, timeout=5) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as error:
            return error.code, error.read(), error.headers

    def login(self):
        self.assertEqual(self.call('login', {'password':'test-password-only'})[0], 200)

    def test_auth_and_logout(self):
        self.assertFalse(json.loads(self.call('status')[1])['authenticated'])
        self.assertEqual(self.call('browse')[0], 401)
        self.assertEqual(self.call('login', {'password':'wrong'})[0], 401)
        self.assertEqual(self.call('login', {'password':'test-password-only'}, header=False)[0], 403)
        self.login()
        self.assertTrue(json.loads(self.call('status')[1])['authenticated'])
        self.assertEqual(self.call('logout', {})[0], 200)
        self.assertEqual(self.call('browse')[0], 401)

    def test_single_image_natural_order_and_read_only(self):
        self.login()
        pages = json.loads(self.call('pages', path='sample.zip')[1])
        self.assertEqual(pages['count'], 3)
        for page, suffix in enumerate((b'PAGE1', b'PAGE2', b'PAGE10')):
            status, data, headers = self.call('image', path='sample.zip', page=page, version=pages['version'])
            self.assertEqual(status, 200)
            self.assertEqual(data, PNG + suffix)
            self.assertEqual(headers['Content-Type'], 'image/png')
        self.assertEqual(hashlib.sha256(self.archive.read_bytes()).hexdigest(), self.original)
        self.assertEqual(self.call('image', path='sample.zip', page=-1, version=pages['version'])[0], 404)
        self.assertEqual(self.call('image', path='sample.zip', page=0, version='stale')[0], 409)

    def test_browser_generated_config(self):
        original = self.config.read_text()
        password = '테스트-password-1234'
        salt = bytes(range(16))
        derived = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600000).hex()
        stored = f'pbkdf2-sha256$600000${salt.hex()}${derived}'
        config = "<?php return ['root'=>" + repr(str(self.books)) + ", 'password_hash'=>" + repr(stored) + ", 'secure_cookie'=>false];"
        try:
            self.config.write_text(config)
            self.assertEqual(self.call('login', {'password':'wrong'})[0], 401)
            self.assertEqual(self.call('login', {'password':password})[0], 200)
            self.assertEqual(self.call('browse')[0], 200)
        finally:
            self.config.write_text(original)

    def test_paths_and_disguised_images(self):
        self.login()
        self.assertEqual(self.call('pages', path='../outside.cbz')[0], 404)
        self.assertEqual(self.call('pages', path='link.cbz')[0], 404)
        items = json.loads(self.call('browse')[1])['items']
        self.assertNotIn('link.cbz', [x['name'] for x in items])
        manifest = json.loads(self.call('pages', path='disguised.zip')[1])
        self.assertEqual(self.call('image', path='disguised.zip', page=0, version=manifest['version'])[0], 422)

if __name__ == '__main__':
    unittest.main()
