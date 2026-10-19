// Run npm ci in this directory, then node build.mjs. Runtime is fully same-origin.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dest = path.join(root, 'vendor/paddleocr');
const sdk = path.join(here, 'node_modules/@paddleocr/paddleocr-js');
const ort = path.join(here, 'node_modules/onnxruntime-web');
await fs.mkdir(path.join(dest, 'assets'), { recursive: true });
await fs.mkdir(path.join(dest, 'ort'), { recursive: true });
await build({ entryPoints: [path.join(sdk, 'dist/index.mjs')], bundle: true, format: 'esm', platform: 'browser',
  external: ['onnxruntime-web', 'fs', 'path'], minify: true, outfile: path.join(dest, 'index.mjs') });
const workers = (await fs.readdir(path.join(sdk, 'dist/assets'))).filter(n => /^worker-entry-.*\.js$/.test(n));
if (workers.length !== 1 || workers[0] !== 'worker-entry-C9UNuyOJ.js') throw Error('SDK worker changed; review the application path.');
await fs.copyFile(path.join(sdk, 'dist/assets', workers[0]), path.join(dest, 'assets', workers[0]));
for (const file of ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm'])
  await fs.copyFile(path.join(ort, 'dist', file), path.join(dest, 'ort', file));
for (const [target, model] of [['det.tar', 'PP-OCRv6_small_det'], ['rec.tar', 'PP-OCRv6_small_rec']]) {
  const url = `https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/${model}_onnx_infer.tar`;
  const response = await fetch(url);
  if (!response.ok) throw Error(`${url}: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  const expected = JSON.parse(await fs.readFile(path.join(dest, 'manifest.json'), 'utf8')).files[target]?.sha256;
  const actual = createHash('sha256').update(data).digest('hex');
  if (expected && actual !== expected) throw Error(`Upstream model changed: ${model}; refusing unreviewed weights.`);
  await fs.writeFile(path.join(dest, target), data);
}
console.log('PaddleOCR browser runtime rebuilt. Run OCR browser acceptance before publishing.');

const tess = path.join(here, 'node_modules/tesseract.js');
const tessCore = path.join(here, 'node_modules/tesseract.js-core');
await fs.mkdir(path.join(dest, 'tesseract/lang'), { recursive: true });
for (const [source, target] of [
  [path.join(tess, 'dist/tesseract.esm.min.js'), 'tesseract.mjs'],
  [path.join(tess, 'dist/worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm'].map(n => [path.join(tessCore, n), n])
]) await fs.copyFile(source, path.join(dest, 'tesseract', target));
const manifest = JSON.parse(await fs.readFile(path.join(dest, 'manifest.json'), 'utf8'));
for (const lang of ['vie', 'eng']) {
  const key = `tesseract/lang/${lang}.traineddata`;
  const response = await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata`);
  if (!response.ok) throw Error(`Language download failed: ${lang} (${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(data).digest('hex') !== manifest.files[key].sha256)
    throw Error(`Language weights changed: ${lang}; refusing unreviewed data.`);
  await fs.writeFile(path.join(dest, key), data);
}
