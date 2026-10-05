import {read, write, clampPage} from './storage.js?v=0.1.4';
import {makeCover} from './covers.js?v=0.1.4';
import {shouldSplit,physicalSide,nextPosition,imageGeometry} from './spread.js?v=0.1.4';
const $ = id => document.getElementById(id);
let folder = '', items = [], book = null, page = 0, count = 0, version = '', sequence = 0, imageController, bookSequence = 0, browseSequence = 0;
let rtl = read('rtl', false), heightFit = read('heightFit', false), objectUrl;
let half=0, imageReady=false, splitMode=read('splitMode','auto');
if(!['auto','on','off'].includes(splitMode))splitMode='auto';
async function api(action, params = {}, body) {
  const response = await fetch('api.php?' + new URLSearchParams({action, ...params}), {
    credentials: 'same-origin', cache: 'no-store', ...(body ? {method:'POST',headers:{'Content-Type':'application/json','X-Comic-Reader':'1'},body:JSON.stringify(body)} : {})
  });
  const result = await response.json();
  if (!response.ok) { if (response.status === 401) showLogin(); throw new Error(result.error || '연결에 실패했습니다.'); }
  return result;
}
function showLogin() { closeBook(); $('library').hidden = true; $('login').hidden = false; }
function message(text = '') { $('message').textContent = text; }
function progress(item) { return read('progress:' + item.path, null); }
function renderBooks() {
  const query = $('search').value.toLocaleLowerCase(); $('books').replaceChildren();
  const filtered = items.filter(item => item.name.toLocaleLowerCase().includes(query));
  for (const item of filtered) {
    const button = document.createElement('button'); button.className = 'book';
    const cover = makeCover(item);
    const title = document.createElement('strong'); title.textContent=item.name;
    const small = document.createElement('small'); const saved = progress(item);
    small.textContent = item.folder ? '폴더 열기' : saved ? `이어 읽기 · ${saved.page+1} / ${saved.count}` : `${(item.size/1048576).toFixed(1)} MB · 읽기`;
    button.append(cover,title,small); button.onclick = () => run(() => item.folder ? browse(item.path) : openBook(item)); $('books').append(button);
  }
  if (!filtered.length) { const empty = document.createElement('p'); empty.textContent = '표시할 책이 없습니다.'; $('books').append(empty); }
}
async function browse(path = '') {
  const request = ++browseSequence;
  message('책장을 불러오는 중…');
  const result = await api('browse',{path}); if(request !== browseSequence) return;
  folder=path; items=result.items; $('folder').textContent=folder || '전체 책장'; $('up').disabled=!folder;
  $('search').value=''; $('login').hidden=true; $('library').hidden=false; renderBooks(); message();
}
async function openBook(item) {
  const request = ++bookSequence; message('책을 여는 중…');
  const result = await api('pages',{path:item.path}); if(request !== bookSequence) return;
  if (!result.count) throw new Error('ZIP 안에 지원하는 이미지가 없습니다.');
  book=item; count=result.count; version=result.version;
  const saved=progress(item); page = saved?.version === version ? clampPage(saved.page,count) : 0;
  $('title').textContent=item.name; $('total').textContent=count; $('pageNumber').max=count;
  $('reader').hidden=false; document.body.classList.add('reading'); updatePreferences(); message(); await loadPage(saved?.version===version && saved?.half===1 ? 1 : 0);
}
async function loadPage(targetHalf=0) {
  if(!book)return;
  imageReady=false; half=0;
  const request = ++sequence; imageController?.abort(); imageController = new AbortController();
  const selectedBook = book, selectedPage = page, selectedVersion = version, selectedCount = count;
  $('pageNumber').value=page+1; $('prev').disabled=true; $('next').disabled=true; $('pageFrame').hidden=true; $('halfLabel').textContent='';
  $('pageImage').hidden=true; $('pageError').hidden=false; $('pageError').textContent='페이지를 불러오는 중…';
  const clearImage = () => { $('pageImage').removeAttribute('src'); if(objectUrl) URL.revokeObjectURL(objectUrl); objectUrl=null; };
  clearImage();
  try {
    const response = await fetch('api.php?' + new URLSearchParams({action:'image',path:selectedBook.path,page:selectedPage,version:selectedVersion}),{signal:imageController.signal,cache:'no-store',credentials:'same-origin'});
    if (!response.ok) { const error=await response.json(); if(response.status===401) showLogin(); throw new Error(error.error || '이미지를 읽을 수 없습니다.'); }
    const blob=await response.blob(); if(request!==sequence || !book) return;
    objectUrl=URL.createObjectURL(blob); $('pageImage').src=objectUrl;
    await $('pageImage').decode(); if(request!==sequence || !book) return;
    imageReady=true; half=splitActive() && (targetHalf===1 || targetHalf==='last') ? 1 : 0;
    $('pageImage').hidden=false; $('pageError').hidden=true; $('pageFrame').hidden=false;
    renderPage();
  } catch(error) { if(error.name!=='AbortError' && request===sequence && book) { $('pageError').textContent=error.message; $('pageError').hidden=false; } }
}
function closeBook() {
  ++sequence; ++bookSequence; imageController?.abort(); book=null; imageReady=false; half=0; $('pageFrame').hidden=true; $('reader').hidden=true; document.body.classList.remove('reading');
  $('pageImage').removeAttribute('src'); if(objectUrl) URL.revokeObjectURL(objectUrl); objectUrl=null;
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  renderBooks();
}
function splitActive() {
  const image=$('pageImage');
  return imageReady && shouldSplit(image.naturalWidth,image.naturalHeight,window.innerHeight>window.innerWidth,splitMode);
}
function renderPage(resetScroll=true) {
  updatePreferences();
  if(!book || !imageReady)return;
  const image=$('pageImage'), canvas=$('canvas'), active=splitActive();
  const side=active ? physicalSide(half,rtl) : null;
  const box=imageGeometry(image.naturalWidth,image.naturalHeight,canvas.clientWidth,canvas.clientHeight,side,heightFit);
  Object.assign($('pageFrame').style,{width:box.frameWidth+'px',height:box.frameHeight+'px'});
  Object.assign(image.style,{width:box.imageWidth+'px',height:box.imageHeight+'px',left:box.left+'px'});
  $('halfLabel').textContent=active ? `${side==='left'?'왼쪽':'오른쪽'} · ${half+1}/2` : '';
  $('prev').disabled=page===0 && (!active || half===0);
  $('next').disabled=page===count-1 && (!active || half===1);
  $('pageNumber').value=page+1;
  if(resetScroll){canvas.scrollTop=0;canvas.scrollLeft=0;}
  // Preserve which half was read as well as the original ZIP image number.
  write('progress:'+book.path,{page,count,version,half:active?half:0});
}
function step(delta) {
  if(!book || !imageReady)return;
  const target=nextPosition(page,half,delta,splitActive(),count);
  if(!target)return;
  if(target.page===page){half=target.half;renderPage();}
  else{page=target.page;loadPage(target.half);}
}
function updatePreferences() {
  const active=splitActive();
  $('direction').textContent=rtl?'우 → 좌':'좌 → 우';
  $('fit').textContent=active || heightFit?'높이 맞춤':'너비 맞춤'; $('fit').disabled=active;
  $('split').textContent=splitMode==='auto'?'양면: 자동':splitMode==='on'?'양면: 강제':'양면: 끔';
}
async function run(action) { try { await action(); } catch(error) { message(error.message); } }
$('loginForm').onsubmit = event => { event.preventDefault(); run(async()=>{await api('login',{}, {password:$('password').value}); $('password').value=''; await browse();}); };
$('logout').onclick=()=>run(async()=>{await api('logout',{},{}); showLogin();});
$('up').onclick=()=>run(()=>browse(folder.split('/').slice(0,-1).join('/')));
$('refresh').onclick=()=>run(()=>browse(folder)); $('search').oninput=renderBooks;
$('close').onclick=closeBook; $('prev').onclick=()=>step(-1); $('next').onclick=()=>step(1); $('retry').onclick=()=>{if(!book)return;page=0;half=0;loadPage(0);};
$('pageNumber').onchange=()=>{if(!book)return;page=clampPage(Number($('pageNumber').value)-1,count);loadPage();};
$('direction').onclick=()=>{rtl=!rtl;write('rtl',rtl);renderPage();};
$('fit').onclick=()=>{heightFit=!heightFit;write('heightFit',heightFit);renderPage();};
$('split').onclick=()=>{splitMode=splitMode==='auto'?'on':splitMode==='on'?'off':'auto';half=0;write('splitMode',splitMode);renderPage();};
new ResizeObserver(()=>{if(book && imageReady)renderPage(false);}).observe($('canvas'));
$('fullscreen').onclick=()=>run(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else if($('reader').requestFullscreen)await $('reader').requestFullscreen();else throw new Error('이 브라우저는 전체화면을 지원하지 않습니다.');});
document.addEventListener('keydown', event=>{
  if(!book || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  if(['ArrowLeft','ArrowRight','Escape'].includes(event.key))event.preventDefault();
  if(event.key==='ArrowRight')step(rtl?-1:1); if(event.key==='ArrowLeft')step(rtl?1:-1); if(event.key==='Escape')closeBook();
});
// Mobile pinch/scroll remains native; large Previous/Next buttons are always visible.
run(async()=>{ const state=await api('status'); if(state.authenticated)await browse();else showLogin(); });
