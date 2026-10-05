export function coverUrl(item) {
  if (!item.cover) return null;
  return 'api.php?' + new URLSearchParams({action:item.folder ? 'folder-cover' : 'cover',path:item.path});
}
export function makeCover(item) {
  const frame=document.createElement('span');frame.className='cover';
  const icon=document.createElement('span');icon.className='icon';icon.textContent=item.folder?'▤':'▥';frame.append(icon);
  const url=coverUrl(item);
  if(url){
    const image=document.createElement('img');image.alt='';image.loading='lazy';image.decoding='async';
    image.onload=()=>{icon.hidden=true;};
    image.onerror=()=>{image.remove();icon.hidden=false;};
    image.src=url;frame.append(image);
  }
  return frame;
}
