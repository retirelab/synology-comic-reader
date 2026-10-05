import {makeConfig} from './config-generator.js?v=0.1.4';
const $ = id => document.getElementById(id);
let url;
$('setupForm').addEventListener('submit', async event=>{
  event.preventDefault(); $('download').hidden=true;
  if(url){URL.revokeObjectURL(url);url=null;}
  $('generate').disabled=true;
  try {
    if(!crypto.subtle)throw new Error('HTTPS 주소에서 열어주세요.');
    if($('newPassword').value !== $('confirm').value)throw new Error('비밀번호 확인이 일치하지 않습니다.');
    $('result').textContent='설정 파일을 만드는 중…';
    const content=await makeConfig($('root').value.trim(),$('newPassword').value);
    url=URL.createObjectURL(new Blob([content],{type:'application/octet-stream'}));
    $('download').href=url; $('download').hidden=false;
    $('newPassword').value=''; $('confirm').value='';
    $('result').textContent='완료되었습니다. 아래 다운로드 링크를 눌러 저장해주세요.';
  } catch(error){$('result').textContent=error.message;}
  finally{$('generate').disabled=false;}
});
addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
