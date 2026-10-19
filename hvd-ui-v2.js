/* PDF EDITOR / Catalog only. Preserve all original engine names and dispatch routes. */
(function(){
'use strict';
const main=document.querySelector('#home');
if(!main||typeof home!=='function')return;
const hero=main.querySelector('.hero');
hero.querySelector('h1').textContent='Bộ công cụ PDF chuyên nghiệp';
hero.querySelector('p').textContent='Chỉnh sửa, tổ chức, chuyển đổi và xuất bản hồ sơ. Các tác vụ cần engine PC được ghi rõ.';
if(!hero.querySelector('.eyebrow'))hero.insertAdjacentHTML('afterbegin','<span class="eyebrow">PDF EDITOR / KHÔNG GIAN LÀM VIỆC</span>');
const q=document.querySelector('#q');
q.placeholder='Tìm: sửa Text, ghép PDF, xóa trang, OCR, chồng bản vẽ…';
const categories=['Tất cả','Sửa Text','Biên tập','Tổ chức','Chuyển đổi','Nâng cao'];
const local=new Set(['Chuyển đổi tệp','PDF sang Word','PDF sang TIFF','Word sang PDF','Excel sang PDF','PPT sang PDF']);
const browser=new Set([
'PDF OCR',
'Chỉnh sửa văn bản PDF','Chỉnh sửa PDF','Xóa vector theo vùng','Ký tên vào PDF','Đánh số trang','Đánh số Bates','Watermark PDF',
'Sắp xếp PDF','Cắt PDF','Xóa trang PDF','Trích xuất trang','Xoay PDF','Đảo thứ tự trang PDF',
'Trích trang lẻ','Trích trang chẵn','Chèn trang trắng PDF','Xoay PDF góc tùy chỉnh','Ghép PDF',
'Ghép PDF xen kẽ','Giảm dung lượng PDF','Cắt lề PDF','PDF sang JPG','PDF sang PNG',
'JPG sang PDF','PDF sang TXT','In nhiều trang N-up','Chồng 2 PDF (Overlay)',
'Làm phẳng PDF'
]);
/* Only entries with a known implemented route are exposed. The original T array
 * also contains incomplete tools sharing the same codes ("none"/"organize").
 * Hide these in the UI, never delete their original engine definitions. */
const cards=[
 ['text','Sửa Text','Sửa Text PDF gốc','Chỉnh sửa trực tiếp chữ gốc trong không gian riêng bằng PDFium WASM.','T',['Chỉnh sửa văn bản PDF']],
 ['edit','Biên tập','Chỉnh sửa & chú thích','Thêm chữ, ảnh, highlight và chú thích; không phải sửa Text gốc.','✎',['Chỉnh sửa PDF']],
 ['sign','Biên tập','Chèn chữ ký','Ký tay, tải ảnh, nhập tên hoặc ký số bằng chứng thư.','✍',['Ký tên vào PDF']],
 ['stamp','Biên tập','Đánh số & đóng dấu','Đánh số trang, Bates và watermark.','#',['Đánh số trang','Đánh số Bates','Watermark PDF']],
 ['pages','Tổ chức','Quản lý trang PDF','Ghép, sắp xếp, tách, xóa, trích xuất, xoay và chèn trang.','▦',['Sắp xếp PDF','Cắt PDF','Xóa trang PDF','Trích xuất trang','Xoay PDF','Đảo thứ tự trang PDF','Trích trang lẻ','Trích trang chẵn','Chèn trang trắng PDF','Xoay PDF góc tùy chỉnh']],
 ['compress','Tổ chức','Nén PDF','Tối ưu dung lượng và ưu tiên giữ vector.','⇲',['Giảm dung lượng PDF']],
 ['crop','Tổ chức','Cắt lề PDF','Kéo vùng cắt, dò lề tự động và so sánh trước/sau. Phải kiểm tra rồi mới xuất.','⌗',['Cắt lề PDF']],
 ['convert','Chuyển đổi','Chuyển đổi định dạng tệp','Chọn tệp đầu vào → định dạng đầu ra. PDF ↔ ảnh; PDF → Word/TXT; Office → PDF.','⇄',['Chuyển đổi tệp']],
 ['ocr','Chuyển đổi','Nhận dạng văn bản OCR','Nhận dạng chữ scan ngay trên trình duyệt.','OCR',['PDF OCR']],
 ['region','Nâng cao','✂ Xóa vector theo vùng','Cắt thực các đoạn vector tại vùng tùy chọn, có vùng bảo vệ. Công cụ riêng, không phủ trắng.','✂',['Xóa vector theo vùng']],
 ['drawings','Nâng cao','Bố trí & chồng bản vẽ','N-up và chồng hai bản vẽ PDF, ưu tiên giữ vector.','▤',['In nhiều trang N-up','Chồng 2 PDF (Overlay)']],
 ['flatten','Nâng cao','Làm phẳng biểu mẫu','Làm phẳng trường biểu mẫu, không khẳng định tất cả chú thích.','▭',['Làm phẳng PDF']]
];
const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const find=name=>T.findIndex(t=>t[0]===name);
const actions=c=>c[5].filter(n=>(browser.has(n)||local.has(n))&&find(n)>=0);
let expanded=null;
const nav=document.querySelector('#nav');
if(nav)nav.innerHTML=categories.slice(2).map(c=>'<button type="button" data-nav="'+esc(c)+'">'+esc(c)+'</button>').join('');
const renderCatalog=()=>{
 const term=q.value.trim().toLocaleLowerCase('vi');
 document.querySelector('#chips').innerHTML=categories.map(c=>'<button type="button" class="chip '+(cat===c?'on':'')+'" data-c="'+esc(c)+'" aria-pressed="'+(cat===c)+'">'+esc(c)+'</button>').join('');
 const html=categories.slice(1).filter(c=>cat==='Tất cả'||cat===c).map(c=>{
  const visible=cards.filter(x=>x[1]===c&&actions(x).length&&(!term||(x[2]+' '+x[3]+' '+x[5].join(' ')).toLocaleLowerCase('vi').includes(term)));
  if(!visible.length)return '';
  const tiles=visible.map(x=>{
   const names=actions(x),single=names.length===1,idx=single?find(names[0]):-1,isText=x[0]==='text';
   const needsPC=names.some(n=>local.has(n)),hasWeb=names.some(n=>browser.has(n));
   const status=needsPC?(hasWeb?'Web / PC':'Cần ứng dụng PC'):'Trình duyệt';
   const opened=expanded===x[0]&&!single;
   const attrs=single?' data-i="'+idx+'"':' data-group-key="'+esc(x[0])+'" aria-expanded="'+opened+'" aria-controls="catalog-panel-'+esc(x[0])+'"';
   return '<button type="button" class="tool catalog-tile'+(isText?' is-primary':'')+'"'+attrs+'><span class="ic catalog-icon" aria-hidden="true">'+esc(x[4])+'</span><span class="tool-body"><b>'+esc(x[2])+'</b><span>'+esc(x[3])+'</span><span class="catalog-status">'+status+'</span></span>'+(isText?'<span class="catalog-cta" aria-hidden="true">Mở trình chỉnh sửa <span class="catalog-cta-arrow">→</span></span>':'')+(single?'':'<span class="catalog-chevron" aria-hidden="true">'+(opened?'−':'+')+'</span>')+'</button>';
  }).join('');
  const active=visible.find(x=>x[0]===expanded&&actions(x).length>1);
  const panel=active?'<div class="catalog-action-panel" role="region" id="catalog-panel-'+esc(active[0])+'" aria-label="'+esc(active[2])+'"><div class="catalog-action-heading"><strong>'+esc(active[2])+'</strong><button type="button" class="catalog-panel-close" data-group-key="'+esc(active[0])+'" aria-label="Thu gọn">×</button></div><div class="catalog-action-list">'+actions(active).map(name=>'<button type="button" class="catalog-action" data-target-tool="'+find(name)+'"><span>'+esc(name)+'</span><small>'+(local.has(name)?'PC':'Web')+'</small></button>').join('')+'</div></div>':'';
  return '<section class="catalog-group" data-category="'+esc(c)+'"><h2 class="cat">'+esc(c==='Sửa Text'?'Chỉnh sửa Text — công cụ độc lập':c)+'</h2><div class="grid">'+tiles+'</div>'+panel+'</section>';
 }).join('');
 document.querySelector('#tools').innerHTML=html||'<p role="status" class="catalog-empty">Không tìm thấy công cụ đang hỗ trợ phù hợp.</p>';
};
document.addEventListener('click',e=>{
 const group=e.target.closest('[data-group-key]');
 if(group){expanded=expanded===group.dataset.groupKey?null:group.dataset.groupKey;renderCatalog();return;}
 const action=e.target.closest('[data-target-tool]');
 if(action){const i=Number(action.dataset.targetTool);if(Number.isInteger(i)&&i>=0&&i<T.length)openTool(i);}
});
home=renderCatalog;
q.oninput=()=>{expanded=null;renderCatalog();};
renderCatalog();
})();