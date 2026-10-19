import SignaturePad from './vendor/signature/pad.mjs';
import { clampBox, imageInkBounds, removeWhite, buildVisualPdf, assertUnsignedDocument } from './pdf-sign-core.mjs';
const $ = id => document.getElementById(id);
const pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
let source, documentPdf, previewPdf, visualBytes, filename = '', current = 1, marks = [], asset, selected;
let revision = 0, appliedRevision = -1, generation = 0, paint = 0, busy = false, showingResult = false, downloadUrl, uploadedImage;
const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error); };
function revokeDownload() { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = null; $('download').hidden = true; $('download').removeAttribute('href'); }
function controls() {
  $('apply').disabled = busy || !documentPdf || (!marks.length && !$('digital').checked);
  $('export').disabled = busy || appliedRevision !== revision;
  $('add').disabled = $('repeat').disabled = busy || !asset || !documentPdf;
  $('remove').disabled = busy || !selected || showingResult;
  $('original').disabled = busy || !showingResult;
  for (const id of ['file', 'reset', 'mode', 'use', 'digital', 'certificate', 'password', 'inspect', 'reason', 'location', 'width', 'image', 'remove-white', 'typed', 'font', 'color', 'thickness', 'undo', 'clear']) $(id).disabled = busy;
  $('pages').classList.toggle('busy', busy); $('placements').classList.toggle('busy', busy);
}
function invalidate() {
  revision++; appliedRevision = -1; visualBytes = null; revokeDownload();
  if (showingResult) { showingResult = false; void renderPage(); }
  controls();
}
const padCanvas = $('pad');
const pad = new SignaturePad(padCanvas, { penColor: $('color').value, minWidth: .7, maxWidth: 2.5, throttle: 8, minDistance: 1 });
let padWidth = 0, padHeight = 0;
new ResizeObserver(() => {
  const r = padCanvas.getBoundingClientRect(); if (!r.width || !r.height || (padWidth === r.width && padHeight === r.height)) return;
  const data = pad.toData(), sx = padWidth ? r.width / padWidth : 1, sy = padHeight ? r.height / padHeight : 1;
  for (const group of data) for (const point of group.points) { point.x *= sx; point.y *= sy; }
  const ratio = Math.min(3, devicePixelRatio || 1); padCanvas.width = Math.round(r.width * ratio); padCanvas.height = Math.round(r.height * ratio); padCanvas.getContext('2d').scale(ratio, ratio);
  padWidth = r.width; padHeight = r.height; pad.clear(); pad.fromData(data);
}).observe(padCanvas);
$('clear').onclick = () => pad.clear();
$('undo').onclick = () => { const data = pad.toData(); data.pop(); pad.fromData(data); };
$('color').oninput = () => { pad.penColor = $('color').value; };
$('thickness').oninput = () => { const v = Number($('thickness').value); pad.minWidth = v * .35; pad.maxWidth = v * 1.25; };
$('mode').onchange = () => { for (const mode of ['draw', 'type', 'image']) $(mode + '-panel').hidden = $('mode').value !== mode; };
$('image').onchange = async () => {
  const file = $('image').files[0]; if (!file) return;
  uploadedImage?.close(); uploadedImage = null;
  try {
    if (file.size > 10 * 1024 * 1024) throw Error('Ảnh chữ ký tối đa 10 MB.');
    const bitmap = await createImageBitmap(file); if (bitmap.width * bitmap.height > 16000000) { bitmap.close(); throw Error('Ảnh quá lớn; dùng ảnh chữ ký dưới 16 triệu điểm ảnh.'); }
    uploadedImage = bitmap; $('asset-status').textContent = 'Đã chọn ảnh. Bấm Dùng chữ ký này để chuẩn bị.';
  } catch { status('Không mở được ảnh PNG/JPG/WebP hoặc ảnh vượt giới hạn.', true); }
};
async function makeAsset() {
  const canvas = document.createElement('canvas'), mode = $('mode').value;
  if (mode === 'draw') { if (pad.isEmpty()) throw Error('Hãy vẽ chữ ký trước.'); canvas.width = padCanvas.width; canvas.height = padCanvas.height; canvas.getContext('2d').drawImage(padCanvas, 0, 0); }
  else if (mode === 'type') {
    const text = $('typed').value.trim().normalize('NFC'); if (!text) throw Error('Hãy nhập họ tên.');
    const italic = $('font').value === 'italic', face = new FontFace('SignatureNoto', `url(./NotoSans-${italic ? 'Italic' : 'Regular'}.ttf)`, { style: italic ? 'italic' : 'normal' });
    await face.load(); document.fonts.add(face);
    const font = `${italic ? 'italic ' : ''}64px SignatureNoto`, measure = canvas.getContext('2d'); measure.font = font;
    canvas.width = Math.min(7000, Math.ceil(measure.measureText(text).width + 30)); canvas.height = 140;
    const context = canvas.getContext('2d'); context.font = font; context.fillStyle = $('color').value; context.fillText(text, 12, 95);
  } else {
    if (!uploadedImage) throw Error('Hãy chọn ảnh chữ ký.');
    const scale = Math.min(1, 2400 / Math.max(uploadedImage.width, uploadedImage.height)); canvas.width = Math.round(uploadedImage.width * scale); canvas.height = Math.round(uploadedImage.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
    if ($('remove-white').checked) { const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height); removeWhite(pixels.data); ctx.putImageData(pixels, 0, 0); }
  }
  const b = imageInkBounds(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
  if (!b) throw Error('Ảnh hoặc chữ ký trống.');
  const cropped = document.createElement('canvas'); cropped.width = b.width; cropped.height = b.height; cropped.getContext('2d').drawImage(canvas, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height);
  return { url: cropped.toDataURL('image/png'), ratio: b.width / b.height };
}
$('use').onclick = async () => {
  busy = true; controls();
  try { asset = await makeAsset(); $('asset').src = asset.url; $('asset').hidden = false; $('asset-status').textContent = 'Chữ ký sẵn sàng. Bấm lên trang hoặc Thêm vào trang.'; }
  catch (error) { status(error.message, true); }
  finally { busy = false; controls(); }
};
function overlay(view) {
  $('placements').replaceChildren();
  if (showingResult) return;
  for (const mark of marks.filter(m => m.page === current)) {
    const box = document.createElement('div'); box.className = 'sig-box' + (selected === mark.id ? ' selected' : ''); box.dataset.id = mark.id; box.setAttribute('aria-label', 'Khung chữ ký'); box.tabIndex = 0;
    Object.assign(box.style, { left: mark.x / view.width * 100 + '%', top: mark.y / view.height * 100 + '%', width: mark.width / view.width * 100 + '%', height: mark.height / view.height * 100 + '%' });
    const image = document.createElement('img'); image.src = mark.asset.url; image.alt = 'Chữ ký'; const handle = document.createElement('span'); handle.className = 'handle'; box.append(image, handle);
    box.onkeydown = event => {
      if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); marks = marks.filter(m => m !== mark); selected = null; invalidate(); overlay(view); }
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (delta) { event.preventDefault(); Object.assign(mark, clampBox({ ...mark, x: mark.x + delta[0] * (event.shiftKey ? 10 : 1), y: mark.y + delta[1] * (event.shiftKey ? 10 : 1) }, view.width, view.height)); invalidate(); overlay(view); $('placements').querySelector(`[data-id="${mark.id}"]`)?.focus(); }
    };
    box.onpointerdown = event => {
      if (busy) return; event.stopPropagation(); event.preventDefault(); selected = mark.id;
      $('width').value = (mark.width * 25.4 / 72).toFixed(1); controls();
      const start = { x: event.clientX, y: event.clientY, ...mark }, resizing = event.target === handle, rect = $('paper').getBoundingClientRect(); box.setPointerCapture(event.pointerId);
      const move = e => {
        const dx = (e.clientX - start.x) * view.width / rect.width, dy = (e.clientY - start.y) * view.height / rect.height;
        // Screen pointer origin is separate from the immutable PDF box origin.
        const next = resizing ? { ...mark, width: Math.max(5, start.width + dx), height: Math.max(3, start.width + dx) / mark.asset.ratio } : { ...mark, x: start.pdfX + dx, y: start.pdfY + dy };
        Object.assign(mark, clampBox(next, view.width, view.height));
        Object.assign(box.style, { left: mark.x / view.width * 100 + '%', top: mark.y / view.height * 100 + '%', width: mark.width / view.width * 100 + '%', height: mark.height / view.height * 100 + '%' });
      };
      start.pdfX = mark.x; start.pdfY = mark.y; start.x = event.clientX; start.y = event.clientY;
      box.addEventListener('pointermove', move);
      const end = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', end); box.removeEventListener('pointercancel', end); invalidate(); overlay(view); };
      box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    };
    $('placements').append(box);
  }
}
async function renderPage() {
  if (!documentPdf) return;
  const token = ++paint, doc = showingResult && previewPdf ? previewPdf : documentPdf, pageNumber = Math.min(current, doc.numPages);
  try {
    const page = await doc.getPage(pageNumber), view = page.getViewport({ scale: 1 });
    const scale = Math.min(1.8, 2048 / Math.max(view.width, view.height)), viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (token !== paint) return;
    $('preview').width = canvas.width; $('preview').height = canvas.height; $('preview').getContext('2d').drawImage(canvas, 0, 0);
    $('page-title').textContent = `Trang ${current}/${doc.numPages}${showingResult ? ' · Đã áp dụng' : ''}`;
    [...$('pages').children].forEach(button => button.classList.toggle('active', Number(button.dataset.page) === current)); overlay(view); controls();
  } catch (error) { if (token === paint) status('Không hiển thị được trang PDF: ' + error.message, true); }
}
async function addMark(position, page = current) {
  if (!asset || !documentPdf || busy) return;
  const doc = documentPdf, token = generation;
  const view = (await doc.getPage(page)).getViewport({ scale: 1 });
  if (token !== generation || doc !== documentPdf) return;
  const width = Math.min(view.width * .8, Math.max(5, Number($('width').value) || 50) * 72 / 25.4);
  const mark = clampBox({ id: crypto.randomUUID(), page, asset, width, height: width / asset.ratio, x: position?.x ?? view.width - width - 25, y: position?.y ?? view.height - width / asset.ratio - 25 }, view.width, view.height);
  marks.push(mark); selected = mark.id; invalidate(); await renderPage();
}
$('add').onclick = () => addMark();
$('paper').onpointerdown = async event => {
  if (event.target.closest('.sig-box') || !documentPdf || !asset || busy) return;
  const rect = $('paper').getBoundingClientRect(), view = (await documentPdf.getPage(current)).getViewport({ scale: 1 });
  await addMark({ x: (event.clientX - rect.left) * view.width / rect.width, y: (event.clientY - rect.top) * view.height / rect.height });
};
$('repeat').onclick = async () => {
  if (!asset || !documentPdf || busy) return;
  const template = marks.find(m => m.id === selected), from = (await documentPdf.getPage(current)).getViewport({ scale: 1 });
  for (let page = 1; page <= documentPdf.numPages; page++) {
    if (template && page === template.page) continue;
    const view = (await documentPdf.getPage(page)).getViewport({ scale: 1 });
    const width = template?.width || Math.min(view.width * .8, Number($('width').value) * 72 / 25.4 || 140);
    marks.push(clampBox({ id: crypto.randomUUID(), page, asset: template?.asset || asset, width, height: width / (template?.asset || asset).ratio, x: template ? template.x / from.width * view.width : view.width - width - 25, y: template ? template.y / from.height * view.height : view.height - width / asset.ratio - 25 }, view.width, view.height));
  }
  invalidate(); await renderPage();
};
$('remove').onclick = () => { marks = marks.filter(m => m.id !== selected); selected = null; invalidate(); void renderPage(); };
$('width').onchange = async () => {
  const mark = marks.find(m => m.id === selected); if (!mark) return;
  const view = (await documentPdf.getPage(mark.page)).getViewport({ scale: 1 }), width = Math.max(5, Number($('width').value) || 50) * 72 / 25.4;
  Object.assign(mark, clampBox({ ...mark, width, height: width / mark.asset.ratio }, view.width, view.height)); invalidate(); await renderPage();
};
async function reset() {
  generation++; paint++; await previewPdf?.destroy(); await documentPdf?.destroy(); previewPdf = documentPdf = null;
  source = visualBytes = undefined; marks = []; asset = selected = null; filename = ''; uploadedImage?.close(); uploadedImage = null;
  revision++; appliedRevision = -1; showingResult = false; revokeDownload(); pad.clear(); $('pages').replaceChildren(); $('placements').replaceChildren(); $('preview').width = $('preview').height = 1; $('asset').hidden = true;
  for (const id of ['file', 'image', 'certificate', 'password', 'typed', 'cert-info', 'reason', 'location']) { if ('value' in $(id)) $(id).value = ''; else $(id).textContent = ''; }
  $('digital').checked = false; $('filename').textContent = 'Chưa có tài liệu'; $('page-title').textContent = 'Trang PDF'; status('Chọn PDF để bắt đầu.'); controls();
}
$('reset').onclick = () => { if (!busy) void reset(); };
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file || busy) return;
  await reset(); busy = true; controls(); const token = generation;
  try {
    if (file.size > 200 * 1024 * 1024) throw Error('PDF tối đa 200 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = await PDFLib.PDFDocument.load(bytes.slice()); assertUnsignedDocument(check, PDFLib);
    source = bytes; documentPdf = await pdfjs.getDocument({ data: bytes.slice() }).promise; filename = file.name; current = 1;
    $('filename').textContent = filename; status('Chọn cách tạo chữ ký, đặt lên trang rồi Áp dụng.');
    for (let n = 1; n <= documentPdf.numPages; n++) {
      const button = document.createElement('button'); button.dataset.page = n; button.textContent = 'Trang ' + n; button.onclick = () => { if (!busy) { current = n; selected = null; void renderPage(); } }; $('pages').append(button);
    }
    await renderPage();
  } catch (error) { status(error.message || 'Không mở được PDF. Kiểm tra mật khẩu tệp.', true); source = undefined; }
  finally { if (generation === token) { busy = false; controls(); } }
};
for (const id of ['digital', 'certificate', 'password', 'reason', 'location']) $(id).addEventListener('input', () => { invalidate(); if (id === 'certificate' || id === 'password') $('cert-info').textContent = ''; });
async function certificateTask(action, pdf) {
  const file = $('certificate').files[0];
  if (!file) throw Error('Hãy chọn chứng thư có khóa riêng .p12/.pfx hoặc PEM.');
  if (file.size > 10 * 1024 * 1024) throw Error('Tệp chứng thư tối đa 10 MB.');
  const certificate = new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    let worker;
    try { worker = new Worker(new URL('./pdf-sign-worker.mjs', import.meta.url), { type: 'module' }); }
    catch { certificate.fill(0); reject(Error('Không khởi tạo được bộ ký số.')); return; }
    const timer = setTimeout(() => { worker.terminate(); reject(Error('Quá thời gian xử lý chứng thư.')); }, 120000);
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    worker.onmessage = ({ data }) => { finish(); data.ok ? resolve(data) : reject(Error(data.error)); };
    worker.onerror = () => { finish(); reject(Error('Không tải hoặc chạy được bộ ký số. Hãy tải lại trang.')); };
    try { worker.postMessage({ action, pdf, certificate, password: $('password').value, options: { pem: /\.pem$/i.test(file.name), reason: $('reason').value, location: $('location').value } }, [certificate.buffer]); }
    catch { certificate.fill(0); finish(); reject(Error('Không đọc được tệp chứng thư.')); }
  });
}
function certificateInfo(info) { $('cert-info').textContent = `${info.subject} · RSA ${info.bits} · Cấp bởi ${info.issuer} · Hết hạn ${new Date(info.validTo).toLocaleDateString('vi-VN')}. Khớp khóa, còn hạn; chưa xác thực chuỗi CA hoặc thu hồi.`; }
$('inspect').onclick = async () => { busy = true; controls(); try { certificateInfo((await certificateTask('inspect')).info); status('Đã đọc chứng thư.'); } catch (e) { status(e.message, true); } finally { busy = false; controls(); } };
$('apply').onclick = async () => {
  if (busy || !documentPdf) return;
  busy = true; controls(); status('Đang áp dụng chữ ký hiển thị…');
  try {
    const result = await buildVisualPdf(source, marks, PDFLib, documentPdf);
    await previewPdf?.destroy(); previewPdf = await pdfjs.getDocument({ data: result.slice() }).promise; visualBytes = result; appliedRevision = revision; showingResult = true;
    await renderPage(); status($('digital').checked ? 'Đã áp dụng hình hiển thị. Bấm Xuất PDF để ký số bằng chứng thư.' : 'Đã áp dụng. Kiểm tra trang rồi bấm Xuất PDF.');
  } catch (e) { status(e.message, true); }
  finally { busy = false; controls(); }
};
$('original').onclick = () => { showingResult = false; void renderPage(); };
$('export').onclick = async () => {
  if (busy || appliedRevision !== revision || !visualBytes) return;
  busy = true; controls(); revokeDownload();
  try {
    let bytes = visualBytes;
    if ($('digital').checked) { status('Đang ký số RSA/SHA-256 trong trình duyệt…'); const signed = await certificateTask('sign', bytes); bytes = signed.bytes; certificateInfo(signed.info); }
    downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = $('download'); link.href = downloadUrl; link.download = filename.replace(/\.pdf$/i, '') + ($('digital').checked ? '_signed.pdf' : '_signature.pdf'); link.hidden = false; link.click();
    status($('digital').checked ? 'Đã tạo PDF có chữ ký số. Mở bằng trình đọc PDF để kiểm tra chữ ký và độ tin cậy chứng thư.' : 'Đã tạo PDF có chữ ký hiển thị; đây không phải chữ ký số bằng chứng thư.');
  } catch (e) { status(e.message, true); }
  finally { $('password').value = ''; busy = false; controls(); }
};
controls();
