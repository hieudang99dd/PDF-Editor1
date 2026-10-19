const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const corePromise = import('../pdfium-preflight-core.mjs');

test('quality report clearly distinguishes native scan, signature and PDF/A hints', async () => {
  const { summarizePage, compileReport } = await corePromise;
  const first = summarizePage(0, 595, 842, 90, [
    { editable: true, vertical: false, lines: [{}],
      box: { x: 10, top: 90, w: 90, h: 12 }, runs: [{ text: 'Đường KM1+200' }] },
    { editable: false, vertical: true, lines: [{}, {}],
      box: { x: 20, top: 75, w: -1, h: 10 }, runs: [{ text: '�' }] }
  ]);
  assert.equal(first.page, 1);
  assert.equal(first.notEditable, 1);
  assert.equal(first.multiline, 1);
  assert.equal(first.unknownGlyphs, 1);
  assert.equal(first.invalidGeometry, 1);
  const report = compileReport({ totalPages: 3, pages: [first],
    info: { signatures: 1, encrypted: false }, pdfAClaimed: true });
  assert.equal(report.readOnly, true);
  assert.equal(report.engine, 'PDFium WASM');
  assert.equal(report.scannedPages, 1);
  assert.equal(report.limited, true);
  for (const code of ['SIGNED', 'COMPLEX_TEXT', 'UNKNOWN_GLYPHS', 'INVALID_BOX', 'SAMPLE', 'PDFA_MARKER']) {
    assert.ok(report.warnings.some(w => w.code === code), 'missing warning ' + code);
  }
  assert.ok(!JSON.stringify(report).includes('Đường KM1+200'), 'PDF text must not leak into reports');
});

test('preflight treats pages without text as informational, not corruption', async () => {
  const { summarizePage, compileReport } = await corePromise;
  const blank = summarizePage(0, 600, 800, 0, []);
  const report = compileReport({ totalPages: 1, pages: [blank] });
  assert.ok(report.warnings.some(w => w.code === 'NO_TEXT' && w.level === 'info'));
  assert.ok(!report.warnings.some(w => w.code === 'COMPLEX_TEXT'));
  assert.throws(() => compileReport({ totalPages: 0, pages: [] }), /Số trang/);
});

test('main UI opens optional native inspection without changing text editor routing', () => {
  const home = read('index.html');
  const html = read('pdfium-preflight.html');
  const worker = read('pdfium-preflight-worker.mjs');
  assert.match(home, /'pdfium-inspect-route'/);
  assert.match(home, /window.PDFEditorUnified.open\('inspect'\)/);
  assert.match(home, /window.PDFEditorUnified.open\('text'\)/);
  assert.match(html, /pdfium-preflight-worker\.mjs/);
  assert.match(worker, /PdfEngine\.create\(\)/);
  assert.match(worker, /engine\.buildModel\(\)/);
  assert.doesNotMatch(worker, /post\([^)]*https?:|fetch\([^)]*https?:/i);
  const scripts = [...html.matchAll(/<script\s+type="module">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  new vm.Script(scripts[0][1].replace(/^import\s+\{[^}]+\}\s+from\s+[^;]+;/m, ''));
});

test('actual PDFium runtime reads a generated PDF without rewriting it', async () => {
  const { PdfEngine } = await import('../vendor/cit-pdf/editcore/core.js');
  const { summarizePage, compileReport } = await corePromise;
  const PDF = require('../pdf-lib.min.js');
  const doc = await PDF.PDFDocument.create();
  const page = doc.addPage([600, 800]);
  page.drawText('PDF HDV Native Check 123', { x: 50, y: 700, size: 14 });
  const bytes = new Uint8Array(await doc.save());
  const snapshot = Buffer.from(bytes);
  const engine = await PdfEngine.create();
  try {
    engine.open(bytes);
    assert.equal(engine.pageCount, 1);
    const nativeParagraphs = engine.buildModel();
    assert.ok(nativeParagraphs.length > 0, 'native engine should recognize text');
    const info = engine.documentInfo();
    const report = compileReport({ info, totalPages: engine.pageCount,
      pages: [summarizePage(0, engine.pageWidth, engine.pageHeight, 0, nativeParagraphs)] });
    assert.equal(report.totalPages, 1);
    assert.ok(report.summary.paragraphs >= 1);
  } finally {
    engine.close();
  }
  assert.deepEqual(Buffer.from(bytes), snapshot, 'native inspection must not alter source bytes');
});
