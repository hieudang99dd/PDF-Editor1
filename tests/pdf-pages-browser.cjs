'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const PDFLib=require('../pdf-lib.min.js');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'test-results','pages');
fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.pdf':'application/pdf'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 const filepath=path.resolve(root,'.'+decodeURIComponent(url.pathname).replace(/^\/PDF-Editor1/,''));
 if(!filepath.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(filepath,(err,body)=>{
  res.writeHead(err?404:200,{'Content-Type':types[path.extname(filepath)]||'application/octet-stream','Cache-Control':'no-cache'});
  res.end(err?'Not found':body);
 });
});
async function fixture(prefix,count){
 const doc=await PDFLib.PDFDocument.create();
 const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
 for(let i=0;i<count;i++){
  const p=doc.addPage(i%2?[842,595]:[595,842]);
  p.drawText(prefix+' PAGE '+(i+1),{x:50,y:530,font,size:18});
  p.drawRectangle({x:60,y:260,width:320,height:120,borderWidth:1.5});
  p.drawLine({start:{x:50,y:650},end:{x:520,y:650},thickness:1});
 }
 return Buffer.from(await doc.save({useObjectStreams:false}));
}
async function run(){
 const live=process.env.PAGES_BASE_URL?.replace(/\/$/,'') || '';
 if(!live)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=live || 'http://127.0.0.1:'+server.address().port+'/PDF-Editor1';
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&/\.m?js/.test(r.url()))errors.push('HTTP '+r.status()+' '+r.url())});
  await page.goto(base+'/pages.html');
  await page.waitForFunction(()=>window.PDFLib?.PDFDocument && window.pdfjsLib?.getDocument);
  const A=await fixture('ALPHA',3),B=await fixture('BRAVO',1);
  await page.locator('#files').setInputFiles([
   {name:'Alpha.pdf',mimeType:'application/pdf',buffer:A},
   {name:'Bravo.pdf',mimeType:'application/pdf',buffer:B},
  ]);
  await page.waitForFunction(()=>document.querySelectorAll('#grid .pm-card').length===4&&
   document.querySelector('#apply').disabled===false,{timeout:45000});
  await page.waitForFunction(()=>document.querySelectorAll('#grid .pm-thumb img[src^="data:image"]').length>0,null,{timeout:40000});
  assert.equal(await page.locator('#summary').innerText(),'4 trang · 2 tệp PDF');
  await page.locator('#layout').selectOption('grid');
  assert.equal(await page.locator('#workspace').getAttribute('data-layout'),'grid');
  await page.locator('#layout').selectOption('rail');
  assert.equal(await page.locator('#workspace').getAttribute('data-layout'),'rail');
  await page.locator('#layout').selectOption('split');
  await page.locator('#jump').fill('4');
  await page.locator('#jump-btn').click();
  assert.match(await page.locator('#preview-info').innerText(),/Trang 4 \/ 4/);
  await page.locator('#range').fill('2-3');
  await page.locator('#range-apply').click();
  assert.match(await page.locator('#selection-info').innerText(),/2 trang/);
  await page.locator('#rotate-right').click();
  await page.locator('#undo').click();
  await page.locator('#redo').click();
  await page.locator('#duplicate').click();
  await page.waitForFunction(()=>document.querySelectorAll('#grid .pm-card').length===6);
  await page.locator('#grid .pm-card').first().click();
  await page.locator('#toggle-split').click();
  assert.match(await page.locator('#split-count').innerText(),/1 mốc/);
  await page.screenshot({path:path.join(out,'01-layout.png'),fullPage:true});
  await page.locator('#clear-splits').click();
  await page.locator('#apply').click();
  await page.locator('#result').waitFor({state:'visible',timeout:45000});
  const downloading=page.waitForEvent('download');
  await page.locator('#result-export').click();
  await(await downloading).saveAs(path.join(out,'organized.pdf'));
  const bytes=fs.readFileSync(path.join(out,'organized.pdf'));
  const pdf=await PDFLib.PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),6);
  const mode=await page.locator('#layout').inputValue();
  assert.equal(mode,'split');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,'02-result.png'),fullPage:true});
  console.log('PASS: live visual page layout, thumbnails, multi-file, range select, rotate, undo/redo, duplicate, split marker and apply/export');
  // Split point must produce a ZIP containing real independent PDFs.
  await page.locator('#grid .pm-card').first().click();
  await page.locator('#toggle-split').click();
  await page.locator('#apply').click();
  await page.locator('#result').waitFor({state:'visible',timeout:45000});
  const getZip=page.waitForEvent('download');
  await page.locator('#result-export').click();
  await(await getZip).saveAs(path.join(out,'split.zip'));
  const zipped=require('../jszip.min.js');
  const archive=await zipped.loadAsync(fs.readFileSync(path.join(out,'split.zip')));
  const names=Object.keys(archive.files).filter(name=>name.endsWith('.pdf'));
  assert.equal(names.length,2,'Expected two PDFs split after first page');
  const pageCounts=[];
  for(const name of names){
    const bytes=await archive.file(name).async('uint8array');
    const d=await PDFLib.PDFDocument.load(bytes);
    pageCounts.push(d.getPageCount());
  }
  assert.deepEqual(pageCounts,[1,5]);
  console.log('PASS: split marker exports a real ZIP with 1-page and 5-page vector PDFs');

  const signed=await PDFLib.PDFDocument.create();signed.addPage();
  signed.context.register(signed.context.obj({Type:'Sig',ByteRange:[0,22,33,45]}));
  const signedBytes=Buffer.from(await signed.save());
  await page.reload();
  await page.locator('#files').setInputFiles({name:'signed.pdf',mimeType:'application/pdf',buffer:signedBytes});
  await page.waitForFunction(()=>document.querySelectorAll('#grid .pm-card').length===1);
  assert.equal(await page.locator('#apply').isDisabled(),true);
  assert.equal(await page.locator('#export').isEnabled(),true);
  const dl=page.waitForEvent('download');
  await page.locator('#export').click();
  await(await dl).saveAs(path.join(out,'signed.pdf'));
  assert.deepEqual(fs.readFileSync(path.join(out,'signed.pdf')),signedBytes);
  assert.deepEqual(errors,[]);
  console.log('PASS: digitally signed original opens read-only and downloads byte-for-byte');
 }finally{
  await browser.close();
  if(!live)await new Promise(resolve=>server.close(resolve));
 }
}
run().catch(e=>{console.error(e.stack);process.exitCode=1});
