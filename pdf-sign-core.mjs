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
export function assertUnsignedDocument(doc, PDFLib) {
  const { PDFDict, PDFName, PDFArray, PDFNull } = PDFLib;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    const type = object.get(PDFName.of('Type')), range = object.get(PDFName.of('ByteRange'));
    if (type?.toString() === '/Sig' || range instanceof PDFArray || (object.get(PDFName.of('FT'))?.toString() === '/Sig' && object.get(PDFName.of('V')) && object.get(PDFName.of('V')) !== PDFNull)) {
      throw new Error('PDF đã có chữ ký số. Công cụ này chưa hỗ trợ ký nối tiếp; hãy dùng bản PDF chưa ký.');
    }
  }
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
