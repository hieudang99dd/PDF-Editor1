import { parsePages, boundedScale, normalizeItems, preserveNativeTextLayer, exportSearchablePdf } from './pdf-ocr-core.mjs?v=20261019-wordscan1';
const $ = id => document.getElementById(id);
const pdfjs = window.pdfjsLib;
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.js', import.meta.url).href;
let file, bytes, documentPdf, current = 1, results = new Map(), busy = false;
let vietnameseWorker;
let engine, engineWorker, generation = 0, previewTask, previewGeneration = 0;
const downloads = new Set();
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function controls() {
  for (const id of ['file', 'pages', 'dpi', 'language', 'skip', 'refine']) $(id).disabled = busy;
  $('run').disabled = busy || !documentPdf;
  $('cancel').disabled = !busy;
  const ready = !busy && results.size > 0;
  $('pdf').disabled = !ready; $('txt').disabled = !ready; $('word').disabled = !ready;
}
function stop() {
  generation++;
  vietnameseWorker?.terminate(); vietnameseWorker = null;
  engineWorker?.terminate(); engineWorker = null; engine = null;
  busy = false; controls();
}
async function getEngine(token) {
  if (engine) return engine;
  status('Đang tải và khởi tạo PaddleOCR. Lần đầu có thể mất một lúc…');
  const { PaddleOCR } = await import('./vendor/paddleocr/index.mjs');
  if (token !== generation) throw new Error('Đã hủy.');
  // Keep a handle so Cancel interrupts model loading and a running inference.
  engineWorker = new Worker(new URL('./vendor/paddleocr/assets/worker-entry-C9UNuyOJ.js', import.meta.url), { type: 'module' });
  const instance = await PaddleOCR.create({ initialize: false, lang: $('language').value, ocrVersion: 'PP-OCRv6',
    worker: { createWorker: () => engineWorker },
    textDetectionModelName: 'PP-OCRv6_small_det', textRecognitionModelName: 'PP-OCRv6_small_rec',
    textDetectionModelAsset: { url: new URL('./vendor/paddleocr/det.tar', import.meta.url).href },
    textRecognitionModelAsset: { url: new URL('./vendor/paddleocr/rec.tar', import.meta.url).href },
    ortOptions: { backend: 'wasm', numThreads: 1, wasmPaths: new URL('./vendor/paddleocr/ort/', import.meta.url).href }
  });
  await instance.initialize();
  if (token !== generation) throw new Error('Đã hủy.');
  engine = instance;
  return instance;
}
async function refineVietnamese(canvas, items, token) {
  if (!$('refine').checked || $('language').value !== 'vi' || !items.length) return;
  if (!vietnameseWorker) {
    status('Đang tải bộ kiểm tra dấu tiếng Việt…');
    const { default: Tesseract } = await import('./vendor/paddleocr/tesseract/tesseract.mjs');
    const { createWorker } = Tesseract;
    if (token !== generation) return;
    const worker = await createWorker('vie+eng', 1, {
      workerPath: new URL('./vendor/paddleocr/tesseract/worker.min.js', import.meta.url).href,
      corePath: new URL('./vendor/paddleocr/tesseract/tesseract-core-simd-lstm.wasm.js', import.meta.url).href,
      langPath: new URL('./vendor/paddleocr/tesseract/lang/', import.meta.url).href,
      gzip: false, workerBlobURL: false
    });
    if (token !== generation) { await worker.terminate(); return; }
    vietnameseWorker = worker;
    await worker.setParameters({ tessedit_pageseg_mode: '7', preserve_interword_spaces: '1' });
  }
  for (const [index, item] of items.entries()) {
    if (token !== generation) return;
    status(`Kiểm tra dấu tiếng Việt · Dòng ${index + 1}/${items.length}…`);
    const [tl, tr, , bl] = item.poly;
    const width = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
    const height = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
    const crop = document.createElement('canvas'); crop.width = Math.ceil(width) + 20; crop.height = Math.ceil(height) + 20;
    try {
      const context = crop.getContext('2d'); context.fillStyle = 'white'; context.fillRect(0, 0, crop.width, crop.height);
      context.translate(10, 10); context.rotate(-Math.atan2(tr[1] - tl[1], tr[0] - tl[0]));
      context.drawImage(canvas, -tl[0], -tl[1]);
      const { data } = await vietnameseWorker.recognize(crop);
      if (token !== generation) return;
      if (data.text.trim()) {
        item.paddleText = item.text; item.paddleScore = item.score;
        item.text = data.text.trim().normalize('NFC'); item.score = data.confidence / 100;
      }
    } finally { crop.width = crop.height = 1; }
  }
}
async function refineTableCells(canvas, items, token) {
  if (!vietnameseWorker || token !== generation) return;
  const { findTables } = await import('./pdf-ocr-word-client.mjs?v=20261019-wordscan1');
  const { bounds } = await import('./pdf-ocr-word-layout.mjs');
  if (token !== generation) return;
  const inside = (item, table) => {
    const b = bounds(item), x = (b.x + b.right) / 2, y = (b.y + b.bottom) / 2;
    return x > table.x && x < table.right && y > table.y && y < table.bottom;
  };
  const tables = findTables(canvas).filter(t => items.filter(i => inside(i, t)).length >= 2);
  if (!tables.length) return;
  const replacement = [], successfulTables = new Set(), worker = vietnameseWorker;
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  try {
    for (const [ti, table] of tables.entries()) for (const [ci, cell] of table.cells.entries()) {
      if (token !== generation) return;
      status(`Đang nhận dạng bảng ${ti + 1}/${tables.length} · Ô ${ci + 1}/${table.cells.length}…`);
      const x = Math.ceil(cell.x + 4), y = Math.ceil(cell.y + 4);
      const width = Math.floor(cell.right - 4) - x, height = Math.floor(cell.bottom - 4) - y;
      if (width < 5 || height < 5) continue;
      const crop = document.createElement('canvas'); crop.width = width + 20; crop.height = height + 20;
      try {
        const context = crop.getContext('2d'); context.fillStyle = 'white'; context.fillRect(0, 0, crop.width, crop.height);
        context.drawImage(canvas, x, y, width, height, 10, 10, width, height);
        const { data } = await worker.recognize(crop, {}, { blocks: true, text: true });
        if (token !== generation) return;
        const lines = (data.blocks || []).flatMap(b => b.paragraphs.flatMap(p => p.lines));
        if (!lines.length && data.text.trim()) lines.push({ text: data.text, confidence: data.confidence, bbox: { x0: 10, y0: 10, x1: width + 10, y1: height + 10 } });
        for (const line of lines) {
          if (!line.text.trim()) continue;
          const b = line.bbox, left = x - 10 + b.x0, top = y - 10 + b.y0, right = x - 10 + b.x1, bottom = y - 10 + b.y1;
          successfulTables.add(table);
          replacement.push({ text: line.text.trim().normalize('NFC'), score: line.confidence / 100,
            fontSize: (b.y1 - b.y0) * 1.12, poly: [[left, top], [right, top], [right, bottom], [left, bottom]] });
        }
      } finally { crop.width = crop.height = 1; }
    }
    if (token === generation) {
      const keep = items.filter(item => !tables.some(t => successfulTables.has(t) && inside(item, t)));
      items.splice(0, items.length, ...keep, ...replacement);
      items.sort((a, b) => bounds(a).y - bounds(b).y || bounds(a).x - bounds(b).x);
    }
  } finally { if (token === generation) await worker.setParameters({ tessedit_pageseg_mode: '7' }); }
}
function showLines() {
  const result = results.get(current);
  $('result-title').textContent = `Kết quả · Trang ${current}`;
  $('lines').replaceChildren(); $('boxes').replaceChildren();
  if (!result) { $('lines').textContent = 'Trang này chưa được nhận dạng.'; return; }
  if (result.native) { $('lines').textContent = 'Trang đã có lớp chữ, được giữ nguyên và không thêm OCR.'; return; }
  $('boxes').setAttribute('viewBox', `0 0 ${result.width} ${result.height}`);
  result.items.forEach((item, index) => {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', item.poly.map(p => p.join(',')).join(' '));
    if (item.score < .85) polygon.classList.add('low');
    $('boxes').append(polygon);
    const row = document.createElement('div'); row.className = 'line' + (item.score < .85 ? ' low' : '');
    const score = document.createElement('small'); score.textContent = `Dòng ${index + 1} · Tin cậy ${Math.round(item.score * 100)}%`;
    const input = document.createElement('textarea'); input.value = item.text;
    input.setAttribute('aria-label', `Văn bản dòng ${index + 1}`);
    input.addEventListener('input', () => { item.text = input.value.normalize('NFC'); });
    input.addEventListener('focus', () => {
      $('boxes').querySelectorAll('.selected').forEach(p => p.classList.remove('selected'));
      polygon.classList.add('selected');
    });
    row.append(score, input); $('lines').append(row);
  });
  if (!result.items.length) $('lines').textContent = 'Không nhận dạng được dòng chữ. Thử chất lượng Chữ nhỏ hoặc kiểm tra ảnh nguồn.';
}
async function showPage(number) {
  current = number;
  const serial = ++previewGeneration;
  previewTask?.cancel();
  $('page-list').querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.page) === current));
  showLines();
  const page = await documentPdf.getPage(number);
  if (serial !== previewGeneration) return;
  const base = page.getViewport({ scale: 1 });
  const view = page.getViewport({ scale: Math.min(1.5, 1400 / base.width, 1800 / base.height) });
  const canvas = $('preview'); canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
  previewTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: view });
  try { await previewTask.promise; } catch (error) { if (error.name !== 'RenderingCancelledException') throw error; }
}
function updatePageLabels() {
  $('page-list').querySelectorAll('button').forEach(button => {
    const n = Number(button.dataset.page), result = results.get(n);
    button.textContent = `Trang ${n}${result ? result.native ? ' · Có chữ' : ' ✓' : ''}`;
  });
}
$('file').addEventListener('change', async event => {
  const selected = event.target.files[0]; if (!selected) return;
  stop(); const token = generation; busy = true; controls();
  results.clear(); $('lines').replaceChildren(); $('boxes').replaceChildren();
  $('pdf').disabled = $('txt').disabled = $('word').disabled = true;
  try {
    previewGeneration++; previewTask?.cancel();
    const previous = documentPdf; documentPdf = null;
    await previous?.destroy();
    if (token !== generation) return;
    if (selected.size > 200 * 1024 * 1024) throw new Error('Tệp vượt 200 MB. Hãy chia nhỏ PDF để OCR trên trình duyệt.');
    const inputBytes = new Uint8Array(await selected.arrayBuffer());
    if (token !== generation) return;
    const loaded = await pdfjs.getDocument({ data: inputBytes.slice() }).promise;
    if (token !== generation) { await loaded.destroy(); return; }
    documentPdf = loaded; bytes = inputBytes; file = selected;
    $('filename').textContent = `${file.name} · ${documentPdf.numPages} trang`;
    $('page-list').replaceChildren(); $('pages').value = ''; $('progress').value = 0;
    for (let n = 1; n <= documentPdf.numPages; n++) {
      const button = document.createElement('button'); button.dataset.page = n; button.textContent = `Trang ${n}`;
      button.addEventListener('click', () => showPage(n).catch(e => status(e.message, true)));
      $('page-list').append(button);
    }
    await showPage(1); status('Đã mở PDF. Chọn phạm vi trang rồi bấm Nhận dạng OCR.');
  } catch (error) {
    if (token === generation) { documentPdf = null; bytes = null; file = null; $('page-list').replaceChildren(); status('Không mở được PDF: ' + error.message, true); }
  } finally { if (token === generation) { busy = false; controls(); } }
});
$('cancel').addEventListener('click', () => { stop(); status('Đã hủy. Các trang đã hoàn tất vẫn có thể kiểm tra và xuất.'); });
$('run').addEventListener('click', async () => {
  if (busy || !documentPdf) return;
  let pages;
  try { pages = parsePages($('pages').value, documentPdf.numPages); }
  catch (error) { status(error.message, true); return; }
  vietnameseWorker?.terminate(); vietnameseWorker = null;
  const token = ++generation; busy = true; controls();
  // A new run replaces previous results; never mix different settings silently.
  results.clear(); showLines(); updatePageLabels(); $('progress').value = 0; $('progress').max = pages.length;
  try {
    for (const [index, number] of pages.entries()) {
      const page = await documentPdf.getPage(number);
      const text = await page.getTextContent();
      if (token !== generation) return;
      // An existing short footer/QR text does not mean a page full of scan
      // pixels has a usable text layer. Only inspect image operators for
      // sparse native text; dense vector text avoids the extra render work.
      let keepNative = preserveNativeTextLayer(text, true);
      if (!keepNative && text.items.some(item => item.str?.trim())) {
        const ops = await page.getOperatorList();
        if (token !== generation) return;
        const images = new Set([
          pdfjs.OPS.paintImageXObject,
          pdfjs.OPS.paintJpegXObject,
          pdfjs.OPS.paintInlineImageXObject,
          pdfjs.OPS.paintImageXObjectRepeat,
          pdfjs.OPS.paintInlineImageXObjectGroup,
          pdfjs.OPS.paintImageMaskXObject
        ].filter(Number.isInteger));
        const hasRaster = ops.fnArray.some(fn => images.has(fn));
        keepNative = preserveNativeTextLayer(text, hasRaster);
      }
      if ($('skip').checked && keepNative) {
        results.set(number, { native: true, text: text.items.map(i => i.str || '').join(' ') });
      } else {
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: boundedScale(base.width, base.height, Number($('dpi').value)) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        try {
          await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: 'rgb(255,255,255)' }).promise;
          const predictor = await getEngine(token);
          if (token !== generation) return;
          status(`Đang nhận dạng trang ${number} · ${index + 1}/${pages.length}…`);
          const [raw] = await predictor.predict(canvas, { textDetLimitSideLen: 1280, textDetLimitType: 'max', textRecScoreThresh: 0 });
          if (token !== generation) return;
          const items = normalizeItems(raw.items, canvas.width, canvas.height);
          await refineVietnamese(canvas, items, token);
          if ($('refine').checked && $('language').value === 'vi') await refineTableCells(canvas, items, token);
          if (token !== generation) return;
          results.set(number, { native: false, width: canvas.width, height: canvas.height, viewport, items });
        } finally { canvas.width = canvas.height = 1; }
      }
      if (token !== generation) return;
      $('progress').value = index + 1; updatePageLabels();
      if (number === current) showLines();
    }
    const count = [...results.values()].filter(r => !r.native).length;
    await showPage(pages[0]);
    status(`Hoàn tất: OCR ${count} trang, giữ nguyên ${results.size - count} trang đã có chữ. Kiểm tra kết quả trước khi xuất.`);
  } catch (error) {
    if (token === generation) {
      engineWorker?.terminate(); engineWorker = null; engine = null;
      status('Chưa hoàn tất OCR: ' + error.message + '. Các trang đã xong được giữ lại; có thể thử lại.', true);
    }
  } finally { if (token === generation) { busy = false; controls(); } }
});
function download(blob, extension) {
  const url = URL.createObjectURL(blob); downloads.add(url);
  const link = document.createElement('a'); link.href = url;
  link.download = file.name.replace(/\.pdf$/i, '') + '_ocr.' + extension;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => { URL.revokeObjectURL(url); downloads.delete(url); }, 120000);
}
$('txt').addEventListener('click', () => {
  const text = [...results].sort((a, b) => a[0] - b[0]).map(([n, r]) =>
    `--- Trang ${n} ---\n` + (r.native ? r.text : r.items.map(i => i.text).join('\n'))).join('\n\n');
  download(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }), 'txt');
});
$('word').addEventListener('click', async () => {
  if (busy || !results.size) return;
  const token = ++generation;
  const snapshot = new Map([...results].map(([n, r]) => [n, { ...r, items: r.items?.map(i => ({ ...i, poly: i.poly.map(p => [...p]) })) }]));
  busy = true; controls();
  try {
    const { exportEditableWord } = await import('./pdf-ocr-word-client.mjs');
    const output = await exportEditableWord(documentPdf, snapshot, pdfjs, window.JSZip,
      text => { if (token === generation) status(text); }, () => token !== generation);
    if (token !== generation) return;
    download(new Blob([output.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'docx');
    status(`Đã xuất Word: ${output.pages} trang, ${output.tables} bảng chỉnh sửa được. Font tiếng Việt đã được nhúng.`);
  } catch (error) { if (token === generation) status('Không xuất được Word: ' + error.message, true); }
  finally { if (token === generation) { busy = false; controls(); } }
});
$('pdf').addEventListener('click', async () => {
  if (busy || !results.size) return;
  busy = true; controls(); $('cancel').disabled = true;
  status('Đang thêm lớp chữ vào PDF gốc…');
  try {
    const response = await fetch(new URL('./NotoSans-Regular.ttf', import.meta.url));
    if (!response.ok) throw new Error('Không tải được font tiếng Việt.');
    const output = await exportSearchablePdf(bytes, results, window.PDFLib, window.fontkit, await response.arrayBuffer());
    download(new Blob([output], { type: 'application/pdf' }), 'pdf');
    status('Đã xuất PDF với lớp chữ tìm kiếm được. Các trang ngoài phạm vi được giữ trong tệp.');
  } catch (error) { status('Không xuất được PDF: ' + error.message, true); }
  finally { busy = false; controls(); }
});
window.addEventListener('pagehide', () => { engineWorker?.terminate(); vietnameseWorker?.terminate(); downloads.forEach(url => URL.revokeObjectURL(url)); });
