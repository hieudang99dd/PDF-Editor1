/* PDF EDITOR - shared workspace navigation across dedicated PDF tools.
 * Only adds UI navigation, never touches a document or changes tool state.
 */
(() => {
 'use strict';
 const current=window.location.pathname.split('/').pop().toLowerCase();
 if(current==='index.html'||!current||document.getElementById('pdfeditor-workspace-nav'))return;
 if(window.self!==window.top){
  const supported={'index.html':'home','text-editor.html':'text','pages.html':'pages',
   'crop.html':'crop','convert.html':'convert','ocr.html':'ocr','sign.html':'sign',
   'region-eraser.html':'region','pdfium-preflight.html':'inspect'};
  document.addEventListener('click',event=>{
   const link=event.target.closest?.('a[href]');
   if(!link||link.hasAttribute('download')||link.target==='_blank')return;
   const uri=new URL(link.href,location.href);
   if(uri.origin!==location.origin)return;
   const route=supported[uri.pathname.split('/').pop()];
   if(!route)return;
   event.preventDefault();event.stopImmediatePropagation();
   window.parent.postMessage({type:'pdf-editor:navigate',route},location.origin);
  },true);
  return;
 }

 const tools=[
  ['index.html','Tất cả công cụ'],
  ['text-editor.html','Sửa Text'],
  ['pages.html','Quản lý trang'],
  ['crop.html','Cắt lề'],
  ['index.html#hvd-tool=0','Nén PDF'],
  ['convert.html','Chuyển đổi'],
  ['ocr.html','OCR'],
  ['sign.html','Chữ ký'],
  ['region-eraser.html','Xóa vector'],
  ['pdfium-preflight.html','Kiểm tra PDF']
 ];
 const style=document.createElement('style');
 style.id='pdfeditor-workspace-nav-css';
 style.textContent=`
 #pdfeditor-workspace-nav{box-sizing:border-box;position:relative;z-index:9;width:100%;background:#eff4f8;color:#172a42;border-bottom:1px solid #cbd9e5;font:500 12px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:light}
 #pdfeditor-workspace-nav,#pdfeditor-workspace-nav *{box-sizing:border-box}
 #pdfeditor-workspace-nav .pdfeditor-workspace-nav-inner{max-width:1440px;margin:0 auto;padding:5px 17px;display:flex;gap:12px;align-items:center}
 #pdfeditor-workspace-nav .pdfeditor-workspace-name{font-weight:800;letter-spacing:.055em;white-space:nowrap;color:#147f78;padding-right:12px;border-right:1px solid #c2d1df;font-size:11px}
 #pdfeditor-workspace-nav .pdfeditor-workspace-links{display:flex;flex:1;gap:3px;align-items:center;overflow-x:auto;scrollbar-width:thin;min-width:0;padding:2px 0;white-space:nowrap}
 #pdfeditor-workspace-nav .pdfeditor-workspace-links a{display:inline-flex;align-items:center;flex:none;min-height:33px;text-decoration:none!important;color:#3a5268!important;background:transparent!important;border:1px solid transparent!important;padding:5px 10px;border-radius:7px;font:600 12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;transition:background .12s}
 #pdfeditor-workspace-nav .pdfeditor-workspace-links a:hover,#pdfeditor-workspace-nav .pdfeditor-workspace-links a:focus-visible{background:#dceeea!important;color:#116d65!important}
 #pdfeditor-workspace-nav .pdfeditor-workspace-links a[aria-current=page]{background:#d6ede8!important;color:#056e65!important;border-color:#91c9bf!important}
 #pdfeditor-workspace-nav a:focus-visible{outline:2px solid #108e80;outline-offset:1px}
 /* Full-screen region editor manages its own locked viewport and toolbar. */
 body.re-workspace-open #pdfeditor-workspace-nav{display:none!important}
 @media(max-width:720px){#pdfeditor-workspace-nav .pdfeditor-workspace-nav-inner{display:block;padding:5px 10px}#pdfeditor-workspace-nav .pdfeditor-workspace-name{display:block;border:0;padding:0 4px 3px}#pdfeditor-workspace-nav .pdfeditor-workspace-links a{min-height:37px}}
 @media(prefers-reduced-motion:reduce){#pdfeditor-workspace-nav a{transition:none!important}}
 `;
 const base=new URL('./index.html',window.location.href);
 const nav=document.createElement('nav');
 nav.id='pdfeditor-workspace-nav';
 nav.setAttribute('aria-label','Chuyển công cụ trong PDF EDITOR');
 const row=document.createElement('div');row.className='pdfeditor-workspace-nav-inner';
 const brand=document.createElement('span');brand.className='pdfeditor-workspace-name';brand.textContent='PDF EDITOR';row.appendChild(brand);
 const links=document.createElement('div');links.className='pdfeditor-workspace-links';
 for(const [path,label] of tools){
  const a=document.createElement('a');
  a.href=new URL(path,base).href;
  a.textContent=label;
  const active=path.split('#')[0]===current;
  if(active)a.setAttribute('aria-current','page');
  if(path==='index.html#hvd-tool=0')a.setAttribute('aria-label','Mở công cụ Nén PDF trong trang chủ');
  links.appendChild(a);
 }
 row.appendChild(links);nav.appendChild(row);
 function mount(){
  if(document.getElementById(nav.id))return;
  document.head.appendChild(style);
  const header=document.body.querySelector('header');
  if(header)header.insertAdjacentElement('afterend',nav);
  else document.body.insertBefore(nav,document.body.firstChild);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
