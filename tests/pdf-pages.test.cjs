'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const PDFLib=require('../pdf-lib.min.js');
const core=()=>import(pathToFileURL(path.join(__dirname,'../pdf-pages-core.mjs')).href);
test('range parser handles multiple selections, descending ranges and invalid indices',async()=>{
 const {parsePageRange}=await core();
 assert.deepEqual(parsePageRange('1-3, 7, 12-10',12),[0,1,2,6,9,10,11]);
 assert.deepEqual(parsePageRange('',10),[]);
 assert.throws(()=>parsePageRange('0-2',4),/1–4/);
 assert.throws(()=>parsePageRange('3,1a',4),/không hợp lệ/);
 assert.throws(()=>parsePageRange('5',4),/1–4/);
});
test('manifest transforms use stable IDs, preserve selection and split markers',async()=>{
 const {movePageIds,rotateDegrees,splitAtIndices,cloneManifest}=await core();
 const p=['a','b','c','d'].map(id=>({id,rotation:0}));
 assert.deepEqual(movePageIds(p,['b','c'],'a').map(x=>x.id),['b','c','a','d']);
 assert.deepEqual(movePageIds(p,['a'],'d').map(x=>x.id),['b','c','a','d']);
 assert.deepEqual(movePageIds(p,['c'],'c').map(x=>x.id),['a','b','c','d']);
 assert.equal(rotateDegrees(-90),270);
 assert.throws(()=>rotateDegrees(13),/90°/);
 assert.deepEqual(splitAtIndices(p,[1,3]).map(v=>v.length),[1,2,1]);
 const next=cloneManifest(p);next[0].rotation=90;assert.equal(p[0].rotation,0);
});
test('pdf-lib page copier retains selectable text, page geometry, rotations and duplicates',async()=>{
 const {assemblePages}=await core();
 async function doc(label,size,rotation){
  const d=await PDFLib.PDFDocument.create();
  const font=await d.embedFont(PDFLib.StandardFonts.Helvetica);
  const page=d.addPage(size);
  page.drawText(label,{x:30,y:100,font,size:12});
  page.drawLine({start:{x:20,y:180},end:{x:size[0]-20,y:180},thickness:.7});
  page.setRotation(PDFLib.degrees(rotation));
  return new Uint8Array(await d.save());
 }
 const sources=[];
 for(const [name,size,rotation] of [['AAA',[842,595],0],['BBB',[595,842],90]]){
  const bytes=await doc(name,size,rotation);
  sources.push({bytes,pageCount:1,locked:false});
 }
 const items=[
  {id:'a',kind:'pdf',source:1,index:0,rotation:90},
  {id:'b',kind:'pdf',source:0,index:0,rotation:0},
  {id:'c',kind:'pdf',source:0,index:0,rotation:180},
  {id:'d',kind:'blank',size:[700,400]}
 ];
 const result=await PDFLib.PDFDocument.load(await assemblePages(items,sources,PDFLib));
 assert.equal(result.getPageCount(),4);
 assert.equal(result.getPage(0).getRotation().angle,180);
 assert.equal(result.getPage(0).getWidth(),595);
 assert.equal(result.getPage(1).getWidth(),842);
 assert.equal(result.getPage(2).getRotation().angle,180);
 assert.equal(result.getPage(3).getWidth(),700);
 const raw=Buffer.from(await result.save()).toString('latin1');
 assert.equal(result.getPage(3).getHeight(),400);
});
test('existing signing ByteRange blocks rewriting, even if caller ignores lock bit',async()=>{
 const {assemblePages,containsSignature}=await core();
 const d=await PDFLib.PDFDocument.create();d.addPage();
 d.context.register(d.context.obj({Type:'Sig',ByteRange:[0,10,25,10]}));
 const signed=new Uint8Array(await d.save());
 const opened=await PDFLib.PDFDocument.load(signed);
 assert.equal(containsSignature(signed,opened,PDFLib),true);
 const entries=[{id:'p1',kind:'pdf',index:0,source:0}];
 await assert.rejects(()=>assemblePages(entries,[{bytes:signed,pageCount:1,locked:false}],PDFLib),/chữ ký số/);
 await assert.rejects(()=>assemblePages(entries,[{bytes:signed,pageCount:1,locked:true}],PDFLib),/bảo vệ/);
});
test('page management has grid, thumbnail preview and direct export without review gate',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../pages.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../pdf-pages.mjs'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../pdf-pages.css'),'utf8');
 const home=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(home,/Quản lý trang PDF/);assert.match(home,/window.PDFEditorUnified.open\('pages'\)/);
 for(const id of ['grid','preview-canvas','apply','export','selected-export','toggle-split','layout','range','size','jump','jump-btn']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(js,/IntersectionObserver/);
 assert.match(js,/MAX_THUMB_PARALLEL=2/);
 assert.match(js,/movePageIds\(/);
 assert.match(js,/assemblePages\(/);
 assert.match(css,/data-layout=rail/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);
});

test('page manager does not require an Apply step to export',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../pages.html'),'utf8');
 const script=fs.readFileSync(path.join(__dirname,'../pdf-pages.mjs'),'utf8');
 assert.match(html,/id="apply"[^>]*hidden/);
 assert.match(html,/id="export"[^>]*Xuất PDF/);
 assert.match(script,/const bytes=await assemblePages\(pages,sources,PDFLib\)/);
 assert.doesNotMatch(script,/Nhấn Áp dụng & kiểm tra trước khi xuất PDF/);
});
