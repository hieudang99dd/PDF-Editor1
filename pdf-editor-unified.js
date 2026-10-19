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
 const root=()=>document.getElementById('unified-ws');
 const viewer=()=>document.getElementById('unified-frame');
 const home=()=>document.getElementById('home');
 const legacy=()=>document.getElementById('ws');
 const getUrl=key=>new URL('./'+ROUTES[key][0],location.href).href;
 function showHome(){
  root().hidden=true;
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
  document.getElementById('unified-title').textContent=ROUTES[route][1];
  document.querySelectorAll('[data-pdf-route]').forEach(btn=>{
   btn.setAttribute('aria-pressed',String(btn.dataset.pdfRoute===route));
  });
  current=route;
  const frame=viewer();
  frame.title=ROUTES[route][1]+' — PDF EDITOR';
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
 function click(event){
  const trigger=event.target.closest?.('[data-pdf-route]');
  if(trigger){event.preventDefault();open(trigger.dataset.pdfRoute);return;}
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
  if(!data||data.type!=='pdf-editor:navigate')return;
  if(data.route==='home')close();
  else if(Object.hasOwn(ROUTES,data.route))open(data.route);
  else if(data.route==='compress'){if(close())window.openTool?.(0);}
 }
 function init(){
  if(!root())return;
  document.addEventListener('click',click);
  window.addEventListener('message',frameMessage);
  viewer().addEventListener('load',()=>{
   document.getElementById('unified-loading').textContent='';
  });
  restore();
 }
 window.PDFEditorUnified={open,close,isOpen,restore,routes:ROUTES};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
