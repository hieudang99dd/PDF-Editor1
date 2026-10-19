# Universal conversion — 2026-10-19

## Implemented
- Homepage routes existing conversion cards to one `convert.html` workflow (OCR remains separate).
- `convert.html` / `universal-convert.mjs`: source → supported destination; local backend request; ZIP/download; cancel HTTP request.
- `backend/universal_convert.py` mounted under `/api/universal-convert`: image → PDF, Office → PDF (LibreOffice), TXT → PDF (Unicode font required), text PDF → basic DOCX/TXT, PDF → JPG/PNG/TIFF and multipage ZIP.
- Existing non-conversion PDF tools remain unchanged.
- Optional PP-StructureV3 OCR separate in `ocr.html`.

## Known limits and release gate
- NOT production validated. No CI/browser/Windows evidence for these new routes yet.
- Requires localhost FastAPI + dependencies; a static GitHub Pages build cannot execute Python/LibreOffice.
- Current DOCX is *text reconstruction*, not high-fidelity Word conversion; PDF scans should go through OCR.
- PDF → PPTX/XLSX, Word → other Office formats, and arbitrary image ↔ image are not implemented. Do not display as successful.
- Input PDF passwords/signatures require separate handling; conversion creates a new file and does not preserve digital signatures.
- Output quality should be verified against real Vietnamese engineering scans, A0 drawings, multi-page TIFF and Office documents.
- Server processes one request synchronously; AbortController cancels browser download/request but not necessarily running server computation.
- TXT → PDF requires installed Unicode font; long text can overflow the current single-page PDF.
- JPG/PNG from multi-page PDF return ZIP; image to PDF currently re-encodes pages (lossless-as-source JPEG integration not yet done).
- Do not change advertised status to 'finished' until automated tests and user document validation pass.

## Next
1. Test backend endpoint with real sample files and verify MIME, page count, font, ZIP contents and file integrity.
2. Build reusable source-target routing engine including browser-native conversions for GitHub Pages users.
3. Add PP-StructureV3 table layout into the shared converter, with editable DOCX/XLSX outputs.
4. Add preview, batch jobs, page selection and cancellation in backend.
5. Evaluate specialized libraries (img2pdf, pdf2docx, unoserver) by license, version and benchmark before adoption.
