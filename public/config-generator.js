const hex = bytes => [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
export async function makeConfig(root, password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  if (!/^\/volume[1-9]\d*\/.+/.test(root) || /[\r\n\0]/.test(root)) throw new Error('만화 폴더의 절대 경로를 확인해 주세요.');
  const encoded = new TextEncoder().encode(password);
  if ([...password].length < 12 || encoded.length > 1024) throw new Error('비밀번호는 12자 이상으로 정해주세요.');
  if (!(salt instanceof Uint8Array) || salt.length !== 16) throw new Error('올바르지 않은 salt입니다.');
  const key = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000}, key, 256);
  const hash = `pbkdf2-sha256$600000$${hex(salt)}$${hex(new Uint8Array(bits))}`;
  const path = root.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return `<?php\nreturn [\n    'root' => '${path}',\n    'password_hash' => '${hash}',\n    'secure_cookie' => true,\n];\n`;
}
