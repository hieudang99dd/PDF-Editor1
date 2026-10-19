const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');const {chromium}=require('playwright');const PDFLib=require('../pdf-lib.min.js');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/signature');fs.mkdirSync(out,{recursive:true});
 const base=process.env.SIGN_LIVE_BASE||'http://127.0.0.1:8098';const server=process.env.SIGN_LIVE_BASE?null:spawn('python3',['-m','http.server','8098','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
 try{
  if(server)for(let i=0;i<40;i++){try{if((await fetch(base+'/sign.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const proxy=process.env.SIGN_LIVE_BASE&&process.env.HTTPS_PROXY?new URL(process.env.HTTPS_PROXY):null;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox'],...(proxy?{proxy:{server:proxy.protocol+'//'+proxy.host,username:decodeURIComponent(proxy.username),password:decodeURIComponent(proxy.password)}}:{})});
  const page=await browser.newPage({viewport:{width:1500,height:1100},acceptDownloads:true,ignoreHTTPSErrors:!!proxy});const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().startsWith('http')&&!r.url().startsWith(base))external.push(r.url());});
  await page.goto(base+'/index.html');await page.getByRole('button',{name:/Chèn chữ ký/}).click();await page.waitForURL('**/sign.html');
  const pdf=await PDFLib.PDFDocument.create();for(let i=0;i<4;i++){const p=pdf.addPage([420,600]);p.setCropBox(30,40,360,520);p.setRotation(PDFLib.degrees(i*90));p.drawText('SIGNATURE TEST PAGE '+(i+1),{x:50,y:400,size:14});p.drawRectangle({x:60,y:200,width:60,height:40,color:PDFLib.rgb(.9,.5,.1)});}
  const field=pdf.getForm().createTextField('existing-field');field.setText('Preserve existing form');field.addToPage(pdf.getPage(0),{x:60,y:300,width:220,height:25});
  const source=await pdf.save();fs.writeFileSync(path.join(out,'source.pdf'),source);
  await page.locator('#file').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from(source)});await page.waitForFunction(()=>document.querySelector('#filename').textContent==='test.pdf'&&!document.querySelector('#use').disabled);
  // Real pointer strokes through upstream Signature Pad.
  const pad=await page.locator('#pad').boundingBox();await page.mouse.move(pad.x+20,pad.y+60);await page.mouse.down();for(let i=0;i<18;i++)await page.mouse.move(pad.x+20+i*9,pad.y+60+Math.sin(i)*18);await page.mouse.up();
  await page.locator('#use').click();await page.waitForFunction(()=>!document.querySelector('#add').disabled);await page.locator('#add').click();await page.waitForSelector('.sig-box');
  await page.locator('.sig-box').scrollIntoViewIfNeeded();const before=await page.locator('.sig-box').boundingBox();await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(before.x+before.width/2-35,before.y+before.height/2-45,{steps:5});await page.mouse.up();
  const after=await page.locator('.sig-box').boundingBox();assert.ok(after.x<before.x-25&&after.y<before.y-35,'Dragging failed '+JSON.stringify({before,after}));
  await page.locator('#width').fill('55');await page.locator('#width').dispatchEvent('change');await page.locator('#repeat').click();
  const placements=[];
  for(let i=1;i<=4;i++){await page.locator(`#pages button[data-page="${i}"]`).click();await page.waitForFunction(n=>document.querySelector('#page-title').textContent.startsWith('Trang '+n+'/'),i);const pos=await page.locator('.sig-box').evaluate(el=>({left:parseFloat(el.style.left)/100,top:parseFloat(el.style.top)/100,width:parseFloat(el.style.width)/100,height:parseFloat(el.style.height)/100}));placements.push(pos);}
  fs.writeFileSync(path.join(out,'placements.json'),JSON.stringify(placements));
  await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#export').disabled);assert.equal(await page.locator('.sig-box').count(),0);
  let download=page.waitForEvent('download');await page.locator('#export').click();await(await download).saveAs(path.join(out,'visual.pdf'));
  await page.locator('#digital-panel').evaluate(el=>el.open=true);await page.locator('#digital').check();await page.locator('#certificate').setInputFiles(path.join(out,'valid.p12'));await page.locator('#password').fill('wrong');await page.locator('#inspect').click();await page.waitForFunction(()=>document.querySelector('#status').classList.contains('error'));assert.match(await page.locator('#status').textContent(),/Không mở được chứng thư/);
  await page.locator('#password').fill('test-password');await page.locator('#inspect').click();await page.waitForFunction(()=>document.querySelector('#cert-info').textContent.includes('PDF Editor QA Certificate'));await page.waitForFunction(()=>!document.querySelector('#apply').disabled);
  await page.locator('#reason').fill('Phê duyệt hồ sơ kỹ thuật');await page.locator('#location').fill('Thành phố Hồ Chí Minh');
  await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#export').disabled);download=page.waitForEvent('download');await page.locator('#export').click();await(await download).saveAs(path.join(out,'signed.pdf'));assert.equal(await page.locator('#password').inputValue(),'');
  await page.locator('#certificate').setInputFiles(path.join(out,'identity.pem'));await page.locator('#password').fill('test-password');await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#export').disabled);download=page.waitForEvent('download');await page.locator('#export').click();await(await download).saveAs(path.join(out,'signed-pem.pdf'));
  // Signed input must be viewable and downloadable byte-for-byte, not rewritten.
  await page.locator('#file').setInputFiles(path.join(out,'signed.pdf'));
  await page.waitForFunction(()=>document.querySelector('#document-mode').textContent.includes('chữ ký số')&&
    !document.querySelector('#document-mode').hidden&&
    !document.querySelector('#download-source').disabled);
  assert.ok(await page.locator('#apply').isDisabled());
  assert.ok(await page.locator('#export').isDisabled());
  const signedOriginalDownload=page.waitForEvent('download');
  await page.locator('#download-source').click();
  await(await signedOriginalDownload).saveAs(path.join(out,'signed-preserved.pdf'));
  assert.deepEqual(fs.readFileSync(path.join(out,'signed-preserved.pdf')),fs.readFileSync(path.join(out,'signed.pdf')),'Signed original must not change a byte');
  assert.ok((await page.locator('#page-title').textContent()).includes('Trang 1/4'));
  // Unsupported office files are selected but clearly rejected (never misrepresented as PDF).
  await page.locator('#file').setInputFiles({name:'office.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('PK unsupported fixture')});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('chưa chuyển được sang PDF'));
  assert.ok(await page.locator('#apply').isDisabled());
  // Expired credentials never sign a document.
  await page.locator('#certificate').setInputFiles(path.join(out,'expired.p12'));await page.locator('#password').fill('test-password');await page.locator('#inspect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('hết hạn'));
  await page.locator('#reset').click();assert.equal(await page.locator('#certificate').inputValue(),'');
  await page.locator('#file').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from(source)});await page.waitForFunction(()=>!document.querySelector('#use').disabled&&document.querySelector('#filename').textContent==='test.pdf');
  await page.locator('#mode').selectOption('type');await page.locator('#typed').fill('Nguyễn Văn Hiếu');await page.locator('#use').click();await page.waitForFunction(()=>!document.querySelector('#add').disabled);await page.locator('#add').click();await page.waitForSelector('.sig-box');await page.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#export').disabled);download=page.waitForEvent('download');await page.locator('#export').click();await(await download).saveAs(path.join(out,'typed.pdf'));
  await page.locator('#original').click();await page.waitForSelector('.sig-box');
  const signature=await page.locator('#asset').getAttribute('src');const image=Buffer.from(signature.split(',')[1],'base64');await page.locator('#mode').selectOption('image');await page.locator('#image').setInputFiles({name:'signature.png',mimeType:'image/png',buffer:image});await page.waitForFunction(()=>document.querySelector('#asset-status').textContent.includes('Đã chọn ảnh'));await page.locator('#remove-white').check();await page.locator('#use').click();await page.waitForFunction(()=>!document.querySelector('#add').disabled);
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS: draw/drag/resize/repeat, rotated CropBox pages, apply/export, RSA P12+PEM, wrong password, expired certificate, signed-input block, typed Vietnamese, image signature, mobile and same-origin.');
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exit(1);});
