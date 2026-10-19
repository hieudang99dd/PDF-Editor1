'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'test-results','compress');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
 '.svg':'image/svg+xml','.pdf':'application/pdf','.wasm':'application/wasm'};
function serve(){
 return http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');const requested=decodeURIComponent(u.pathname);
  const f=path.resolve(root,'.'+requested.replace(/^\/PDF-Editor1/,''));
  if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(f,(err,data)=>{
   res.writeHead(err?404:200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(err?'Not found':data);
  });
 });
}
async function fixture(page){
 return Buffer.from(await page.evaluate(async()=>{
  const cv=document.createElement('canvas');cv.width=1150;cv.height=900;
  const ctx=cv.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,cv.width,cv.height);
  let seed=789;
  for(let i=0;i<52000;i++){
   seed=(seed*1664525+1013904223)>>>0;
   const x=seed%1150;seed=(seed*1664525+1013904223)>>>0;const y=seed%900;
   ctx.fillStyle='rgb('+((seed>>4)&255)+','+((seed>>10)&255)+','+((seed>>16)&255)+')';
   ctx.fillRect(x,y,8,8);
  }
  const imgBlob=await new Promise(res=>cv.toBlob(res,'image/jpeg',.99));
  const imgBytes=new Uint8Array(await imgBlob.arrayBuffer());
  const doc=await PDFLib.PDFDocument.create();
  const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for(let p=0;p<2;p++){
   const sheet=doc.addPage([842,595]);
   const jpg=await doc.embedJpg(imgBytes);
   sheet.drawImage(jpg,{x:155,y:35,width:600,height:410});
   sheet.drawText('CAD VECTOR TEXT LAYER '+(p+1),{x:45,y:550,size:15,font});
   sheet.drawLine({start:{x:20,y:490},end:{x:820,y:490},thickness:1.1});
  }
  const bytes=await doc.save({useObjectStreams:false});
  return Array.from(bytes);
 }));
}
async function main(){
 const server=serve();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1380,height:920},acceptDownloads:true});
  const faults=[];
  page.on('pageerror',e=>faults.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&/\.m?js/.test(r.url()))faults.push(r.status()+' '+r.url())});
  await page.goto('http://127.0.0.1:'+server.address().port+'/PDF-Editor1/compress.html');
  await page.waitForFunction(()=>window.PDFLib?.PDFDocument);
  const input=await fixture(page);
  fs.writeFileSync(path.join(out,'source.pdf'),input);
  await page.locator('#file').setInputFiles({name:'Road-CD3D.pdf',mimeType:'application/pdf',buffer:input});
  await page.locator('input[value=strong]').check();
  await page.locator('#compress').click();
  await page.locator('#result').waitFor({state:'visible',timeout:90000});
  assert.match(await page.locator('#status').innerText(),/Đã nén PDF/);
  const saving=await page.locator('#saving-percent').innerText();
  assert.ok(parseFloat(saving)>10,'Image-heavy PDF should shrink more than 10%: '+saving);
  const downloading=page.waitForEvent('download');
  await page.locator('#download').click();
  await (await downloading).saveAs(path.join(out,'strong.pdf'));
  const original=fs.readFileSync(path.join(out,'source.pdf'));
  const optimized=fs.readFileSync(path.join(out,'strong.pdf'));
  assert.ok(optimized.byteLength<original.byteLength,'output must shrink');
  const doc=await page.evaluate(async bytes=>{
    const d=await PDFLib.PDFDocument.load(Uint8Array.from(bytes));
    return {pages:d.getPageCount(),width:d.getPage(0).getWidth()};
  },Array.from(optimized));
  assert.equal(doc.pages,2);assert.equal(doc.width,842);
  await page.screenshot({path:path.join(out,'01-strong.png'),fullPage:true});

  await page.locator('input[value=safe]').check();
  await page.locator('#compress').click();
  await page.locator('#result').waitFor({state:'visible',timeout:90000});
  const dl2=page.waitForEvent('download');
  await page.locator('#download').click();
  await(await dl2).saveAs(path.join(out,'safe.pdf'));
  assert.ok(fs.statSync(path.join(out,'safe.pdf')).size<=original.byteLength);
  await page.screenshot({path:path.join(out,'02-safe.png'),fullPage:true});
  assert.deepEqual(faults,[]);
  console.log('PASS: PDF EDITOR compresses embedded JPEG, retains PDF pages/vectors, and exports without size increase.');
 }finally{
   await browser.close();
   await new Promise(r=>server.close(r));
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
