'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const PDFLib=require('../pdf-lib.min.js');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=fs.readFileSync(path.join(__dirname,'../pdf-compress-engine.mjs'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../compress.html'),'utf8');
const bridge=fs.readFileSync(path.join(__dirname,'../pdf-local-tools.js'),'utf8');
const load=()=>import(pathToFileURL(path.join(__dirname,'../pdf-compress-engine.mjs')).href);
test('presets distinguish truly lossless from image recompression without page rasterization',async()=>{
 const {COMPRESSION_PRESETS}=await load();
 assert.equal(COMPRESSION_PRESETS.safe.scale,1);
 assert.equal(COMPRESSION_PRESETS.balanced.quality>.7,true);
 assert.equal(COMPRESSION_PRESETS.strong.scale<COMPRESSION_PRESETS.balanced.scale,true);
 assert.match(source,/enumerateIndirectObjects/);
 assert.match(source,/decodePDFRawStream/);
 assert.match(source,/DCTDecode/);
 assert.doesNotMatch(source,/drawPage\(|renderPageToImage\(/);
});
test('safe mode preserves page geometry; output must not become larger',async()=>{
 const {compressPdfBytes}=await load();
 const doc=await PDFLib.PDFDocument.create();
 const p=doc.addPage([842,595]);
 const helv=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
 p.drawText('Road CAD VECTOR / DATUM TEST',{x:42,y:500,size:17,font:helv});
 p.drawRectangle({x:45,y:390,width:300,height:80,borderWidth:1.5});
 const bytes=new Uint8Array(await doc.save({useObjectStreams:false}));
 const r=await compressPdfBytes(bytes,{PDFLib,mode:'safe'});
 assert.ok(r.bytes.byteLength<=bytes.byteLength,'Do not enlarge a PDF');
 const out=await PDFLib.PDFDocument.load(r.bytes);
 assert.equal(out.getPageCount(),1);
 assert.equal(out.getPage(0).getWidth(),842);
 assert.equal(out.getPage(0).getHeight(),595);
 assert.equal(r.stats.imagesChanged,0);
 assert.equal(r.stats.mode,'safe');
});
test('digital signature ByteRange must pass through byte-identically',async()=>{
 const {compressPdfBytes,containsPdfSignature}=await load();
 const bytes=new TextEncoder().encode('%PDF-1.6\n1 0 obj << /ByteRange [0 10 20 10] >> endobj');
 assert.equal(containsPdfSignature(bytes),true);
 for(const mode of ['safe','balanced','strong']){
  const out=await compressPdfBytes(bytes,{PDFLib,mode});
  assert.deepEqual(out.bytes,bytes);
  assert.equal(out.stats.status,'signed');
 }
});
test('unsupported/non-PDF and invalid presets are rejected',async()=>{
 const {compressPdfBytes}=await load();
 await assert.rejects(()=>compressPdfBytes(new TextEncoder().encode('not a PDF'),{PDFLib}),/không phải PDF/);
 const doc=await PDFLib.PDFDocument.create();doc.addPage();
 const validBytes=new Uint8Array(await doc.save());
 await assert.rejects(()=>compressPdfBytes(validBytes,{PDFLib,mode:'unknown'}),/không hợp lệ/);
});
test('standalone, legacy routes and homepage are connected to the same algorithm',()=>{
 assert.match(page,/pdf-compress-page\.mjs\?v=/);
 assert.match(page,/input type="radio" name="mode" value="strong"/);
 assert.match(page,/id="saving-percent"/);
 assert.match(bridge,/compressPdfBytes/);
 for(const name of ['compress-pdf.html','compress-pdf-for-email.html','compress-pdf-to-100kb.html']){
  const html=fs.readFileSync(path.join(__dirname,'../studio',name),'utf8');
  assert.match(html,/location\.replace\(new URL\('\.\.\/compress\.html'/);
 }
});
