import {parsePageRange,containsSignature} from './pdf-pages-core.mjs?v=20261019-pages2';
import {clamp,normalizeRect,validRect,isFullPage,viewportCropRect,almostEqualBox,
 findInkBounds,describeChanges} from './pdf-crop-core.mjs?v=20261019-crop1';
const el=id=>document.getElementById(id);
const PDFLib=window.PDFLib,pdfjs=window.pdfjsLib||window['pdfjs-dist/build/pdf'];
if(!PDFLib?.PDFDocument||!pdfjs?.getDocument)throw Error('Thiếu thư viện PDF.js hoặc pdf-lib.');
pdfjs.GlobalWorkerOptions.workerSrc='./pdf.worker.min.js';
let sourceBytes=null,sourceLib=null,sourceJs=null,outputBytes=null,outputJs=null,outputUrl=null;
let pageCount=0,pageNumber=1,selected={x:0,y:0,w:1,h:1},rects=new Map(),locked=false;
let revision=0,appliedRevision=-1,reviewReady=false,reviewPages=[],changeRows=[];
let busy=false,openGeneration=0,stageGeneration=0,reviewGeneration=0,drag=null,stageViewport=null;
let stageRender=null,beforeRender=null,afterRender=null;
const mm=n=>(n*25.4/72).toFixed(1);
function status(msg,error=false){el('status').textContent=msg;el('status').style.color=error?'#b22b2b':'#526880';reportToShell()}
function getName(){return (el('file').files[0]?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[^a-zA-Z0-9À-ỹ_.()\- ]/g,'_').slice(0,90)}
function updateControls(){
 const ready=!!sourceJs&&!busy;
 for(const id of ['page','scope','padding','auto','reset'])el(id).disabled=!ready||locked;
 for(const id of ['prev','next'])el(id).disabled=!ready||(id==='prev'?pageNumber<=1:pageNumber>=pageCount);
 el('range').disabled=!ready||locked;
 el('apply').disabled=!ready||locked;
 const approved=reviewReady&&appliedRevision===revision&&el('approved').checked&&!!outputBytes;
 for(const id of ['export','review-export'])el(id).disabled=!approved||busy||locked;
 el('inspect').disabled=!outputUrl;
 el('approved').disabled=!reviewReady;
 reportToShell();
}
async function clearReview(){
 ++reviewGeneration;
 outputBytes=null;reviewReady=false;reviewPages=[];changeRows=[];appliedRevision=-1;
 el('approved').checked=false;el('approved').disabled=true;el('review').hidden=true;
 if(outputUrl){URL.revokeObjectURL(outputUrl);outputUrl=null}
 const doc=outputJs;outputJs=null;
 // Immediately revoke export buttons before any asynchronous PDF.js cleanup.
 updateControls();
 if(doc){try{await doc.destroy()}catch{}}
 updateControls();
}
function changed(){
 ++revision;
 void clearReview();
}
function updateSelection(){
 const r=validRect(selected),box=el('crop-rectangle');
 box.hidden=!sourceJs;
 Object.assign(box.style,{left:(r.x*100)+'%',top:(r.y*100)+'%',width:(r.w*100)+'%',height:(r.h*100)+'%'});
 el('selection-summary').textContent='Giữ lại '+Math.round(r.w*100)+'% chiều rộng × '+Math.round(r.h*100)+'% chiều cao · ngoài khung là lề bị ẩn';
}
function setSelection(rect,{remember=true,mark=true}={}){
 selected=validRect({...rect});
 if(remember)rects.set(pageNumber,{...selected});
 updateSelection();
 if(mark)changed();
}
function cursorPoint(event){
 const bounds=el('stage').getBoundingClientRect();
 return {x:clamp((event.clientX-bounds.left)/bounds.width),y:clamp((event.clientY-bounds.top)/bounds.height)};
}
function dragRect(mode,base,start,cur){
 const dx=cur.x-start.x,dy=cur.y-start.y;
 if(mode==='move')return {x:clamp(base.x+dx,0,1-base.w),y:clamp(base.y+dy,0,1-base.h),w:base.w,h:base.h};
 const left=base.x,top=base.y,right=base.x+base.w,bottom=base.y+base.h;
 if(mode==='draw')return normalizeRect(start,cur,.001);
 const min=.018,part=mode;
 let l=left,t=top,r=right,b=bottom;
 if(part.includes('w'))l=clamp(left+dx,0,right-min);
 if(part.includes('e'))r=clamp(right+dx,left+min,1);
 if(part.includes('n'))t=clamp(top+dy,0,bottom-min);
 if(part.includes('s'))b=clamp(bottom+dy,top+min,1);
 return {x:l,y:t,w:r-l,h:b-t};
}
el('stage').addEventListener('pointerdown',event=>{
 if(!sourceJs||busy||locked||event.button!==0)return;
 const handle=event.target.closest('[data-handle]')?.dataset.handle;
 const inside=event.target.closest('#crop-rectangle');
 const mode=handle|| (inside&&!isFullPage(selected)?'move':'draw');
 drag={mode,base:{...selected},start:cursorPoint(event),originPage:pageNumber};
 el('stage').setPointerCapture(event.pointerId);
});
el('stage').addEventListener('pointermove',event=>{
 if(!drag||!sourceJs)return;
 try{
  const next=dragRect(drag.mode,drag.base,drag.start,cursorPoint(event));
  // A zero-area drawing is allowed while dragging, but not as a committed crop.
  if(next.w>=.018&&next.h>=.018){selected=next;updateSelection()}
 }catch{}
});
function finishDrag(event){
 if(!drag)return;
 const old=drag.base,mode=drag.mode,start=drag.start;drag=null;
 try{
  if(mode==='draw'&&Math.abs(cursorPoint(event).x-start.x)<.018&&Math.abs(cursorPoint(event).y-start.y)<.018)
   selected=old;
  validRect(selected);
  rects.set(pageNumber,{...selected});
  if(JSON.stringify(old)!==JSON.stringify(selected))changed();
  updateSelection();
 }catch(error){selected=old;updateSelection();status(error.message,true)}
}
el('stage').addEventListener('pointerup',finishDrag);
el('stage').addEventListener('pointercancel',finishDrag);
el('scope').addEventListener('change',()=>{
 el('range-wrap').hidden=el('scope').value!=='range';changed();
});
el('range').addEventListener('input',changed);
el('padding').addEventListener('change',changed);
el('auto').addEventListener('click',()=>{
 const canvas=el('source-canvas');
 if(!canvas.width)return;
 try{
  const context=canvas.getContext('2d',{willReadFrequently:true});
  const found=findInkBounds(context.getImageData(0,0,canvas.width,canvas.height),{pad:Number(el('padding').value)});
  if(!found){status('Không xác định được vùng nét an toàn. Hãy vẽ vùng cắt thủ công.',true);return}
  setSelection(found);
  status('Đã dò lề dựa trên ảnh hiển thị. Hãy kiểm tra kỹ nét mảnh và chữ mờ trước khi áp dụng.');
 }catch(error){status('Không thể dò lề: '+error.message,true)}
});
el('reset').addEventListener('click',()=>{setSelection({x:0,y:0,w:1,h:1});status('Đã đưa vùng chọn về đầy đủ trang. Hãy vẽ lại vùng muốn giữ.')});
async function renderPage(doc,num,canvas,desiredWidth,kind){
 const page=await doc.getPage(num);
 const baseline=page.getViewport({scale:1});
 const scale=Math.min(1.65,Math.max(.07,desiredWidth/baseline.width),Math.sqrt(3_600_000/(baseline.width*baseline.height)));
 const viewport=page.getViewport({scale});
 canvas.width=Math.ceil(viewport.width);
 canvas.height=Math.ceil(viewport.height);
 const context=canvas.getContext('2d',{alpha:false,willReadFrequently:kind==='stage'});
 const task=page.render({canvasContext:context,viewport,background:'rgb(255,255,255)'});
 if(kind==='stage')stageRender=task;
 if(kind==='before')beforeRender=task;
 if(kind==='after')afterRender=task;
 await task.promise;
 return viewport;
}
async function renderStage(){
 const epoch=++stageGeneration;
 if(!sourceJs)return;
 try{stageRender?.cancel()}catch{}
 const canvas=el('source-canvas'),stage=el('stage'),parent=el('stage-scroll');
 const width=Math.max(220,Math.min(900,(parent.clientWidth||950)-38));
 try{
  const viewport=await renderPage(sourceJs,pageNumber,canvas,width,'stage');
  if(epoch!==stageGeneration)return;
  stageViewport=viewport;
  stage.style.width=canvas.width+'px';stage.style.height=canvas.height+'px';
  selected=rects.get(pageNumber)||{x:0,y:0,w:1,h:1};
  updateSelection();
  const src=sourceLib.getPage(pageNumber-1).getCropBox();
  el('dimensions').textContent='Vùng trang hiện tại: '+mm(src.width)+' × '+mm(src.height)+' mm';
  updateControls();
 }catch(e){if(e.name!=='RenderingCancelledException')status('Không dựng được trang: '+e.message,true)}
}
async function showPage(number){
 pageNumber=clamp(number,1,pageCount);
 el('page').value=String(pageNumber);
 await renderStage();
}
el('page').addEventListener('change',()=>void showPage(Number(el('page').value)));
el('prev').addEventListener('click',()=>void showPage(pageNumber-1));
el('next').addEventListener('click',()=>void showPage(pageNumber+1));
function targetPages(){
 const scope=el('scope').value;
 if(scope==='one')return [pageNumber];
 if(scope==='all')return Array.from({length:pageCount},(_,i)=>i+1);
 const nums=parsePageRange(el('range').value,pageCount).map(n=>n+1);
 if(!nums.length)throw Error('Hãy nhập khoảng trang cần cắt, ví dụ 1-3, 5.');
 return nums;
}
function disposeSource(){
 try{stageRender?.cancel()}catch{}
 void sourceJs?.destroy?.();sourceJs=null;sourceLib=null;sourceBytes=null;
 pageCount=0;rects.clear();el('crop-rectangle').hidden=true;
}
el('file').addEventListener('change',async()=>{
 const file=el('file').files?.[0];if(!file)return;
 const epoch=++openGeneration;
 disposeSource();await clearReview();
 busy=true;locked=false;updateControls();
 el('file-name').textContent=file.name;
 el('locked').hidden=true;
 status('Đang kiểm tra cấu trúc PDF và trạng thái chữ ký số…');
 try{
  if(file.size>150*1024*1024)throw Error('Giới hạn trình duyệt là 150 MB/tệp.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(epoch!==openGeneration)return;
  if(bytes[0]!==37||bytes[1]!==80||bytes[2]!==68||bytes[3]!==70||bytes[4]!==45)
   throw Error('Tệp không phải PDF hợp lệ.');
  const model=await PDFLib.PDFDocument.load(bytes.slice(),{updateMetadata:false});
  const reader=await pdfjs.getDocument({data:bytes.slice()}).promise;
  if(epoch!==openGeneration){await reader.destroy();return}
  locked=containsSignature(bytes,model,PDFLib);
  el('locked').hidden=!locked;
  sourceBytes=bytes;sourceLib=model;sourceJs=reader;pageCount=reader.numPages;
  if(pageCount!==model.getPageCount())throw Error('Số trang PDF không khớp giữa hai engine.');
  if(pageCount>1500)throw Error('Quá 1500 trang. Hãy chia tài liệu trước.');
  pageNumber=1;
  const options=Array.from({length:pageCount},(_,i)=>new Option('Trang '+(i+1),String(i+1)));
  el('page').replaceChildren(...options);
  el('page').value='1';el('scope').value='one';el('range').value='';
  el('range-wrap').hidden=true;
  selected={x:0,y:0,w:1,h:1};
  busy=false;await renderStage();
  status(locked?'PDF có chữ ký số: chỉ xem được, không cho phép cắt rồi ghi lại.':
   'Đã mở '+pageCount+' trang. Vẽ vùng cắt hoặc chọn “Dò lề tự động” rồi áp dụng.');
 }catch(error){
  if(epoch===openGeneration){disposeSource();busy=false;status('Không mở được PDF: '+error.message,true)}
 }finally{if(epoch===openGeneration){busy=false;updateControls()}}
});
async function apply(){
 if(!sourceBytes||busy||locked)return;
 let targets;
 try{targets=targetPages();validRect(selected);
  if(isFullPage(selected))throw Error('Chưa thay đổi vùng cắt. Hãy kéo tạo vùng hoặc dò lề trước khi áp dụng.');
 }catch(e){status(e.message,true);return}
 busy=true;await clearReview();updateControls();status('Đang áp dụng CropBox lên '+targets.length+' trang, giữ nguyên nội dung vector…');
 const localRevision=revision;
 try{
  const modified=await PDFLib.PDFDocument.load(sourceBytes.slice(),{updateMetadata:false});
  const previews=[];
  for(let i=0;i<targets.length;i++){
   const n=targets[i],pdfPage=await sourceJs.getPage(n);
   const viewport=pdfPage.getViewport({scale:1}),page=modified.getPage(n-1);
   const newBox=viewportCropRect(viewport,selected,page.getMediaBox(),page.getCropBox());
   const old=page.getCropBox();
   if(!almostEqualBox(old,newBox))page.setCropBox(newBox.x,newBox.y,newBox.width,newBox.height);
   previews.push(n);
   if(i%20===0)status('Đang cắt lề: '+(i+1)+'/'+targets.length+' trang…');
  }
  if(localRevision!==revision)throw Error('Vùng cắt đã thay đổi; hãy áp dụng lại.');
  const newBytes=new Uint8Array(await modified.save({useObjectStreams:true,updateFieldAppearances:false}));
  const verification=await PDFLib.PDFDocument.load(newBytes.slice(),{updateMetadata:false});
  if(verification.getPageCount()!==pageCount)throw Error('Số trang đầu ra không đúng.');
  const changes=describeChanges(sourceLib,verification,targets);
  if(!changes.length)throw Error('Không có thay đổi CropBox thực tế. Hãy tăng vùng lề muốn cắt.');
  for(let i=0;i<pageCount;i++){
   const before=sourceLib.getPage(i).getMediaBox(),after=verification.getPage(i).getMediaBox();
   if(!almostEqualBox(before,after))throw Error('MediaBox đã thay đổi bất thường ở trang '+(i+1));
  }
  const resultReader=await pdfjs.getDocument({data:newBytes.slice()}).promise;
  if(resultReader.numPages!==pageCount)throw Error('PDF.js không mở đúng số trang của tệp kết quả.');
  outputBytes=newBytes;outputJs=resultReader;
  outputUrl=URL.createObjectURL(new Blob([newBytes],{type:'application/pdf'}));
  changeRows=changes;reviewPages=changes.map(row=>row.page);
  appliedRevision=revision;reviewReady=false;
  el('approved').checked=false;el('approved').disabled=true;
  el('review').hidden=false;
  el('review-count').textContent=changes.length+' trang thay đổi / '+pageCount+' trang gốc';
  const select=el('review-page');
  select.replaceChildren(...reviewPages.map(n=>new Option('Trang '+n,String(n))));
  select.value=String(reviewPages[0]);
  renderChangeLog();
  status('Đã áp dụng thành công. Đang tạo ảnh trước/sau từ PDF kết quả để kiểm tra…');
  await renderReview(reviewPages[0]);
 }catch(error){await clearReview();status('Không áp dụng được: '+error.message,true)}
 finally{busy=false;updateControls()}
}
function renderChangeLog(){
 const log=el('change-log');log.replaceChildren();
 const table=document.createElement('table');
 const thead=document.createElement('thead'),tr=document.createElement('tr');
 for(const caption of ['Trang','Kích thước trước (mm)','Sau khi cắt (mm)','Lề mất ở 4 phía (mm)']){
  const th=document.createElement('th');th.textContent=caption;tr.append(th)
 }
 thead.append(tr);table.append(thead);
 const tbody=document.createElement('tbody');
 for(const r of changeRows){
  const row=document.createElement('tr');
  for(const value of [r.page,r.before.join(' × '),r.after.join(' × '),r.margins.join(' / ')]){
   const td=document.createElement('td');td.textContent=String(value);row.append(td)
  }
  tbody.append(row)
 }
 table.append(tbody);log.append(table);
}
async function renderReview(num){
 if(!sourceJs||!outputJs)return;
 const epoch=++reviewGeneration;
 reviewReady=false;el('approved').checked=false;
 updateControls();
 const pos=reviewPages.indexOf(num);
 el('review-prev').disabled=pos<=0;el('review-next').disabled=pos<0||pos>=reviewPages.length-1;
 el('review-page').value=String(num);
 try{
  const width=Math.min(500,Math.max(170,(el('review').clientWidth-90)/2));
  try{beforeRender?.cancel();afterRender?.cancel()}catch{}
  await renderPage(sourceJs,num,el('before-canvas'),width,'before');
  if(epoch!==reviewGeneration)return;
  await renderPage(outputJs,num,el('after-canvas'),width,'after');
  if(epoch!==reviewGeneration)return;
  reviewReady=true;
  status('Đã dựng PDF kết quả thật. Hãy so sánh hai trang và xem nhật ký thay đổi, sau đó xác nhận kiểm tra để mở nút Xuất.');
  updateControls();
 }catch(error){if(error.name!=='RenderingCancelledException')status('Không dựng được kết quả để kiểm tra: '+error.message,true)}
}
el('review-page').addEventListener('change',()=>void renderReview(Number(el('review-page').value)));
el('review-prev').addEventListener('click',()=>{const i=reviewPages.indexOf(Number(el('review-page').value));if(i>0)void renderReview(reviewPages[i-1])});
el('review-next').addEventListener('click',()=>{const i=reviewPages.indexOf(Number(el('review-page').value));if(i>=0&&i<reviewPages.length-1)void renderReview(reviewPages[i+1])});
el('approved').addEventListener('change',updateControls);
function exportResult(){
 if(!reviewReady||appliedRevision!==revision||!el('approved').checked||!outputBytes||locked)return;
 const url=URL.createObjectURL(new Blob([outputBytes],{type:'application/pdf'}));
 const a=document.createElement('a');a.download=getName()+'_cat-le.pdf';a.href=url;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),120000);
 status('Đã chuẩn bị tải PDF đã được kiểm tra. CropBox chỉ ẩn phần ngoài khung; không xóa dữ liệu nguồn.');
}
el('apply').addEventListener('click',()=>void apply());
el('export').addEventListener('click',exportResult);
el('review-export').addEventListener('click',exportResult);
el('inspect').addEventListener('click',()=>{if(outputUrl)window.open(outputUrl,'_blank','noopener,noreferrer')});
window.addEventListener('pagehide',()=>{if(outputUrl)URL.revokeObjectURL(outputUrl);void outputJs?.destroy?.();void sourceJs?.destroy?.()});
updateControls();

// Bridge embedded crop controls to the one PDF EDITOR toolbar.
// Only limited commands are accepted from the same-origin parent.
const embedded=new URLSearchParams(location.search).get('embedded')==='1' && window.parent!==window;
function reportToShell(){
 if(!embedded)return;
 window.parent.postMessage({
  type:'pdf-editor:crop-state',
  applyEnabled:!el('apply').disabled,
  exportEnabled:!el('export').disabled,
  reviewAvailable:!el('review').hidden,
  status:el('status').textContent.slice(0,320)
 },location.origin);
}
function syncFrameHeight(){
 if(!embedded)return;
 const height=Math.ceil(document.documentElement.scrollHeight);
 window.parent.postMessage({type:'pdf-editor:crop-height',height},location.origin);
}
if(embedded){
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='pdf-editor:crop-command')return;
  const action=event.data.action;
  if(action==='apply'&&!el('apply').disabled)el('apply').click();
  else if(action==='export'&&!el('export').disabled)el('export').click();
  else if(action==='review'&&!el('review').hidden)el('review').scrollIntoView({behavior:'smooth',block:'start'});
 });
 new ResizeObserver(syncFrameHeight).observe(document.body);
 window.addEventListener('load',syncFrameHeight);
}
reportToShell();
