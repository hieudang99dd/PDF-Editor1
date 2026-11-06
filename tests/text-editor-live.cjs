/* Real Chromium test: open standalone CIT text editor, select a native run,
 * format through its dock, export, verify old glyph stream is replaced.
 * Run: npm install --no-save playwright && npx playwright install chromium
 *      node tests/text-editor-live.cjs
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const PDF=require('../pdf-lib.min.js');
const fontkit=require('../fontkit.umd.min.js');
const PDFJS=require('../pdf.min.js');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'test-results','text-editor');
fs.mkdirSync(out,{recursive:true});
PDFJS.GlobalWorkerOptions.workerSrc=path.join(root,'pdf.worker.min.js');
async function fixture(){
 const doc=await PDF.PDFDocument.create();
 doc.registerFontkit(fontkit);
 const font=await doc.embedFont(fs.readFileSync(path.join(root,'fonts/Tinos-Regular.ttf')));
 const page=doc.addPage([620,790]);
 const lines=['RÃNH KM1+260.65','RÃNH KM1+261.65','KHỐI LƯỢNG 35 M3'];
 for(let i=0;i<lines.length;i++)
   page.drawText(lines[i],{x:70,y:680-36*i,font,size:12});
 page.drawRectangle({x:60,y:570,width:490,height:150,borderWidth:0.5,
   borderColor:PDF.rgb(0,0,0),color:PDF.rgb(1,1,1),opacity:0});
 const filename=path.join(out,'input.pdf');
 fs.writeFileSync(filename,await doc.save());
 return filename;
}
function serve(){
 const mime={'.html':'text/html','.js':'application/javascript',
  '.mjs':'application/javascript','.wasm':'application/wasm',
  '.css':'text/css','.ttf':'font/ttf'};
 return http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const file=path.resolve(root,'.'+relative);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,bytes)=>{
   res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
   res.end(error?'Not found':bytes);
  });
 });
}
async function main(){
 const server=serve();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
  page.on('pageerror',err=>errors.push('page: '+err.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  const url='http://127.0.0.1:'+server.address().port+'/text-editor.html';
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#hdv-text-dock').waitFor({state:'attached',timeout:20000});
  assert.equal(await page.title(),'Chỉnh sửa Text PDF – PDF HVD × CIT');
  const file=await fixture();
  await page.locator('#hdv-text-file-picker').setInputFiles(file);
  await page.waitForFunction(()=>window.organizerInstance?.pages?.length===1 &&
    window.organizerInstance.isTextMode && document.querySelectorAll('.po-text-box').length>=3,
    {timeout:90000});
  await page.screenshot({path:path.join(out,'01-open.png')});
  const dock=page.locator('#hdv-text-dock');
  assert.ok(await dock.isVisible());
  const canvas=await page.locator('#po-preview-canvas').boundingBox();
  const pane=await dock.boundingBox();
  assert.ok(pane.x>canvas.x,'CIT inspector must be right of PDF stage');
  const selected=page.locator('#po-text-layer .po-text-box').filter({hasText:'RÃNH KM1+260.65'});
  await selected.click({force:true});
  await page.waitForFunction(()=>!!window.organizerInstance?.activeEditDiv);
  const textarea=page.locator('#hdv-text-value');
  assert.ok(await textarea.isEnabled());
  assert.match(await textarea.inputValue(),/KM1\+260\.65/);
  await textarea.fill('RÃNH KM1+299.99');
  await page.screenshot({path:path.join(out,'02-inspector.png')});
  await page.locator('#hdv-text-apply').click();
  await page.waitForFunction(()=>window.organizerInstance.pages[0]?.textEdits?.length===1 &&
     !window.organizerInstance.activeEditDiv,{timeout:120000});
  await page.locator('#po-save').click();
  await page.locator('#po-save-confirm').click();
  await page.locator('#po-save-download-link:visible').waitFor({timeout:120000});
  const promise=page.waitForEvent('download',{timeout:120000});
  await page.locator('#po-save-download-link').click();
  const download=await promise;
  const saved=path.join(out,'output.pdf');
  await download.saveAs(saved);
  const pdf=await PDFJS.getDocument({data:new Uint8Array(fs.readFileSync(saved)),verbosity:0}).promise;
  let text;
  try{
   const pg=await pdf.getPage(1);
   text=(await pg.getTextContent()).items.map(i=>i.str).join(' ');
  }finally{await pdf.destroy();}
  assert.ok(text.includes('KM1+299.99'),text);
  assert.ok(!text.includes('KM1+260.65'),text);
  assert.ok(text.includes('KM1+261.65'),text);
  assert.deepEqual(errors,[],'standalone page and native worker should not throw browser errors');
  console.log(JSON.stringify({status:'PASS',checks:['standalone route','right CIT inspector',
   'PDF file opened','click native text','format via inspector','CIT PDFium commit',
   'PDF export','old text removed','other row unchanged'],output:out}));
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
