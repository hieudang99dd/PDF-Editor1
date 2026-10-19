// PDF coordinates stay in original user space, including CropBox and /Rotate.
export function parsePages(value, count) {
  if (!value.trim()) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set();
  for (const token of value.split(',')) {
    const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Khoảng trang không hợp lệ. Ví dụ: 1-3, 5.');
    const a = Number(match[1]), b = Number(match[2] || a);
    if (a < 1 || b < a || b > count) throw new Error(`Trang phải nằm trong 1–${count}.`);
    for (let i = a; i <= b; i++) pages.add(i);
  }
  return [...pages].sort((a, b) => a - b);
}
export function boundedScale(width, height, dpi = 180) {
  return Math.min(dpi / 72, 4096 / Math.max(width, height), Math.sqrt(8000000 / (width * height)));
}
export function normalizeItems(items, width, height) {
  return items.filter(item => typeof item.text === 'string' && item.poly?.length === 4 &&
    item.poly.every(p => p.length === 2 && p.every(Number.isFinite)))
    .map(item => ({ text: item.text.normalize('NFC'), score: Number.isFinite(item.score) ? item.score : 0,
      poly: item.poly.map(([x, y]) => [Math.max(0, Math.min(width, x)), Math.max(0, Math.min(height, y))]) }));
}
export function textMatrix(poly, toPdf, textWidth) {
  const [tl, tr, , bl] = poly.map(p => toPdf(...p));
  if (!(textWidth > 0)) throw new Error('Dòng văn bản không có chiều rộng.');
  const up = [tl[0] - bl[0], tl[1] - bl[1]];
  return [(tr[0] - tl[0]) / textWidth, (tr[1] - tl[1]) / textWidth,
    up[0], up[1], bl[0] + up[0] * 0.18, bl[1] + up[1] * 0.18];
}
export async function exportSearchablePdf(bytes, results, PDFLib, fontkit, fontBytes) {
  const { PDFDocument, beginText, endText, setFontAndSize, setTextRenderingMode,
    setTextMatrix, showText } = PDFLib;
  const doc = await PDFDocument.load(bytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  for (const [number, result] of results) {
    if (result.native) continue;
    const page = doc.getPage(number - 1);
    const key = page.node.newFontDictionary(font.name, font.ref);
    for (const item of result.items) {
      if (!item.text.trim()) continue;
      const matrix = textMatrix(item.poly, (...point) => result.viewport.convertToPdfPoint(...point),
        font.widthOfTextAtSize(item.text, 1));
      // Rendering mode 3 adds searchable Unicode without repainting the scan.
      page.pushOperators(beginText(), setFontAndSize(key, 1), setTextRenderingMode(3),
        setTextMatrix(...matrix), showText(font.encodeText(item.text)), endText());
    }
  }
  return doc.save();
}
