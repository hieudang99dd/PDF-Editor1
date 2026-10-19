'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const PDFLib=require('../pdf-lib.min.js');
const root=path.resolve(__dirname,'..');
const core=()=>import(pathToFileURL(path.join(root,'pdf-crop-core.mjs')).href);
test('normalized crops validate, preserve margins and reject degenerate rectangles',async()=>{
 const {normalizeRect,toMargins,fromMargins,isFullPage,viewportCropRect}=await core();
 const r=normalizeRect({x:.85,y:.9},{x:.12,y:.18});
 assert.ok(Math.abs(r.x-.12)<1e-10&&Math.abs(r.h-.72)<1e-10);
 const a=toMargins(fromMargins({left:.12,top:.11,right:.07,bottom:.06}));
 assert.ok(Math.abs(a.left-.12)<1e-8&&Math.abs(a.bottom-.06)<1e-8);
 assert.equal(isFullPage({x:0,y:0,w:1,h:1}),true);
 assert.throws(()=>fromMargins({left:.7,right:.5}),/Vùng cắt/);
 assert.throws(()=>normalizeRect({x:.2,y:.2},{x:.21,y:.21}),/quá nhỏ/);
});
test('PDF.js rotated viewport maps four corners back to unrotated PDF space',async()=>{
 const {viewportCropRect}=await core();
 const media={x:10,y:20,width:600,height:800};
 const box={x:.1,y:.2,w:.7,h:.6};
 const vp0={width:600,height:800,convertToPdfPoint:(x,y)=>[x+10,820-y]};
 const q0=viewportCropRect(vp0,box,media,media);
 assert.ok(Math.abs(q0.x-70)<.001&&Math.abs(q0.y-180)<.001);
 assert.ok(Math.abs(q0.width-420)<.001&&Math.abs(q0.height-480)<.001);
 const vp90={width:800,height:600,convertToPdfPoint:(x,y)=>[10+y,20+x]};
 const q90=viewportCropRect(vp90,box,media,media);
 assert.ok(Math.abs(q90.x-130)<.001&&Math.abs(q90.y-100)<.001);
 assert.ok(Math.abs(q90.width-360)<.001&&Math.abs(q90.height-560)<.001);
 const vp180={width:600,height:800,convertToPdfPoint:(x,y)=>[610-x,20+y]};
 const q180=viewportCropRect(vp180,box,media,media);
 assert.ok(Math.abs(q180.x-130)<.001&&Math.abs(q180.y-180)<.001);
 const vp270={width:800,height:600,convertToPdfPoint:(x,y)=>[610-y,820-x]};
 const q270=viewportCropRect(vp270,box,media,media);
 assert.ok(Math.abs(q270.x-130)<.001&&Math.abs(q270.y-180)<.001);
 assert.throws(()=>viewportCropRect(vp0,{x:.5,y:.5,w:0,h:0},media,media),/Vùng cắt/);
});
test('existing non-zero CropBox and MediaBox enforce strict intersection',async()=>{
 const {viewportCropRect}=await core();
 const media={x:-30,y:15,width:700,height:950};
 const crop={x:35,y:45,width:300,height:500};
 const vp={width:300,height:500,convertToPdfPoint:(x,y)=>[35+x,545-y]};
 const actual=viewportCropRect(vp,{x:.1,y:.1,w:.8,h:.8},media,crop);
 assert.deepEqual(actual,{x:65,y:95,width:240,height:400});
 const expanded=viewportCropRect(vp,{x:0,y:0,w:1,h:1},media,crop);
 assert.deepEqual(expanded,crop);
});
test('auto margin ignores blank pages, detects graphical ink and retains safety padding',async()=>{
 const {findInkBounds}=await core();
 const w=600,h=400,data=new Uint8ClampedArray(w*h*4);data.fill(255);
 const image={width:w,height:h,data};
 assert.equal(findInkBounds(image),null);
 for(let y=75;y<335;y++)for(let x=90;x<530;x++){const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=40;}
 const found=findInkBounds(image,{pad:.03});
 assert.ok(found.x<.15&&found.y<.1875&&found.x+found.w>.883&&found.y+found.h>.835,JSON.stringify(found));
});
test('exported PDF CropBox is reversible, retains MediaBox and page count',async()=>{
 const {viewportCropRect,describeChanges,almostEqualBox}=await core();
 const original=await PDFLib.PDFDocument.create();
 const font=await original.embedFont(PDFLib.StandardFonts.Helvetica);
 const a=original.addPage([600,800]);a.drawText('KEEP ORIGINAL VECTOR TEXT',{x:120,y:320,font,size:14});
 const b=original.addPage([500,600]);b.drawLine({start:{x:10,y:50},end:{x:490,y:50},thickness:2});
 b.setRotation(PDFLib.degrees(90));
 const source=await PDFLib.PDFDocument.load(await original.save());
 const old=source.getPage(0).getCropBox();
 const viewport={width:600,height:800,convertToPdfPoint:(x,y)=>[x,800-y]};
 const newBox=viewportCropRect(viewport,{x:.08,y:.1,w:.82,h:.78},source.getPage(0).getMediaBox(),old);
 source.getPage(0).setCropBox(newBox.x,newBox.y,newBox.width,newBox.height);
 const checked=await PDFLib.PDFDocument.load(await source.save());
 assert.equal(checked.getPageCount(),2);
 assert.equal(checked.getPage(1).getRotation().angle,90);
 assert.ok(almostEqualBox(checked.getPage(0).getMediaBox(),old));
 assert.equal(describeChanges(original,checked,[1]).length,1);
 assert.equal(describeChanges(original,checked,[2]).length,0);
 const restored=checked.getPage(0);
 restored.setCropBox(old.x,old.y,old.width,old.height);
 assert.ok(almostEqualBox(restored.getCropBox(),old));
});
test('homepage routes to crop editor with mandatory apply-review-export controls',()=>{
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const html=fs.readFileSync(path.join(root,'crop.html'),'utf8');
 const ui=fs.readFileSync(path.join(root,'pdf-crop.mjs'),'utf8');
 const css=fs.readFileSync(path.join(root,'pdf-crop.css'),'utf8');
 assert.match(home,/crop-route/);
 assert.match(home,/window\.PDFEditorUnified\.open\('crop'\)/);
 for(const id of ['file','source-canvas','crop-rectangle','scope','range','apply','review','change-log','before-canvas','after-canvas','approved','export']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(ui,/containsSignature/);
 assert.match(ui,/viewportCropRect/);
 assert.match(ui,/findInkBounds/);
 assert.match(ui,/renderPage\(outputJs/);
 assert.match(ui,/!el\('approved'\)\.checked/);
 assert.match(ui,/!reviewReady/);
 assert.match(css,/crop-rectangle i\[data-handle=ne\]/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);
});
