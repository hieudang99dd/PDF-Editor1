# Licensing and attribution

This HDV version incorporates CIT-PDF/BentoPDF native text editing code and is
distributed as a combined application under GNU AGPL version 3 (see LICENSE).
Other pre-existing third-party libraries and fonts retain their own licenses.
Source for this application and its modifications:
https://github.com/hieudang99dd/PDF-Editor-Hdv

## CIT-PDF / BentoPDF

- Original code: © BentoPDF Contributors.
- CIT-PDF modifications: © 2026 Cường IT.
- HDV integration and adaptations: 2026-10-15.
- Source release: https://github.com/Cuongyd196/cit-pdf/tree/1.0.0
- Exact source commit: `3c9c138d980a417de7439f383f37882a1d730ab6`.
- Upstream project: https://github.com/alam00000/bentopdf
- License: GNU AGPL-3.0; original license copied to `vendor/cit-pdf/LICENSE`.

Vendored source: `editcore/core.js`, `streamsplice.js`, `type3surgery.js`,
`shadingsurgery.js`, and `utils/freetext-script.js`. The latter is converted from
TypeScript by removing its two type annotations and spelling control characters
as Unicode escapes. `core.js` changes only that import's extension.
`engine-loader.js` is adapted for static relative URLs and Node-based tests.
The HDV adapters are `pdf-native-{text,worker,client}.mjs`; they preserve table
bounds, pin baselines, handle page rotation, serialize worker operations, reset
per-document splice state and report errors without overlay fallback.

## Native runtime

`vendor/cit-pdf/pdfium` is the unmodified prebuilt runtime from the CIT release's
`vendor/bentopdf-pdfium/bentopdf-pdfium-813903c93c75.tgz`:
https://github.com/Cuongyd196/cit-pdf/blob/1.0.0/vendor/bentopdf-pdfium/bentopdf-pdfium-813903c93c75.tgz

Package: `bentopdf-pdfium@0.0.0-813903c93c75`; its package metadata declares
AGPL-3.0. The runtime includes PDFium and upstream third-party components; their
original rights remain with their respective authors. The JavaScript/WASM pair
is copied verbatim, not independently rebuilt. The exact native build's C++
corresponding source/build instructions are not included in the CIT release
snapshot; the provenance here does not assert a reproducible native build or
certify completeness of upstream's source distribution.

WASM SHA-256:
`1860f0b33a1c7d231b78fa9bfedace19739f06e80b1d5f654dd2ea77a7a893ce`.

## Scope

HDV is not an official CIT-PDF or BentoPDF distribution. No commercial license
or permission to distribute this combined application as proprietary software
is supplied. See `docs/TEXT_ENGINE.md` for implemented features and limitations.

## Additional CIT-inspired browser operations (2026-10-15)

The browser-side algorithms in `cit-advanced-core.js` and their HVD UI adapter
`cit-advanced-ui.js` are adaptations informed by CIT-PDF 1.0.0 modules:
`src/js/logic/reverse-pages-page.ts`, `n-up-pdf-page.ts`,
`crop-pdf-page.ts`, `alternate-merge-page.ts`, `edit-metadata-page.ts`,
`remove-metadata-page.ts`, `remove-annotations-page.ts`,
`bates-numbering-page.ts`, and `src/js/utils/pdf-operations.ts`.
The code is integrated under the existing project's AGPL-3.0 license.
Full feature matrix and limitations: `docs/PROCESSING_AND_QA.md`.

## PaddleOCR browser OCR (2026-10-19)

- Browser SDK: [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js), `@paddleocr/paddleocr-js` 0.4.2, Apache-2.0. The Apache license is retained in `vendor/paddleocr/LICENSE`.
- ONNX models: PaddlePaddle official inference model distribution; model names, sizes and SHA-256 checksums are recorded in `vendor/paddleocr/manifest.json`.
- Runtime dependencies: ONNX Runtime Web (MIT), OpenCV.js through `@techstark/opencv-js` (Apache-2.0), js-yaml (MIT), clipper-lib (BSL-1.0). Their notices remain in the generated bundles and `vendor/paddleocr/THIRD_PARTY_NOTICES.txt`.
- PDF searchable-text integration is application code. OCR does not recover the original font from scanned images.

Vietnamese refinement uses Tesseract.js 6.0.1 / tesseract.js-core 6.0.0 and [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) `vie+eng` (Apache-2.0). Retained notices are bundled in `vendor/paddleocr/THIRD_PARTY_NOTICES.txt`.
