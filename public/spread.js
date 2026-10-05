// Pure helpers for spread detection, physical sides and page transitions.
export function shouldSplit(width,height,portrait,mode='auto') {
  if(!(width>0 && height>0) || mode==='off')return false;
  return mode==='on' || (portrait && width/height >= 1.1);
}
export function physicalSide(half,rtl) { return (half===1) !== Boolean(rtl) ? 'right' : 'left'; }
export function nextPosition(page,half,delta,split,count) {
  if(split && delta>0 && half===0)return {page,half:1};
  if(split && delta<0 && half===1)return {page,half:0};
  const next=page+(delta>0?1:-1);
  if(next<0 || next>=count)return null;
  return {page:next,half:delta<0?'last':0};
}
export function imageGeometry(width,height,viewWidth,viewHeight,side=null,heightFit=false) {
  const leftWidth=Math.floor(width/2);
  const cropWidth=side==='left'?leftWidth:side==='right'?width-leftWidth:width;
  const scale=(side || heightFit) ? viewHeight/height : Math.min(viewWidth,1000)/width;
  return {frameWidth:cropWidth*scale,frameHeight:height*scale,imageWidth:width*scale,imageHeight:height*scale,left:side==='right'?-leftWidth*scale:0};
}
