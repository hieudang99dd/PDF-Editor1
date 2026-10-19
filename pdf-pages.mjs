import {parsePageRange,movePageIds,cloneManifest,rotateDegrees,containsSignature,splitAtIndices,assemblePages} from './pdf-pages-core.mjs?v=20261019-pages1';

const el=id=>document.getElementById(id);
const PDFLib=window.PDFLib;
const pdfjs=window.pdfjsLib||window['pdfjs-dist/build/pdf'];
if(!PDFLib?.PDFDocument || !pdfjs?.getDocument)throw Error('Thiếu PDFLib hoặc PDF.js.');
pdfjs.GlobalWorkerOptions.workerSrc='./pdf.worker.min.js';

let sources=[],pages=[],history=[],historyIndex=-1,serial=0,focusId=null,lastAnchor=null;
let selected=new Set(),cuts=new Set(),busy=false,revision=0,appliedRevision=-1;
let prepared=null,preparedUrl=null,thumbObserver=null,thumbJobs=[],activeThumbs=0,thumbEpoch=0;
const thumbCache=new Map();
let previewEpoch=0,dragIds=[];
const MAX_THUMB_PARALLEL=2;
const MAX_THUMB_CACHE=90;
const message=(s,error=false)=>{el('status').textContent=s;el('status').style.color=error?'#be3535':''};
function fmt(n){return n>1024*1024?(n/1048576).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB'}
function download(bytes,name,type='application/pdf'){
 const url=URL.createObjectURL(new Blob([bytes],{type}));
 const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function fileName(name){
 return (name||'document').replace(/\.pdf$/i,'').replace(/[^a-zA-Z0-9À-ỹ_.()\- ]/g,'_').slice(0,90);
}
function setBusy(on,text){
 busy=on;el('progress').hidden=!on;
 if(on){el('progress').value=15;if(text)message(text)}
 updateControls();
}
function revokePreview(){
 if(preparedUrl){URL.revokeObjectURL(preparedUrl);preparedUrl=null}
 prepared=null;appliedRevision=-1;el('result').hidden=true;
}
function touch(){
 revision++;revokePreview();
}
function snapshot(){
 return {pages:cloneManifest(pages),selected:[...selected],cuts:[...cuts],focusId};
}
function pushHistory(){
 const state=snapshot();
 history=history.slice(0,historyIndex+1);history.push(state);
 if(history.length>60)history.shift();
 historyIndex=history.length-1;
}
function restore(index){
 if(index<0||index>=history.length)return;
 historyIndex=index;
 const s=history[index];pages=cloneManifest(s.pages);selected=new Set(s.selected);
 cuts=new Set(s.cuts);focusId=s.focusId;touch();render();
}
function mutate(run){
 if(busy||locked())return;
 const old=JSON.stringify(snapshot());
 run();
 selected=new Set([...selected].filter(id=>pages.some(p=>p.id===id)));
 cuts=new Set([...cuts].filter(id=>pages.some(p=>p.id===id)));
 if(focusId&&!pages.some(p=>p.id===focusId))focusId=pages[0]?.id||null;
 if(old===JSON.stringify(snapshot()))return;
 touch();pushHistory();render();
}
function locked(){return sources.some(s=>s.locked)}
function isOriginalLocked(){return sources.length===1&&sources[0].locked&&historyIndex<=0}
function activePages(){return pages.filter(p=>selected.has(p.id))}
function focus(){return pages.find(p=>p.id===focusId)}
function updateControls(){
 const ready=pages.length>0,editable=ready&&!locked()&&!busy;
 const hasSel=selected.size>0;
 for(const id of ['rotate-left','rotate-right','duplicate','delete','selected-export','toggle-split']){
  el(id).disabled=!editable||!hasSel;
 }
 for(const id of ['blank','reverse','select-all','select-odd','select-even','range-apply','clear-splits'])
  el(id).disabled=!editable||(id==='clear-splits'&&!cuts.size);
 el('apply').disabled=!editable;
 el('export').disabled=busy||!(appliedRevision===revision&&prepared)||false;
 if(isOriginalLocked()&&!busy)el('export').disabled=false;
 el('undo').disabled=busy||historyIndex<=0||locked();
 el('redo').disabled=busy||historyIndex>=history.length-1||locked();
 el('add').disabled=busy;el('open').disabled=busy;
 el('selected-export').disabled=!editable||!hasSel;
 const current=pages.findIndex(p=>p.id===focusId);
 el('prev').disabled=busy||current<=0;
 el('next').disabled=busy||current<0||current>=pages.length-1;
}
function updateMeta(){
 const n=pages.length,sel=selected.size;
 el('summary').textContent=n?(n+' trang · '+sources.length+' tệp PDF'):'Chưa mở PDF';
 el('selection-info').textContent=sel?'Đã chọn '+sel+' trang':'Bấm trang để xem, Ctrl/Shift để chọn nhiều';
 el('split-count').textContent=cuts.size+' mốc tách';
 el('empty').hidden=!!n;
 el('grid').hidden=!n;
 if(locked())message('PDF có chữ ký số hoặc không hỗ trợ ghi lại: chỉ được xem và tải bản gốc. Không thể thay đổi trang.');
 updateControls();
}
function cachePut(key,src){
 if(thumbCache.has(key))thumbCache.delete(key);
 thumbCache.set(key,src);
 if(thumbCache.size>MAX_THUMB_CACHE)thumbCache.delete(thumbCache.keys().next().value);
}
function scheduleThumb(img,item,epoch){
 if(!img.isConnected)return;
 const key=item.kind==='blank'?'blank':item.source+':'+item.index;
 if(thumbCache.has(key)){img.src=thumbCache.get(key);return}
 if(item.kind==='blank'){img.alt='Trang trắng';return}
 thumbJobs.push({img,item,epoch,key});drainThumbs();
}
async function drainThumbs(){
 while(activeThumbs<MAX_THUMB_PARALLEL&&thumbJobs.length){
  const task=thumbJobs.shift();
  if(task.epoch!==thumbEpoch||!task.img.isConnected)continue;
  activeThumbs++;
  (async()=>{
   let page=null;
   try{
    const source=sources[task.item.source];if(!source)return;
    page=await source.doc.getPage(task.item.index+1);
    const original=page.getViewport({scale:1});
    const scale=Math.min(160/original.width,204/original.height,0.5);
    const viewport=page.getViewport({scale:Math.max(.03,scale)});
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
    const context=canvas.getContext('2d',{alpha:false});
    await page.render({canvasContext:context,viewport}).promise;
    if(task.epoch!==thumbEpoch||!task.img.isConnected)return;
    const url=canvas.toDataURL('image/jpeg',.72);cachePut(task.key,url);
    task.img.src=url;
    canvas.width=1;canvas.height=1;
   }catch(e){
    if(task.epoch===thumbEpoch&&task.img.isConnected)task.img.alt='Không dựng được ảnh trang';
    console.warn('[PDF EDITOR] Thumbnail unavailable',e);
   }finally{page?.cleanup?.()}
  })().finally(()=>{activeThumbs--;drainThumbs()});
 }
}
function render(){
 thumbEpoch++;thumbJobs.length=0;
 thumbObserver?.disconnect();
 const grid=el('grid');const fragment=document.createDocumentFragment();
 const epoch=thumbEpoch;
 thumbObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
   const img=entry.target;thumbObserver.unobserve(img);
   const item=pages.find(p=>p.id===img.dataset.pageId);
   if(item)scheduleThumb(img,item,epoch);
  }
 },{root:el('scroll'),rootMargin:'240px 0px',threshold:0.01}):null;
 pages.forEach((page,index)=>{
  const card=document.createElement('div');
  card.className='pm-card'+(selected.has(page.id)?' is-selected':'')+(focusId===page.id?' is-focused':'');
  card.tabIndex=0;card.draggable=!locked()&&!busy;
  card.dataset.id=page.id;card.setAttribute('role','group');
  card.setAttribute('aria-label','Trang '+(index+1)+' – '+(sources[page.source]?.name||'Trang trắng'));
  const check=document.createElement('input');check.className='pm-select-box';check.type='checkbox';
  check.checked=selected.has(page.id);check.setAttribute('aria-label','Chọn trang '+(index+1));
  check.addEventListener('click',e=>e.stopPropagation());
  check.addEventListener('change',()=>{if(locked())return;selected.has(page.id)?selected.delete(page.id):selected.add(page.id);focusId=page.id;updateSelectionDom();});
  card.append(check);
  if(cuts.has(page.id)){const marker=document.createElement('span');marker.className='pm-split-mark';marker.textContent='✂ Tách';card.append(marker)}
  const thumb=document.createElement('div');thumb.className='pm-thumb';
  const img=new Image();img.loading='lazy';img.alt='Ảnh thu nhỏ trang '+(index+1);
  img.dataset.pageId=page.id;
  if(page.kind==='blank'){const note=document.createElement('span');note.className='pm-thumb-placeholder';note.textContent='Trang trắng';thumb.append(note)}
  else {thumb.append(img);thumbObserver?thumbObserver.observe(img):scheduleThumb(img,page,epoch)}
  card.append(thumb);
  const info=document.createElement('div');info.className='pm-card-label';
  const number=document.createElement('span');number.textContent='Trang '+(index+1);
  const source=document.createElement('span');source.className='pm-card-source';
  source.title=sources[page.source]?.name||'Trang mới';
  source.textContent=(sources[page.source]?.name||'Trống').slice(0,22);
  info.append(number,source);card.append(info);
  const actions=document.createElement('div');actions.className='pm-card-actions';
  const makeBtn=(title,aria,fn)=>{
   const b=document.createElement('button');b.type='button';b.textContent=title;b.title=aria;
   b.setAttribute('aria-label',aria+' trang '+(index+1));b.disabled=locked()||busy;
   b.addEventListener('click',e=>{e.stopPropagation();fn()});actions.append(b);
  };
  makeBtn('↶','Xoay trái',()=>mutate(()=>{page.rotation=rotateDegrees((page.rotation||0)-90)}));
  makeBtn('↷','Xoay phải',()=>mutate(()=>{page.rotation=rotateDegrees((page.rotation||0)+90)}));
  makeBtn('⧉','Nhân đôi',()=>mutate(()=>{pages.splice(index+1,0,{...page,id:'page_'+(++serial)})}));
  makeBtn('✕','Xóa',()=>removeIds([page.id]));
  card.append(actions);
  card.addEventListener('click',e=>selectCard(page.id,e));
  card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectCard(page.id,e)}});
  card.addEventListener('dragstart',e=>{
   if(locked()){e.preventDefault();return}
   dragIds=selected.has(page.id)?pages.filter(p=>selected.has(p.id)).map(p=>p.id):[page.id];
   e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',page.id);
   card.classList.add('is-dragging');
  });
  card.addEventListener('dragend',()=>{card.classList.remove('is-dragging');dragIds=[]});
  card.addEventListener('dragover',e=>{if(!dragIds.length)return;e.preventDefault();card.classList.add('is-drop-target')});
  card.addEventListener('dragleave',()=>card.classList.remove('is-drop-target'));
  card.addEventListener('drop',e=>{
   e.preventDefault();e.stopPropagation();card.classList.remove('is-drop-target');
   const ids=dragIds.slice();
   if(ids.length&&!ids.includes(page.id))mutate(()=>{pages=movePageIds(pages,ids,page.id)});
   dragIds=[];
  });
  fragment.append(card);
 });
 grid.replaceChildren(fragment);
 updateMeta();updateSelectionDom();
 void previewFocused();
}
function updateSelectionDom(){
 for(const card of el('grid').children){
  card.classList.toggle('is-selected',selected.has(card.dataset.id));
  card.classList.toggle('is-focused',focusId===card.dataset.id);
  const check=card.querySelector('.pm-select-box');if(check)check.checked=selected.has(card.dataset.id);
 }
 updateMeta();
}
function selectCard(id,event={}){
 const idx=pages.findIndex(p=>p.id===id);if(idx<0)return;
 if(!locked()){
  if(event.shiftKey&&lastAnchor){
   const anchor=pages.findIndex(p=>p.id===lastAnchor);
   if(anchor>=0){for(let i=Math.min(anchor,idx);i<=Math.max(anchor,idx);i++)selected.add(pages[i].id)}
  }else if(event.ctrlKey||event.metaKey){selected.has(id)?selected.delete(id):selected.add(id);lastAnchor=id}
  else{selected=new Set([id]);lastAnchor=id}
 }else{lastAnchor=id}
 focusId=id;updateSelectionDom();void previewFocused();
}
async function previewFocused(){
 const version=++previewEpoch, page=focus(),canvas=el('preview-canvas');
 canvas.style.display='none';el('preview-empty').hidden=false;
 if(!page){el('preview-info').textContent='—';return}
 const idx=pages.indexOf(page);
 el('preview-info').textContent='Trang '+(idx+1)+' / '+pages.length+
   (page.kind==='blank'?' · Trống':' · '+sources[page.source]?.name);
 if(page.kind==='blank'){el('preview-empty').textContent='Trang trắng';return}
 try{
  const pdf=await sources[page.source].doc.getPage(page.index+1);
  if(version!==previewEpoch)return;
  const base=pdf.getViewport({scale:1,rotation:(pdf.rotate||0)+(page.rotation||0)});
  const w=el('preview-scroll').clientWidth-40,h=el('preview-scroll').clientHeight-40;
  const scale=Math.min(Math.max(0.1,w/base.width),Math.max(.1,h/base.height),1.7);
  const viewport=pdf.getViewport({scale,rotation:(pdf.rotate||0)+(page.rotation||0)});
  canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
  await pdf.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
  if(version===previewEpoch){el('preview-empty').hidden=true;canvas.style.display='block'}
  pdf.cleanup?.();
 }catch(e){if(version===previewEpoch)el('preview-empty').textContent='Không thể dựng trang: '+e.message}
 updateControls();
}
function removeIds(ids){
 const list=new Set(ids);
 if(pages.length<=list.size)return message('Không thể xóa toàn bộ trang; cần giữ ít nhất một trang.',true);
 mutate(()=>{pages=pages.filter(p=>!list.has(p.id));selected.clear()});
}
async function loadFiles(files){
 const picked=[...files].filter(f=>f.name.toLowerCase().endsWith('.pdf')||f.type==='application/pdf');
 if(!picked.length)return message('Vui lòng chọn tệp PDF hợp lệ.',true);
 if(busy)return;
 setBusy(true,'Đang mở PDF và tạo danh sách trang…');
 const fresh=[];
 try{
  for(const file of picked){
   const bytes=new Uint8Array(await file.arrayBuffer());
   const pdfTask=pdfjs.getDocument({data:bytes.slice()});
   const doc=await pdfTask.promise;
   let locked=false,reason='';
   try{
    const writer=await PDFLib.PDFDocument.load(bytes.slice(),{updateMetadata:false});
    locked=containsSignature(bytes,writer,PDFLib);
    if(locked)reason='PDF đã có chữ ký số';
   }catch(e){locked=true;reason='PDF mã hóa hoặc không hỗ trợ ghi: '+(e.message||String(e))}
   fresh.push({name:file.name,bytes,pageCount:doc.numPages,doc,locked,reason});
  }
  const start=sources.length;
  const added=[];
  for(let i=0;i<fresh.length;i++){
   const sourceIndex=start+i;
   for(let p=0;p<fresh[i].pageCount;p++)added.push({id:'page_'+(++serial),source:sourceIndex,index:p,kind:'pdf',rotation:0});
  }
  sources.push(...fresh);pages.push(...added);
  if(added.length){focusId=added[0].id;selected.clear();lastAnchor=focusId}
  touch();pushHistory();render();
  message(locked()?'Tài liệu có chữ ký số hoặc không thể ghi: chỉ xem và tải bản gốc.':
    'Đã mở '+fresh.length+' tệp · '+added.length+' trang. Kéo thả trang hoặc dùng thanh công cụ.');
 }catch(e){
  for(const s of fresh){try{await s.doc.destroy()}catch{}}
  message('Không thể mở PDF: '+(e.message||String(e)),true);
 }finally{setBusy(false)}
}
function setSelectedByIndex(indices){
 if(locked())return;
 selected=new Set(indices.map(i=>pages[i]?.id).filter(Boolean));
 focusId=pages[indices[0]]?.id||focusId;
 updateSelectionDom();
 if(focusId){el('grid').querySelector('[data-id="'+focusId+'"]')?.scrollIntoView({block:'nearest'});void previewFocused()}
}
async function apply(){
 if(busy||locked()||!pages.length)return;
 setBusy(true,'Đang tạo PDF để kiểm tra…');
 try{
  const bytes=await assemblePages(pages,sources,PDFLib);
  revokePreview();prepared=bytes;appliedRevision=revision;
  preparedUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  el('result').hidden=false;
  el('result-heading').textContent='Đã áp dụng thành công';
  el('result-text').textContent=pages.length+' trang · '+fmt(bytes.length)+
    (cuts.size?' · '+(cuts.size+1)+' phần khi xuất ZIP':'')+
    ' · Hãy xem lại trước khi xuất.';
  message('Đã kiểm tra số trang và khổ giấy. Chọn “Xuất kết quả” khi đã đúng.');
 }catch(e){message('Không thể áp dụng: '+(e.message||String(e)),true)}
 finally{setBusy(false)}
}
async function exportResult(){
 if(busy)return;
 if(isOriginalLocked()){
  return download(sources[0].bytes,sources[0].name);
 }
 if(!prepared||appliedRevision!==revision){message('Nhấn Áp dụng & kiểm tra trước khi xuất PDF.',true);return}
 if(!cuts.size){
  download(prepared,fileName(sources[0]?.name)+'_organized.pdf');message('Đã yêu cầu tải PDF kết quả.');return;
 }
 if(!window.JSZip)return message('Chưa tải thư viện ZIP để tách PDF.',true);
 setBusy(true,'Đang chia tài liệu thành các PDF…');
 try{
  const points=pages.map((p,i)=>cuts.has(p.id)?i+1:-1).filter(n=>n>0&&n<pages.length);
  const parts=splitAtIndices(pages,points);
  const archive=new window.JSZip();
  for(let i=0;i<parts.length;i++){
   const bytes=await assemblePages(parts[i],sources,PDFLib);
   archive.file('phan_'+String(i+1).padStart(2,'0')+'.pdf',bytes);
   el('progress').value=Math.round((i+1)/parts.length*95);
  }
  const blob=await archive.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
  download(await blob.arrayBuffer(),fileName(sources[0]?.name)+'_split.zip','application/zip');
  message('Đã xuất '+parts.length+' tệp PDF trong ZIP.');
 }catch(e){message('Không thể tách PDF: '+e.message,true)}finally{setBusy(false)}
}
async function extractSelected(){
 if(!selected.size||busy||locked())return;
 setBusy(true,'Đang trích xuất trang đã chọn…');
 try{
  const result=await assemblePages(activePages(),sources,PDFLib);
  download(result,fileName(sources[0]?.name)+'_selected.pdf');
  message('Đã trích xuất '+selected.size+' trang PDF.');
 }catch(e){message('Không thể trích xuất: '+e.message,true)}finally{setBusy(false)}
}
function bind(id,fn){el(id).addEventListener('click',fn)}
bind('open',()=>el('files').click());bind('add',()=>el('files').click());
el('files').addEventListener('change',e=>{void loadFiles(e.target.files);e.target.value=''});
for(const id of ['scroll','empty']){
 const zone=el(id);
 zone.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();zone.classList.add('dragging-over')}});
 zone.addEventListener('dragleave',()=>zone.classList.remove('dragging-over'));
 zone.addEventListener('drop',e=>{
  if(e.dataTransfer?.files.length){e.preventDefault();e.stopPropagation();zone.classList.remove('dragging-over');void loadFiles(e.dataTransfer.files)}
 });
}
bind('select-all',()=>setSelectedByIndex(pages.map((_,i)=>i)));
bind('select-odd',()=>setSelectedByIndex(pages.map((_,i)=>i).filter(i=>i%2===0)));
bind('select-even',()=>setSelectedByIndex(pages.map((_,i)=>i).filter(i=>i%2===1)));
bind('range-apply',()=>{
 try{setSelectedByIndex(parsePageRange(el('range').value,pages.length))}
 catch(e){message(e.message,true)}
});
function jumpToPage(){
 const num=Number(el('jump').value);
 if(!Number.isInteger(num)||num<1||num>pages.length)return message('Số trang phải từ 1 đến '+pages.length+'.',true);
 const id=pages[num-1].id;
 selectCard(id);
 el('grid').querySelector('[data-id="'+id+'"]')?.scrollIntoView({behavior:'smooth',block:'center'});
 message('Đang xem trang '+num+' / '+pages.length);
}
bind('jump-btn',jumpToPage);
el('jump').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();jumpToPage()}});

el('range').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el('range-apply').click()}});
bind('rotate-left',()=>mutate(()=>{for(const p of activePages())p.rotation=rotateDegrees((p.rotation||0)-90)}));
bind('rotate-right',()=>mutate(()=>{for(const p of activePages())p.rotation=rotateDegrees((p.rotation||0)+90)}));
bind('duplicate',()=>mutate(()=>{
 const set=new Set(selected);const result=[];
 for(const p of pages){result.push(p);if(set.has(p.id))result.push({...p,id:'page_'+(++serial)})}
 pages=result;selected.clear();
}));
bind('delete',()=>removeIds([...selected]));
bind('reverse',()=>mutate(()=>{pages.reverse()}));
bind('blank',()=>mutate(()=>{
 const index=pages.findIndex(p=>p.id===focusId);
 const p=focus()||pages[0];
 const [width,height]=p?.kind==='blank'?(p.size||[595.28,841.89]):[595.28,841.89];
 const item={id:'page_'+(++serial),kind:'blank',size:[width,height],rotation:0};
 pages.splice(Math.max(0,index+1),0,item);focusId=item.id;selected=new Set([item.id]);
}));
bind('toggle-split',()=>mutate(()=>{
 const idx=pages.findIndex(p=>p.id===focusId);if(idx<0||idx===pages.length-1)return;
 const id=pages[idx].id;cuts.has(id)?cuts.delete(id):cuts.add(id);
}));
bind('clear-splits',()=>mutate(()=>cuts.clear()));
bind('undo',()=>restore(historyIndex-1));bind('redo',()=>restore(historyIndex+1));
bind('apply',()=>void apply());bind('export',()=>void exportResult());bind('result-export',()=>void exportResult());
bind('selected-export',()=>void extractSelected());
bind('result-close',()=>{el('result').hidden=true});
bind('inspect',()=>{if(preparedUrl)window.open(preparedUrl,'_blank','noopener,noreferrer')});
bind('prev',()=>{const i=pages.findIndex(p=>p.id===focusId);if(i>0)selectCard(pages[i-1].id)});
bind('next',()=>{const i=pages.findIndex(p=>p.id===focusId);if(i<pages.length-1)selectCard(pages[i+1].id)});
el('layout').addEventListener('change',()=>{el('workspace').dataset.layout=el('layout').value;void previewFocused()});
el('size').addEventListener('input',()=>{
 el('size-value').value=el('size').value+' px';el('grid').style.setProperty('--thumb-size',el('size').value+'px');
});
document.addEventListener('keydown',e=>{
 if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||e.target?.isContentEditable)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(historyIndex-1)}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restore(historyIndex+1)}
 if(e.key==='Delete'&&selected.size)removeIds([...selected]);
});
window.addEventListener('pagehide',()=>{
 thumbObserver?.disconnect();if(preparedUrl)URL.revokeObjectURL(preparedUrl);
 for(const source of sources)source.doc?.destroy?.();
});
updateMeta();
