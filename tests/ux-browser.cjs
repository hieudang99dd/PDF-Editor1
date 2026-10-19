/* Browser E2E for PDF HVD workspace. Run with Playwright Chromium.
 * Verifies generated binary downloads and that the tool stays open afterward.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const PDFLib=require('../pdf-lib.min.js');
const root=path.resolve(__dirname,'..');

function site(){
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
   '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
   '.json':'application/json','.wasm':'application/wasm','.pdf':'application/pdf',
   '.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
 return http.createServer(async(req,res)=>{
   try{
     const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
     const local=pathname==='/'?'/index.html':pathname;
     const target=path.resolve(root,'.'+local);
     if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
     const body=await fsp.readFile(target);
     res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream',
       'Cache-Control':'no-store'});
     res.end(body);
   }catch(err){res.writeHead(404);res.end('Missing file');}
 });
}

async function vectorSample(){
 const doc=await PDFLib.PDFDocument.create();
 for(let i=0;i<2;i++){
  const p=doc.addPage([600,400]);
  if(i===1)p.setRotation(PDFLib.degrees(90)); // mixed portrait/landscape in one range
  p.drawLine({start:{x:30,y:200},end:{x:570,y:200},thickness:1,color:PDFLib.rgb(0,0,0)});
  p.drawLine({start:{x:30,y:70},end:{x:570,y:70},thickness:1,color:PDFLib.rgb(0,0,0)});
 }
 return Buffer.from(await doc.save());
}
async function sample(label){
 const doc=await PDFLib.PDFDocument.create();
 const page=doc.addPage([595,842]);
 page.drawText(label,{x:50,y:750,size:18});
 return Buffer.from(await doc.save());
}

(async()=>{
 const server=site();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address='http://127.0.0.1:'+server.address().port+'/';
 let browser;
 try{
   browser=await chromium.launch({headless:true});
   const page=await browser.newPage({viewport:{width:1280,height:800},acceptDownloads:true});
   const failures=[];
   page.on('pageerror',e=>failures.push(e.message));
   let acceptDialogs=true;
   page.on('dialog',dialog=>acceptDialogs?dialog.accept():dialog.dismiss());
   // The original link #hvd-tool=28 must open the new reviewed crop editor.
   await page.goto(address+'index.html?v=20261019-suite1&utm_source=chatgpt.com#hvd-tool=28',
     {waitUntil:'domcontentloaded'});
   await page.waitForURL('**/index.html?*#workspace=crop',{timeout:15000});
   assert.equal(new URL(page.url()).hash,'#workspace=crop');
   const cropFrame=page.frameLocator('#unified-frame');
   await cropFrame.locator('#crop-rectangle').waitFor({state:'attached'});
   assert.equal(await cropFrame.locator('#review').count(),1);
   await page.locator('#unified-ws').waitFor({state:'visible'});
   assert.equal(await page.locator('#home').isVisible(),false);
   await page.locator('#unified-home').click();
   await page.locator('button.catalog-tile').filter({hasText:'Quản lý trang PDF'}).first().click();
   await page.waitForFunction(()=>location.hash==='#workspace=pages');
   await page.frameLocator('#unified-frame').locator('#files').waitFor({state:'attached'});
   // Embedded page manager supplies its own back control; duplicate shell nav is hidden.
   assert.equal(await page.locator('#unified-ws .unified-toolbar').isVisible(),false);
   await page.frameLocator('#unified-frame').locator('.pm-back').click();
   await page.waitForURL('**/index.html?*');
   assert.equal(await page.locator('#unified-ws').isHidden(),true);
   await page.goto(address,{waitUntil:'domcontentloaded'});
   // The dedicated merge card was removed at user request; page manager retains merge.
   // Test binary download + in-place reset with the still-supported numbering tool.
   await page.locator('button.catalog-tile').filter({hasText:'Đánh số & đóng dấu'}).first().click();
   await page.locator('button.catalog-action').filter({hasText:'Đánh số trang'}).first().click();
   await page.locator('#ws').waitFor({state:'visible'});
   assert.match(new URL(page.url()).hash,/^#hvd-tool=\d+$/);
   await page.locator('#fi').setInputFiles({
     name:'two-pages.pdf',mimeType:'application/pdf',buffer:await vectorSample()
   });
   assert.equal(await page.locator('.files li').count(),1);
   await page.locator('#go').click();
   const downloadLink=page.locator('#out a[download]').first();
   await downloadLink.waitFor({state:'visible',timeout:30000});
   const wait=page.waitForEvent('download');
   await downloadLink.click();
   const download=await wait;
   const destination=path.join('/tmp','hvd-ux-numbered-'+process.pid+'.pdf');
   await download.saveAs(destination);
   const bytes=fs.readFileSync(destination);
   fs.unlinkSync(destination);
   assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');
   const numbered=await PDFLib.PDFDocument.load(bytes);
   assert.equal(numbered.getPageCount(),2);
   assert.ok(await page.locator('#ws').isVisible(),'workspace must remain open after binary download');
   assert.equal(await page.locator('.files li').count(),1,'selected input must survive download');
   await page.locator('#ws-refresh').click();
   assert.ok(await page.locator('#ws').isVisible());
   assert.equal(await page.locator('.files li').count(),1,'refresh should keep selected input');
   assert.equal(await page.locator('#out a[download]').count(),0,'refresh should clear old result');
   await page.locator('#ws-new').click();
   assert.equal(await page.locator('.files li').count(),0);
   assert.ok(await page.locator('#fi').count());
   await page.goBack({waitUntil:'domcontentloaded'});
   assert.ok(await page.locator('#home').isVisible(),'native Browser Back should return to catalog');
   await page.goForward({waitUntil:'domcontentloaded'});
   await page.locator('#ws').waitFor({state:'visible'});
   assert.equal(await page.locator('#wt').textContent(),'Đánh số trang');
   await page.setViewportSize({width:375,height:740});
   assert.ok(await page.locator('#refresh-app').isVisible(),'refresh must remain accessible on mobile');
   assert.ok(await page.locator('#ws-new').isVisible(),'New File action must remain accessible on mobile');
   await page.setViewportSize({width:1280,height:800});
   // Organizer: a real new-document reset must unload the PDF but preserve
   // the active feature; cancellation must leave its editor state intact.
   await page.goto(address,{waitUntil:'domcontentloaded'});
   await page.evaluate(() => openTool(T.findIndex(t=>t[0]==='Chỉnh sửa PDF')));
   await page.locator('#fi').setInputFiles({
     name:'sample-original.pdf',mimeType:'application/pdf',buffer:await sample('Document original')
   });
   await page.locator('#go').click();
   await page.locator('#po-ws').waitFor({state:'visible',timeout:30000});
   assert.ok(await page.locator('#po-new-document').isVisible());
   assert.ok(await page.locator('#po-back').isVisible());
   assert.match((await page.locator('#po-back').innerText()).trim(),/Danh mục công cụ/);
   assert.match((await page.locator('#po-tb-reset').innerText()).trim(),/Hoàn nguyên trang/);
   assert.equal(await page.locator('#po-meta-title').innerText(),'sample-original');
   const loaded=await page.evaluate(()=>window.organizerInstance.files.length);
   assert.equal(loaded,1);

   // Declining an explicit reset must keep the source, pages, and output.
   acceptDialogs=false;
   await page.locator('#po-new-document').click();
   acceptDialogs=true;
   assert.ok(await page.locator('#po-ws').isVisible(),'cancel must retain open document');
   assert.equal(await page.evaluate(()=>window.organizerInstance.files.length),1);
   await page.locator('#po-new-document').click();
   await page.locator('#po-initial-upload').waitFor({state:'visible'});
   assert.ok(await page.locator('#po-new-document').isVisible());
   assert.ok(await page.locator('#po-back').isVisible());
   assert.equal(await page.evaluate(()=>window.organizerInstance.files.length),0);
   assert.equal(await page.evaluate(()=>window.organizerInstance.pages.length),0);
   assert.ok(await page.locator('#po-save').isDisabled());
   assert.ok(await page.locator('#po-ws').isHidden());
   await page.locator('#po-file-input').setInputFiles({
     name:'another-file.pdf',mimeType:'application/pdf',buffer:await sample('Second document')
   });
   await page.locator('#po-ws').waitFor({state:'visible',timeout:30000});
   assert.equal(await page.locator('#po-meta-title').innerText(),'another-file');
   assert.ok(await page.locator('.po-header').isVisible());
   // The Organizer must remain a text/page editing tool, with no vector eraser plugin.
   assert.equal(await page.locator('#po-tb-region').count(),0,
     'vector region eraser must NOT be embedded inside PDF Organizer');
   // The new standalone route loads its own PDF, preview, zones and save workflow.
   await page.goto(address,{waitUntil:'domcontentloaded'});
   await page.locator('.tool').filter({hasText:'Xóa vector theo vùng'}).first().click();
   await page.waitForFunction(()=>location.hash==='#workspace=region');
   await page.frameLocator('#unified-frame').locator('#re-uploader').waitFor({state:'visible'});
   // Validate engine internals directly after proving it is embedded in the unified shell.
   await page.goto(address+'region-eraser.html',{waitUntil:'domcontentloaded'});
   await page.locator('#re-uploader').waitFor({state:'visible'});
   assert.ok(await page.locator('#re-dropzone').isVisible());
   await page.locator('#re-input').setInputFiles({
      name:'cad-linework.pdf',mimeType:'application/pdf',buffer:await vectorSample()
   });
   await page.locator('#re-workspace').waitFor({state:'visible',timeout:30000});
   await page.locator('#re-gallery-panel').waitFor({state:'visible'});
   assert.equal(await page.locator('.re-page-card').count(),2,'2-page PDF should show page storyboard');
   const galleryLayout=await page.evaluate(()=>{
     const h=document.querySelector('.re-gallery-head').getBoundingClientRect();
     const grid=document.getElementById('re-gallery-grid');
     const g=grid.getBoundingClientRect();
     return {locked:document.body.classList.contains('re-workspace-open'),
       documentScroll:document.documentElement.scrollHeight-innerHeight,
       galleryOverflow:getComputedStyle(grid).overflowY,
       gridTop:g.top,headBottom:h.bottom,gridBottom:g.bottom};
   });
   assert.equal(galleryLayout.locked,true,'PDF workspace should lock browser scrolling');
   assert.ok(galleryLayout.documentScroll<=3,'document must not overflow while storyboard is open');
   assert.equal(galleryLayout.galleryOverflow,'auto','only page tiles should scroll in gallery');
   assert.ok(galleryLayout.gridBottom<=800&&galleryLayout.gridTop>=galleryLayout.headBottom-2,
     'gallery cards must remain inside fixed available height');
   assert.equal(await page.locator('#re-download').isDisabled(),true,'Export must remain locked before Apply');
   assert.match(await page.locator('#re-process').innerText(),/Áp dụng/);
   assert.doesNotMatch(await page.locator('#re-process').innerText(),/xuất/i);
   await page.locator('.re-page-card').first().click();
   await page.locator('#re-editor-view').waitFor({state:'visible'});
   assert.ok(await page.locator('#re-gallery-back').isVisible());
   await page.waitForFunction(()=>{
     const c=document.getElementById('re-canvas'),s=document.getElementById('re-page-surface');
     return c&&c.width>200&&c.height>100&&s.getBoundingClientRect().width>100;
   },{timeout:30000});
   // Compact editor must keep the FULL PDF sheet inside the fixed viewport,
   // not merely fit its width (which clips top/bottom on landscape CAD sheets).
   const fitted=async()=>{
    return page.evaluate(()=>{
     const vp=document.getElementById('re-viewport'),
       pageSurface=document.getElementById('re-page-surface');
     const css=getComputedStyle(vp);
     const paddingX=(parseFloat(css.paddingLeft)||0)+(parseFloat(css.paddingRight)||0);
     const paddingY=(parseFloat(css.paddingTop)||0)+(parseFloat(css.paddingBottom)||0);
     const p=pageSurface.getBoundingClientRect(),v=vp.getBoundingClientRect();
     return {
      width:p.width,height:p.height,
      usableWidth:vp.clientWidth-paddingX,
      usableHeight:vp.clientHeight-paddingY,
      top:p.top,bottom:p.bottom,left:p.left,right:p.right,
      vpTop:v.top,vpBottom:v.bottom,vpLeft:v.left,vpRight:v.right,
      viewportWidth:vp.clientWidth
     };
    });
   };
   await page.waitForFunction(()=>{
     const vp=document.getElementById('re-viewport'),sheet=document.getElementById('re-page-surface'),
       css=getComputedStyle(vp);
     return sheet.clientWidth<=vp.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)+1 &&
       sheet.clientHeight<=vp.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)+1;
   },{timeout:30000});
   const pageFit=await fitted();
   assert.ok(pageFit.top>=pageFit.vpTop-3&&pageFit.bottom<=pageFit.vpBottom+3,
     'page-fit must display both top and bottom of landscape sheet');
   assert.ok(pageFit.left>=pageFit.vpLeft-3&&pageFit.right<=pageFit.vpRight+3,
     'page-fit must display both left and right of landscape sheet');
   assert.ok(pageFit.vpTop<310,'compact top bars must leave adequate vertical drawing space');
   assert.equal(await page.locator('#re-fit').getAttribute('aria-pressed'),'true');
   await page.locator('#re-fit-width').click();
   await page.waitForFunction(()=>{
    const vp=document.getElementById('re-viewport'),sheet=document.getElementById('re-page-surface');
    return sheet.clientHeight>vp.clientHeight+15;
   },{timeout:30000});
   assert.equal(await page.locator('#re-fit-width').getAttribute('aria-pressed'),'true');
   await page.locator('#re-fit').click();
   await page.waitForFunction(()=>{
    const vp=document.getElementById('re-viewport'),sheet=document.getElementById('re-page-surface');
    return sheet.clientHeight<=vp.clientHeight-10;
   },{timeout:30000});
   await page.locator('#re-toggle-tools').click();
   assert.ok(await page.locator('.re-tools').isHidden(),'focus view should hide only the task sidebar');
   const fullWidth=await fitted();
   assert.ok(fullWidth.viewportWidth>pageFit.viewportWidth+140,
     'hiding task sidebar must allocate more width to the PDF');
   assert.equal(await page.locator('#re-toggle-tools').getAttribute('aria-pressed'),'true');
   await page.locator('#re-toggle-tools').click();
   assert.ok(await page.locator('.re-tools').isVisible(),'task sidebar must be recoverable');
   assert.equal(await page.locator('#re-toggle-tools').getAttribute('aria-pressed'),'false');
   // Responsive changes must recompute real page fitting, preserving the overlay.
   await page.setViewportSize({width:1000,height:700});
   await page.waitForFunction(()=>{
    const vp=document.getElementById('re-viewport'),sheet=document.getElementById('re-page-surface');
    return sheet.clientWidth<=vp.clientWidth+1&&sheet.clientHeight<=vp.clientHeight+1;
   },{timeout:30000});
   assert.equal(await page.evaluate(()=>window.scrollY),0);
   await page.setViewportSize({width:1280,height:800});
   await page.locator('#re-fit').click();
   const lockedLayout=await page.evaluate(()=>{
     const tools=document.querySelector('.re-tools'),preview=document.querySelector('.re-preview');
     const viewport=document.getElementById('re-viewport');
     const shell=document.querySelector('.re-preview-toolbar'),footer=document.querySelector('.re-footer-info');
     const a=tools.getBoundingClientRect(),b=preview.getBoundingClientRect();
     return {documentScroll:document.documentElement.scrollHeight-innerHeight,
       toolsTop:a.top,previewTop:b.top,toolsHeight:a.height,previewHeight:b.height,
       toolsScrollable:tools.scrollHeight>tools.clientHeight+5,
       toolsOverflow:getComputedStyle(tools).overflowY,
       pdfOverflow:getComputedStyle(viewport).overflowY,
       previewBottom:b.bottom, toolbarTop:shell.getBoundingClientRect().top,
       footerBottom:footer.getBoundingClientRect().bottom};
   });
   assert.ok(lockedLayout.documentScroll<=3,'browser itself must not scroll in editor mode');
   assert.ok(Math.abs(lockedLayout.toolsTop-lockedLayout.previewTop)<=2,'fixed panes share the same top edge');
   assert.ok(Math.abs(lockedLayout.toolsHeight-lockedLayout.previewHeight)<=2,'panes share the same height');
   assert.ok(lockedLayout.toolsHeight>200&&lockedLayout.previewBottom<=800,
     'both panes are confined to the visible viewport');
   assert.equal(lockedLayout.toolsOverflow,'auto','task actions scroll internally');
   assert.equal(lockedLayout.pdfOverflow,'auto','PDF canvas scrolls internally');
   assert.ok(lockedLayout.toolsScrollable,'long task options must have their own scrollable area');
   const beforeScroll=await page.locator('.re-tools').evaluate(el=>el.scrollTop);
   await page.locator('.re-tools').evaluate(el=>el.scrollTop=300);
   assert.ok(await page.locator('.re-tools').evaluate(el=>el.scrollTop)>beforeScroll+100);
   assert.equal(await page.evaluate(()=>window.scrollY),0,'scrolling task options cannot move top controls');
   await page.locator('.re-tools').evaluate(el=>el.scrollTop=0);
   // Zoom the page to force independent canvas scroll, keeping header/footer pinned.
   await page.locator('#re-zoom-in').click();
   await page.locator('#re-zoom-in').click();
   const pdfScroll=await page.locator('#re-viewport').evaluate(el=>{
     const over=el.scrollWidth>el.clientWidth+3||el.scrollHeight>el.clientHeight+3;
     el.scrollTop=80;el.scrollLeft=60;
     return {over,top:el.scrollTop,left:el.scrollLeft};
   });
   assert.equal(pdfScroll.over,true,'zoomed drawing should overflow only its PDF viewport');
   assert.ok(pdfScroll.top>0||pdfScroll.left>0,'PDF scrolling must work');
   assert.equal(await page.evaluate(()=>window.scrollY),0);
   await page.locator('#re-fit').click();
   async function drawZone(x0,x1,role,y0=.39,y1=.61){
     if(await page.locator('#re-role').isEnabled())await page.locator('#re-role').selectOption(role);
     await page.locator('#re-shape').selectOption('rect');
     await page.locator('#re-draw').click();
     const box=await page.locator('#re-overlay').boundingBox();
     assert.ok(box&&box.width>100&&box.height>100,'standalone overlay must cover rendered PDF');
     await page.mouse.move(box.x+box.width*x0,box.y+box.height*y0);
     await page.mouse.down();
     await page.mouse.move(box.x+box.width*x1,box.y+box.height*y1,{steps:8});
     await page.mouse.up();
   }
   assert.equal(await page.locator('#re-object-mode').inputValue(),'whole-object');
   assert.ok(await page.locator('#re-allow-signed').count());
   // Preserve the previous precision workflow as its own explicit mode.
   await page.locator('#re-object-mode').selectOption('precise');
   await page.locator('#re-operation').selectOption('between');
   await drawZone(.3,.7,'erase');
   assert.equal(await page.locator('.re-zone').count(),1);
   await page.locator('#re-undo').click();
   assert.equal(await page.locator('.re-zone').count(),0,'standalone Undo must restore zone edits');
   await page.locator('#re-redo').click();
   assert.equal(await page.locator('.re-zone').count(),1,'standalone Redo must reapply zone edits');
   // Automatically expose draggable vertex/edge handles after drawing.
   assert.equal(await page.locator('.re-edit-grip-vertex').count(),4);
   assert.equal(await page.locator('.re-edit-grip-edge').count(),4);
   const initial=await page.locator('.re-zone-selected').getAttribute('points');
   const vertex=await page.locator('.re-edit-grip-vertex').first().boundingBox();
   assert.ok(vertex && vertex.width>5,'vertex handles must be visible and clickable');
   await page.mouse.move(vertex.x+vertex.width/2,vertex.y+vertex.height/2);
   await page.mouse.down();
   await page.mouse.move(vertex.x+vertex.width/2-16,vertex.y+vertex.height/2-9,{steps:9});
   await page.mouse.up();
   const moved=await page.locator('.re-zone-selected').getAttribute('points');
   assert.notEqual(moved,initial,'dragging a vertex must change actual region geometry');
   await page.locator('#re-undo').click();
   assert.equal(await page.locator('.re-zone-selected').getAttribute('points'),initial,
     'one Undo reverts the whole drag, not its individual pointermove frames');
   await page.locator('#re-redo').click();
   assert.equal(await page.locator('.re-zone-selected').getAttribute('points'),moved);
   // Drag the entire top edge (two corners should move together).
   const edge=await page.locator('.re-edit-grip-edge').first().boundingBox();
   assert.ok(edge && edge.width>4,'edge midpoint handle must exist');
   const beforeEdge=await page.locator('.re-zone-selected').getAttribute('points');
   await page.mouse.move(edge.x+edge.width/2,edge.y+edge.height/2);
   await page.mouse.down();
   await page.mouse.move(edge.x+edge.width/2,edge.y+edge.height/2-9,{steps:6});
   await page.mouse.up();
   assert.notEqual(await page.locator('.re-zone-selected').getAttribute('points'),beforeEdge,
     'dragging a segment must change region boundary');
   await page.locator('#re-undo').click();
   assert.equal(await page.locator('.re-zone-selected').getAttribute('points'),beforeEdge);
   await page.locator('#re-redo').click();
   await drawZone(.43,.57,'erase',.44,.56);
   // Selecting another zone by its task-list row repositions the grips.
   await page.getByRole('button',{name:'Chỉnh sửa đường bao vùng 1'}).click();
   assert.equal(await page.locator('.re-zone-selected').count(),1);
   await page.getByRole('button',{name:'Chỉnh sửa đường bao vùng 2'}).click();
   assert.equal(await page.locator('.re-edit-grip-vertex').count(),4);
   assert.equal(await page.locator('.re-zone').count(),2);
   await page.locator('#re-scope').selectOption('range');
   await page.locator('#re-range-from').fill('1');
   await page.locator('#re-range-to').fill('2');
   await page.locator('#re-process').click();
   await page.locator('#re-results').waitFor({state:'visible',timeout:120000});
   const afterApplyLayout=await page.evaluate(()=>{
     const a=document.querySelector('.re-tools').getBoundingClientRect();
     const b=document.querySelector('.re-preview').getBoundingClientRect();
     const report=document.getElementById('re-results');
     const vp=document.getElementById('re-viewport').getBoundingClientRect();
     const box=report.getBoundingClientRect();
     const footer=document.querySelector('.re-footer-info').getBoundingClientRect();
     const inline=document.getElementById('re-editor-status');
     const toast=document.getElementById('re-status');
     return {a:a.height,b:b.height,position:getComputedStyle(report).position,
       reportInSidebar:document.querySelector('.re-tools').contains(report),
       reportRight:box.right,viewportLeft:vp.left,footerTop:footer.top,
       viewportBottom:vp.bottom,inlineVisible:inline.getBoundingClientRect().width>0,
       floatingToastHidden:getComputedStyle(toast).display==='none',
       documentScroll:document.documentElement.scrollHeight-innerHeight};
   });
   assert.ok(Math.abs(afterApplyLayout.a-lockedLayout.toolsHeight)<=2,
      'review result must not change the panel height');
   assert.ok(Math.abs(afterApplyLayout.b-lockedLayout.previewHeight)<=2);
   assert.equal(afterApplyLayout.position,'static','result report must not float above PDF');
   assert.equal(afterApplyLayout.reportInSidebar,true,'result report must belong to task panel');
   assert.ok(afterApplyLayout.reportRight<=afterApplyLayout.viewportLeft+2,
      'result report must not overlap PDF drawing');
   assert.ok(afterApplyLayout.footerTop>=afterApplyLayout.viewportBottom-2,
      'status bar stays below PDF viewport');
   assert.equal(afterApplyLayout.inlineVisible,true);
   assert.equal(afterApplyLayout.floatingToastHidden,true,'old toast should be hidden in editor');
   assert.match(await page.locator('#re-editor-status').innerText(),/Đã áp dụng/);
   assert.ok(afterApplyLayout.documentScroll<=3);
   assert.match(await page.locator('#re-result-summary').innerText(),/PATH/);
   assert.equal(await page.locator('#re-download').isEnabled(),true,'Export unlocks only after PDFium Apply succeeds');
   assert.equal(await page.locator('#re-process').isDisabled(),true,'cannot apply an already reviewed snapshot');
   assert.equal(await page.locator('#re-draw').isDisabled(),true,'must explicitly Rework before changing zones');
   assert.ok(await page.locator('#re-rework').isVisible(),'Rework action should be available after applying');
   await page.locator('#re-toggle-tools').click();
   assert.ok(await page.locator('.re-tools').isHidden());
   assert.ok(await page.locator('#re-rework').isVisible(),
     'Rework button stays accessible above the PDF in focus mode');
   await page.locator('#re-toggle-tools').click();
   assert.match(await page.locator('#re-step-review').getAttribute('class'),/active/);
   assert.ok(await page.locator('#re-review-switch').isVisible(),'real output review should be shown immediately');
   assert.ok(await page.locator('#re-overlay').isHidden(),'region overlay must not impersonate the processed PDF');
   await page.locator('#re-before').click();
   assert.ok(await page.locator('#re-overlay').isVisible(),'before mode returns to the original PDF');
   await page.locator('#re-after').click();
   assert.ok(await page.locator('#re-overlay').isHidden(),'after mode must show real processed PDF');
   // Review result is NOT exported yet. Rework must discard the old output
   // without deleting the two drawn zones or leaving the editor.
   await page.locator('#re-rework').click();
   assert.equal(await page.locator('#re-download').isDisabled(),true,'stale result cannot be exported');
   assert.equal(await page.locator('#re-results').isHidden(),true,'old preview is invalidated on Rework');
   assert.equal(await page.locator('.re-zone').count(),2,'Rework preserves original region geometry');
   assert.equal(await page.locator('#re-process').isEnabled(),true);
   assert.equal(await page.locator('#re-draw').isEnabled(),true);
   await page.locator('#re-undo').click();
   assert.equal(await page.locator('.re-zone').count(),1,'can edit region history after Rework');
   await page.locator('#re-redo').click();
   assert.equal(await page.locator('.re-zone').count(),2);
   await page.locator('#re-process').click();
   await page.locator('#re-results').waitFor({state:'visible',timeout:120000});
   assert.equal(await page.locator('#re-download').isEnabled(),true);
   assert.match(await page.locator('#re-step-review').getAttribute('class'),/active/);
   const nativeWait=page.waitForEvent('download',{timeout:30000});
   await page.locator('#re-download').click();
   const nativeFile=await nativeWait;
   assert.match(await page.locator('#re-step-export').getAttribute('class'),/active/);
   const nativePath=path.join('/tmp','hvd-region-'+process.pid+'.pdf');
   await nativeFile.saveAs(nativePath);
   const nativeBytes=fs.readFileSync(nativePath);fs.unlinkSync(nativePath);
   assert.equal(nativeBytes.subarray(0,5).toString('ascii'),'%PDF-');
   assert.equal((await PDFLib.PDFDocument.load(nativeBytes)).getPageCount(),2);
   const {PdfEngine}=await import('../vendor/cit-pdf/editcore/core.js');
   const inspected=await PdfEngine.create();
   try{
     inspected.open(new Uint8Array(nativeBytes));
     for(let i=0;i<2;i++){
      inspected.loadPage(i);
      const vectorPaths=Array.from({length:inspected.objectCount()},(_,j)=>inspected.objectAt(j))
        .filter(obj=>obj?.type===2);
      assert.ok(vectorPaths.length>=4,'page '+(i+1)+' must contain native split paths after range operation');
     }
   }finally{inspected.close();}
   assert.ok(await page.locator('#re-workspace').isVisible(),'download must keep standalone tool open');
   await page.locator('#re-new').click();
   await page.locator('#re-uploader').waitFor({state:'visible'});
   assert.equal(await page.locator('.re-zone').count(),0);
   assert.match(page.url(),/region-eraser\.html/,'reset must remain inside standalone route');
   // Whole-object mode must physically remove text, not simply cover it.
   await page.locator('#re-input').setInputFiles({
     name:'text-report.pdf',mimeType:'application/pdf',buffer:await sample('DELETE TEXT IN BOX')
   });
   await page.locator('#re-gallery-panel').waitFor({state:'visible'});
   await page.locator('.re-page-card').first().click();
   await page.locator('#re-editor-view').waitFor({state:'visible'});
   assert.equal(await page.locator('#re-object-mode').inputValue(),'whole-object');
   assert.equal(await page.locator('#re-download').isDisabled(),true,'reset must discard prior export');
   await drawZone(.04,.65,'erase',.07,.20);
   await page.locator('#re-process').click();
   await page.locator('#re-results').waitFor({state:'visible',timeout:120000});
   assert.match(await page.locator('#re-result-summary').innerText(),/đối tượng PDF được gỡ/);
   assert.ok(await page.locator('#re-download').isEnabled());
   const textDownload=page.waitForEvent('download',{timeout:30000});
   await page.locator('#re-download').click();
   const textFile=await textDownload;
   const textPath=path.join('/tmp','hvd-text-erase-'+process.pid+'.pdf');
   await textFile.saveAs(textPath);
   const textBytes=fs.readFileSync(textPath);fs.unlinkSync(textPath);
   const verify=await PdfEngine.create();
   try{
    verify.open(new Uint8Array(textBytes));verify.loadPage(0);
    const textCount=Array.from({length:verify.objectCount()},(_,i)=>verify.objectAt(i))
       .filter(o=>o?.type===1).length;
    assert.equal(textCount,0,'selected text objects must be physically removed from PDF content stream');
   }finally{verify.close();}
   assert.deepEqual(failures,[],'No new browser JS errors');
   console.log('PASS: separate vector region eraser route + binary PDFium output + independent reset + Organizer regression');
 }finally{
   await browser?.close();
   await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
