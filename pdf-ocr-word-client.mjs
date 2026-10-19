import { boundedScale } from './pdf-ocr-core.mjs';
import { bounds, detectRuledTables, assignItemsToTables, nativeTextItems } from './pdf-ocr-word-layout.mjs';
import { createEditableDocx } from './pdf-ocr-word.mjs';
const fontKinds = ['Regular', 'Bold', 'Italic', 'BoldItalic'];
async function wordFonts() {
  const entries = await Promise.all(fontKinds.map(async kind => {
    const response = await fetch(new URL(`./NotoSans-${kind}.ttf`, import.meta.url));
    if (!response.ok) throw new Error(`Không tải được font tiếng Việt ${kind}.`);
    return [kind, await response.arrayBuffer()];
  }));
  const fonts = Object.fromEntries(entries);
  await Promise.all(fontKinds.map(async kind => {
    const face = new FontFace('OCRWord', fonts[kind].slice(0), { weight: /Bold/.test(kind) ? '700' : '400', style: /Italic/.test(kind) ? 'italic' : 'normal' });
    await face.load(); document.fonts.add(face);
  }));
  return fonts;
}
export function findTables(canvas) {
  const small = document.createElement('canvas'), ratio = Math.min(1, 1800 / Math.max(canvas.width, canvas.height));
  small.width = Math.ceil(canvas.width * ratio); small.height = Math.ceil(canvas.height * ratio);
  const context = small.getContext('2d', { willReadFrequently: true }); context.drawImage(canvas, 0, 0, small.width, small.height);
  const tables = detectRuledTables(context.getImageData(0, 0, small.width, small.height));
  const sx = canvas.width / small.width, sy = canvas.height / small.height;
  for (const t of tables) {
    t.x *= sx; t.right *= sx; t.y *= sy; t.bottom *= sy;
    t.xs = t.xs.map(x => x * sx); t.ys = t.ys.map(y => y * sy);
    for (const c of t.cells) { c.x *= sx; c.right *= sx; c.y *= sy; c.bottom *= sy; }
  }
  small.width = small.height = 1; return tables;
}
function clearTextFromBackground(canvas, items, tables) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  for (const box of [...items.map(bounds), ...tables]) {
    const padding = box.xs ? 6 : 2;
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(box.x - padding))), y = Math.max(0, Math.min(canvas.height - 1, Math.floor(box.y - padding)));
    const right = Math.min(canvas.width, Math.ceil(box.right + padding)), bottom = Math.min(canvas.height, Math.ceil(box.bottom + padding));
    if (right <= x || bottom <= y) continue;
    // Sample surrounding paper rather than painting every scan pure white.
    const samples = [[x, y], [Math.min(canvas.width - 1, right), y], [x, Math.min(canvas.height - 1, bottom)], [Math.min(canvas.width - 1, right), Math.min(canvas.height - 1, bottom)]];
    const pixels = samples.map(([px, py]) => context.getImageData(px, py, 1, 1).data).sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]);
    const color = pixels.at(-1); context.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    context.fillRect(x, y, right - x, bottom - y);
  }
}
export async function exportEditableWord(documentPdf, sourceResults, pdfjs, JSZip, onProgress = () => {}, aborted = () => false) {
  const check = () => { if (aborted()) throw new Error('Đã hủy xuất Word.'); };
  check(); onProgress('Đang chuẩn bị font tiếng Việt cho Word…');
  const fonts = await wordFonts(); check();
  const pages = [], entries = [...sourceResults].sort((a, b) => a[0] - b[0]);
  let tableCount = 0;
  for (const [index, [number, result]] of entries.entries()) {
    check(); onProgress(`Đang dựng bố cục Word · Trang ${number} (${index + 1}/${entries.length})…`);
    const page = await documentPdf.getPage(number), original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: boundedScale(original.width, original.height, 180) });
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    try {
      await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: 'rgb(255,255,255)' }).promise;
      check();
      const items = result.native ? nativeTextItems(await page.getTextContent(), viewport, pdfjs) : result.items.map(item => ({ ...item, fontSize: item.fontSize ? item.fontSize * canvas.height / result.height : undefined, poly: item.poly.map(([x, y]) => [x * canvas.width / result.width, y * canvas.height / result.height]) }));
      const tables = findTables(canvas);
      const remaining = assignItemsToTables(items, tables);
      // Empty grids in engineering graphics are kept as graphics, not invented tables.
      const populated = tables.filter(t => t.cells.filter(c => c.items.some(i => i.text.trim())).length >= 2);
      const returned = tables.filter(t => !populated.includes(t)).flatMap(t => t.cells.flatMap(c => c.items));
      clearTextFromBackground(canvas, items, populated);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Không dựng được hình nền trang Word.');
      pages.push({ number, width: canvas.width, height: canvas.height, pointWidth: original.width, pointHeight: original.height,
        items: [...remaining, ...returned], tables: populated, background: new Uint8Array(await blob.arrayBuffer()) });
      tableCount += populated.length;
    } finally { canvas.width = canvas.height = 1; }
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  check(); onProgress(`Đang đóng gói Word · ${pages.length} trang, ${tableCount} bảng…`);
  const measurement = document.createElement('canvas').getContext('2d');
  const measureText = (text, size, bold, italic) => {
    measurement.font = `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${size}px OCRWord`;
    return measurement.measureText(text).width;
  };
  const bytes = await createEditableDocx(pages, { JSZip, fonts, measureText });
  check(); return { bytes, pages: pages.length, tables: tableCount };
}
