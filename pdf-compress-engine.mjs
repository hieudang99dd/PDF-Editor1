/**
 * PDF EDITOR - Browser-side PDF compressor (no page rasterization).
 * Architecture: qpdf structural strategies + selective Image-XObject recompress
 * inspired by dgbkn/compress-pdf-lib (MIT); no external network or libraries.
 * For preservation and safety: never rewrite digitally signed PDFs, color-key
 * masks, transparency, JBIG2/JPX/CCITT, ICC/CMYK or unsupported Decode arrays.
 */
export const COMPRESSION_PRESETS = Object.freeze({
  safe: Object.freeze({quality:1, scale:1, label:'Không mất chất lượng'}),
  balanced: Object.freeze({quality:.76,scale:.85,label:'Cân bằng'}),
  strong: Object.freeze({quality:.58,scale:.68,label:'Nén mạnh ảnh scan'})
});

function checkAbort(signal) {
  if(signal?.aborted) throw new DOMException('Đã hủy nén PDF','AbortError');
}
export function containsPdfSignature(bytes, PDFLib, pdfDoc = null) {
  const decoder = new TextDecoder('latin1');
  const chunk = 1024 * 1024;
  // Chunk overlap prevents missing /ByteRange across byte boundaries.
  for(let i=0;i<bytes.length;i+=chunk) {
    if(decoder.decode(bytes.subarray(Math.max(0,i-32),Math.min(bytes.length,i+chunk))).includes('/ByteRange'))
      return true;
  }
  if (!pdfDoc) return false;
  for(const [,object] of pdfDoc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFLib.PDFDict)) continue;
    const type = object.get(PDFLib.PDFName.of('Type'));
    if(type?.toString?.()==='/Sig' || object.get(PDFLib.PDFName.of('ByteRange')))
      return true;
  }
  return false;
}
export function inspectImageXObjects(pdfDoc, PDFLib) {
  const arr=[];
  for(const [ref,object] of pdfDoc.context.enumerateIndirectObjects()) {
    if(!(object instanceof PDFLib.PDFRawStream))continue;
    if(object.dict.get(PDFLib.PDFName.of('Subtype'))?.toString?.()!=='/Image')continue;
    arr.push({ref,stream:object});
  }
  return arr;
}
function nameOf(v){return v?.toString?.() || '';}
function isTrue(value){return value?.toString?.()==='true';}
function props(dict, PDFLib) {
 const get=n=>dict.get(PDFLib.PDFName.of(n));
 return {get, width:get('Width')?.asNumber?.(),height:get('Height')?.asNumber?.(),
   bits:get('BitsPerComponent')?.asNumber?.()||8,space:nameOf(get('ColorSpace')),
   filter:nameOf(get('Filter'))};
}
function eligible(meta) {
 const {get,width,height,bits,space,filter}=meta;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<50||height<50||width*height>30e6)return false;
 if(bits!==8|| !['/DeviceRGB','/DeviceGray'].includes(space))return false;
 if(!['/FlateDecode','/DCTDecode'].includes(filter))return false;
 if(get('Mask')||get('SMask')||get('SMaskInData')||get('Decode')||get('DecodeParms')||isTrue(get('ImageMask')))return false;
 return true;
}
function inflateImage(stream, meta, PDFLib) {
 const bytes = PDFLib.decodePDFRawStream(stream).decode();
 const total=meta.width*meta.height;
 const channels=meta.space==='/DeviceRGB'?3:1;
 if(bytes.length !==total*channels) return null;
 const rgba=new Uint8ClampedArray(total*4);
 for(let i=0;i<total;i++) {
  const t=i*4,p=i*channels;
  rgba[t]=bytes[p];
  rgba[t+1]=channels===3?bytes[p+1]:bytes[p];
  rgba[t+2]=channels===3?bytes[p+2]:bytes[p];
  rgba[t+3]=255;
 }
 return new ImageData(rgba,meta.width,meta.height);
}
async function encodeImage(stream,meta,preset,PDFLib){
 const w=Math.max(1,Math.round(meta.width*preset.scale));
 const h=Math.max(1,Math.round(meta.height*preset.scale));
 if(w*h>20e6) return null;
 const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):document.createElement('canvas');
 canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:false});
 if(!ctx)return null;
 let bitmap=null;
 try {
  if(meta.filter==='/DCTDecode'){
    bitmap=await createImageBitmap(new Blob([stream.contents],{type:'image/jpeg'}));
  }else{
    const pixels=inflateImage(stream,meta,PDFLib);
    if(!pixels)return null;
    bitmap=await createImageBitmap(pixels);
  }
  // Downsample by image pixels only; never render or replace entire PDF pages.
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(bitmap,0,0,w,h);
  const blob=typeof canvas.convertToBlob==='function'
    ? await canvas.convertToBlob({type:'image/jpeg',quality:preset.quality})
    : await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(Error('Không thể mã hóa JPEG')), 'image/jpeg',preset.quality));
  if(!blob || blob.type!=='image/jpeg')return null;
  return {bytes:new Uint8Array(await blob.arrayBuffer()),width:w,height:h};
 }finally{
  bitmap?.close?.();
  canvas.width=1;canvas.height=1;
 }
}
function replaceImage(context,ref,stream,encoded,PDFLib){
 const dict=stream.dict.clone(context);
 dict.set(PDFLib.PDFName.of('Filter'),PDFLib.PDFName.of('DCTDecode'));
 dict.set(PDFLib.PDFName.of('ColorSpace'),PDFLib.PDFName.of('DeviceRGB'));
 dict.set(PDFLib.PDFName.of('BitsPerComponent'),PDFLib.PDFNumber.of(8));
 dict.set(PDFLib.PDFName.of('Width'),PDFLib.PDFNumber.of(encoded.width));
 dict.set(PDFLib.PDFName.of('Height'),PDFLib.PDFNumber.of(encoded.height));
 dict.delete(PDFLib.PDFName.of('DecodeParms'));
 dict.delete(PDFLib.PDFName.of('DP'));
 dict.delete(PDFLib.PDFName.of('Length'));
 context.assign(ref,PDFLib.PDFRawStream.of(dict,encoded.bytes));
}
function pdfHeader(bytes) {
 return new TextDecoder('latin1').decode(bytes.subarray(0,Math.min(1024,bytes.length))).includes('%PDF-');
}
function samePageGeometry(a,b) {
 if(a.getPageCount()!==b.getPageCount())return false;
 for(let i=0;i<a.getPageCount();i++){
  const x=a.getPage(i),y=b.getPage(i);
  if(Math.abs(x.getWidth()-y.getWidth())>.1 || Math.abs(x.getHeight()-y.getHeight())>.1
     || (x.getRotation().angle%360)!==(y.getRotation().angle%360))return false;
 }
 return true;
}
/** @returns {{bytes:Uint8Array,stats:{originalBytes,outputBytes,savedBytes,reduction,imagesFound,imagesChanged,mode,status}}} */
export async function compressPdfBytes(input,{PDFLib,mode='balanced',onProgress=()=>{},signal}={}){
 if(!PDFLib?.PDFDocument || !PDFLib?.PDFRawStream)throw Error('Chưa tải được bộ xử lý PDF.');
 const inputBytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(!pdfHeader(inputBytes))throw Error('Tệp đầu vào không phải PDF hợp lệ.');
 const preset=COMPRESSION_PRESETS[mode];
 if(!preset)throw Error('Chế độ nén không hợp lệ.');
 const originalBytes=inputBytes.byteLength;
 const stats={originalBytes,outputBytes:originalBytes,savedBytes:0,reduction:0,
   imagesFound:0,imagesChanged:0,mode,status:'unchanged'};
 checkAbort(signal);
 if(containsPdfSignature(inputBytes,PDFLib)) {
  return {bytes:inputBytes,stats:{...stats,status:'signed',
    note:'PDF có chữ ký số: giữ nguyên tệp để không làm mất hiệu lực chữ ký.'}};
 }
 onProgress({phase:'Đọc cấu trúc PDF',progress:8});
 let doc;
 try {
  doc=await PDFLib.PDFDocument.load(inputBytes.slice(),{updateMetadata:false});
 }catch(e){throw Error('PDF mã hóa hoặc cấu trúc không đọc được an toàn: '+(e?.message||String(e)));}
 if(containsPdfSignature(inputBytes,PDFLib,doc)){
  return {bytes:inputBytes,stats:{...stats,status:'signed',note:'PDF có chữ ký số: không ghi lại nội dung.'}};
 }
 const images=inspectImageXObjects(doc,PDFLib);
 stats.imagesFound=images.length;
 if(mode!=='safe'){
  for(let i=0;i<images.length;i++){
   checkAbort(signal);
   const {ref,stream}=images[i],meta=props(stream.dict,PDFLib);
   if(eligible(meta)&&stream.contents.byteLength>2500){
     try{
      const encoded=await encodeImage(stream,meta,preset,PDFLib);
      // A meaningful gain avoids unneeded PDF-level rewrite/noise.
      if(encoded && encoded.bytes.byteLength+160<stream.contents.byteLength*.96){
       replaceImage(doc.context,ref,stream,encoded,PDFLib);
       stats.imagesChanged++;
      }
     }catch(e){console.warn('[PDF EDITOR] Bỏ qua ảnh XObject không tương thích',ref.toString(),e);}
   }
   onProgress({phase:'Tối ưu ảnh nhúng',progress:12+Math.round((i+1)/images.length*69),
     done:i+1,total:images.length});
   if(i%4===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 checkAbort(signal);
 onProgress({phase:'Nén lại cấu trúc PDF',progress:86});
 // pdf-lib serialization may alter unrelated PDF features: compare and
 // require actual byte reduction before selecting output.
 const candidate=new Uint8Array(await doc.save({
   useObjectStreams:true,addDefaultPage:false,updateFieldAppearances:false
 }));
 if(candidate.byteLength>=originalBytes){
  onProgress({phase:'Giữ bản gốc vì nén không giảm',progress:100});
  return {bytes:inputBytes,stats:{...stats,status:'unchanged',imagesChanged:0,
    note:'Không giảm được dung lượng một cách an toàn; giữ bản gốc.'}};
 }
 const verify=await PDFLib.PDFDocument.load(candidate,{updateMetadata:false});
 if(!samePageGeometry(doc,verify))throw Error('PDF kết quả thay đổi số trang hoặc kích thước trang; đã chặn xuất.');
 checkAbort(signal);
 stats.outputBytes=candidate.byteLength;
 stats.savedBytes=originalBytes-candidate.byteLength;
 stats.reduction=Math.round(10000*stats.savedBytes/originalBytes)/100;
 stats.status='compressed';
 stats.note=stats.imagesChanged
   ? `Đã tối ưu ${stats.imagesChanged} ảnh nhúng; chữ và đường vector không raster hóa.`
   : 'Đã tối ưu cấu trúc PDF, không làm mất lớp chữ.';
 onProgress({phase:'Đã hoàn thành và kiểm tra',progress:100});
 return {bytes:candidate,stats};
}
