'use strict';
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const {once}=require('node:events'),assert=require('node:assert/strict');
const PDFLib=require('../pdf-lib.min.js');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.pdf':'application/pdf','.svg':'image/svg+xml'};
function webServer(){
 return http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const real=path.resolve(root,'.'+name);
  if(!real.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(real,(error,data)=>{
   if(error){res.writeHead(404);res.end('Not found');return}
   res.writeHead(200,{'Content-Type':MIME[path.extname(real)]||'application/octet-stream','Cache-Control':'no-store'});
   res.end(data);
  });
 });
}
async function fixture(){
 const d=await PDFLib.PDFDocument.create();
 const font=await d.embedFont(PDFLib.StandardFonts.Helvetica);
 const a=d.addPage([550,720]);a.drawText('VECTOR PAGE ONE',{x:70,y:360,size:18,font});
 a.drawRectangle({x:70,y:200,width:300,height:310,borderColor:PDFLib.rgb(0,0,0),borderWidth:1});
 const b=d.addPage([760,540]);b.drawText('VECTOR PAGE TWO',{x:70,y:330,size:18,font});
 b.setRotation(PDFLib.degrees(90));
 return Buffer.from(await d.save());
}
(async()=>{
 const server=webServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:950},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port+'/crop.html';
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const source=await fixture();
  await page.locator('#file').setInputFiles({name:'pages.pdf',mimeType:'application/pdf',buffer:source});
  await page.locator('#apply').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#apply').disabled,{timeout:30000});
  assert.equal(await page.locator('#export').isDisabled(),true,'no export before apply');
  await page.locator('#scope').selectOption('all');
  const r=await page.locator('#stage').boundingBox();assert.ok(r&&r.width>100&&r.height>100);
  await page.mouse.move(r.x+r.width*.14,r.y+r.height*.13);
  await page.mouse.down();
  await page.mouse.move(r.x+r.width*.89,r.y+r.height*.88,{steps:9});
  await page.mouse.up();
  assert.match(await page.locator('#selection-summary').innerText(),/Giữ lại/);
  await page.locator('#apply').click();
  await page.locator('#review').waitFor({state:'visible',timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('#approved').disabled,{timeout:30000});
  assert.equal(await page.locator('#export').isDisabled(),true,'export must require explicit review');
  assert.match(await page.locator('#review-count').innerText(),/2 trang thay đổi/);
  await page.locator('#review-page').selectOption('2');
  await page.waitForFunction(()=>!document.querySelector('#approved').disabled,{timeout:30000});
  fs.mkdirSync(path.join(root,'test-results/crop'),{recursive:true});
  await page.locator('#review').screenshot({path:path.join(root,'test-results/crop/review-before-after.png')});
  await page.locator('#approved').check();
  await page.waitForFunction(()=>!document.querySelector('#export').disabled);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
  const bytes=fs.readFileSync(await download.path());
  const result=await PDFLib.PDFDocument.load(bytes);
  const original=await PDFLib.PDFDocument.load(source);
  assert.equal(result.getPageCount(),2);
  assert.equal(result.getPage(1).getRotation().angle,90);
  for(let i=0;i<2;i++){
   assert.ok(result.getPage(i).getCropBox().width<original.getPage(i).getCropBox().width);
   assert.ok(result.getPage(i).getCropBox().height<original.getPage(i).getCropBox().height);
   assert.deepEqual(result.getPage(i).getMediaBox(),original.getPage(i).getMediaBox());
  }
  await page.locator('#reset').click();
  assert.equal(await page.locator('#export').isDisabled(),true,'modifying crop must revoke approval');
  assert.deepEqual(errors,[],'browser must run without JS exceptions');
  const signed=await PDFLib.PDFDocument.create();signed.addPage();
  signed.context.register(signed.context.obj({Type:'Sig',ByteRange:[0,10,25,10]}));
  await page.locator('#file').setInputFiles({name:'signed.pdf',mimeType:'application/pdf',buffer:Buffer.from(await signed.save())});
  await page.locator('#locked').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('#apply').isDisabled(),true);
  assert.equal(await page.locator('#export').isDisabled(),true);
  console.log('PASS: actual PDF crop visual review, two rotated pages, explicit export approval, invalidation and signed PDF lock.');
 }finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1});
