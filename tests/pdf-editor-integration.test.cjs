'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const tools=['pages.html','crop.html','ocr.html','convert.html','sign.html','region-eraser.html','pdfium-preflight.html'];
test('all advanced PDF tools share PDF EDITOR navigation without replacing processing engines',()=>{
 const script=read('pdf-editor-workspace.js');
 assert.match(script,/document\.createElement\('nav'\)/);
 assert.match(script,/insertAdjacentElement\('afterend',nav\)/);
 assert.match(script,/aria-current/);
 assert.ok(script.includes('body.re-workspace-open #pdfeditor-workspace-nav'));
 for(const name of tools){
  const body=read(name);
  assert.match(body,/pdf-editor-workspace\.js\?v=20261019-suite1/,name+' must load shared navigation');
  assert.match(script,new RegExp(name.replace(/\./g,'\\.')),name+' must be accessible');
 }
 assert.doesNotMatch(read('studio/edit-pdf-text.html'),/pdf-editor-workspace\.js/);
 assert.match(read('studio/hvd-hub.js'),/PDF EDITOR/);
});
test('the PDF EDITOR homepage is a single entry point for the updated workflows',()=>{
 const home=read('index.html'),ui=read('hvd-ui-v2.js');
 for(const part of ["'crop-route'","'paddle-ocr-route'","'pages-route'","'universal-route'","'signature-route'","'region-eraser-route'"]){
  assert.ok(home.includes(part),'Missing route '+part);
 }
 assert.match(home,/hvd-ui-v2\.js\?v=20261019-crop-ui3/);
 const head=home.split('</head>')[0];
 assert.match(head,/#hvd-tool=/);
 assert.match(head,/28:'crop'/);
 assert.match(head,/14:'pages'/);
 assert.match(head,/history\.replaceState/);
 assert.match(ui,/\['pages','Tổ chức','Quản lý trang PDF'/);
 assert.match(ui,/\['crop','Tổ chức','Cắt lề PDF'/);
 assert.match(ui,/\['convert','Chuyển đổi','Chuyển đổi định dạng tệp'/);
 assert.match(ui,/\['ocr','Chuyển đổi','Nhận dạng văn bản OCR'/);
 assert.doesNotMatch(ui,/\['merge','Tổ chức','Ghép PDF'/);
 assert.doesNotMatch(ui,/\['meta','Nâng cao','Thuộc tính PDF'/);
 assert.match(read('crop.html'),/id="review"/);
 assert.match(read('crop.html'),/id="approved"/);
 assert.match(read('pages.html'),/id="apply"/);
 assert.match(read('pages.html'),/id="export"/);
});
test('shared links use existing pages in repository, never invented routes',()=>{
 const src=read('pdf-editor-workspace.js');
 const matches=[...src.matchAll(/\['([^']+\.html(?:#[^']+)?)','([^']+)'\]/g)];
 assert.ok(matches.length>=8);
 for(const [,url] of matches){
  const filename=url.split('#')[0];
  assert.ok(fs.existsSync(path.join(base,filename)),url+' must resolve locally');
 }
 const readme=read('README.md');
 assert.match(readme,/https:\/\/hieudang99dd\.github\.io\/PDF-Editor1\/index\.html/);
});
