import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync} from 'node:crypto';
import {makeConfig} from '../public/config-generator.js';
test('browser crypto produces interoperable PHP hash without plaintext',async()=>{
 const password='테스트-password-1234',salt=Uint8Array.from({length:16},(_,i)=>i);
 const expected=pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex');
 const config=await makeConfig('/volume1/comics',password,salt);
 assert.ok(config.includes('pbkdf2-sha256$600000$000102030405060708090a0b0c0d0e0f$'+expected));
 assert.ok(!config.includes(password));assert.ok(config.includes("'secure_cookie' => true"));
});
test('invalid path and short password do not create a config',async()=>{
 await assert.rejects(()=>makeConfig('/tmp/comics','long-password-1234'));
 await assert.rejects(()=>makeConfig('/volume1/comics','short'));
 await assert.rejects(()=>makeConfig('/volume1/comics\n','long-password-1234'));
});
