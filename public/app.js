import {read, write, clampPage} from './storage.js?v=0.1.3';
import {makeCover} from './covers.js?v=0.1.3';
const $ = id => document.getElementById(id);
let folder = '', items = [], book = null, page = 0, count = 0, version = '', sequence = 0, imageController, bookSequence = 0, browseSequence = 0;
let rtl = read('rtl', false), heightFit = read('heightFit', false), objectUrl;
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
  $('reader').hidden=false; document.body.classList.add('reading'); updatePreferences(); message(); await loadPage();
}
async function loadPage() {
  const request = ++sequence; imageController?.abort(); imageController = new AbortController();
  const selectedBook = book, selectedPage = page, selectedVersion = version, selectedCount = count;
  $('pageNumber').value=page+1; $('prev').disabled=page===0; $('next').disabled=page===count-1;
  $('pageImage').hidden=true; $('pageError').hidden=false; $('pageError').textContent='페이지를 불러오는 중…';
  const clearImage = () => { $('pageImage').removeAttribute('src'); if(objectUrl) URL.revokeObjectURL(objectUrl); objectUrl=null; };
  clearImage();
  try {
    const response = await fetch('api.php?' + new URLSearchParams({action:'image',path:selectedBook.path,page:selectedPage,version:selectedVersion}),{signal:imageController.signal,cache:'no-store',credentials:'same-origin'});
    if (!response.ok) { const error=await response.json(); if(response.status===401) showLogin(); throw new Error(error.error || '이미지를 읽을 수 없습니다.'); }
    const blob=await response.blob(); if(request!==sequence || !book) return;
    objectUrl=URL.createObjectURL(blob); $('pageImage').src=objectUrl;
    await $('pageImage').decode(); if(request!==sequence || !book) return;
    $('pageImage').hidden=false; $('pageError').hidden=true; $('canvas').scrollTop=0; $('canvas').scrollLeft=0;
    write('progress:'+selectedBook.path,{page:selectedPage,count:selectedCount,version:selectedVersion});
  } catch(error) { if(error.name!=='AbortError' && request===sequence && book) { $('pageError').textContent=error.message; $('pageError').hidden=false; } }
}
function closeBook() {
  ++sequence; ++bookSequence; imageController?.abort(); book=null; $('reader').hidden=true; document.body.classList.remove('reading');
  $('pageImage').removeAttribute('src'); if(objectUrl) URL.revokeObjectURL(objectUrl); objectUrl=null;
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  renderBooks();
}
function step(delta) { if(!book)return; const next=clampPage(page+delta,count); if(next!==page){page=next; loadPage();} }
function updatePreferences() { $('direction').textContent=rtl?'우 → 좌':'좌 → 우'; $('fit').textContent=heightFit?'높이 맞춤':'너비 맞춤'; $('reader').classList.toggle('height',heightFit); }
async function run(action) { try { await action(); } catch(error) { message(error.message); } }
$('loginForm').onsubmit = event => { event.preventDefault(); run(async()=>{await api('login',{}, {password:$('password').value}); $('password').value=''; await browse();}); };
$('logout').onclick=()=>run(async()=>{await api('logout',{},{}); showLogin();});
$('up').onclick=()=>run(()=>browse(folder.split('/').slice(0,-1).join('/')));
$('refresh').onclick=()=>run(()=>browse(folder)); $('search').oninput=renderBooks;
$('close').onclick=closeBook; $('prev').onclick=()=>step(-1); $('next').onclick=()=>step(1); $('retry').onclick=()=>loadPage();
$('pageNumber').onchange=()=>{if(!book)return;page=clampPage(Number($('pageNumber').value)-1,count);loadPage();};
$('direction').onclick=()=>{rtl=!rtl;write('rtl',rtl);updatePreferences();};
$('fit').onclick=()=>{heightFit=!heightFit;write('heightFit',heightFit);updatePreferences();};
$('fullscreen').onclick=()=>run(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else if($('reader').requestFullscreen)await $('reader').requestFullscreen();else throw new Error('이 브라우저는 전체화면을 지원하지 않습니다.');});
document.addEventListener('keydown', event=>{
  if(!book || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  if(['ArrowLeft','ArrowRight','Escape'].includes(event.key))event.preventDefault();
  if(event.key==='ArrowRight')step(rtl?-1:1); if(event.key==='ArrowLeft')step(rtl?1:-1); if(event.key==='Escape')closeBook();
});
// Mobile pinch/scroll remains native; large Previous/Next buttons are always visible.
run(async()=>{ const state=await api('status'); if(state.authenticated)await browse();else showLogin(); });
