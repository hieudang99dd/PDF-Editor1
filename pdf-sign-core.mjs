export function clampBox(box, width, height) {
  const w = Math.min(width, Math.max(5, Number(box.width) || 5)), h = Math.min(height, Math.max(3, Number(box.height) || 3));
  return { ...box, width: w, height: h, x: Math.max(0, Math.min(width - w, Number(box.x) || 0)), y: Math.max(0, Math.min(height - h, Number(box.y) || 0)) };
}
export function imageInkBounds({ data, width, height }) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 12) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  return right < left ? null : { x: Math.max(0, left - 3), y: Math.max(0, top - 3), width: Math.min(width, right + 4) - Math.max(0, left - 3), height: Math.min(height, bottom + 4) - Math.max(0, top - 3) };
}
export function removeWhite(data, threshold = 235) {
  // Alpha matting retains antialiased edges; colored ink is not converted to black.
  for (let i = 0; i < data.length; i += 4) {
    const minimum = Math.min(data[i], data[i + 1], data[i + 2]);
    if (minimum >= threshold) data[i + 3] = Math.round(data[i + 3] * (255 - minimum) / (255 - threshold));
  }
  return data;
}
export function hasDigitalSignatures(doc, PDFLib) {
  const { PDFDict, PDFName, PDFArray, PDFNull } = PDFLib;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    const type = object.get(PDFName.of('Type')), range = object.get(PDFName.of('ByteRange'));
    if (type?.toString() === '/Sig' || range instanceof PDFArray || (object.get(PDFName.of('FT'))?.toString() === '/Sig' && object.get(PDFName.of('V')) && object.get(PDFName.of('V')) !== PDFNull)) {
      return true;
    }
  }
  return false;
}
export function assertUnsignedDocument(doc, PDFLib) {
  if (hasDigitalSignatures(doc, PDFLib)) {
    throw new Error('PDF đã có chữ ký số. Không thể ghi đè hoặc ký tiếp mà vẫn giữ hiệu lực chữ ký cũ bằng bộ xuất hiện tại.');
  }
}
export function detectUploadFormat(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 5) throw new Error('Tệp rỗng hoặc dữ liệu không hợp lệ.');
  // A legal PDF header can start within the first 1024 bytes.
  const head = bytes.subarray(0, Math.min(1024,bytes.length));
  for(let i=0;i+4<head.length;i++)if(head[i]===37&&head[i+1]===80&&head[i+2]===68&&head[i+3]===70&&head[i+4]===45)return 'pdf';
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return 'png';
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'jpeg';
  if(bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&
    bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80)return 'webp';
  return 'unknown';
}
export async function inspectPdfForEditing(bytes, PDFLib) {
  try {
    const doc = await PDFLib.PDFDocument.load(bytes.slice(), {updateMetadata:false});
    const signed = hasDigitalSignatures(doc, PDFLib);
    return {
      readOnly: signed, signed,
      reason: signed
        ? 'PDF có chữ ký số: được mở và tải bản gốc nguyên vẹn. Chức năng Áp dụng/Ký tiếp bị khóa vì sẽ phá chữ ký trước; chưa hỗ trợ incremental signing.'
        : ''
    };
  } catch (e) {
    // PDF.js may render password-protected or nonstandard PDFs that pdf-lib
    // cannot safely rewrite. Fail closed to view/download without altering bytes.
    return {
      readOnly:true, signed:false,
      reason:'PDF này có bảo vệ hoặc cấu trúc không tương thích bộ ghi. Có thể xem và tải bản gốc; không chỉnh sửa/ký để tránh làm hỏng tài liệu.'
    };
  }
}
export async function buildImagePdf(bytes, format, PDFLib, webpToPng) {
  if (!['png','jpeg','webp'].includes(format)) throw new Error('Không phải tệp ảnh được hỗ trợ.');
  const doc = await PDFLib.PDFDocument.create();
  const png = format === 'webp' ? await webpToPng(bytes) : bytes;
  const img = format === 'jpeg' ? await doc.embedJpg(bytes) : await doc.embedPng(png);
  const fit = Math.min(1,14400 / Math.max(img.width,img.height));
  const w = img.width * fit, h = img.height * fit;
  const page = doc.addPage([w,h]);
  page.drawImage(img,{x:0,y:0,width:w,height:h});
  return new Uint8Array(await doc.save());
}
export async function buildVisualPdf(source, placements, PDFLib, pdfjsDocument) {
  const doc = await PDFLib.PDFDocument.load(source.slice());
  assertUnsignedDocument(doc, PDFLib);
  const images = new Map();
  for (const mark of placements) {
    const page = doc.getPage(mark.page - 1), view = (await pdfjsDocument.getPage(mark.page)).getViewport({ scale: 1 });
    const b = clampBox(mark, view.width, view.height);
    if (!images.has(mark.asset.url)) images.set(mark.asset.url, await doc.embedPng(mark.asset.url));
    const [x, y] = view.convertToPdfPoint(b.x, b.y + b.height);
    page.drawImage(images.get(mark.asset.url), { x, y, width: b.width, height: b.height, rotate: PDFLib.degrees(view.rotation) });
  }
  return placements.length ? doc.save({ useObjectStreams: false }) : source.slice();
}
