const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const src=html.match(/<script>\s*(const \$=s=>[\s\S]*?)<\/script>/)?.[1];
assert.ok(src,'Main app script must exist');

test('inline app remains valid JavaScript with independent workspace controls',()=>{
 new vm.Script(src,{filename:'index inline'});
 for(const id of ['ws-refresh','ws-new','ws-status','refresh-app','back']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/href="hvd-ui-v2\.css/);
 assert.match(html,/#ws-status/);
 assert.doesNotMatch(src,/if\(b\.id=='refresh-app'\)location\.reload\(\)/);
});

function navigationFixture(){
 const T=[['Trình đọc PDF','Mở tệp','Chỉnh sửa','👁','organize','.pdf']];
 const nodes={
  '#ws':{style:{display:'none'}},
  '#home':{style:{display:'block'}},
  '#wt':{textContent:''},
  '#wd':{textContent:''},
  '#ws-status':{textContent:''},
  '#go':{disabled:false},
  '#stage a[download]':null,
  '#po-back':null
 };
 let tool=null,files=[],renderCount=0,backCount=0,pushes=[],notices=[],confirmResult=true;
 const history={
   state:null,
   pushState(value,_unused,url){this.state=value;pushes.push(url);},
   back(){backCount++;this.state=null;},
   replaceState(){this.state=null;}
 };
 const loc={hash:'',pathname:'/PDF-Editor-Hdv/',search:''};
 const ctx={
  T,history,location:loc,scrollTo(){},window:{addEventListener(){}},
  document:{querySelector:sel=>nodes[sel]||null},
  $:sel=>nodes[sel]||null,home(){},render(){renderCount++;},
  toast:m=>notices.push(m),confirm(){return confirmResult},
  hvdDownloadRequested:false,
  get tool(){return tool},set tool(v){tool=v},
  get files(){return files},set files(v){files=v}
 };
 const start=src.indexOf('function openTool(i, restore=false)');
 const end=src.indexOf('function render()',start);
 const fnOpen=src.slice(start,end);
 const start2=src.indexOf('function showCatalog(){');
 const end2=src.indexOf("window.addEventListener('popstate'",start2);
 const fnNav=src.slice(start2,end2);
 assert.ok(start>=0&&end>start&&start2>=0&&end2>start2);
 // Execute in a context with free variables while retaining test-side state.
 vm.createContext(ctx);
 vm.runInContext(fnOpen+'\n'+fnNav,ctx);
 return {ctx,nodes,history,pushes,notices,get count(){return renderCount},
  get backCount(){return backCount},setConfirm:v=>{confirmResult=v}};
}

test('opening a browser PDF tool adds history, Back and Forward retain same-session file selection',()=>{
 const f=navigationFixture();
 f.ctx.openTool(0);
 assert.equal(f.nodes['#ws'].style.display,'block');
 assert.equal(f.nodes['#home'].style.display,'none');
 assert.deepEqual(f.pushes,['#hvd-tool=0']);
 f.ctx.files=[{name:'drawing.pdf',size:12345}];
 f.ctx.hvdDownloadRequested=true;
 f.ctx.back();
 assert.equal(f.nodes['#ws'].style.display,'none');
 assert.equal(f.backCount,1);
 f.ctx.openTool(0,true);
 assert.equal(f.ctx.files[0].name,'drawing.pdf');
 assert.equal(f.pushes.length,1,'Forward route must not create another history entry');
});

test('reset preserves files, new file clears them, both keep current workspace',()=>{
 const f=navigationFixture();f.ctx.openTool(0);
 f.ctx.files=[{name:'section.pdf',size:15}];
 f.ctx.resetWorkspace(false);
 assert.equal(f.ctx.files.length,1);
 assert.equal(f.nodes['#ws'].style.display,'block');
 assert.match(f.nodes['#ws-status'].textContent,/Đã làm mới tác vụ/);
 f.ctx.resetWorkspace(true);
 assert.equal(f.ctx.files.length,0);
 assert.equal(f.nodes['#ws'].style.display,'block');
 assert.ok(f.count>=3);
});

test('busy operations cannot be reset or exited and pending download requires acknowledgment',()=>{
 const f=navigationFixture();f.ctx.openTool(0);
 f.nodes['#go'].disabled=true;
 f.ctx.resetWorkspace(true);f.ctx.back();
 assert.equal(f.count,1);
 assert.equal(f.backCount,0);
 assert.ok(f.notices.some(x=>x.includes('Đang xử lý')));
 f.nodes['#go'].disabled=false;
 f.nodes['#stage a[download]']={};
 f.setConfirm(false);f.ctx.back();
 assert.equal(f.backCount,0,'Should not leave generated output without confirmation');
 f.setConfirm(true);f.ctx.back();
 assert.equal(f.backCount,1);
});

test('all browser result producers keep download in-page and dispose old object URLs',()=>{
 const local=read('pdf-local-tools.js'),adv=read('cit-advanced-ui.js');
 assert.match(src,/hvdDownloadUrls=new Set/);
 assert.match(src,/window\.hvdTrackDownloadUrl=trackDownloadUrl/);
 assert.match(src,/function releaseWorkspaceDownloads\(/);
 assert.match(src,/trackDownloadUrl\(blob\)/);
 assert.match(src,/a\[download\]/);
 assert.match(local,/hvdTrackDownloadUrl\?\./);
 assert.match(adv,/hvdTrackDownloadUrl\?\./);
 assert.doesNotMatch(local+adv,/location\.(?:assign|replace)\(/);
});

test('preflight supports inspection reset and second input without leaving page',()=>{
 const h=read('pdfium-preflight.html');
 assert.match(h,/id="reset"/);
 assert.match(h,/id="clear"[^>]*>＋ Tệp khác/);
 assert.match(h,/\$\('reset'\)\.addEventListener\('click'/);
 assert.match(h,/report = null; \$\('results'\)\.classList\.add\('hidden'\)/);
 assert.match(h,/link\.download = 'pdf-hvd-kiem-tra-chat-luong\.json'/);
});
