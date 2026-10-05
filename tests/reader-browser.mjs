// Exercise the real reader DOM with synthetic images, without NAS credentials.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn('python3',['-m','http.server','8137','--bind','127.0.0.1','--directory','public'],{stdio:'ignore'});
let browser;
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let imageRequests=0;
 const svg=wide=>`<svg xmlns="http://www.w3.org/2000/svg" width="${wide?1400:700}" height="1000"><rect width="700" height="1000" fill="#1680d5"/>${wide?'<rect x="700" width="700" height="1000" fill="#df4050"/>':''}</svg>`;
 await page.route('**/api.php?**',async route=>{
  const params=new URL(route.request().url()).searchParams,action=params.get('action');
  if(action==='image'){imageRequests++;return route.fulfill({contentType:'image/svg+xml',body:svg(params.get('page')!=='1')});}
  if(action==='cover')return route.fulfill({contentType:'image/svg+xml',body:svg(false)});
  const data=action==='status'?{authenticated:true,version:'0.1.4'}:action==='browse'?{items:[{name:'Synthetic.zip',path:'Synthetic.zip',folder:false,size:2048,cover:true}]}:action==='pages'?{count:3,version:'fixture'}:{ok:true};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:8137');
 const card=page.locator('.book');await card.waitFor();await card.click();
 await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='왼쪽 · 1/2');
 const geometry=await page.evaluate(()=>({frame:document.getElementById('pageFrame').getBoundingClientRect().height,canvas:document.getElementById('canvas').clientHeight}));
 assert.ok(Math.abs(geometry.frame-geometry.canvas)<1);
 const firstRequests=imageRequests;
 await page.click('#next');await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='오른쪽 · 2/2');
 assert.equal(await page.locator('#pageNumber').inputValue(),'1');assert.equal(imageRequests,firstRequests);
 await page.click('#close');await card.click();await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='오른쪽 · 2/2');
 await page.click('#next');await page.waitForFunction(()=>document.getElementById('pageNumber').value==='2' && !document.getElementById('pageFrame').hidden);
 assert.equal(await page.locator('#halfLabel').textContent(),'');
 await page.click('#prev');await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='오른쪽 · 2/2');
 await page.click('#retry');await page.waitForFunction(()=>document.getElementById('pageNumber').value==='1' && document.getElementById('halfLabel').textContent==='왼쪽 · 1/2');
 await page.click('#direction');await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='오른쪽 · 1/2');
 await page.click('#next');await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='왼쪽 · 2/2');
 await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='왼쪽 · 2/2');
 await page.click('#split');assert.equal(await page.locator('#split').textContent(),'양면: 강제');
 await page.click('#split');assert.equal(await page.locator('#halfLabel').textContent(),'');
 await page.click('#split');await page.waitForFunction(()=>document.getElementById('halfLabel').textContent==='오른쪽 · 1/2');
 assert.deepEqual(errors,[]);
 console.log('Reader browser checks passed: height fit, half order, no refetch, resume, mixed scans, restart, rotation, overrides.');
} finally {await browser?.close();server.kill();}
