/* CIT-PDF 1.0.0 → PDF HVD advanced tools UI; GNU AGPL-3.0.
 * Static browser adapter, no network calls, existing HDV UI stays authoritative.
 */
(() => {
  'use strict';
  const core=window.CITAdvancedCore;
  if(!core){console.error('Bộ xử lý PDF HVD chưa tải');return;}
  const actions=new Map([
    ['Đảo thứ tự trang PDF','reverse'],['Trích trang lẻ','odd'],
    ['Trích trang chẵn','even'],['Ghép PDF xen kẽ','interleave'],
    ['In nhiều trang N-up','nup'],['Cắt lề PDF','crop'],
    ['Xem thuộc tính PDF','inspect'],['Sửa thuộc tính PDF','metadata'],
    ['Xóa metadata cơ bản','remove-metadata'],
    ['Xóa chú thích PDF','remove-annotations'],['Đánh số Bates','bates'],
    ['Chèn trang trắng PDF','insert-blank'],['Chồng 2 PDF (Overlay)','overlay'],
    ['Xoay PDF góc tùy chỉnh','rotate-custom']
  ]);
  const tools=[
    ['Đảo thứ tự trang PDF','Đảo thứ tự tất cả các trang, bảo toàn vector','Sắp xếp','⇅','cit-reverse','.pdf'],
    ['Trích trang lẻ','Xuất các trang 1, 3, 5… sang PDF mới','Sắp xếp','1·3','cit-odd','.pdf'],
    ['Trích trang chẵn','Xuất các trang 2, 4, 6… sang PDF mới','Sắp xếp','2·4','cit-even','.pdf'],
    ['Ghép PDF xen kẽ','Ghép lần lượt các trang của đúng hai PDF','Sắp xếp','⇄','merge','.pdf'],
    ['In nhiều trang N-up','2 hoặc 4 trang trên một tờ, giữ nét vector','Sắp xếp','▦','cit-nup','.pdf'],
    ['Xem thuộc tính PDF','Số trang, kích thước, góc xoay và metadata','Chỉnh sửa','ⓘ','cit-inspect','.pdf'],
    ['Sửa thuộc tính PDF','Cập nhật tiêu đề, tác giả, mô tả, từ khóa','Chỉnh sửa','ID','cit-metadata','.pdf'],
    ['Xóa metadata cơ bản','Xóa Info/XMP cấp tài liệu; không phải ẩn danh an toàn','Chỉnh sửa','×','cit-remove-metadata','.pdf'],
    ['Xóa chú thích PDF','Xóa chú thích, giữ lại trường biểu mẫu','Chỉnh sửa','▤','cit-remove-annotations','.pdf'],
    ['Đánh số Bates','Đóng dấu mã trang liên tục','Chỉnh sửa','#','cit-bates','.pdf'],
    ['Chèn trang trắng PDF','Thêm trang trắng vào vị trí chọn','Sắp xếp','⊞','cit-blank','.pdf'],
    ['Chồng 2 PDF (Overlay)','Chồng PDF thứ hai lên các trang của PDF thứ nhất','Chỉnh sửa','▧','merge','.pdf'],
    ['Xoay PDF góc tùy chỉnh','Xoay mọi góc; giữ vector','Sắp xếp','⟳','cit-rotation','.pdf']
  ];
  const existing=new Set(T.map(t=>t[0]));
  for(const t of tools)if(!existing.has(t[0]))T.push(t);
  const crop=T.find(t=>t[0]==='Cắt lề PDF');
  if(crop){crop[1]='Cắt vùng nhìn bằng CropBox, không xóa nội dung gốc';crop[4]='cit-crop';}
  const redaction=T.find(t=>t[0]==='Biên tập lại (che thông tin)');
  if(redaction){redaction[0]='Che thông tin trực quan';redaction[1]='Chỉ che vùng nhìn; không phải xóa dữ liệu an toàn';}
  const flatten=T.find(t=>t[0]==='Làm phẳng PDF');
  if(flatten)flatten[1]='Làm phẳng trường biểu mẫu; không khẳng định xử lý mọi chú thích';
  const sig=T.find(t=>t[0]==='Ký tên vào PDF');
  if(sig)sig[1]='Ký tay, ảnh chữ ký và ký số bằng chứng thư trong trình duyệt';
  const attr='style="max-width:130px;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--bg)"';
  OPT['cit-crop']=[
    '<label>Lề trái (mm)<input id="cit-left" type="number" value="5" min="0" max="500" step="0.1" '+attr+'></label>',
    '<label>Lề phải (mm)<input id="cit-right" type="number" value="5" min="0" max="500" step="0.1" '+attr+'></label>',
    '<label>Lề trên (mm)<input id="cit-top" type="number" value="5" min="0" max="500" step="0.1" '+attr+'></label>',
    '<label>Lề dưới (mm)<input id="cit-bottom" type="number" value="5" min="0" max="500" step="0.1" '+attr+'></label>',
    '<p>Chỉ thay đổi CropBox (vùng hiển thị). KHÔNG xóa thông tin nằm ngoài vùng cắt.</p>'
  ].join('');
  OPT['cit-nup']='<label>Trang trên mỗi tờ<select id="cit-nup"><option value="2">2 trang</option><option value="4">4 trang</option></select></label><p>Dùng embedded pages để bảo toàn nét vector.</p>';
  OPT['cit-metadata']=[
    '<label>Tiêu đề<input id="cit-title" type="text" maxlength="300"></label>',
    '<label>Tác giả<input id="cit-author" type="text" maxlength="300"></label>',
    '<label>Mô tả<input id="cit-subject" type="text" maxlength="300"></label>',
    '<label>Đơn vị tạo<input id="cit-creator" type="text" maxlength="300"></label>',
    '<label>Từ khóa, phân cách dấu phẩy<input id="cit-keywords" type="text" maxlength="600"></label>'
  ].join('');
  OPT['cit-bates']=[
    '<label>Tiền tố ASCII<input id="cit-prefix" type="text" value="HDV-" maxlength="24"></label>',
    '<label>Bắt đầu từ<input id="cit-start" type="number" value="1" min="1" max="100000000" '+attr+'></label>',
    '<label>Số chữ số<select id="cit-padding"><option value="4">4</option><option value="5">5</option><option value="6" selected>6</option><option value="8">8</option></select></label>'
  ].join('');
  OPT['cit-blank']='<label>Chèn trước trang (bắt đầu từ 0)<input id="cit-position" type="number" min="0" value="0" step="1" '+attr+'></label>';
  OPT['cit-rotation']='<label>Góc xoay (độ)<input id="cit-angle" type="number" min="-360" max="360" value="45" step="1" '+attr+'></label><p>Góc khác bội số 90° tạo lại trang vector; không mang theo annotation.</p>';
  OPT['cit-overlay']='<label>Độ mờ lớp phủ<select id="cit-opacity"><option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option><option value="0.25">25%</option></select></label><p>Thứ tự tệp: PDF nền trước, PDF lớp phủ sau. Giữ vector nhưng không chuyển annotation của lớp phủ.</p>';
  OPT['cit-remove-metadata']='<p>Xóa Info, XMP cấp tài liệu và PieceInfo. Không đảm bảo loại bỏ metadata nhúng, đối tượng ẩn hoặc phiên bản cũ; không dùng để ẩn danh bảo mật.</p>';
  OPT['cit-remove-annotations']='<p>Xóa đối tượng chú thích (bình luận, highlight…), giữ trường điền biểu mẫu. Chữ/ảnh vẽ trực tiếp lên trang không phải annotation và vẫn được giữ nguyên.</p>';

  const val=(id,def='')=>document.getElementById(id)?.value??def;
  function optionsFor(action){
    if(action==='crop')return {left:val('cit-left','5'),right:val('cit-right','5'),top:val('cit-top','5'),bottom:val('cit-bottom','5')};
    if(action==='nup')return {nup:val('cit-nup','2')};
    if(action==='insert-blank')return {position:val('cit-position','0')};
    if(action==='rotate-custom')return {angle:val('cit-angle','45')};
    if(action==='overlay')return {opacity:val('cit-opacity','1')};
    if(action==='metadata')return {title:val('cit-title'),author:val('cit-author'),subject:val('cit-subject'),creator:val('cit-creator'),keywords:val('cit-keywords')};
    if(action==='bates')return {prefix:val('cit-prefix','HDV-'),start:val('cit-start','1'),padding:val('cit-padding','6')};
    return {};
  }
  function resultView(out,result){
    const wrap=document.createElement('div');wrap.className='res';
    const heading=document.createElement('b');
    heading.textContent=result.info?'Đã đọc thông tin PDF':'Đã tạo PDF mới';
    wrap.append(heading);
    if(result.info){
      const m=result.info;
      const p=document.createElement('p');
      p.textContent='Số trang: '+m.pageCount+' | Tiêu đề: '+m.title+' | Tác giả: '+m.author;
      wrap.append(p);
      const table=document.createElement('table');table.style.width='100%';
      table.style.fontSize='13px';
      const header=document.createElement('tr');
      for(const v of ['Trang','Rộng (mm)','Cao (mm)','Xoay']){
        const th=document.createElement('th');th.textContent=v;th.style.textAlign='left';
        th.style.padding='6px';header.append(th);
      }
      table.append(header);
      for(const page of m.pages){
        const row=document.createElement('tr');
        for(const v of [page.page,page.widthMm,page.heightMm,page.rotation]){
          const cell=document.createElement('td');cell.textContent=String(v);cell.style.padding='6px';row.append(cell);
        }
        table.append(row);
      }
      wrap.append(table);
    }else{
      const p=document.createElement('p');p.textContent=result.note||'Hoàn tất';wrap.append(p);
      const blob=new Blob([result.bytes],{type:result.mime||'application/pdf'});
      const url=window.hvdTrackDownloadUrl?.(blob)||URL.createObjectURL(blob);
      const link=document.createElement('a');link.className='btn';
      link.textContent='Tải PDF kết quả';link.download=result.filename;link.href=url;
      link.addEventListener('click',()=>setTimeout(()=>URL.revokeObjectURL(url),120000),{once:true});
      wrap.append(link);
    }
    out.replaceChildren(wrap);
  }
  async function runAdvanced(){
    const action=actions.get(tool[0]),out=document.getElementById('out');
    const button=document.getElementById('go');
    if(!out||!button||!files.length)return;
    if((action==='interleave'||action==='overlay')&&files.length!==2){toast('Chọn đúng 2 tệp PDF');return;}
    button.disabled=true;
    window.hvdReleaseWorkspaceDownloads?.();
    out.replaceChildren();
    const status=document.createElement('p');
    status.textContent='Đang xử lý trong trình duyệt (không tải file lên máy chủ)…';
    out.append(status);
    try{
      const inputs=await Promise.all(files.map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())})));
      const result=await core.execute(window.PDFLib,action,inputs,optionsFor(action));
      resultView(out,result);
    }catch(error){
      status.textContent='Không xử lý được: '+(error.message||String(error));
      status.style.color='var(--acc)';
      console.error('[CIT Advanced]',error);
    }finally{button.disabled=false;}
  }
  // Reuse HTML controls for both multiple-file CIT actions.
  const previousRun=run;
  run=function(){return actions.has(tool?.[0])?runAdvanced():previousRun();};
  home();
})();
