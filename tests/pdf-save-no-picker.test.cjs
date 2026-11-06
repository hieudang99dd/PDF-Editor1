'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const organizer=fs.readFileSync(path.join(root,'organizer.js'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const backup=fs.readFileSync(path.join(root,'text-editor-hdv.html'),'utf8');

test('PDF export never requests access to Chrome system folders',()=>{
  for(const blocked of ['showSaveFilePicker','showDirectoryPicker','requestPermission','createWritable',
    'po-save-mode','po-save-pick-dir','po-save-dir','po-save-clear-dir']){
    assert.equal(organizer.includes(blocked),false,'Forbidden save mode still present: '+blocked);
  }
  assert.match(organizer,/id="po-save-confirm"[^>]*>Tạo PDF/);
  assert.match(organizer,/id="po-save-download-link"[^>]*download hidden/);
  assert.doesNotMatch(organizer,/a\.click\(\)/);
  assert.match(organizer,/id="po-save-filename"/);
  assert.match(organizer,/this\.downloadSaveBlob\(blob, filename\)/);
  assert.doesNotMatch(organizer,/this\.savedHistoryIndex\s*=\s*historyAtSave/);
});
test('Website and editor fallback load versioned PDF save engine',()=>{
  assert.match(home,/organizer\.js\?v=20261106-save-click2/);
  assert.match(backup,/organizer\.js\?v=20261106-save-click2/);
});

test('PDF filename validation preserves Vietnamese and rejects unsafe Windows names',()=>{
  const begin=organizer.indexOf('    getSaveFilename() {');
  const end=organizer.indexOf('    downloadSaveBlob(blob, filename) {',begin);
  assert.ok(begin>=0&&end>begin);
  const nodes={
    'po-save-filename':{value:'Hồ sơ đường bộ'},
    'po-save-preview-path':{textContent:''}
  };
  const cls=new Function('document','return class Test {'+
    organizer.slice(begin,end)+'}')({getElementById(id){return nodes[id]}});
  const unit=new cls();
  assert.equal(unit.getSaveFilename(),'Hồ sơ đường bộ.pdf');
  nodes['po-save-filename'].value='Hồ sơ đường bộ.pdf';
  unit.updatePathPreview();
  assert.match(nodes['po-save-preview-path'].textContent,/Hồ sơ đường bộ\.pdf$/);
  assert.doesNotMatch(nodes['po-save-preview-path'].textContent,/\.pdf\.pdf/);
  for(const invalid of ['CON.pdf','anh/chup.pdf','bản-vẽ?.pdf']){
    nodes['po-save-filename'].value=invalid;
    assert.throws(()=>unit.getSaveFilename(),/Tên file không hợp lệ/);
  }
});

test('PDF stays ready for explicit user click with no synthetic download',()=>{
  const begin=organizer.indexOf('    downloadSaveBlob(blob, filename) {');
  const end=organizer.indexOf('    async showSaveModal(',begin);
  assert.ok(begin>=0&&end>begin);
  const links=new Map(),started=[],revoked=[];
  const modalDownload={hidden:true,href:'',download:''};
  const button={insertAdjacentElement(_position,element){links.set(element.id,element)}};
  const document={
    body:{appendChild(){}},
    getElementById(id){return id==='po-save'?button:id==='po-save-download-link'?modalDownload:links.get(id)||null},
    createElement(){
      return {style:{},href:'',download:'',id:'',className:'',textContent:'',
        remove(){},setAttribute(){},click(){started.push(this.download)}};
    }
  };
  let n=0;
  const URL={
    createObjectURL(){return 'blob:pdf-'+(++n)},
    revokeObjectURL(v){revoked.push(v)}
  };
  const cls=new Function('document','URL','console','return class Test {'+
    organizer.slice(begin,end)+'}')(document,URL,{warn(){}});
  const unit=new cls();
  const pdf={size:3,type:'application/pdf'};
  unit.downloadSaveBlob(pdf,'Hồ sơ.pdf');
  assert.deepEqual(started,[],'Generating the file must never force a download');
  assert.equal(modalDownload.hidden,false);
  assert.equal(modalDownload.href,'blob:pdf-1');
  assert.equal(modalDownload.download,'Hồ sơ.pdf');
  assert.equal(links.get('po-download-manual').download,'Hồ sơ.pdf');
  assert.equal(links.get('po-download-manual').href,'blob:pdf-1');
  assert.deepEqual(revoked,[]);
  unit.downloadSaveBlob(pdf,'Hồ sơ_v2.pdf');
  assert.equal(links.get('po-download-manual').download,'Hồ sơ_v2.pdf');
  assert.equal(modalDownload.download,'Hồ sơ_v2.pdf');
  assert.deepEqual(started,[]);
  assert.deepEqual(revoked,['blob:pdf-1']);
});


test('Export with a Unicode text annotation builds PDF and preserves retryable state',async()=>{
  const start=organizer.indexOf('    async executeSave() {');
  const end=organizer.indexOf('    showSuccess(',start);
  assert.ok(start>=0&&end>start);
  const draws=[],downloads=[],messages=[];
  const page={
    getRotation(){return {angle:0}},
    getWidth(){return 595},
    getHeight(){return 842},
    drawText(t){draws.push(t)}
  };
  let pageList=[page];
  const pdf={
    getForm(){return {getFields(){return []}}},
    getPages(){return [...pageList]},
    getPageCount(){return pageList.length},
    getPage(i){return pageList[i]},
    removePage(i){pageList.splice(i,1)},
    addPage(p){pageList.push(p);return p},
    async save(){return new Uint8Array([37,80,68,70,45,49])}
  };
  const native={PDFLib:{
    PDFDocument:{load:async()=>pdf},
    rgb:(r,g,b)=>({r,g,b}),
    degrees:a=>({angle:a})
  }};
  const modal={classList:{add(){},remove(){}}},confirmButton={disabled:false};
  class BlobMock {
    constructor(parts,{type}){this.parts=parts;this.size=parts.reduce((n,x)=>n+(x.length||0),0);this.type=type}
  }
  const ctor=new Function('window','document','Blob','toast','confirm','console',
    'return class Test{'+organizer.slice(start,end)+'}');
  const Unit=ctor(native,{getElementById:id=>id==='po-save-confirm'?confirmButton:modal},
    BlobMock,m=>messages.push(m),()=>true,{error(){}});
  const unit=new Unit();
  Object.assign(unit,{
    exportSelectedMode:false,
    pages:[{type:'pdf',fileIndex:0,pageIndex:0,rotation:0,textEdits:[],
      annotations:[{type:'text',leftPct:10,topPct:10,widthPct:30,heightPct:10,
        text:'Hồ sơ cầu đường',fontSize:14,color:'#1a1f36'}]}],
    files:[{arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer}],
    encrypted:[false],historyIndex:2,activeEditDiv:null,pendingTextCommit:null,
    getSaveFilename:()=> 'Bản vẽ thử.pdf',
    updateProgress(){},showLoading(){},hideLoading(){},
    async getUnicodeFont(){return {unicode:true}},
    downloadSaveBlob(blob,filename){downloads.push({blob,filename})},
    showSuccess(){}
  });
  await unit.executeSave();
  assert.deepEqual(draws,['Hồ sơ cầu đường']);
  assert.equal(downloads.length,1);
  assert.equal(downloads[0].filename,'Bản vẽ thử.pdf');
  assert.equal(downloads[0].blob.type,'application/pdf');
  assert.equal(unit.isSaving,false);
  assert.equal(confirmButton.disabled,false);
  assert.equal(unit.lastExportedHistoryIndex,2);
  assert.equal(unit.savedHistoryIndex,undefined,
    'Unconfirmed browser download must not be treated as an actual saved file');
  assert.deepEqual(messages,[]);
});
