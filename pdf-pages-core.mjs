/*
 * PDF EDITOR – page manifest and lossless PDF page assembly.
 * Inspired by the page models of Stirling-PDF, BentoPDF and PDF Arranger;
 * the editor operates on references, never rasterizes original pages.
 */
export function parsePageRange(input,total){
  if(!Number.isSafeInteger(total)||total<0)throw Error('Tổng số trang không hợp lệ.');
  const selected=new Set();
  const text=String(input||'').trim();
  if(!text)return [];
  for(const part of text.split(/[,;]+/)){
    const value=part.trim();
    const match=/^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(value);
    if(!match)throw Error('Khoảng trang không hợp lệ: '+value+'. Ví dụ: 1-5, 8, 12-10.');
    const a=Number(match[1]),b=match[2]?Number(match[2]):a;
    if(a<1||b<1||a>total||b>total)throw Error('Trang phải nằm trong khoảng 1–'+total+'.');
    for(let i=a,step=a<=b?1:-1;step>0?i<=b:i>=b;i+=step)selected.add(i-1);
  }
  return [...selected].sort((a,b)=>a-b);
}
export function movePageIds(items,ids,target){
 const moving=new Set(ids);
 const movingItems=items.filter(p=>moving.has(p.id));
 if(!movingItems.length)return items.slice();
 const left=items.filter(p=>!moving.has(p.id));
 const targetIndex=left.findIndex(p=>p.id===target);
 if(target===null||target===undefined)return [...left,...movingItems];
 if(targetIndex<0)return items.slice();
 left.splice(targetIndex,0,...movingItems);
 return left;
}
export function cloneManifest(items){
 return items.map(p=>({...p}));
}
export function rotateDegrees(degrees){
 const angle=((Number(degrees)||0)%360+360)%360;
 if(!Number.isInteger(angle)||angle%90!==0)throw Error('Chỉ hỗ trợ xoay 90°, 180° hoặc 270°.');
 return angle;
}
export function containsSignature(bytes,doc,PDFLib){
 const {PDFDict,PDFName,PDFArray,PDFNull}=PDFLib;
 for(const [,obj] of doc.context.enumerateIndirectObjects()){
  if(!(obj instanceof PDFDict))continue;
  const type=obj.get(PDFName.of('Type'));
  const field=obj.get(PDFName.of('FT'));
  if(type?.toString()==='/Sig'||obj.get(PDFName.of('ByteRange')) instanceof PDFArray||
     (field?.toString()==='/Sig'&&obj.get(PDFName.of('V'))&&obj.get(PDFName.of('V'))!==PDFNull))return true;
 }
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 // Plain ByteRange also catches signed-but-malformed dictionaries. False
 // positives are a conservative read-only outcome, never a broken signature.
 const decoder=new TextDecoder('latin1');
 for(let i=0;i<data.byteLength;i+=1024*1024){
  const end=Math.min(data.byteLength,i+1024*1024);
  if(decoder.decode(data.subarray(Math.max(0,i-40),end)).includes('/ByteRange'))return true;
 }
 return false;
}
export function splitAtIndices(items,cuts){
 const parts=[],marks=new Set(cuts),current=[];
 for(let i=0;i<items.length;i++){
  if(i>0&&marks.has(i)){if(current.length)parts.push(current.slice());current.length=0}
  current.push(items[i]);
 }
 if(current.length)parts.push(current.slice());
 return parts;
}
function safeSize(source){return source?.pageCount||0}
export function validateManifest(items,sources){
 if(!items.length)throw Error('Cần giữ lại ít nhất một trang.');
 for(const item of items){
  if(item.kind==='blank')continue;
  const src=sources[item.source];
  if(!src || !Number.isInteger(item.index)||item.index<0||item.index>=safeSize(src))
   throw Error('Tham chiếu trang không hợp lệ: '+item.id);
 }
 return true;
}
export async function assemblePages(items,sources,PDFLib){
 if(!PDFLib?.PDFDocument)throw Error('Thư viện PDF chưa sẵn sàng.');
 validateManifest(items,sources);
 const needed=new Set(items.filter(p=>p.kind!=='blank').map(p=>p.source));
 for(const i of needed)if(sources[i].locked)
  throw Error('PDF được bảo vệ hoặc có chữ ký số: không thể tổ chức rồi ghi lại tệp này. Hãy tải bản gốc.');
 const pdfDocs=new Map();
 for(const i of needed){
  const src=sources[i];
  const doc=await PDFLib.PDFDocument.load(src.bytes.slice(),{updateMetadata:false});
  if(containsSignature(src.bytes,doc,PDFLib))throw Error('PDF có chữ ký số: không được thay đổi thứ tự trang.');
  pdfDocs.set(i,doc);
 }
 const merged=await PDFLib.PDFDocument.create();
 for(const p of items){
  if(p.kind==='blank'){
   const [w,h]=p.size||[595.28,841.89];
   merged.addPage([w,h]);continue;
  }
  const parent=pdfDocs.get(p.source);
  const [copy]=await merged.copyPages(parent,[p.index]);
  const delta=rotateDegrees(p.rotation||0);
  if(delta){
   const original=copy.getRotation().angle;
   copy.setRotation(PDFLib.degrees(rotateDegrees(original+delta)));
  }
  merged.addPage(copy);
 }
 const bytes=new Uint8Array(await merged.save({useObjectStreams:true}));
 const inspected=await PDFLib.PDFDocument.load(bytes,{updateMetadata:false});
 if(inspected.getPageCount()!==items.length)throw Error('Số trang đầu ra không chính xác; đã chặn xuất.');
 for(let n=0;n<items.length;n++){
  const p=items[n];if(p.kind==='blank')continue;
  const original=pdfDocs.get(p.source).getPage(p.index);
  const copy=inspected.getPage(n);
  const sourceBox=original.getMediaBox(),newBox=copy.getMediaBox();
  if(Math.abs(sourceBox.width-newBox.width)>.1||Math.abs(sourceBox.height-newBox.height)>.1)
   throw Error('Khổ trang bị thay đổi trong quá trình xuất.');
 }
 return bytes;
}
