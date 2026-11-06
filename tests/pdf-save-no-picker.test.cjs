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
  assert.match(organizer,/id="po-save-confirm"[^>]*>Tạo PDF &amp; tải xuống/);
  assert.match(organizer,/id="po-save-filename"/);
  assert.match(organizer,/this\.downloadSaveBlob\(blob, filename\)/);
  assert.doesNotMatch(organizer,/this\.savedHistoryIndex\s*=\s*historyAtSave/);
});
test('Website and editor fallback load versioned PDF save engine',()=>{
  assert.match(home,/organizer\.js\?v=20261106-download-only/);
  assert.match(backup,/organizer\.js\?v=20261106-download-only/);
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

test('An interrupted automatic download leaves a clickable PDF link for retry',()=>{
  const begin=organizer.indexOf('    downloadSaveBlob(blob, filename) {');
  const end=organizer.indexOf('    async showSaveModal(',begin);
  assert.ok(begin>=0&&end>begin);
  const links=new Map(),started=[],revoked=[];
  const button={insertAdjacentElement(_position,element){links.set(element.id,element)}};
  const document={
    body:{appendChild(){}},
    getElementById(id){return id==='po-save'?button:links.get(id)||null},
    createElement(){
      return {style:{},href:'',download:'',id:'',className:'',textContent:'',
        remove(){},click(){started.push(this.download)}};
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
  assert.equal(started[0],'Hồ sơ.pdf');
  assert.equal(links.get('po-download-manual').download,'Hồ sơ.pdf');
  assert.equal(links.get('po-download-manual').href,'blob:pdf-1');
  assert.deepEqual(revoked,[]);
  unit.downloadSaveBlob(pdf,'Hồ sơ_v2.pdf');
  assert.equal(links.get('po-download-manual').download,'Hồ sơ_v2.pdf');
  assert.deepEqual(revoked,['blob:pdf-1']);
});
