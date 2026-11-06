'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');

test('All 8 PDF workflows share a shell without opaque fixed-height white masks',()=>{
 const html=read('index.html');
 const css=read('pdf-editor-unified.css');
 const js=read('pdf-editor-unified.js');
 const routes=['text','pages','crop','convert','ocr','sign','region','inspect'];
 for(const route of routes){
  assert.match(js,new RegExp('\\b'+route+":\\s*\\['"),'Missing '+route+' route');
 }
 assert.match(html,/id="unified-frame"/);
 assert.match(css,/#unified-ws \.unified-framebox\{[^}]*min-height:0;[^}]*background:#eef3f7/s);
 assert.doesNotMatch(css,/#unified-ws \.unified-framebox\{[^}]*min-height:660px/s);
 assert.match(css,/#unified-frame\{[^}]*background:transparent/s);
 assert.match(css,/#unified-ws\[data-tool=region\] \.unified-framebox\{[^}]*overflow:hidden/s);
 assert.match(css,/#unified-ws\[data-tool=text\] \.unified-framebox\{[^}]*flex:1 1 0%/s);
 assert.match(css,/#unified-ws\[data-tool=pages\] \.unified-framebox\{[^}]*min-height:0/s);
 assert.match(css,/#unified-crop-bar\{[^}]*position:relative/s);
});
test('Scrollable tools auto-resize to content without feeding viewport height back into themselves',()=>{
 const js=read('pdf-editor-unified.js');
 assert.match(js,/AUTO_HEIGHT_ROUTES=new Set\(\['convert','ocr','sign','inspect','crop'\]\)/);
 assert.match(js,/new ResizeObserver\(schedule\)/);
 assert.match(js,/frameResizeObserver\.disconnect\(\)/);
 assert.match(js,/doc\.body\.getBoundingClientRect\(\)/);
 assert.doesNotMatch(js,/doc\.documentElement\.scrollHeight/);
 assert.match(js,/html\.pdfeditor-embedded-shell body>header\{display:none!important\}/);
 assert.match(js,/html\.pdfeditor-embedded-shell \.sign-workspace/);
 new Function(js);
});
test('Page results and dark-mode dropzone do not hide active PDF content',()=>{
 const pages=read('pdf-pages.css');
 const main=read('index.html');
 assert.match(pages,/\.pm-result\{position:relative;z-index:1;bottom:auto/s);
 assert.match(pages,/\.pm-workspace\{flex:1 1 0%;min-height:0\}/);
 assert.match(main,/class="drop compress-drop"[^>]*background:var\(--card\)/);
 assert.match(main,/pdf-editor-unified\.css\?v=20261106-occlusionfix/);
});
