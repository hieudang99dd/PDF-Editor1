import {compressPdfBytes,containsPdfSignature} from './pdf-compress-engine.mjs?v=20261019-compress1';
const byId=id=>document.getElementById(id);
const input=byId('file'), button=byId('compress'),status=byId('status'),
  drop=byId('drop-zone'),result=byId('result');
let file=null,output=null,outputUrl=null,busy=false;
const pretty=n=>n>=1048576?(n/1048576).toFixed(2)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B';
function release(){if(outputUrl){URL.revokeObjectURL(outputUrl);outputUrl=null}}
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
function resetResult(){
 release();output=null;result.hidden=true;
 byId('progress').hidden=true;byId('progress-bar').style.width='0%';
 byId('output-size').textContent='—';byId('saving-percent').textContent='—';byId('images-count').textContent='—';
}
function choose(selected){
 if(busy)return;
 file=selected||null;resetResult();
 byId('file-name').textContent=file?file.name+' ('+pretty(file.size)+')':'Chưa chọn tệp PDF';
 byId('original-size').textContent=file?pretty(file.size):'—';
 button.disabled=!file;byId('warning').hidden=true;
 message(file?'Chọn mức độ nén và nhấn Áp dụng nén.':'Chọn PDF để bắt đầu.');
}
input.addEventListener('change',()=>choose(input.files?.[0]));
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('active')});
drop.addEventListener('dragleave',()=>drop.classList.remove('active'));
drop.addEventListener('drop',e=>{
 e.preventDefault();drop.classList.remove('active');
 const selected=e.dataTransfer?.files?.[0];
 if(selected)choose(selected);
});
drop.addEventListener('keydown',e=>{
 if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}
});
byId('reset').addEventListener('click',()=>{if(busy)return;input.value='';choose(null)});
const selectedMode=()=>document.querySelector('input[name=mode]:checked')?.value||'balanced';
async function compress(){
 if(!file||busy)return;
 busy=true;button.disabled=true;byId('reset').disabled=true;resetResult();
 byId('progress').hidden=false;
 try{
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!bytes.length)throw Error('Tệp PDF trống.');
  const mode=selectedMode();
  if(containsPdfSignature(bytes)){
   byId('warning').hidden=false;
   byId('warning').textContent='Phát hiện chữ ký số: hệ thống sẽ giữ nguyên tệp PDF để không làm mất hiệu lực chữ ký.';
  }
  message('Đang phân tích PDF...');
  const {bytes:done,stats}=await compressPdfBytes(bytes,{
   PDFLib:window.PDFLib,mode,
   onProgress:({phase,progress})=>{
     byId('progress-bar').style.width=progress+'%';
     message(phase+' · '+progress+'%');
   }
  });
  output=new Blob([done],{type:'application/pdf'});
  byId('progress-bar').style.width='100%';
  byId('output-size').textContent=pretty(stats.outputBytes);
  byId('saving-percent').textContent=stats.reduction+'%';
  byId('images-count').textContent=stats.imagesChanged+'/'+stats.imagesFound;
  byId('result-note').textContent=stats.note;
  release();outputUrl=URL.createObjectURL(output);
  byId('download').href=outputUrl;
  byId('download').download=file.name.replace(/\.pdf$/i,'')+'_compressed.pdf';
  result.hidden=false;
  message(stats.status==='signed'?'Giữ nguyên PDF đã ký số. Có thể tải lại bản gốc.':
    stats.status==='unchanged'?'PDF đã được tối ưu hoặc nén không giảm dung lượng; giữ nguyên tệp gốc.':
      'Đã nén PDF và kiểm tra số trang, kích thước trang.');
 }catch(e){
  console.error('[PDF EDITOR] Nén PDF thất bại',e);
  message('Không thể nén PDF: '+(e?.message||String(e)),true);
 }finally{
  busy=false;button.disabled=!file;byId('reset').disabled=false;
 }
}
button.addEventListener('click',()=>void compress());
byId('view-result').addEventListener('click',()=>{
 if(outputUrl)window.open(outputUrl,'_blank','noopener,noreferrer');
});
window.addEventListener('pagehide',release);
