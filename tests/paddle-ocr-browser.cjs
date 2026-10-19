// Real OCR + editable results + searchable PDF, no mocked inference.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/paddle-ocr');fs.mkdirSync(out,{recursive:true});
 const port=Number(process.env.OCR_TEST_PORT||8093),base=`http://127.0.0.1:${port}`;
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<40;i++){try{if((await fetch(base+'/ocr.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().startsWith('http')&&!r.url().startsWith(base))external.push(r.url());});
  await page.goto(base+'/index.html');
  await page.getByRole('button',{name:/Nhận dạng văn bản OCR/}).click();
  await page.waitForURL('**/ocr.html');
  await page.goto(base+'/studio/ocr-pdf.html');await page.waitForURL('**/ocr.html');
  const input=await page.evaluate(async()=>{
   const font=new FontFace('Noto','url(./NotoSans-Regular.ttf)');await font.load();document.fonts.add(font);
   const c=document.createElement('canvas');c.width=1400;c.height=500;
   const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='40px Noto';
   x.fillText('HỒ SƠ THIẾT KẾ ĐƯỜNG GIAO THÔNG',40,90);x.fillText('Khối lượng bê tông: 125,50 m3',40,180);
   const d=await PDFLib.PDFDocument.create();const img=await d.embedPng(c.toDataURL());
   d.addPage([700,250]).drawImage(img,{x:0,y:0,width:700,height:250});
   d.addPage([700,250]).drawText('Existing native text stays unchanged',{x:30,y:160,size:20});
   d.addPage([700,250]).drawText('Outside selected range 98765',{x:30,y:160,size:20});
   return [...await d.save()];
  });
  fs.writeFileSync(path.join(out,'source.pdf'),Buffer.from(input));
  await page.locator('#file').setInputFiles({name:'scan-vietnamese.pdf',mimeType:'application/pdf',buffer:Buffer.from(input)});
  await page.waitForFunction(()=>!document.querySelector('#run').disabled);
  await page.locator('#pages').fill('1-2');
  await page.locator('#run').click();await page.locator('#cancel').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Đã hủy'));
  await page.locator('#run').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Hoàn tất:')||document.querySelector('#status').classList.contains('error'),{},{timeout:120000});
  assert.ok((await page.locator('#status').textContent()).startsWith('Hoàn tất:'),await page.locator('#status').textContent());
  const recognized=await page.locator('#lines textarea').evaluateAll(nodes=>nodes.map(n=>n.value));
  assert.ok(recognized.length>=2,JSON.stringify(recognized));assert.match(recognized.join(' '),/125[,.]50/);
  assert.ok(recognized.join(' ').includes('HỒ SƠ THIẾT KẾ ĐƯỜNG GIAO THÔNG'),JSON.stringify(recognized));
  assert.ok(recognized.join(' ').includes('Khối lượng bê tông'),JSON.stringify(recognized));
  fs.writeFileSync(path.join(out,'recognized.json'),JSON.stringify(recognized,null,2));
  const corrected='HỒ SƠ THIẾT KẾ ĐƯỜNG GIAO THÔNG';await page.locator('#lines textarea').first().fill(corrected);
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  const download=page.waitForEvent('download');await page.locator('#pdf').click();const saved=await download;
  await saved.saveAs(path.join(out,'searchable.pdf'));
  const outputBytes=fs.readFileSync(path.join(out,'searchable.pdf'));
  const check=await page.evaluate(async({source,output})=>{
   const a=await pdfjsLib.getDocument({data:new Uint8Array(source)}).promise;
   const b=await pdfjsLib.getDocument({data:new Uint8Array(output)}).promise;
   const texts=[];for(let n=1;n<=b.numPages;n++)texts.push((await(await b.getPage(n)).getTextContent()).items.map(x=>x.str).join(' '));
   async function render(doc){const p=await doc.getPage(1),v=p.getViewport({scale:1});const c=document.createElement('canvas');c.width=v.width;c.height=v.height;await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;return c.getContext('2d').getImageData(0,0,c.width,c.height).data;}
   const x=await render(a),y=await render(b);let diff=0;for(let i=0;i<x.length;i++)if(x[i]!==y[i])diff++;
   await a.destroy();await b.destroy();return {texts,diff};
  },{source:input,output:[...outputBytes]});
  assert.equal(check.texts.length,3);assert.ok(check.texts[0].includes(corrected),check.texts[0]);
  assert.match(check.texts[1],/Existing native text stays unchanged/);assert.match(check.texts[2],/Outside selected range 98765/);assert.equal(check.diff,0);
  const txtDownload=page.waitForEvent('download');await page.locator('#txt').click();const txt=await txtDownload;await txt.saveAs(path.join(out,'recognized.txt'));
  assert.ok(fs.readFileSync(path.join(out,'recognized.txt'),'utf8').includes(corrected));
  await page.setViewportSize({width:700,height:900});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({recognized,check,errors,external},null,2));
  console.log('PASS: actual Vietnamese OCR, cancellation/retry, correction, PDF/TXT export, unchanged pixels, page selection, native text, same-origin assets.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
