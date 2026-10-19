const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'hvd-ui-v2.js'),'utf8');
const css=fs.readFileSync(path.join(root,'hvd-ui-v2.css'),'utf8');
const cit=fs.readFileSync(path.join(root,'cit-advanced-ui.js'),'utf8');
function mock(data){
 const saved=structuredClone(data);
 const nodes={'#q':{value:'',placeholder:''},'#chips':{innerHTML:''},'#tools':{innerHTML:''},'#nav':{innerHTML:''}};
 const listeners={};
 const hero={querySelector:q=>q==='.eyebrow'?null:({textContent:''}),insertAdjacentHTML(){}};
 const context={document:{querySelector:q=>q==='#home'?{querySelector:()=>hero}:nodes[q],addEventListener:(n,f)=>listeners[n]=f},T:data,cat:'Tất cả',home(){},openTool(i){context.opened=i}};
 vm.createContext(context);
 new vm.Script(ui).runInContext(context);
 const click=(selector,dataset)=>listeners.click({target:{closest:q=>q===selector?{dataset}:null}});
 return {nodes,context,saved,html:()=>nodes['#tools'].innerHTML,click};
}
test('Text editing remains a separate native tool routed to its existing page',()=>{
 assert.match(html,/\['Chỉnh sửa văn bản PDF','[^']+','Chỉnh sửa','T','cit-text-route','\.pdf'\]/);
 assert.match(html,/if\(T\[i\]\?\.\[4\]==='cit-text-route'/);
 const h=mock([['Chỉnh sửa văn bản PDF','Text','Chỉnh sửa','T','cit-text-route','.pdf'],['Chỉnh sửa PDF','Other','Chỉnh sửa','✎','organize','.pdf']]);
 assert.match(h.html(),/Chỉnh sửa Text — công cụ độc lập/);
 assert.match(h.html(),/Sửa Text PDF gốc/);
 assert.match(h.html(),/data-i="0"/);
 assert.match(h.html(),/class="catalog-cta" aria-hidden="true">Mở trình chỉnh sửa/);
 assert.match(h.html(),/class="ic catalog-icon" aria-hidden="true">T<\/span>/);
 assert.match(h.html(),/class="catalog-status">Trình duyệt<\/span>/);
 assert.equal((h.html().match(/Sửa Text PDF gốc/g)||[]).length,1);
});
test('12 catalog definitions, original registry immutable, unsupported tools hidden',()=>{
 const source=ui.match(/const cards=\[([\s\S]*?)\];/)[1];
 assert.equal((source.match(/^\s*\['/gm)||[]).length,12);
 const data=[['Giảm dung lượng PDF','Nén','Nén','⇲','compress','.pdf'],['PDF OCR','OCR','Chuyển đổi','OCR','lang','.pdf'],['PDF sang PDF/A','Không có engine','Chuyển đổi','A','none','.pdf'],['Chỉnh sửa văn bản PDF','Text','Chỉnh sửa','T','cit-text-route','.pdf'],['Ghép PDF','Ghép','Sắp xếp','⊕','merge','.pdf'],['Ghép PDF xen kẽ','Xen kẽ','Sắp xếp','⇄','merge','.pdf'],['Chia sẻ PDF','Chưa có server','Chỉnh sửa','↗','qr','.pdf'],['Xóa trang PDF','Xóa','Sắp xếp','×','range','.pdf'],['Trích xuất trang','Trích','Sắp xếp','⇥','range','.pdf']];
 const h=mock(data);
 assert.deepEqual(data,h.saved);
 assert.match(h.html(),/Nén PDF/);
 assert.match(h.html(),/Quản lý trang PDF/);
 assert.match(h.html(),/Nhận dạng chữ scan ngay trên trình duyệt/);
 assert.doesNotMatch(h.html(),/Cần ứng dụng PC/);
 assert.doesNotMatch(h.html(),/PDF sang PDF\/A|Chia sẻ PDF|Chưa hỗ trợ/);
 h.click('[data-group-key]',{groupKey:'pages'});
 assert.match(h.html(),/data-target-tool="7"/);
 h.click('[data-target-tool]',{targetTool:'7'});
 assert.equal(h.context.opened,7);
});
test('catalog filters by category and by hidden action name',()=>{
 const h=mock([['Giảm dung lượng PDF','Nén','Nén','⇲','compress','.pdf'],['Chỉnh sửa văn bản PDF','Text','Chỉnh sửa','T','cit-text-route','.pdf'],['PDF OCR','OCR','Chuyển đổi','OCR','lang','.pdf'],['Đảo thứ tự trang PDF','Đảo','Sắp xếp','⇅','cit-reverse','.pdf']]);
 h.nodes['#q'].value='đảo';vm.runInContext('home()',h.context);
 assert.match(h.html(),/Quản lý trang PDF/);
 assert.doesNotMatch(h.html(),/Sửa Text PDF gốc/);
 h.nodes['#q'].value='';h.context.cat='Sửa Text';vm.runInContext('home()',h.context);
 assert.match(h.html(),/Sửa Text PDF gốc/);
 assert.doesNotMatch(h.html(),/Nén PDF/);
 h.context.cat='Tất cả';h.nodes['#q'].value='OCR';vm.runInContext('home()',h.context);
 assert.match(h.html(),/Nhận dạng văn bản OCR/);
 assert.match(h.nodes['#nav'].innerHTML,/Nâng cao/);
 assert.doesNotMatch(h.nodes['#nav'].innerHTML,/AI PDF/);
});
test('CIT route and editor engine stay unmodified',()=>{
 assert.match(cit,/for\(const t of tools\)if\(!existing\.has\(t\[0\]\)\)T\.push\(t\)/);
 assert.match(cit,/home\(\);\s*\}\)\(\);/);
 assert.doesNotMatch(ui,/T\.push\(|T\[[^\]]+\]\s*=/);
 assert.match(html,/hvd-ui-v2\.js\?v=20261019-unified1/);
 assert.match(html,/hvd-ui-v2\.css\?v=20261016-dao1/);
});
test('catalog icon and featured text tile use explicit centered, responsive layout',()=>{
 assert.match(css,/\.catalog-tile \.catalog-icon\s*\{[^}]*display:grid;place-items:center/s,
   'Explicit grid must override the inherited `.tool span{display:block}` rule');
 assert.match(css,/\.catalog-tile \.catalog-icon\s*\{[^}]*color:#fff/s,
   'Text icons must contrast on primary accent background');
 assert.match(css,/\.catalog-group\[data-category="Sửa Text"\] \.grid\s*\{[^}]*max-width:920px/s,
   'The featured card must not span the entire desktop canvas');
 assert.match(css,/\.catalog-tile \.catalog-status\s*\{[^}]*position:static/s,
   'Status pill must stay inside its text flow, not float in the tile');
 assert.match(css,/@media\(max-width:640px\)[\s\S]*?\.catalog-tile \.catalog-cta/s,
   'Text editor CTA must wrap correctly on phones');
 assert.match(css,/\.catalog-tile \.catalog-cta\s*\{[^}]*white-space:nowrap/s);
});

test('conversion groups show one unified tile and preserve OCR separately',()=>{
 const registry=[
  ['Chuyển đổi tệp','Đổi định dạng','Chuyển đổi','⇄','universal-route','.pdf'],
  ['PDF OCR','OCR','Chuyển đổi','OCR','paddle-ocr-route','.pdf'],
  ['PDF sang JPG','Cũ','Chuyển đổi','JPG','pdf2jpg','.pdf'],
  ['PDF sang PNG','Cũ','Chuyển đổi','PNG','pdf2png','.pdf'],
  ['JPG sang PDF','Cũ','Chuyển đổi','▣','img','image/*'],
  ['PDF sang Word','Cũ','Chuyển đổi','W','none','.pdf'],
  ['Word sang PDF','Cũ','Chuyển đổi','W','none','.docx']
 ];
 const h=mock(registry);
 const rendered=h.html();
 assert.equal((rendered.match(/Chuyển đổi định dạng tệp/g)||[]).length,1);
 assert.match(rendered,/data-i="0"/);
 assert.match(rendered,/class="catalog-status">Cần ứng dụng PC<\/span>/);
 assert.doesNotMatch(rendered,/PDF sang ảnh|Ảnh sang PDF|Văn bản & Office/);
 assert.match(rendered,/Nhận dạng văn bản OCR/);
 assert.match(html,/universal-route/);
});

test('PDF metadata card removed without impacting independent advanced tools',()=>{
 const data=[
  ['Xem thuộc tính PDF','Xem thuộc tính','Chỉnh sửa','ⓘ','cit-properties','.pdf'],
  ['Sửa thuộc tính PDF','Sửa thuộc tính','Chỉnh sửa','ⓘ','cit-properties','.pdf'],
  ['Xóa metadata cơ bản','Xóa thuộc tính','Chỉnh sửa','ⓘ','cit-properties','.pdf'],
  ['Xóa chú thích PDF','Xóa chú thích','Chỉnh sửa','ⓘ','cit-remove-annotations','.pdf'],
  ['Làm phẳng PDF','Làm phẳng','Ký & Bảo vệ','▭','flatten','.pdf'],
  ['Giảm dung lượng PDF','Nén','Nén','⇲','compress','.pdf']
 ];
 const h=mock(data);
 assert.doesNotMatch(h.html(),/Thuộc tính PDF|Xem thuộc tính PDF|Sửa thuộc tính PDF|Xóa metadata cơ bản|Xóa chú thích PDF/);
 assert.match(h.html(),/Làm phẳng biểu mẫu/);
 assert.match(h.html(),/Nén PDF/);
});

test('standalone merge PDF card removed; merging remains available via page manager',()=>{
 const data=[
  ['Ghép PDF','Ghép PDF','Sắp xếp','⊕','merge','.pdf'],
  ['Ghép PDF xen kẽ','Ghép PDF xen kẽ','Sắp xếp','⇄','merge','.pdf'],
  ['Sắp xếp PDF','Sắp xếp','Sắp xếp','▦','pages-route','.pdf'],
  ['Trích xuất trang','Trích xuất','Sắp xếp','⇥','range','.pdf']
 ];
 const h=mock(data);
 assert.match(h.html(),/Quản lý trang PDF/);
 assert.match(h.html(),/Ghép, sắp xếp, tách, xóa, trích xuất, xoay và chèn trang/);
 assert.doesNotMatch(h.html(),/>Ghép PDF<\/b>|>Ghép PDF<\/strong>/);
 assert.doesNotMatch(h.html(),/data-group-key="merge"/);
 assert.match(html,/pages-route/);
});
