/* PDF EDITOR: one visible workspace, tool engines remain isolated in same-origin frames. */
(() => {
 'use strict';
 const ROUTES=Object.freeze({
  text:['text-editor.html','Sửa Text PDF'],
  pages:['pages.html','Quản lý trang PDF'],
  crop:['crop.html','Cắt lề PDF'],
  convert:['convert.html','Chuyển đổi định dạng'],
  ocr:['ocr.html','Nhận dạng OCR'],
  sign:['sign.html','Chèn chữ ký'],
  region:['region-eraser.html','Xóa vector theo vùng'],
  inspect:['pdfium-preflight.html','Kiểm tra chất lượng PDF']
 });
 const hash=()=>/^#workspace=([a-z]+)$/.exec(location.hash)?.[1]||null;
 let current=null;
 let frameResizeObserver=null;
 let frameLayoutEpoch=0;
 const AUTO_HEIGHT_ROUTES=new Set(['convert','ocr','sign','inspect','crop']);
 const root=()=>document.getElementById('unified-ws');
 const viewer=()=>document.getElementById('unified-frame');
 const home=()=>document.getElementById('home');
 const legacy=()=>document.getElementById('ws');
 const getUrl=key=>new URL('./'+ROUTES[key][0]+(key==='crop'?'?embedded=1&ui=20261106-occlusionfix1':key==='pages'?'?embedded=1&ui=20261106-occlusionfix1':''),location.href).href;
 function clearFrameLayout(){
  frameLayoutEpoch++;
  if(frameResizeObserver){frameResizeObserver.disconnect();frameResizeObserver=null;}
 }
 function syncAutoFrameHeight(epoch=frameLayoutEpoch){
  if(epoch!==frameLayoutEpoch||!isOpen()||!AUTO_HEIGHT_ROUTES.has(current))return;
  const frame=viewer();
  let doc;
  try{doc=frame.contentDocument;}catch(_){return;}
  if(!doc?.body)return;
  // html.scrollHeight is at least the iframe viewport height. Measuring it
  // and adding padding would enlarge the iframe endlessly on each resize.
  const bodyBox=doc.body.getBoundingClientRect();
  let measured=Math.max(doc.body.offsetHeight||0,bodyBox.height||0);
  const last=doc.body.lastElementChild;
  if(last){
   const lastBox=last.getBoundingClientRect();
   const margin=parseFloat(frame.contentWindow.getComputedStyle(last).marginBottom)||0;
   measured=Math.max(measured,lastBox.bottom-bodyBox.top+Math.max(0,margin));
  }
  measured=Math.ceil(measured);
  if(!Number.isFinite(measured)||measured<100)return;
  const desired=Math.max(360,Math.min(24000,measured+12));
  if(Math.abs(frame.getBoundingClientRect().height-desired)>8)frame.style.height=desired+'px';
 }
 function installFrameLayout(){
  clearFrameLayout();
  if(!isOpen()||!AUTO_HEIGHT_ROUTES.has(current))return;
  const frame=viewer();
  let doc;
  try{doc=frame.contentDocument;}catch(_){return;}
  if(!doc?.body)return;
  // Remove only duplicate header and avoid viewport-based panel-height feedback.
  // Keep child engine, controls and preview state entirely inside its iframe.
  doc.documentElement.classList.add('pdfeditor-embedded-shell');
  let style=doc.getElementById('pdfeditor-embed-layout');
  if(!style){
   style=doc.createElement('style');
   style.id='pdfeditor-embed-layout';
   style.textContent=`
    html.pdfeditor-embedded-shell,html.pdfeditor-embedded-shell body{
     max-width:100%;overflow-x:hidden;
    }
    html.pdfeditor-embedded-shell body>header{display:none!important}
    html.pdfeditor-embedded-shell body>main{min-width:0}
    @media(min-width:851px){
     html.pdfeditor-embedded-shell .workspace{
      height:clamp(480px,45vw,740px);min-height:480px;
     }
    }
    @media(min-width:1001px){
     html.pdfeditor-embedded-shell .sign-workspace{
      height:clamp(540px,51vw,800px);min-height:540px;
     }
    }
    @media(max-width:850px){
     html.pdfeditor-embedded-shell .workspace,
     html.pdfeditor-embedded-shell .sign-workspace{height:auto}
    }
   `;
   doc.head.appendChild(style);
  }
  const epoch=frameLayoutEpoch;
  const schedule=()=>{
   if(epoch!==frameLayoutEpoch)return;
   window.requestAnimationFrame(()=>syncAutoFrameHeight(epoch));
  };
  if(typeof ResizeObserver==='function'){
   frameResizeObserver=new ResizeObserver(schedule);
   frameResizeObserver.observe(doc.body);
  }
  schedule();
  doc.fonts?.ready?.then(schedule)?.catch(()=>{});
 }
 function showHome(){
  clearFrameLayout();
  root().hidden=true;
  root().removeAttribute('data-tool');
  document.getElementById('unified-crop-bar').hidden=true;
  resetCropButtons();
  home().style.display='block';
  legacy().style.display='none';
  const frame=viewer();
  if(frame.hasAttribute('src'))frame.removeAttribute('src');
  current=null;
 }
 function isOpen(){return Boolean(current&&!root().hidden);}
 function approveLeave(){return !current||window.confirm('Chuyển công cụ sẽ đóng tài liệu đang mở trong công cụ hiện tại nếu chưa xuất. Tiếp tục?');}
 function open(route,{restore=false}={}){
  if(!Object.hasOwn(ROUTES,route))return false;
  if(current===route&&isOpen())return true;
  if(!restore&&!approveLeave())return false;
  home().style.display='none';
  legacy().style.display='none';
  root().hidden=false;
  root().dataset.tool=route;
  syncShellHeight();
  document.getElementById('unified-crop-bar').hidden=route!=='crop';
  resetCropButtons();
  document.getElementById('unified-title').textContent=ROUTES[route][1];
  document.querySelectorAll('[data-pdf-route]').forEach(btn=>{
   btn.setAttribute('aria-pressed',String(btn.dataset.pdfRoute===route));
  });
  current=route;
  clearFrameLayout();
  const frame=viewer();
  frame.title=ROUTES[route][1]+' — PDF EDITOR';
  frame.style.height='';
  frame.src=getUrl(route);
  document.getElementById('unified-loading').textContent='Đang mở '+ROUTES[route][1]+'…';
  if(!restore)history.pushState({pdfEditorWorkspace:route},'',location.pathname+location.search+'#workspace='+route);
  window.scrollTo(0,0);
  return true;
 }
 function close({restore=false}={}){
  if(!isOpen())return true;
  if(!restore&&!approveLeave())return false;
  showHome();
  if(!restore)history.pushState(null,'',location.pathname+location.search);
  if(typeof window.home==='function')window.home();
  return true;
 }
 function restore(){
  const route=hash();
  if(route&&Object.hasOwn(ROUTES,route)){open(route,{restore:true});return true;}
  if(isOpen())showHome();
  return false;
 }
 function resetCropButtons(){
  for(const id of ['crop-host-apply','crop-host-review','crop-host-export'])document.getElementById(id).disabled=true;
  document.getElementById('crop-host-status').textContent='Chọn PDF và vẽ vùng cần giữ lại.';
 }
 function click(event){
  const action=event.target.closest?.('#crop-host-apply,#crop-host-review,#crop-host-export');
  if(action){
   if(current!=='crop'||action.disabled)return;
   const cmd=action.id==='crop-host-apply'?'apply':action.id==='crop-host-review'?'review':'export';
   if(cmd==='export'){
    // Run synchronously during the real user click. postMessage -> .click() in
    // the iframe loses user activation and can cause the browser to block PDF downloads.
    try{
     const nativeExport=viewer().contentDocument?.getElementById('export');
     if(nativeExport&&!nativeExport.disabled){nativeExport.click();return;}
    }catch(_){/* Cross-origin or not ready: use the legacy bridge. */}
   }
   viewer().contentWindow.postMessage({type:'pdf-editor:crop-command',action:cmd},location.origin);
   return;
  }
  const trigger=event.target.closest?.('[data-pdf-route]');
  if(trigger){event.preventDefault();event.stopImmediatePropagation();open(trigger.dataset.pdfRoute);return;}
  if(event.target.closest?.('#unified-home')){event.preventDefault();close();return;}
  if(event.target.closest?.('#unified-reload')){
   event.preventDefault();
   if(window.confirm('Làm mới công cụ này? Dữ liệu chưa xuất trong công cụ sẽ mất.')){
    const frame=viewer();frame.src=getUrl(current);
   }
  }
 }
 function frameMessage(event){
  if(event.origin!==location.origin||event.source!==viewer().contentWindow)return;
  const data=event.data;
  if(!data)return;
  if(current==='crop'&&data.type==='pdf-editor:crop-state'){
   document.getElementById('crop-host-apply').disabled=!data.applyEnabled;
   document.getElementById('crop-host-review').disabled=!data.reviewAvailable;
   document.getElementById('crop-host-export').disabled=!data.exportEnabled;
   document.getElementById('crop-host-status').textContent=typeof data.status==='string'?data.status.slice(0,320):'';
   return;
  }
  if(current==='crop'&&data.type==='pdf-editor:crop-height'){
   const height=Number(data.height);
   if(Number.isFinite(height)&&height>=250&&height<=12000)viewer().style.height=Math.max(720,height+12)+'px';
   return;
  }
  if(data.type!=='pdf-editor:navigate')return;
  if(data.route==='home')close();
  else if(Object.hasOwn(ROUTES,data.route))open(data.route);
  else if(data.route==='compress'){if(close())window.openTool?.(0);}
 }
 function syncShellHeight(){
  const hdr=document.querySelector('body > header');
  root().style.setProperty('--pdfeditor-header-height',Math.ceil(hdr?.getBoundingClientRect().height||60)+'px');
 }
 function init(){
  if(!root())return;
  syncShellHeight();
  window.addEventListener('resize',()=>{syncShellHeight();syncAutoFrameHeight();});
  document.addEventListener('click',click,true); // capture before legacy catalog dispatch
  window.addEventListener('message',frameMessage);
  viewer().addEventListener('load',()=>{
   if(!isOpen())return;
   installFrameLayout();
   document.getElementById('unified-loading').textContent='';
  });
  restore();
 }
 window.PDFEditorUnified={open,close,isOpen,restore,routes:ROUTES};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
