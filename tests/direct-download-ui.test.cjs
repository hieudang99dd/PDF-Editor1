'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('Main editor uses a two-stage PDF export with no file-system access',()=>{
 const js=read('organizer.js'),css=read('organizer.css'),html=read('index.html');
 assert.match(js,/id="po-save-download-link"[^>]*download hidden/);
 assert.match(js,/id="po-save-ready"[^>]*role="status"/);
 assert.match(js,/document.getElementById\('po-save-ready'\)\.hidden = false/);
 assert.match(js,/document.getElementById\('po-save-download-link'\)/);
 assert.doesNotMatch(js,/showDirectoryPicker|showSaveFilePicker|requestPermission|createWritable/);
 const start=js.indexOf('    downloadSaveBlob(blob, filename) {');
 const end=js.indexOf('    async showSaveModal(',start);
 assert.ok(start>=0 && end>start);
 const block=js.slice(start,end);
 assert.doesNotMatch(block,/\.click\(\)/);
 assert.match(block,/modalLink\.hidden = false/);
 assert.match(css,/#po-save-modal \[hidden\]/);
 assert.match(html,/organizer\.js\?v=20261106-save-click2/);
});

test('Page manager produces PDF/ZIP but requires explicit click on output link',()=>{
 const js=read('pdf-pages.mjs'),html=read('pages.html');
 assert.match(html,/id="download-retry"[^>]*download hidden/);
 assert.match(html,/pdf-pages\.mjs\?v=20261106-save-click1/);
 const start=js.indexOf('function clearDownload(){');
 const end=js.indexOf('function fileName(',start);
 assert.ok(start>=0 && end>start);
 const block=js.slice(start,end);
 assert.doesNotMatch(block,/\.click\(\)/);
 const anchor={hidden:true,style:{},removeAttribute(name){if(name==='href')this.href='';}};
 const urls=[],releases=[],messages=[];
 const URLmock={createObjectURL(){const value='blob:mock-'+(urls.length+1);urls.push(value);return value;},revokeObjectURL:x=>releases.push(x)};
 const Test=new Function('el','URL','Blob','message','let latestDownloadUrl=null;'+block+';return {download,clearDownload}')(id=>id==='download-retry'?anchor:null,URLmock,Blob,text=>messages.push(text));
 Test.download(new Uint8Array([1,2,3]),'test.pdf');
 assert.equal(anchor.href,'blob:mock-1');
 assert.equal(anchor.download,'test.pdf');
 assert.equal(anchor.hidden,false);
 assert.ok(messages.some(text=>text.includes('Tải kết quả')));
 Test.download(new Uint8Array([4]),'test.zip','application/zip');
 assert.equal(anchor.download,'test.zip');
 assert.deepEqual(releases,['blob:mock-1']);
 Test.clearDownload();
 assert.equal(anchor.hidden,true);
 assert.deepEqual(releases,['blob:mock-1','blob:mock-2']);
});

test('Signature and OCR output remain user-downloadable after async processing',()=>{
 const sign=read('pdf-sign.mjs'),signHtml=read('sign.html');
 const ocr=read('pdf-ocr.mjs'),ocrHtml=read('ocr.html');
 assert.match(signHtml,/id="download" hidden/);
 assert.match(signHtml,/pdf-sign\.mjs\?v=20261106-save-click1/);
 assert.match(sign,/link\.hidden = false;\s*link\.textContent = '↓ Tải PDF đã tạo'/);
 assert.doesNotMatch(sign,/link\.hidden = false;\s*link\.click\(\)/);
 assert.match(ocrHtml,/id="download-result"[^>]*download hidden/);
 assert.match(ocrHtml,/pdf-ocr\.mjs\?v=20261106-download-link1/);
 const start=ocr.indexOf('function download(blob, extension) {');
 const end=ocr.indexOf("$('txt').addEventListener",start);
 assert.ok(start>=0 && end>start);
 assert.doesNotMatch(ocr.slice(start,end),/\.click\(\)/);
 assert.match(ocr.slice(start,end),/link\.hidden = false/);
});
