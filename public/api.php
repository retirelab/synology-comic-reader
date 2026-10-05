<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
function fail(int $code, string $message): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE); exit;
}
function reply(array $data): void {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit;
}
// Browser-generated PBKDF2 configs and existing PHP password_hash configs.
function verifyViewerPassword(string $password, string $stored): bool {
    if (!str_starts_with($stored, 'pbkdf2-sha256$')) return password_verify($password, $stored);
    $parts = explode('$', $stored);
    if (count($parts) !== 4 || $parts[1] !== '600000' || !preg_match('/^[a-f0-9]{32}$/D', $parts[2]) || !preg_match('/^[a-f0-9]{64}$/D', $parts[3])) return false;
    $salt = hex2bin($parts[2]);
    if ($salt === false) return false;
    return hash_equals($parts[3], hash_pbkdf2('sha256', $password, $salt, 600000, 64, false));
}
$configPath = getenv('COMIC_READER_CONFIG') ?: '/volume1/comic-reader-private/config.php';
if (!is_file($configPath)) fail(503, '설정 파일이 없습니다. 설치 안내에 따라 NAS 설정을 먼저 완료해 주세요.');
$config = require $configPath;
if (!is_array($config) || empty($config['root']) || empty($config['password_hash'])) fail(503, '서버 설정이 올바르지 않습니다.');
$secure = (bool)($config['secure_cookie'] ?? false);
ini_set('session.use_strict_mode', '1');
session_name('comic_reader');
session_set_cookie_params(['httponly'=>true, 'samesite'=>'Strict', 'secure'=>$secure, 'path'=>'/']);
if (!session_start()) fail(503, 'PHP 세션 저장 경로를 확인해 주세요.');
$action = $_GET['action'] ?? 'status';
if (!is_string($action)) fail(400, '잘못된 요청입니다.');
if (in_array($action, ['login', 'logout'], true)) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_SERVER['HTTP_X_COMIC_READER'] ?? '') !== '1') fail(403, '허용되지 않은 요청입니다.');
    if ($action === 'logout') { $_SESSION = []; session_destroy(); reply(['ok'=>true]); }
    $input = json_decode(file_get_contents('php://input', false, null, 0, 4096) ?: '', true);
    $password = is_array($input) ? ($input['password'] ?? null) : null;
    if (!is_string($password) || strlen($password) > 1024 || !verifyViewerPassword($password, $config['password_hash'])) {
        usleep(800000); fail(401, '비밀번호를 확인해 주세요.');
    }
    session_regenerate_id(true); $_SESSION['authenticated'] = true; $_SESSION['last_seen'] = time(); reply(['ok'=>true]);
}
$authenticated = !empty($_SESSION['authenticated']) && time() - (int)($_SESSION['last_seen'] ?? 0) < 43200;
if ($action === 'status') reply(['authenticated'=>$authenticated, 'version'=>'0.1.3']);
if (!$authenticated) fail(401, '로그인이 필요합니다.');
$_SESSION['last_seen'] = time();
session_write_close();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail(405, 'GET 요청만 지원합니다.');
$root = realpath($config['root']);
if ($root === false || !is_dir($root)) fail(503, '만화 폴더 경로 또는 읽기 권한을 확인해 주세요.');
function resolvePath(string $root, $relative): string {
    if (!is_string($relative) || str_contains($relative, "\0") || strlen($relative)>4096) fail(400, '잘못된 경로입니다.');
    $path = realpath($root . '/' . $relative);
    if ($path === false || ($path !== $root && !str_starts_with($path, $root . DIRECTORY_SEPARATOR))) fail(404, '파일을 찾을 수 없습니다.');
    return $path;
}
function isBook(string $path): bool { return in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), ['zip','cbz'], true); }
function isImage(string $path): bool {
    return in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), ['jpg','jpeg','png','webp','gif'], true);
}
function folderCover(string $folder): ?string {
    $names = scandir($folder);
    if ($names === false) return null;
    $candidates = [];
    foreach ($names as $name) {
        $file = $folder . '/' . $name;
        if ($name[0] === '.' || is_link($file) || !is_file($file) || !is_readable($file) || !isImage($name)) continue;
        $candidates[] = $name;
    }
    usort($candidates, function ($a, $b) {
        $priority = fn($name) => in_array(strtolower(pathinfo($name, PATHINFO_FILENAME)), ['cover','folder'], true) ? 0 : 1;
        return ($priority($a) <=> $priority($b)) ?: strnatcasecmp($a, $b) ?: strcmp($a, $b);
    });
    return $candidates ? $folder . '/' . $candidates[0] : null;
}
// Send one image, validating its actual format. Never extract a ZIP to disk.
function sendImage($stream, int $size): void {
    if ($size < 1 || $size > 32*1024*1024) fail(413, '이미지 한 장의 크기는 최대 32MB입니다.');
    $prefix = fread($stream, min(65536, $size));
    if ($prefix === false || $prefix === '') fail(422, '빈 이미지입니다.');
    if (!class_exists('finfo')) fail(503, 'PHP fileinfo 확장을 활성화해 주세요.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($prefix);
    if (!in_array($mime,['image/jpeg','image/png','image/webp','image/gif'],true)) fail(422, '지원하지 않는 이미지입니다.');
    header('Content-Type: '.$mime);
    echo $prefix;
    $sent = strlen($prefix);
    while (!feof($stream) && !connection_aborted() && $sent < $size) {
        $chunk = fread($stream, min(65536, $size-$sent));
        if ($chunk === false || $chunk === '') break;
        echo $chunk; $sent += strlen($chunk);
    }
    fclose($stream);
}
$relative = $_GET['path'] ?? '';
$path = resolvePath($root, $relative);
if ($action === 'folder-cover') {
    if (!is_dir($path) || !is_readable($path)) fail(404, '폴더를 읽을 수 없습니다.');
    $cover = folderCover($path);
    if ($cover === null) fail(404, '폴더 표지가 없습니다.');
    $stream = fopen($cover, 'rb');
    if ($stream === false) fail(404, '폴더 표지를 읽을 수 없습니다.');
    sendImage($stream, (int)filesize($cover)); exit;
}
if ($action === 'browse') {
    if (!is_dir($path) || !is_readable($path)) fail(404, '폴더를 읽을 수 없습니다.');
    $items = []; $names = scandir($path);
    if ($names === false) fail(503, '폴더를 읽을 수 없습니다.');
    foreach ($names as $name) {
        if ($name[0] === '.' || in_array($name, ['@eaDir','#recycle'], true)) continue;
        $item = $path . '/' . $name;
        if (is_link($item) || !is_readable($item)) continue;
        $folder = is_dir($item);
        if (!$folder && (!is_file($item) || !isBook($item))) continue;
        $items[] = ['name'=>$name, 'path'=>ltrim(substr($item, strlen($root)), '/'), 'folder'=>$folder, 'size'=>$folder ? 0 : filesize($item), 'cover'=>$folder ? folderCover($item) !== null : true];
    }
    usort($items, fn($a,$b)=>($b['folder'] <=> $a['folder']) ?: strnatcasecmp($a['name'],$b['name']));
    reply(['items'=>$items]);
}
if (!in_array($action,['pages','image','cover'],true)) fail(400, '알 수 없는 요청입니다.');
if (!is_file($path) || !isBook($path) || !is_readable($path)) fail(404, '만화 파일을 읽을 수 없습니다.');
if (!class_exists('ZipArchive')) fail(503, 'Web Station PHP 프로필에서 zip 확장을 활성화해 주세요.');
$zip = new ZipArchive();
if ($zip->open($path, ZipArchive::RDONLY) !== true) fail(422, 'ZIP 파일이 손상되었거나 지원하지 않는 형식입니다.');
if ($zip->numFiles > 20000) fail(413, 'ZIP 내부 파일 수가 너무 많습니다. (최대 20,000개)');
$pages = []; $seen = [];
for ($i=0; $i<$zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    if ($stat === false) continue;
    $name = $stat['name'];
    if (!preg_match('/\.(jpe?g|png|webp|gif)$/i', $name) || str_starts_with($name,'__MACOSX/') || basename($name)[0] === '.') continue;
    if (isset($seen[$name])) fail(422, 'ZIP에 같은 이름의 이미지가 중복되어 있습니다.');
    $seen[$name] = true;
    $pages[] = ['name'=>$name, 'index'=>$i, 'size'=>(int)$stat['size'], 'encrypted'=>!empty($stat['encryption_method'])];
}
usort($pages, fn($a,$b)=>strnatcasecmp($a['name'],$b['name']) ?: ($a['index'] <=> $b['index']));
$version = hash('sha256', (string)filesize($path) . ':' . (string)filemtime($path));
if ($action === 'pages') {
    $zip->close(); reply(['count'=>count($pages), 'version'=>$version]);
}
if ($action === 'image' && ($_GET['version'] ?? '') !== $version) fail(409, '파일이 변경되었습니다. 책을 다시 열어 주세요.');
$page = $action === 'cover' ? 0 : filter_var($_GET['page'] ?? null, FILTER_VALIDATE_INT);
if ($page === false || $page === null || $page < 0 || $page >= count($pages)) fail(404, '페이지를 찾을 수 없습니다.');
$entry = $pages[$page];
if ($entry['encrypted']) fail(422, '암호가 걸린 ZIP은 첫 버전에서 지원하지 않습니다.');
if ($entry['size'] < 1 || $entry['size'] > 32*1024*1024) fail(413, '이미지 한 장의 크기는 최대 32MB입니다.');
$stream = $zip->getStream($entry['name']);
if ($stream === false) fail(422, '이미지를 읽을 수 없습니다.');
sendImage($stream, $entry['size']);
$zip->close();
