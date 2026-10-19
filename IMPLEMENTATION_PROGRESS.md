# PDF HDV — Integration Progress

## 2026-10-15: CIT-PDF 1.0.0 → PDF HDV

Nguồn: Cuongyd196/cit-pdf, tag 1.0.0, commit 3c9c138d980a417de7439f383f37882a1d730ab6. Repo đích: hieudang99dd/PDF-Editor-Hdv, nhánh master.

### Đã có trước đợt này

- Sửa lỗi lưu/tải PDF: 606e519.
- Native text CIT: f1cc44a, c1599ec. PDFium WASM, font/baseline, table bounds, rotation, worker/undo, kiểm thử JS. Xem docs/TEXT_ENGINE.md.
- Các công cụ cơ bản trong trình duyệt: ghép, tách, xoay, ảnh JPG/PNG, chữ ký, watermark, đánh số trang (tùy công cụ).

### Thực hiện trong đợt tiếp tục

- backend/main.py: FastAPI localhost, API capabilities, PDF → TXT/DOCX/TIFF, Office → PDF, OCR tiếng Việt/Anh → TXT/PDF có chữ, nén không làm tăng file. Giới hạn input/trang, hạn chế CORS, xóa thư mục tạm.
- pdf-local-tools.js: kết nối giao diện với engine localhost, thông báo lỗi và download thật, thêm TXT/TIFF.
- index.html: nạp module cục bộ, sửa nhãn, giải thích khác biệt browser/localhost.
- tests/test_local_backend.py: 9 bài test Python đã đạt gồm DOCX → PDF thật. tests/local-bridge.test.cjs: 3 bài test JavaScript đã đạt, kiểm chứng route, request và download. OCR tiếng Anh đã kiểm chứng thực tế trả TXT/PDF tìm kiếm được.
- backend/README.md: cách chạy, API, giới hạn.
- Commits: 6296d35, e53fa29, 1a8835f, 57c1c98, fb9cb3a (và tài liệu tiếp theo).

### Chưa hoàn thành / kế tiếp

1. Test browser + localhost trên Windows Chrome, kiểm tra CORS / Local Network Access, vòng đời download và file URI.
2. So sánh PDF CAD nhiều trang, tiếng Việt, bảng/trắc dọc; tách chế độ giữ vector và raster.
3. Office conversion fidelity: bảng, ảnh, columns, định dạng Word/Excel/PPT. DOCX từ PDF hiện ưu tiên editable text.
4. Các module CIT có engine thật phù hợp HDV: bảo mật qpdf, flatten annotations, sửa form, crop, redaction thật, kiểm tra PDF/A, batch.
5. Kiểm tra giấy phép AGPL-3.0, mã nguồn/phiên bản và tests cho từng module trước khi gắn nhãn hoạt động; chưa hoàn thành 119 công cụ.
6. Mỗi vòng sửa code: test Python/Node, smoke browser, ghi commit, cập nhật tài liệu tiến độ.

### Ranh giới kỹ thuật

GitHub Pages chỉ chạy frontend tĩnh. Office/Tesseract/LibreOffice chạy native nên phải có backend localhost (hoặc máy chủ riêng). Nếu triển khai cloud, cần thiết kế xác thực, cách ly, hàng đợi, giới hạn CPU/tệp và chính sách dữ liệu. Không tự kích hoạt tải lên cloud.

## 2026-10-15: GitHub Pages online stability patch

- Verified that GitHub Pages deployment workflows completed successfully; this is distinct from browser-level feature testing.
- Reworked pdf-local-tools.js: browser-only lossless-structure PDF optimization and PDF→TXT text-layer extraction do **not** make calls to localhost:8000.
- Added truthful UI labels: PC-only OCR/Office/TIFF and hybrid Web/PC conversion, rather than promising all operations run on GitHub Pages.
- Updated index.html asset URL to version the local bridge and invalidate stale browser caches.
- Added tests/pages-smoke.test.cjs and GitHub Action pages-smoke.yml on each push for static scripts and browser-only flows.
- Browser PDF optimization may rewrite PDF internals and invalidate digital signatures; signed/archival PDFs should be retained and tested separately. PDF→TXT cannot OCR scanned images.
- Remaining verification: real Chrome on Windows; external website fetching from this environment is restricted, so deployment success must not be confused with pixel-perfect live-browser confirmation.


## 2026-10-15: Tích hợp CIT advanced browser tools và kiểm thử

- Đã thêm cit-advanced-core.js (UMD: page copying, crop, metadata, annotations, Bates, N-up, overlay, rotation) và cit-advanced-ui.js (gắn 14 tác vụ vào giao diện HVD). Các chức năng đủ điều kiện chạy trực tiếp trên GitHub Pages.
- Đã thay công cụ Cắt lề PDF (trước đó chỉ dẫn sang organizer) bằng engine CropBox. Có cảnh báo rõ: CropBox không phải xóa dữ liệu.
- Đã đổi diễn giải chức năng che nền, chữ ký dạng ảnh và làm phẳng form để không nhận nhầm thành redaction, chữ ký số hay xử lý mọi annotation.
- Đã bổ sung các test thực: tests/cit-advanced.test.cjs, tests/cit-advanced-ui.test.cjs. Bao gồm trang trắng N-up, Unicode metadata, crop theo mm, annotations, overlay, rotation, signature ByteRange và tải file browser.
- Workflow .github/workflows/pages-smoke.yml gọi tests/pages-smoke.test.cjs cùng hai test mới, tổng 31 bài Node đã đạt.
- Ghi nhận AGPL-3.0 và tài liệu xác minh tại docs/PROCESSING_AND_QA.md.
- Chưa triển khai hoặc chưa hoàn thiện: qpdf/ Ghostscript, PPT/Office WASM browser, OCR trình duyệt, PDF/A validator, sửa đoạn văn phức tạp, secure redaction, cryptographic signing/validation, full flatten annotation, toàn bộ các trang công cụ CIT.
- Chỉ đóng dấu “hoàn thành” cho module có mã, đường đi UI, xuất PDF thật, kiểm thử PDF thật; không đánh đồng trang công cụ với thuật toán đã tích hợp.

### Quality gate: ngăn tính năng chia sẻ giả

- Bỏ chế độ giả lập "PDF sang QR" từng tạo đường dẫn không có thật `pdfhub.local`; đánh nhãn chưa hỗ trợ khi chưa có máy chủ chia sẻ thật.
- Trình duyệt không tải tài liệu lên server chỉ bằng thao tác tạo mã QR; không sử dụng QR để hàm ý chia sẻ thực.

## 2026-10-15 — Native CIT Text: multi-line batch & rich-run protection

- Integrated new `pdf-batch-text.js` into `index.html` and the existing `PDFOrganizer`. Provides editing across many **existing** text lines in one atomic batch, with preview find/replace, per-line selection and a single Undo step.
- Adapted `pdf-native-text.mjs` to preserve sibling style runs when a uniquely identified run within a mixed-font paragraph is replaced; retained strict native baseline and table boundaries. Rejected text mutations spanning style boundaries.
- Implemented signed-PDF preflight guard (ByteRange) in native rewrite; Type3/fragile text remains protected and uneditable if source cannot be safely identified.
- Added `tests/rich-native.test.cjs`, `tests/batch-text.test.cjs`, expanded `tests/native-text.test.cjs` for true WASM mixed-font and digital signatures; expanded GitHub Actions smoke suite to include all three and `tests/text-layout.test.cjs`.
- Verified GitHub CI **84/84 passing** in workflow after changes; follow final commit check for Pages. Details in [docs/TEXT_ENGINE.md](docs/TEXT_ENGINE.md).
- Important scope: edits multiple original one-line boxes in one transaction, **not** full multiline paragraph reflow. Font Type3 converted to vector outlines, arbitrary WYSIWYG restyling of multiple runs, and full PDF/A/PDF/UA compatibility are not claimed.

## 2026-10-15 — Separate CIT Native Text workspace

- Created independent, static GitHub Pages route [text-editor.html](text-editor.html) with [text-editor-shell.js](text-editor-shell.js) and [text-editor.css](text-editor.css); added main-site tool card **Chỉnh sửa Text chuyên sâu** plus header shortcut.
- Based layout on user-provided CIT-PDF desktop screenshot: top file/export/undo controls, central PDF document, bottom page/zoom navigation, persistent right-hand font/color/size/style/align inspector.
- Native algorithm is **not duplicated**: reuses upstream-derived PdfEngine/PDFium worker already integrated through NativeTextClient, PDFTextLayout checks, original Organizer persistence/history and batch editor.
- Fixed focus handoff from inline native editor to new right-hand dock so clicking font, color or size no longer auto-commits via blur before user presses Apply.
- Explicitly disabled unsafe/cosmetic controls: no fake paragraph spacing, no automatic rich paragraph reflow; Type3 and fragile text remain guarded.
- Added [tests/text-editor-route.test.cjs](tests/text-editor-route.test.cjs) to Node CI and [tests/text-editor-live.cjs](tests/text-editor-live.cjs) in Chromium CI for real PDF replacement/export validation.
- User operation now starts directly from separate module, without page organization. Legacy organizer retained for backward compatibility.
- Ref specification, licensing and QA boundary: [docs/TEXT_ENGINE.md](docs/TEXT_ENGINE.md). Check live-browser workflow status before marking deployment fully accepted.

### CIT Text workspace – nghiệm thu Chromium và phát hành (2026-10-15)

- ✅ **89/89 Node test** thành công, workflow [Pages smoke checks](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38715353221).
- ✅ **Chromium E2E thành công**, workflow [CIT Text Editor Browser QA](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38715250412). Đã chạy 9 điểm kiểm tra: trang độc lập, panel bên phải, mở PDF, chọn text, chỉnh qua panel, commit PDFium, tải PDF, xác minh xóa text gốc và giữ text dòng khác.
- ✅ Đã lưu artifact `cit-text-editor-browser` gồm PDF vào/ra và hai screenshot để QA trên GitHub Actions.
- ✅ Đường vào riêng: `text-editor.html`; đường dẫn từ card và shortcut trong `index.html`.
- ⚠ Chưa khẳng định parity toàn bộ frontend CIT v1.0.0: hỗ trợ văn bản an toàn giữ bố cục CAD, chưa chạy reflow tự do/Type3 nguy hiểm.

## 2026-10-15 — HOÀN THÀNH: Frontend CIT nguyên bản trên GitHub Pages

- **Source**: CIT-PDF tag `1.0.0`, SHA `3c9c138d980a417de7439f383f37882a1d730ab6`; ghim SHA, `npm ci` và Vite build nguyên gốc. Không mô phỏng frontend nữa.
- **Artifact**: toàn bộ CIT bundle (HTML, TypeScript biên dịch, CSS, PDFium WASM, assets) ~176 MB, ghép với website HVD bởi `scripts/cit-original/publish_site.py`.
- **Route**: `text-editor.html` → `cit-native/edit-pdf-text.html` dùng trình editor gốc CIT; `text-editor-hdv.html` giữ editor HVD trước đây làm fallback.
- **Acceptance**: Chromium mở trình CIT nguyên gốc, nạp PDF, chọn vùng chữ, dùng contenteditable, hiển thị dock font/size/spacing, xuất PDF thật; kiểm tra độc lập PyMuPDF phát hiện `CIT NATIVE EDITED`, không còn `CIT ORIGINAL LINE`, giữ `SECOND CAD LINE`, số trang/kích thước không đổi.
- **Deployment**: [GitHub Actions Run 38744102098](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38744102098) **success**, deploy-pages báo `Reported success!`, SHA `c3cade1d0f42f637e708b982d90ac228ccb3c290`.
- **Site**: https://hieudang99dd.github.io/PDF-Editor-Hdv/text-editor.html ; original engine https://hieudang99dd.github.io/PDF-Editor-Hdv/cit-native/edit-pdf-text.html
- **E2E evidence**: workflow artifact `cit-original-browser-evidence` (PDF đầu vào/đầu ra + screenshot) cùng run trên.
- **Licensing / reproducibility**: xem `CIT-ORIGINAL-FRONTEND.lock.json`, `docs/STUDIO_DEPLOYMENT.md`; AGPL-3.0.
- **Scope**: tương đồng bằng cách build **cùng upstream frontend/engine**, không chỉ dựng giao diện tương tự. Không tuyên bố mọi PDF CAD bất kỳ đều sửa được. Đã chạy thử trong Chromium với artifact Pages; chưa kiểm tra tương tác trên CDN Github Pages trực tiếp từ môi trường này.

### 2026-10-15 — ĐÃ KHẮC PHỤC trôi phiên bản Pages legacy (kết quả cuối)

- GitHub Pages có **hai cơ chế**: custom Actions và legacy branch `master`. Vì `GITHUB_TOKEN` không có quyền đổi `build_type` (HTTP 403), không chỉ dùng `deploy-pages`.
- Sau khi mọi test Chromium và PyMuPDF pass, CI đồng bộ **toàn bộ frontend CIT đã build nguyên bản** vào repo `master/cit-native/` rồi tạo commit bot `bee0f8291ebd38780aafbbfacbbfefc9128d17e5`.
- Đường dẫn `master/text-editor.html` thay bằng redirect sang `./cit-native/edit-pdf-text.html`, giữ editor HVD cũ tại `master/text-editor-hdv.html`, thêm `.nojekyll` để Pages legacy phục vụ đúng asset.
- Từ đây dù lần cập nhật tiếp theo vẫn kích hoạt Pages legacy, **frontend CIT hiện nằm sẵn trong chính nguồn của branch**, không còn phụ thuộc chỉ vào artifact tạm.
- Workflow [38744823470](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38744823470): **success**; bước PDFium edit + PyMuPDF nội dung, Git push, upload, deploy đều thành công.
- Commit nhúng CIT: https://github.com/hieudang99dd/PDF-Editor-Hdv/commit/bee0f8291ebd38780aafbbfacbbfefc9128d17e5
- Cách phát triển: nguồn CIT gốc được ghim tag/commit trong `CIT-ORIGINAL-FRONTEND.lock.json`; `cit-native/` là **compiled distribution**, không phải file TypeScript source.

## 2026-10-15 — Frontend CIT × PDF HVD: bản nâng cấp điều hướng, fallback, CI

- **Hướng nâng cấp**: dùng frontend CIT-PDF v1.0.0 (đóng băng SHA upstream `3c9c138d980a417de7439f383f37882a1d730ab6`) với nguyên các module biên tập, WASM, font, reflow, Undo/Redo và Export; không tự tạo bản sao HTML/JS mới.
- **HVD bridge**: tạo `scripts/cit-original/hvd-hub.js` và `hvd-hub.css`; bổ sung nút quay về HVD trong toolbar CIT và landing, bắt sự kiện `#back-to-tools` ở capture phase để không chuyển nhầm đến trang CIT.
- **An toàn PDF**: không chỉnh các thuật toán `editcore`, `PdfEngine`, engine worker, rich paragraphs; module HVD chỉ điều hướng và nhận diện. Font/layout/Export là của upstream CIT.
- **Đã sửa bug lớn** trong `publish_site.py`: từ lần build thứ hai, `text-editor.html` đã là redirect; trước đây có thể đổi tên redirect thành `text-editor-hdv.html` và phá fallback. Mới có fail-closed guard và kiểm chứng fallback thật.
- **Bundle sạch**: không copy lại `cit-native/` cũ; build từ upstream sạch rồi thêm bridge. CI persist chính `cit-stage/cit-native` đã kiểm tra lên `master`.
- **Deploy nhất quán**: loại bỏ lần xuất bản Pages từ riêng pipeline CIT để không chạy đua với `pages build and deployment` mặc định từ master. Chỉ commit code đã kiểm thử, để nguồn master xuất bản tự động.
- **Bộ test**: `tests/hvd-cit-hub.test.cjs` (unit navigation/capture, không can thiệp PDF engine) và `tests/cit-original-browser.cjs` (Chromium native CIT real PDF, panel font, HVD route, export); PyMuPDF độc lập tiếp tục xác minh text gốc bị thay và dòng bên cạnh còn nguyên.
- **Xác nhận QA**: workflow CIT [38754383598](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38754383598) **success** (bao gồm real Chromium và PyMuPDF); smoke test HVD [38754383650](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38754383650) **success**.
- **Bot build đã đồng bộ GitHub**: commit `8af167eea08572d326e508ebd1c02a5a42227bfb` chứa `cit-native/hvd-hub.js`, `hvd-hub.css`, HTML CIT tích hợp mới, route chính và fallback.
- **GitHub Pages**: theo dõi workflow `38754751823` cho bản bot build. Nếu workflow chưa báo xanh thì chưa khẳng định CDN trực tiếp đã cập nhật mới.
- **Giới hạn**: chưa QA từng loại file CAD thực có font Type3, table hỗn hợp, PDF ký số; nguồn frontend gốc CIT được kế thừa chứ không mặc nhiên là engine sửa được mọi PDF.

## 2026-10-15 — Cá nhân hóa giao diện PDF HVD, giữ nguyên thuật toán

- **Yêu cầu:** mọi tên thương mại, logo, mô tả UI của công cụ đều sử dụng **PDF HVD**. Thuật toán xử lý PDF được giữ nguyên như bản gốc đã qua kiểm thử; không thay thế bằng công cụ mô phỏng.
- **Frontend branding tự động:** `scripts/cit-original/brand_site.py` chỉnh tên trang, meta title/author, OpenGraph, Twitter metadata, canonical, manifest, favicon và brand trước first paint của bản Vite. `hvd-mark.svg` và `hvd-site.webmanifest` được tạo cho HVD. `hvd-hub.js` đổi tên thanh điều hướng/footer, giữ nút quay về HVD và không đụng PDFium/algorithms.
- **Đường dẫn mới:** `text-editor.html` → `studio/edit-pdf-text.html`; đổi BASE_URL Vite thành `/PDF-Editor-Hdv/studio/`. Commit bot `c8c0ce35c1fbe95cb5b0d2a8d54d508e7716bfdd` đã tạo thư mục `studio/` và xóa thư mục xuất bản `cit-native/` cũ.
- **Giao diện HVD hiện hữu:** trang chủ và editor dự phòng được đổi tên hiển thị PDF HVD (tên công cụ, tiêu đề, chú thích font, thông báo UI), không phá code gốc.
- **Bản quyền / pháp lý:** các thông báo bản quyền gốc, giấy phép AGPL-3.0, `NOTICE.md` và khả năng truy cập mã nguồn được giữ lại theo nghĩa vụ phân phối. Việc thương hiệu hiển thị thành PDF HVD **không** có nghĩa sở hữu tác quyền của phần mềm nguồn mở.
- **Kiểm thử:** Python unit kiểm tra cách brand và giữ copyright, Vite build pinned source, Chromium mở `/studio/` kiểm tra logo/title/font panel/Undo-Redo và thay chữ PDF thật, PyMuPDF kiểm tra chữ đầu ra và hình học, Node smoke test HVD.
- **Đã đạt:** [CI native editor](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38758092102) = `success`; Node smoke [38758215338](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38758215338) = `success`. Commit chứa frontend đã đóng gói: [c8c0ce3](https://github.com/hieudang99dd/PDF-Editor-Hdv/commit/c8c0ce35c1fbe95cb5b0d2a8d54d508e7716bfdd).
- **Cần theo dõi** Pages legacy build trên commit mới nhất đến khi GitHub xác nhận thành công. Kiểm chứng PDF A0/A1, font Type3 và file CAD thực vẫn là công việc QA tiếp theo.

## 2026-10-15 — Thiết kế lại trang chủ PDF HVD (UI v2)

- Nguồn yêu cầu: ảnh chụp giao diện hiện tại; mục tiêu giao diện chuyên nghiệp, tiết kiệm diện tích, rõ ràng thứ bậc, phù hợp desktop/tablet/mobile.
- Tệp mới: `hvd-ui-v2.css` (responsive typography, layout 4/2/1 cột, hero gọn, theme, thẻ công cụ và trạng thái); `hvd-ui-v2.js` (đặt tên tiếng Việt rõ nghĩa, công cụ thường dùng, tìm kiếm, lọc nhóm, đánh dấu web/PC/chưa phát triển).
- `index.html` nạp hai tệp này sau script gốc, không thay đổi xử lý tệp, thư viện PDF hay thuật toán. Tác vụ vẫn giữ `data-i` gốc nên dùng lại `openTool`/router.
- Danh mục nổi bật không bị lặp trong danh mục bên dưới khi đang xem Tất cả.
- Hạn chế: trạng thái web/PC dựa trên registry frontend, chưa có health-check thời gian thực; nhãn 'Trình duyệt' chỉ cho biết phương thức xử lý, không đảm bảo mọi file PDF đều được hỗ trợ. Các chức năng chưa triển khai được vô hiệu hóa ở catalog.
- QA: workflow Pages smoke tại commit `d01971f8` đã đạt; workflow commit cuối `398c8b63` và Pages deployment cần kiểm tra khi hoàn tất.

## 2026-10-15 — Sửa bố cục nút chỉnh Text sai vị trí trên header

- Yêu cầu người dùng từ ảnh: nút "T Chỉnh Text" ở góc phải header là sai phân cấp; phải bỏ khỏi thanh ứng dụng chung.
- Đã kiểm tra và xác nhận `index.html` không còn `#shortcut-text`. Trình **Chỉnh sửa văn bản PDF** là thẻ công cụ trong nhóm **Chỉnh sửa**, đường xử lý `cit-text-route` vẫn mở `text-editor.html`.
- Thêm `header #shortcut-text{display:none!important}` làm biện pháp phòng trường hợp trình duyệt còn cache HTML cũ. Không dùng CSS thay cho việc xóa khỏi markup.
- Sửa `hvd-ui-v2.js`: tên và mô tả thương mại chỉ dùng khi **render**. Không được ghi đè `T[i][0]` vì `pdf-local-tools.js` và các module xử lý PDF dispatch bằng đúng tên tác vụ. Đồng thời bảo toàn `data-i` để routing không đổi, thẻ Text chỉ hiển thị một lần ở mục nổi bật.
- Kiểm tra hồi quy qua `tests/home-layout.test.cjs`: header không có Text CTA, tồn tại thẻ Text đúng nhóm, mã định tuyến và engine key không bị sửa, tìm kiếm nhóm hoạt động. Thêm vào `pages-smoke.yml`.
- CI [run 38765064531](https://github.com/hieudang99dd/PDF-Editor-Hdv/actions/runs/38765064531) **success**. Pages deployment tại commit tiếp theo cần chờ kiểm tra.

## 2026-10-15 — Loại bỏ footer chữ dài trên trang chủ, giữ thông báo giấy phép theo yêu cầu

- Đã xóa hẳn `<footer>` chứa mô tả kỹ thuật, "Mã nguồn", "AGPL-3.0", "Ghi nhận tác giả" khỏi `<main id="home">`; không chỉ dùng `display:none` để che nội dung.
- Giao diện chính chỉ hiển thị nút thông tin nhỏ **ⓘ** ở header. Mở khi được nhấn, hiển thị một `<dialog>` gọn gàng và có thể đóng bằng nút ×, Escape hoặc click nền.
- Đảm bảo nghĩa vụ nguồn mở: popup vẫn cung cấp thông báo bản quyền (BentoPDF Contributors, Cường IT), điều khoản không bảo hành, link `LICENSE`, `NOTICE.md` và repository chứa mã nguồn/thay đổi. Files pháp lý không bị sửa/xóa.
- Mã mới: `hvd-legal.js`; CSS bổ sung trong `hvd-ui-v2.css`; HTML chỉ sửa `index.html`, không động đến engine PDF.
- Bổ sung hồi quy `tests/home-legal.test.cjs` vào workflow `pages-smoke.yml`. Phải xác nhận kiểm thử và GitHub Pages CI trước khi báo đã lên trang công khai.

## 2026-10-16 — Thông tin giấy phép không che giao diện

- Bỏ hoàn toàn bảng `<dialog id="hvd-legal-dialog">` và không nạp `hvd-legal.js` từ trang chủ. Không còn hộp thoại pháp lý phủ lên công cụ xử lý PDF.
- Giữ biểu tượng thông tin nhỏ, mở `NOTICE.md` trong tab mới khi người dùng chủ động chọn; không tự bật, không làm gián đoạn quá trình thao tác.
- Giữ nguyên `LICENSE`, `NOTICE.md` và ghi nhận tác giả trong repository. Không thay đổi thuật toán xử lý PDF.
- Cập nhật CSS, cache version và kiểm thử để ngăn hộp thoại xuất hiện trở lại.

## 2026-10-16 — Tinh gọn giao diện, Sửa Text là công cụ riêng

- Chốt giữ tính năng Sửa Text PDF gốc độc lập; đi thẳng `text-editor.html` qua định tuyến `cit-text-route` như cũ, không gộp với nhóm Chỉnh sửa PDF.
- Giảm giao diện chính xuống 15 thẻ (cấu hình tĩnh), 5 mục lọc: Sửa Text, Biên tập, Tổ chức, Chuyển đổi và Nâng cao.
- Gộp các thao tác trang, ghép, đánh số/Bates/watermark, chuyển đổi Office, xuất ảnh, N-up/Overlay, metadata thành nhóm có submenu; lựa chọn vẫn gọi đúng `openTool(i)` cũ.
- Ẩn tính năng chưa có engine bằng allowlist; không xóa mã nguồn/thuật toán, không sửa `T`, `organizer.js`, PDFium/CIT hay Local Engine. OCR/Office/TIFF tiếp tục gắn nhãn cần PC; không hứa chạy toàn bộ trên Pages.
- Thay `hvd-ui-v2.js`, CSS, cache phiên bản của `index.html`, cập nhật kiểm thử `tests/home-layout.test.cjs` và ghi tiến độ; chờ CI và Pages xác thực.

### CI sửa Text native sau khi tinh gọn danh mục

- Test Chromium cũ kiểm tra `#shortcut-text` vốn đã bị bỏ khỏi header theo quyết định UI trước đó, gây báo lỗi giả ở bước quay về trang HVD.
- Sửa `tests/cit-original-browser.cjs` để xác minh trang đích bằng `#logo` có chữ PDF HVD và tồn tại `#tools` thay vì nút header đã bị xóa. Không thay đổi thao tác PDFium, file kết quả hoặc kiểm tra nội dung PDF.

## 2026-10-16 — Repository cleanup / workflow consolidation

- Đã kiểm kê nguồn của frontend `studio/` được build cố định; xác định đây là bundle dùng thật, **không xóa** JS chunk/CSS/WASM/font hay các file `.br` mà chưa có đối chiếu manifest.
- Gộp **7 file tài liệu** theo 3 workflow: `docs/TEXT_ENGINE.md`, `docs/STUDIO_DEPLOYMENT.md`, `docs/PROCESSING_AND_QA.md`; giữ nguyên các quyết định cũ với nhãn lịch sử. Cập nhật liên kết từ `NOTICE.md`, `backend/README.md`, ma trận tính năng và nhật ký tiến độ.
- Xóa **19 script vá thử** ở `scratch/`, xóa `debug_run.py` và `debug_run2.py`, `hvd-home-v2.css` và `hvd-legal.js` vì không còn nằm trong đường tải chính. Nội dung vẫn có thể phục hồi qua lịch sử Git trước khi merge.
- Tạo `README.md` (điểm vào duy nhất cho người mới) và `docs/REPOSITORY_MAP.md` (mô hình folder/cleanup). Điều chỉnh `.gitignore`, cập nhật skill agent về kiến trúc Hybrid để tránh sửa nhầm production artifact.
- Không sửa code thuật toán, PDFium, `organizer.js`, `text-editor.html`, frontend Vite đã build, backend hoặc `vendor/` trong lần dọn dẹp này.
- QA: test Node toàn repo qua GitHub Actions và kiểm tra link/route/syntax; kiểm thử trên GitHub Pages và CAD A0/A1 cần thực hiện riêng. Không xem smoke test là chứng minh tính tương đương giao diện đã triển khai.


## 2026-10-16 — UX Workflow (in-place output, refresh, Back/Forward)

- Tạo đặc tả `docs/UX_WORKFLOW.md`: vòng đời tác vụ EMPTY → READY → PROCESSING → RESULT/ERROR, các hành động Reset/New File/Back/Download, kiểm soát unsaved và cách nghiệm thu browser.
- `index.html`: workspace có nút Danh mục công cụ, Làm mới tác vụ (giữ file), Tệp khác (không thoát công cụ); header refresh không còn reload nguyên trang. Route `#hvd-tool=N` hỗ trợ Back/Forward; trong cùng phiên, giữ file khi forward lại đúng tool. Không lưu dữ liệu PDF vào browser storage.
- `index.html`, `pdf-local-tools.js`, `cit-advanced-ui.js`: kết quả download ở nguyên tool; theo dõi và thu hồi Blob URL sau 120 giây khi không còn hiển thị, không thu hồi tức thời khiến tải file lớn lỗi. Trước khi rời khi kết quả chưa được yêu cầu tải có cảnh báo.
- `pdfium-preflight.html`: Làm mới báo cáo vẫn giữ file, Tệp khác không điều hướng. `hvd-ui-v2.css`: nút refresh có thể sử dụng trên mobile; theme ghi preference không nhạy cảm.
- **Không thay** các engine/JS minified `studio/`, `organizer.js`, native text worker hoặc API save. `#save` và `#exitEditor` Studio cần E2E riêng trước khi cải tổ sâu.
- `tests/ux-session.test.cjs`: hồi quy các trạng thái, in-place downloads, refresh, history; GitHub Actions pages-smoke để nghiệm thu tĩnh. Kiểm thử Chrome/Edge + PDF kỹ thuật thực tế vẫn là hạng mục tiếp theo.

## 2026-10-16 — Khắc phục Organizer không thoát tài liệu khi Làm mới

- Phát hiện `#po-tb-reset` trước đây chỉ hoàn nguyên cấu trúc trang trong history, không xóa tài liệu và không trở về khu vực upload.
- Tạo `PDFOrganizer.newDocument()`: khóa khi đang đọc/lưu, xác nhận nếu có PDF, `destroy()` instance cũ (PDF.js/worker/cache/URL/listeners), khởi tạo lại cùng tính năng bằng `window.initOrganizer([])`; không reload website và không tự về trang chủ.
- Đưa **Làm mới** lên thanh quản lý tài liệu; đổi nhãn nút cũ thành **Hoàn nguyên trang** cho đúng phạm vi; bỏ mũi tên back icon cực nhỏ, thay bằng **Danh mục công cụ** có nhãn và kích thước rõ ràng, phân bố responsive.
- Thiết kế lại màn hình upload, hỗ trợ Enter/Space; thu gọn header Studio thừa tại `studio/hvd-brand.css` (không đụng dữ liệu/engine).
- `tests/organizer-reset.test.cjs` kiểm tra hủy và cho phép, trạng thái đang đọc/lưu; cập nhật Chromium E2E với PDF thật và workflow `ux-browser.yml` tự chạy khi sửa organizer; tài liệu quy trình `docs/UX_WORKFLOW.md` đã cập nhật.
- QA cần xác nhận Node/Chromium trước khi gộp; các tài liệu CAD A0/A1 với font Type3 và thay đổi text phức tạp vẫn cần thử riêng.


- Tách điều kiện tự chạy `cit-original-build.yml`: thay đổi `organizer.js` hoặc trang chủ không còn gây build lại và ghi đè `studio/`; workflow vẫn có `workflow_dispatch` và triggers theo nguồn Studio. Tăng cache version `organizer.js` trong cả trang chính lẫn trình editor dự phòng, và `hvd-brand.css` trong Studio.


## 2026-10-16 — Native Vector Region Eraser v1

- Thêm chức năng Xóa vector theo vùng tại Organizer: vẽ hình chữ nhật/đa giác, nhiều vùng xóa union và vùng giữ bên trong (difference). Bảo vệ mảng vùng qua Undo/Redo. Không dùng whiteout hoặc raster overlay làm kết quả PDF.
- Geometry: pdf-region-geometry.mjs giao polygon với đường thẳng, tách parametric intervals, kiểm tra polygon tự cắt, giới hạn 64 vùng/trang và 256 đỉnh/vùng.
- PDFium: pdf-region-native.mjs dùng các API PATH segment/object đang xuất trong WASM CIT, xóa PATH nguồn và thêm các đoạn giữ ngoài vùng, bảo toàn màu/width/matrix/z-index. Worker/client độc lập. Cắt sau native text rewrite, trước annotation.
- Phạm vi v1: PATH line/polyline nét liền, không tô kín, trang /Rotate=0. Báo lỗi thay vì xóa sai cho Bézier, hatch/fill, dashed, clip, matrix suy biến; text/image/Form không bị sửa. Không phải PDF redaction.
- CI: tests/pdf-region-geometry.test.cjs, tests/pdf-region-native.test.cjs kiểm tra PDF vector thực; UX Browser QA tương tác vẽ vùng + export, cùng Pages smoke.
- Đặc tả kiến trúc/tọa độ/giới hạn/QA: docs/REGION_ERASER.md. Kiểm tra A0/A1, layered CAD, stroke hairline, CropBox và XObject lồng vẫn cần bộ dữ liệu nghiệm thu riêng.


## 2026-10-16 — Tách Native Region Eraser thành công cụ độc lập

- Tạo trang độc lập `region-eraser.html`, style `region-eraser.css`, controller `region-eraser.js`: tải/chọn PDF, xem trước theo trang bằng PDF.js, chọn vùng chữ nhật hoặc đa giác, nhiều vùng xóa/protect, Undo/Redo, chọn tệp mới, Làm mới và xuất PDF không điều hướng.
- Chuyển công cụ trên trang chủ sang route `region-eraser-route` trỏ trực tiếp tới trang mới, có thẻ riêng trong danh mục Chỉnh sửa.
- Gỡ plugin UI `pdf-region-ui.js`, styles `po-region-*`, mọi trường `eraseRegions` và xử lý `eraseRegionsInWorker` khỏi `organizer.js`; Organizer giữ nguyên chức năng sửa text, trang và chú thích.
- Bảo toàn thuật toán lõi `pdf-region-geometry.mjs`, `pdf-region-native.mjs`, `pdf-region-worker.mjs`; adapter riêng không dùng PDFLib, để xuất từ PDF nguồn, tránh làm ảnh hưởng tới nội dung chỉnh sửa khác.
- Cập nhật test Node kiểm tra sự độc lập và bài Chromium cho luồng route độc lập → vẽ vùng → xem kết quả → tải PDF thực → làm mới.


## 2026-10-16 — Nâng dung lượng Region Eraser lên 512 MiB

- Đồng bộ cấu hình 512 MiB ở UI và PDFium qua `pdf-region-limits.mjs`, cảnh báo RAM từ 256 MiB.
- Xem trước PDF.js qua Blob URL, giới hạn canvas 16 triệu pixel, giải phóng preview URL khi đóng PDF. Không nhân bản `file.arrayBuffer()` trên main thread ở bước xuất; Worker nhận File rồi tự đọc, transferable output PDF.
- Cải tiến `pdf-region-worker/client`: progress theo trang/đối tượng, AbortController hủy tác vụ, watchdog 8 phút và deadline thích ứng đến 30 phút, báo lỗi thiếu RAM mà không thay đổi file nguồn.
- Bổ sung regression `tests/pdf-region-512mb.test.cjs` và workflow `region-large.yml` kiểm tra PDF thật >80 MiB; kỹ thuật kiểm thử và giới hạn được ghi trong `docs/REGION_ERASER.md`.
- **Lưu ý:** 512 MiB là ngưỡng nhận tệp; không có chứng chỉ thực thi mọi PDF 512 MiB và không kiểm tra mọi tổ hợp trình duyệt/thiết bị.


## 2026-10-16 — Boolean regions + dàn trang + range + xem kết quả trước tải

- `pdf-region-geometry.mjs`: hỗ trợ union (nhiều vùng riêng), between (vùng giữa hai đường bao), intersection (chỉ vùng giao), chặn polygon lỗi hoặc không giao nhau.
- `pdf-region-plan.mjs` mới: kế hoạch xóa theo các trang đã vẽ hoặc nhân vùng từ trang đang chọn qua khoảng Từ–Đến (inclusive, tối đa 500 trang), không thay đổi dữ liệu vùng nguồn.
- `region-eraser.html/js/css`: chuyển mặc định sang dàn trang 24 thumbnail/lượt, lazy render, nhấp trang để mở biên tập phóng to và quay lại gallery.
- Sau **Áp dụng & xuất PDF**, mở PDF kết quả thật bằng PDF.js, cho phép Bản gốc/Sau xử lý để kiểm tra chính xác trước khi tải xuống, không dùng phủ trắng.
- Thêm `tests/pdf-region-boolean-gallery.test.cjs`, nâng Chromium E2E cho PDF 2 trang với dải giữa hai biên, khoảng 1–2 và xem trước/sau.
- Giữ nguyên tách biệt khỏi Organizer, giới hạn 512 MiB, worker cancellation, cùng chính sách không sửa file PDF gốc.


## 2026-10-16 — Sửa lỗi /Rotate ở Region Eraser

- Loại bỏ chặn /Rotate của PDFium; chuyển UI viewport PDF.js theo từng trang tới worker để nghịch đảo chính xác vùng khoanh trên trang xoay, CropBox và UserUnit.
- Xác minh góc xoay PDFium/PDF.js; không đoán tọa độ khi thiếu/ma trận suy biến. Hỗ trợ trang 0°/90°/180°/270° lẫn trong cùng khoảng trang.
- Node/PDFium QA: `tests/pdf-region-rotation.test.cjs`, thêm Chromium fixture trang thứ hai xoay 90° và xác nhận xóa vật lý trong toàn khoảng.
- Không sửa Organizer, core Native Text và giới hạn đầu vào 512 MiB.


## 2026-10-16 — Bổ sung xóa rộng và PDF có chữ ký

- `pdf-region-native.mjs` bổ sung mode `whole-object`: loại bỏ thật các page object chữ, ảnh, fill/path, Form giao vùng bằng PDFium. Giữ mode `precise` để cắt vector đúng biên; không dùng phủ trắng.
- `pdf-region-geometry.mjs` kiểm tra vùng giao với bounding rect theo phép boolean, cache giao cạnh để tránh lặp tính toán với PDF nhiều đối tượng.
- Checkbox cho phép tạo bản sao PDF có chữ ký số, với thông báo chữ ký cũ mất hiệu lực; không mặc định bỏ chặn, không tuyên bố giữ chữ ký hợp lệ.
- Giao diện có hai chế độ và cảnh báo tường minh về xóa nguyên đối tượng có thể mất nội dung ngoài vùng; báo cáo số page object đã gỡ và xem PDF kết quả.
- Tests `pdf-region-all-objects.test.cjs` và Chromium E2E thêm tình huống chữ bị xóa thực, không thay đổi Organizer.


## 2026-10-16 — Tách nút Áp dụng / Xuất PDF thành hai bước độc lập

- `region-eraser.html/css`: thay nút `Áp dụng & xuất PDF` bằng `✂ Áp dụng` và `↓ Xuất PDF` trên thanh công cụ; thêm thanh bước và nút `Chỉnh sửa lại` ở vùng xem kết quả.
- `region-eraser.js`: `Apply` chỉ thực hiện PDFium Worker và xem kết quả bằng PDF.js, không tải xuống. Export khóa khi chưa có kết quả/bị lỗi/bận; khi người dùng chỉnh lại, bỏ blob PDF cũ, giữ vùng chọn, buộc áp dụng lại; không vô tình xuất snapshot cũ.
- Vẫn giữ nút Bản gốc/Sau xử lý, nhiều vùng, xóa mọi page object, chữ ký số có xác nhận, giới hạn 512 MiB và trải nghiệm không rời trang sau khi tải.
- `tests/pdf-region-apply-export.test.cjs` và Chromium QA kiểm tra các trạng thái đầu/cuối, áp dụng 2 lần trước khi tải, Undo/Redo sau Chỉnh sửa lại và ngăn xuất nhầm.


## 2026-10-16 — Đổi thương hiệu hiển thị thành PDF Đạo Chích

- Đồng bộ tên **PDF Đạo Chích** trong trang chủ, Xóa vector theo vùng, PDFium Preflight, trình sửa Text gốc, adapter thanh thương hiệu, các tiêu đề SEO và tab trình duyệt.
- Logo đổi ký hiệu **H** thành **Đ** tại các header chính và SVG `studio/hvd-mark.svg`. CSS responsive đảm bảo tên tiếng Việt không tràn trên mobile.
- Bổ sung cache-busting cho CSS/JS/SVG thương hiệu trên GitHub Pages.
- Thêm regression `tests/brand-dao-chich.test.cjs`, cập nhật test cũ và tên GitHub Actions.
- Bảo toàn đường dẫn GitHub, định danh `hvd-*`, thuật toán PDF, NOTICE.md/LICENSE và ghi nhận thư viện nguồn mở; đổi thương hiệu không thay đổi nghĩa vụ giấy phép.


## 2026-10-16 — Khóa chiều cao panel tác vụ và xem PDF, chỉ cuộn bên trong

- Chỉnh `region-eraser.css` để giao diện đang mở PDF chiếm đúng chiều cao cửa sổ (100dvh), thanh điều khiển/tiến trình và tiêu đề đứng yên; panel tác vụ trái và PDF phải có chiều cao bằng nhau.
- `re-tools` cuộn tùy chọn riêng, `re-viewport` cuộn bản vẽ riêng, `re-gallery-grid` cuộn thumbnail riêng. Không để cuộn toàn bộ trang khi thao tác; ở mobile panel xếp dọc với mỗi vùng cuộn độc lập.
- Bảng kiểm tra kết quả sau Áp dụng nổi trong workspace, không co height của panel; JS thêm/xóa trạng thái `re-workspace-open` khi mở, làm mới, hoặc gặp lỗi.
- Cache-bust HTML CSS/JS và bổ sung Node/CSS + Chromium E2E assertions về kích thước, vị trí, khả năng cuộn riêng và chiều cao không đổi.


## 2026-10-16 — Chỉnh sửa trực tiếp đường bao chọn vùng bằng kéo đỉnh/cạnh

- `pdf-region-handles.mjs`: phép kéo đỉnh/cạnh không làm biến đổi dữ liệu cũ, kiểm tra hình học, hạn chế vượt biên và ràng buộc vùng lồng/giao.
- `region-eraser.js`: vẽ tay nắm SVG và vùng đang chọn; tự chọn vùng mới vẽ, chọn vùng qua danh sách hoặc click trực tiếp. Pointer capture để kéo có preview, commit một lần khi pointerup; Undo/Redo theo cử chỉ, Escape/pointercancel hủy thay đổi.
- `region-eraser.css/html`: nút **✥ Sửa**, đỉnh/cạnh tương phản rõ, hướng dẫn, vùng bấm cho touch, cache-bust.
- `tests/pdf-region-handles.test.cjs` và Chromium E2E chạy kéo đỉnh, cạnh, Undo/Redo trước khi chạy PDFium thật; giữ nguyên toàn bộ quy trình Áp dụng → Kiểm tra → Xuất PDF.


## 2026-10-16 — Thu gọn giao diện Vẽ vùng / Chỉnh sửa và hiển thị toàn trang

- Trạng thái CSS `re-editor-active` chỉ dùng khi mở trang để vẽ; rút gọn topbar, hàng tệp, workflow, nút quay lại, PDF toolbar, footer; giảm chiều rộng panel trái còn ~248px, giữ scroll độc lập.
- Chế độ `Vừa trang` đã được sửa từ căn theo width đơn thuần sang phép fit theo cả chiều cao lẫn chiều rộng viewport thực. Thêm `Vừa rộng` cho PDF CAD và nút `Ẩn tác vụ / Hiện tác vụ` để tập trung bản vẽ.
- `pdf-region-view.mjs` mới chứa thuật toán đo kích thước trang và tỉ lệ zoom không phụ thuộc DOM. `ResizeObserver` trong `region-eraser.js` tự căn khi đổi viewport, vẫn dùng giới hạn RAM/canvas megapixel cũ và giữ overlay SVG/tay nắm.
- Bổ sung `tests/pdf-region-fit-layout.test.cjs`, Chromium đo các biên trang PDF và thao tác layout, cập nhật cache bust CSS/JS và cập nhật test cố định chiều cao từ phiên bản trước.


## 2026-10-16 — Sửa lỗi hộp thông báo che PDF sau khi Áp dụng

- Chuyển bảng Kết quả xử lý từ overlay tuyệt đối trên góc PDF sang đầu panel tác vụ cuộn độc lập bên trái, đồng thời bỏ `scrollIntoView` gây cuộn ngoài ý muốn.
- Chuyển nút `Chỉnh sửa lại` ra thanh điều hướng phía trên trang PDF, truy cập được ngay cả khi panel tác vụ ẩn.
- Thay toast fixed bằng trạng thái inline trong footer ngoài khung PDF và trong tiêu đề dàn trang, bảo toàn màu lỗi và accessibility; toast vẫn dùng cho uploader chưa mở PDF.
- Sửa CSS layout/mobile, cache-bust assets và thêm Node + Chromium checks đảm bảo vùng PDF không bị che.

## 2026-10-16 — Khôi phục giao diện sửa Text, bảo vệ frontend đã chốt

- Giữ route `text-editor.html` dẫn tới frontend CIT gốc trong `studio/edit-pdf-text.html`; không thay thành organizer hoặc trình soạn Text khác.
- Bổ sung lối **Khôi phục giao diện chỉnh sửa Text** tại vùng mở tệp, dẫn tới `studio/repair-editor.html` để người dùng xử lý Service Worker/cache lỗi sau khi đổi tên repository.
- CSS bổ sung chỉ áp dụng cho liên kết khôi phục ở màn hình upload; không tác động `#overlay`, `#inspector`, nút sửa/lưu hay thuật toán PDFium/CIT.
- Nâng bài kiểm tra asset-paths bảo vệ bố cục editor gốc, panel font/cỡ chữ/giãn dòng, Undo/Redo, Export và liên kết khôi phục.
- Kết quả E2E có trước: Chromium/PyMuPDF xác nhận sửa và xuất PDF mẫu Latin hai dòng; PDF có bảng CAD/font subset vẫn cần kiểm tra bằng mẫu thực tế.

## 2026-10-16 — Áp dụng trực tiếp văn bản, không giữ lớp bản nháp

- Ảnh báo lỗi cho thấy văn bản đang soạn bị chồng dòng trong ô bảng. Phân tích frontend CIT hiện tại: editor dùng HTML contenteditable và canvas native glass để xem trước; commit PDF thật gọi `endEdit(true)`.
- Bổ sung `studio/hvd-text-apply.js` và CSS riêng: chỉ hiển thị **Áp dụng vào PDF / Hủy nhập** khi vùng text đang mở. Áp dụng gọi trực tiếp native CIT `endEdit(true)`, đóng vùng nhập và dựng lại trang PDF thay vì giữ overlay nháp.
- **Xuất PDF** và `Ctrl+S` khi còn vùng nhập sẽ thực hiện native commit trước khi xuất, tránh lưu PDF bỏ sót chữ đang gõ. `Ctrl+Enter` áp dụng, `Escape` hủy.
- Khi native glass được tạo, CSS ẩn mực chữ DOM để tránh nhìn cùng lúc hai lớp chữ; vẫn giữ dấu nháy và vùng chọn.
- Không sửa minified Vite, mã nguồn PdfEngine/PDFium WASM hoặc thêm lớp che trắng/sao chép text giả. Đường dẫn route và panel đã chốt giữ nguyên.
- Bổ sung `tests/studio-text-apply.test.cjs` vào Pages smoke CI. Nghiệm thu ảnh thực tế tiếng Việt/ô bảng từ PDF người dùng vẫn chưa thực hiện vì chỉ có ảnh màn hình, không có tệp PDF gốc; chưa khẳng định xử lý được mọi trường hợp paragraph đang chồng nội dung nhiều đối tượng.

## 2026-10-16 — Đồng bộ source CIT-PDFium và nghiệm thu Auto-Apply/Export

- Chuẩn hóa đúng cit-pdf tag 1.0.0/SHA `3c9c138d980a417de7439f383f37882a1d730ab6`; patch trong mã nguồn ở `scripts/cit-original/patch_source.py`, không sửa trực tiếp các JS đã minify.
- API native cố định `window.__HVD_CIT_TEXT_API` phản hồi thành công/thất bại và tự phục hồi UI/hồ sơ history khi commit bị từ chối trong phạm vi hỗ trợ; bridge bỏ tên chunk Vite cố định. Giữ Apply và Export tách riêng.
- `cascadeParagraphGrowth` mặc định tắt nhằm giữ vị trí các chữ lân cận trong bảng CAD; bổ sung tùy chọn kích hoạt thủ công tại inspector của bản build nguồn.
- `saveFile` không đóng tài liệu sau xuất; tình trạng Apply/Xuất được hiển thị tại thanh công cụ, Blob URL không thu hồi ngay; thao tác xuất bị chặn nếu native commit đang mở thất bại.
- Sửa lỗi build đường dẫn khi đổi repository sang `/PDF-Editor1/`, bổ sung bước TypeScript, Vite, regression và kiểm PDF sau xuất. `sync_text_build.py` giữ nguyên HTML/CSS đã chốt, các công cụ khác và metadata giấy phép, chỉ chép tài nguyên cần cho phiên chỉnh text.
- Workflow CI `38914907967`: **thành công đầy đủ**; Chromium chạy PDFium nguồn thật, PyMuPDF xác minh chữ sau lưu; đã commit bộ frontend mới `8e8a51465a3851a805e65e6e25baca91ea99473a`.
- Manifest `studio/hvd-text-build.json` có 676 tài nguyên và SHA-256 để phát hiện thay đổi ngoài dự kiến. Ghi chi tiết và giới hạn nghiệm thu tại `docs/TEXT_CIT_SYNC_RELEASE.md`.
- Chưa có PDF gốc từ ảnh lỗi để nghiệm thu CAD phức tạp, font Type3/tiếng Việt/scan/chữ ký điện tử. Không khẳng định mọi lỗi WASM rollback nguyên tử.

## 2026-10-16 — Xử lý màn hình tải text xoay liên tục trên browser

- Ảnh người dùng cho thấy modal `loader-modal` có dòng “Đang tải Trình chỉnh sửa văn bản PDF...” che toàn bộ trang. Đây là trạng thái native `launchEditor(file)` đang xử lý. Không thể khẳng định lỗi do cache, module, WASM hoặc PDF đầu vào chỉ từ ảnh.
- Đã đối chiếu và kiểm thử *site live* (không phải local/mock) bằng Chromium trên GitHub Pages: phiên sạch và phiên cho phép Service Worker đều mở được trang `studio/edit-pdf-text.html`, tải PDF fixture, nhận diện hai paragraph, tạo API CIT/PDFium, không lỗi JS; [workflow startup](https://github.com/hieudang99dd/PDF-Editor1/actions/workflows/studio-startup-live.yml).
- Do chưa có PDF thực tế gây treo, chưa tái hiện được nguyên nhân sâu; không khẳng định đã xử lý được **mọi** trường hợp. Bổ sung watchdog 25 giây trên loader, nút **Tải lại trình chỉnh sửa** và lối **Khôi phục cache**. Không ép hủy phiên native, không thay đổi content stream của PDF.
- Tăng cache Service Worker từ `pdf-dao-chich-v12` lên `pdf-dao-chich-v13`; cache bust `hvd-text-apply.js/css?v=20261016-stallfix1`; sửa QA đường dẫn và thêm bài kiểm tra phục hồi.
- Node/Pages smoke, Chromium website thật và build nguồn cit-pdf/PDFium đã đạt sau cập nhật; [source CI](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/38917298592) hoàn tất thành công.
- **Còn cần:** PDF gốc dẫn đến spinner và mẫu CAD/font subset/Unicode để bắt được đúng tình huống, phân biệt tải WASM chậm, browser caching, logic mở PDF và tính tương thích thuật toán. Không gọi tương đương cit-pdf “100%” vì có bản vá native result, tùy chọn cascade và UX Apply/Export.

## 2026-10-16 — Khắc phục hồi quy mở PDF trong Studio text editor

- Ghi nhận lỗi người dùng: thả/chọn PDF trên `/studio/edit-pdf-text.html` có thể dừng lâu ở vòng xoay “Đang tải Trình chỉnh sửa văn bản PDF”. Không quy kết lỗi giao diện chọn file khi chưa có bằng chứng.
- Rà soát nguồn `cit-pdf 1.0.0`: `launchEditor(file)` gọi `batchDecryptIfNeeded()` trước khi khởi chạy PDFium. Hàm `isFileEncrypted()` trong `src/js/utils/password-prompt.ts` chờ `getPDFDocument().promise` không giới hạn; đây là đường treo có thể xảy ra với PDF.js/PDF phức tạp, dù PDFium có thể đọc được.
- Bổ sung vào `scripts/cit-original/patch_source.py`: timeout 12 giây cho phép dò mã hóa **không thiết yếu**. Khi quá hạn, huỷ task PDF.js và chuyển nguyên PDF sang PDFium; PDF có mật khẩu vẫn dùng quy trình hỏi mật khẩu của PDFium. Giữ nguyên thuật toán PDFium C/C++/WASM.
- Theo dõi từng giai đoạn `__HVD_PDF_OPEN_STAGE` và hiển thị nhãn thực: kiểm tra mật khẩu → tải mô-đun → khởi tạo PDFium → phân tích font/đối tượng → đã mở. Giới hạn 45 giây khi đợi `engineReady` để trả thông báo lỗi có chỉ dẫn thay vì treo im lặng. Giữ nút hồi phục loader sau 25 giây.
- Bổ sung Chromium nghiệm thu trang thật `tests/studio-file-open-regression.cjs`, kiểm đúng entrypoint đang phát hành, **6/6** luồng chọn file thật/kéo-thả/setInputFiles trên PDF ba trang có chữ và vector, với Service Worker được bật và tắt.
- Bổ sung `tests/cit-pdfjs-timeout.test.cjs`: mô phỏng PDF.js treo, file cần mật khẩu và PDF thường; cả ba đều **PASS**. Build TypeScript/Vite, regression Node, Chromium sửa + Xuất và kiểm tra PyMuPDF đều **PASS**, [CI run 38920803970](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/38920803970), `# fail 0`.
- Không sửa giao diện đã duyệt, chỉ tăng độ tin cậy trong bước khởi tạo tệp PDF. Do chưa nhận được PDF cụ thể của người dùng, không khẳng định đã tái hiện được *nguyên nhân chính xác* của tệp đó; nếu tiếp tục treo cần PDF gốc và console log (theo nhãn bước hiện trên giao diện) để kiểm tra nội dung và worker chuyên biệt.

## 2026-10-16 — Giữ font gốc theo từng run, tự nạp font nhúng và loại bỏ cache chéo giữa các PDF

- Người dùng báo lỗi font khi mở PDF bìa hồ sơ cao tốc (ảnh màn hình): chữ có dấu/ký hiệu bị sai và bảng thuộc tính hiển thị Times New Roman. Chưa có tệp PDF gốc nên **chưa kết luận** phần chữ nào trong ảnh có font/subset lỗi; cần thử bản PDF thật.
- Đối chiếu CIT 1.0.0: lõi đã có `runFontData`, `synthRunFont`, `FontFace`, `ensureRunFont`; tuy vậy giao diện chọn đoạn trước đây dùng `p.runs[0]` và cache font theo `family|bold|italic` không xóa khi thay PDF. Điều này dễ hiển thị không đúng run đại diện hoặc dùng nhầm bản font subset giữa hai tài liệu.
- Vá nguồn qua `scripts/cit-original/patch_source.py`: thêm `hvdOriginalFontInfo()` (font/cỡ/màu/đậm/nghiêng, trạng thái nhúng/khả dụng, cảnh báo nhiều font/subset, ưu tiên run tại con trỏ), `hvdEnsureSelectedOriginalFont()` nạp bất đồng bộ dữ liệu font có trong PDF, và `hvdLoadSelectedSystemFont()` gọi `queryLocalFonts` **sau thao tác cấp quyền của người dùng** rồi nạp byte font khớp.
- `syncInspector()` khi mới chọn một paragraph hiển thị thuộc tính của run có nội dung đại diện thay vì tùy tiện lấy run đầu tiên. Khi con trỏ nằm trong vùng đang chỉnh, ưu tiên đúng `span[data-src]` của đoạn chữ tương ứng.
- Xóa `docFonts`, `docFontsReady`, `docFontsNull`, `_fontADCache` mỗi khi mở PDF mới, không bao giờ dùng nhầm font tài liệu trước. **Không** đổi `run.family` chỉ khi người dùng chọn đoạn và **không** chép một font thay thế lên văn bản gốc.
- Thêm phần **Font gốc của vùng đang chọn** trong inspector với tình trạng/font/cỡ/đậm-nghiêng, cảnh báo subset và nút **Nạp font từ máy (cần cấp quyền)**. Trình duyệt không thể tự cài hoặc tải hợp pháp tất cả font thương mại; font không nhúng/Type3 hay ký tự ngoài subset có thể cần font bản quyền có sẵn trên máy hoặc được người dùng cung cấp.
- Kiểm thử `tests/cit-original-fonts.test.cjs` và `tests/studio-text-sync-browser.cjs`: **PASS** bộ regression (0 lỗi), đọc native PDFium run font thực tế (`Chrom Sans OTF` trên fixture), bảng inspector nhất quán với tên font được trích xuất, sửa text bằng Apply, Xuất PDF và xác minh PyMuPDF không mất dòng lân cận. Source build [run 38923000647](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/38923000647) **success**; frontend mới commit `2b2a10cf3e0e5889a89fe288c6c73294c3bc4a85`.
- **Giới hạn:** chưa có PDF bìa dự án trong ảnh để xác nhận glyph tiếng Việt/Type3/SHX/embedded subset ngoài fixture. Không tuyên bố hoàn hảo với mọi font và không tải font Times New Roman lên kho web.

## 2026-10-16 — Thanh ảnh thu nhỏ trang trái (dành cho hồ sơ PDF 247 trang)

- Yêu cầu từ ảnh người dùng: giữ vùng sửa text ở giữa, inspector bên phải; thêm **cột ảnh thu nhỏ trang bên trái**, nhấn trang nào chuyển đúng trang đó, có ô nhảy số trang và nút thu gọn.
- Giữ PDFium/cit-pdf 1.0.0 làm engine biên tập và điều hướng; vá nguồn **có neo kiểm soát** tại `scripts/cit-original/patch_source.py`: export `getPageCount`, `getPageIndex`, `navigateToPage`, phát `hvd:pagechange` khi native đổi trang và `hvd:document-open` sau khi PDFium mở tệp thành công.
- Thumbnails dựng độc lập bằng PDF.js (read-only) trong `edit-pdf-text-page.ts`: `window.__HVD_PDF_THUMBNAILS.render(index)`, chỉ khởi tạo đối tượng PDF.js khi có ảnh ở gần vùng cuộn; mỗi thumbnail giới hạn 152×198 CSS px, nén JPEG; tự huỷ document/task khi người dùng mở PDF mới.
- Frontend độc lập `studio/hvd-text-pages.js` và `studio/hvd-text-pages.css`: rail trái rộng 194px (160px màn hẹp), tự độc lập scroll, đánh dấu trang hiện tại, bấm thumbnail, nhập số trang, nút `▤ Trang`, responsive màn nhỏ. Tạo tối đa **hai ảnh đồng thời** với IntersectionObserver và generation token tránh kết quả từ PDF cũ.
- Trước khi nhảy trang, bridge gọi `window.__HVD_COMMIT_BEFORE_PAGE_NAV` → native Apply để tránh bỏ nội dung đang nhập; các thao tác xuất/sửa hiện tại không bị thay đổi. Nếu PDF.js không dựng được thumbnail vẫn còn nút số trang để điều hướng PDFium.
- Nghiệm thu qua `tests/studio-text-sync-browser.cjs`: mở PDF thật **4 trang**, đợi thumbnail đầu tiên thực sự là JPEG, bấm thumbnail trang 3 và xác thực PDFium/toolbar chuyển tới `3 / 4`, nhập số 1 trở về trang đầu, thử ẩn/hiện cột, tiếp tục sửa text + Áp dụng + Xuất; PyMuPDF xác nhận tất cả trang khác còn nguyên văn bản và kích thước. Static QA `tests/cit-page-sidebar.test.cjs` bảo vệ lazy rendering cho tài liệu 247 trang.
- [CI build nguồn + Chromium + PyMuPDF](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/38927270314) **PASS**, `# fail 0`; bundle đã đồng bộ lên master commit `891d5de178b9d199a2839a8fa334ed9108765239`. Mã nguồn thương hiệu, công cụ khác và giấy phép được giữ nguyên.
- Giới hạn: thumbnails hiện là ảnh của tệp gốc tại thời điểm mở, không phải live preview của thay đổi text chưa xuất; kiểm thử thực tế trên bộ 247 trang của người dùng chưa có file mẫu, chỉ xác minh nguyên tắc lazy & giới hạn tài nguyên bằng regression. Các PDF mã hóa hoặc PDF.js không đọc được vẫn có số trang và điều hướng native.

## 2026-10-16 — Đổi tên sản phẩm hiển thị thành PDF EDITOR

- Theo yêu cầu, thay thương hiệu hiển thị “PDF Đạo Chích” và “PDF HVD” bằng **PDF EDITOR** ở trang chủ, trình sửa text, bộ công cụ PDF, màn hình khôi phục, SEO/tab title, manifest cài ứng dụng và thanh công cụ.
- Đổi chữ trên biểu tượng nhãn hiệu từ “Đ” sang “P”; đổi phiên bản assets nhận diện `20261016-editor1` và Service Worker sang `pdf-editor-v14`, đồng thời xóa cache tên cũ khi kích hoạt.
- Giữ URL đang phát hành `https://hieudang99dd.github.io/PDF-Editor1/`, không đổi tên repository, không thay đổi engine PDFium/cit-pdf, đường đi của tác vụ, `NOTICE.md` hoặc `LICENSE`.
- Cập nhật smoke tests và CI mô phỏng sửa/xuất PDF để không hồi quy về thương hiệu trước. Các tài liệu nhật ký cũ có thể nhắc tên trước đây như ghi chép lịch sử.

## 2026-10-19 — Browser OCR: PaddleOCR and Vietnamese refinement

- Added `ocr.html`, `pdf-ocr.mjs/css`, `pdf-ocr-core.mjs`; homepage OCR and Studio OCR share this route instead of requiring localhost.
- PaddleOCR.js 0.4.2 / PP-OCRv6 small runs in a dedicated Worker with same-origin model/WASM assets. Added default opt-in-visible Tesseract `vie+eng` refinement after real tests exposed missing Vietnamese tone characters in Paddle model dictionaries.
- Added page ranges, DPI controls, skip-native-text, progress/cancel/retry, editable per-line results, confidence polygons and PDF/TXT export. Searchable PDF retains original page contents, uses invisible embedded Unicode text, and maps coordinates through PDF.js viewport.
- Local real browser acceptance passed on synthetic Vietnamese scan, cancel/retry, native/out-of-range pages, correction/export and zero changed rendered pixels. Independent PyMuPDF confirmed Unicode extraction and unchanged pixels. Regression initially 218 pass / 2 skip; final validation recorded by CI.
- Added pinned rebuild script, vendor manifest/licenses, browser acceptance workflow and `docs/OCR_BROWSER.md`. Large/cropped/rotated coordinate math has unit coverage; no claim of perfect OCR on all engineering drawings. Final deployment requires successful runtime build and Pages verification.

### Publication verified — 2026-10-19

- Runtime release commit: `18a7f08b1fa5a2185cf8d639c9d1dedcc449b8d5`. OCR acceptance workflow `39186660834` and master recheck `39186818446`: success. GitHub Pages run `39186817973`: build/deploy/report success.
- Live website Chromium acceptance at `https://hieudang99dd.github.io/PDF-Editor1/ocr.html`: passed homepage/Studio navigation, Vietnamese scan OCR, cancel/retry, editing, PDF/TXT downloads, native/out-of-range page preservation, unchanged rendering and same-origin assets. Local 218 Node tests passed (2 skipped); 3 Python branding tests passed.

## 2026-10-19 — Editable Word from OCR with Vietnamese font embedding

- Added the dedicated DOCX export button, OOXML writer and independent layout module. Preserve page sizes/orientations, editable positioned text and real ruled Word tables with rectangular horizontal/vertical merges; retain non-text graphics as a masked background.
- Added per-cell Vietnamese recognition to reduce line-rule characters and cross-column concatenation on scanned tables. Existing recognized text remains editable before DOCX export; native pages use PDF text geometry.
- Embed four Noto Sans fonts with reversible OOXML obfuscation, NFC Unicode and font relationships. This is a Vietnamese-capable replacement font, not recovery of an unknown scan font.
- Browser QA covers a native table and the same table as a scan, Unicode corrections and PDF/TXT/DOCX downloads. Local LibreOffice render was inspected page by page; independent PyMuPDF verifies pagination, Vietnamese, a single-line title and retained graphics. Added geometry/merge/font tests and `.github/workflows/ocr-word.yml`.
- Output is editable text boxes plus real tables; borderless/skewed/unclear tables and exact source font recovery are not claimed. Publication status is confirmed after CI/Pages.

### Editable Word publication verified — 2026-10-19

- Release: `dfce85ab612d3bad8047720c0f5d2f51bbd7e3d8`. Word acceptance run `39190058047` (branch) and `39190219048` (master): success. Pages build/deployment `39190218655`: success.
- Direct live browser acceptance passed on `https://hieudang99dd.github.io/PDF-Editor1/ocr.html`: PDF/TXT/DOCX download, corrected Unicode, three Word sections, two editable ruled tables (native and scan), four embedded fonts, original PDF rendering unchanged, page range respected and no external document upload.
- Local Node regression: 222 passed, 2 skipped. Three rendered Word pages were inspected; independent font-byte, Unicode, pagination, graphic and visible table-border checks passed. Complex/source-specific layout and recognition limitations remain documented.

## 2026-10-19 — Correct editable Word font/spacing failures

User screenshot showed per-line TextBoxes and broken spacing. Replaced custom VML text reconstruction with pinned MIT dolanmiu/docx 9.6.1 browser library and normal flowing paragraphs/tables; kept full four-face Noto Sans embedding through a small font adapter. Fixed dropped native whitespace and gutter bridging. A realistic administrative-letter regression additionally exposed residual raster Vietnamese accents; full-line font-relative masking eliminates these in the fixture. Corrected landscape dimension handling in the library adapter.

Validation: 225 Node tests (223 pass, two pre-existing skips), real Paddle/Tesseract browser OCR and PDF/TXT/DOCX downloads, independent three-page Word rendering, merged/native/scanned tables, reversible font bytes, dimensions and graphic preservation. Added actual fragmented PDF administrative-letter/paired-header fixture and edited-font document; independent render + pixel check catches ghost accents. Deployment verification pending. Original user PDF/DOCX not supplied; do not claim an exact-file fix or perfect conversion.

Release verification: `6f8e38c` published after branch Word acceptance run `39192573797` succeeded. Pages deployment `39192755329` and master smoke run `39192756300` succeeded. Fresh Chromium sessions against the public Pages URL passed actual OCR/correction/PDF/TXT/DOCX downloads and the administrative-letter font-change export, including zero textboxes. The first reproducibility gate caught CRLF variation in third-party license text; build now normalizes notice line endings. Runtime bundle checksum stayed unchanged.

## 2026-10-19 — Local browser signature integration

Replaced the homepage's fixed last-page image-stamp route with `sign.html`: upstream Signature Pad 5.1.4, typed Vietnamese name, PNG/JPEG/WebP signature/stamp, optional white matting, multiple page placements with drag/resize/keyboard support, separate apply/preview and export. Integrated pinned @signpdf 3.3.0 + node-forge 1.4.0 for actual RSA/SHA-256 CMS signing with P12/PFX and combined PEM identities. Signing Worker keeps private data local, ends after each request, and export clears the password. Rejects expired/mismatched keys and already-signed input; does not claim CA trust, TSA/LTV, ECDSA, Token/remote or incremental signatures.

Local verification: 229 Node tests (227 pass, two existing skips), real Chromium drawing/placement/downloads and P12+PEM signing, wrong password/expiry/signed-input rejection, typed/image/mobile and same-origin requests. Independent PyMuPDF confirmed unchanged text and image placement on all four CropBox/Rotate orientations; OpenSSL verified both CMS signatures, rejected tampered bytes and confirmed Vietnamese metadata. All rendered pages inspected. Deployment verification pending.

## 2026-10-19 — Ký tay và ký số PDF – hợp nhất từ nhánh phát triển

- Kế thừa mã và bộ kiểm thử có sẵn trên `codex/signature` (không phát triển lại từ đầu). `sign.html` là công cụ riêng mở qua thẻ **Chèn chữ ký**, sử dụng `pdf-sign*.mjs/css`, Signature Pad, pdf-lib và @signpdf.
- Ký tay/nét biến thiên, chữ ký nhập tên tiếng Việt, ảnh PNG/JPEG/WebP, đặt/kéo/co khung nhiều trang; Áp dụng để xem trước riêng, Xuất PDF riêng.
- Ký số RSA >= 2048 bằng chứng thư P12/PFX hoặc PEM kèm private key và mật khẩu, SHA-256/CMS detached; Worker xử lý cục bộ. Không hỗ trợ chứng thư công khai đơn thuần hoặc CA/USB Token không có khóa riêng dạng tệp.
- Bảo vệ PDF đã có chữ ký chống rewrite (chưa incremental sign), giữ nguyên text và form trước đó. Browser automation tạo chứng thư kiểm thử tạm, OpenSSL kiểm chứng `ByteRange`, dữ liệu sửa bị từ chối, PyMuPDF xác thực CropBox/Rotate và chữ ký trên bốn trang.
- Đã đưa bản đạt CI lên `master` bằng fast-forward `fa7dfc4ad82e45b87b5e7739de6d2c2c6b85d86a`. [CI ký](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39195292511), [Pages deploy](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39195291882) và [Pages smoke](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39195292503) đều thành công. Bổ sung workflow nghiệm thu trình duyệt trực tiếp trên website sau khi triển khai.
- Giới hạn: chưa PAdES-LT/LTA, TSA/timestamp chứng thực, CA trust/OCSP/CRL, ECDSA, PKCS#11 USB Token, remote signing, ký nhiều bên giữ chữ ký cũ; không được mô tả các cơ chế này như đã hỗ trợ. Xem `docs/SIGNATURES.md`.

### Kiểm thử website chữ ký sau phát hành — 2026-10-19

- Đã phát hành `sign.html` trên `master`; CI source/browser/crypto `39195292511` và GitHub Pages `39195291882` đều thành công.
- Thêm workflow `.github/workflows/signature-live.yml` để kiểm thử trên đúng `https://hieudang99dd.github.io/PDF-Editor1/sign.html` sau khi triển khai. Sửa lỗi cấu hình fixture: cài `node-forge` qua lockfile trước khi tạo chứng thư QA.
- [Run trực tiếp website **39195871566**](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39195871566): **SUCCESS** toàn bộ bước, gồm mở trang thật, Playwright ký/đặt chữ ký và tải PDF, chứng thư RSA P12/PEM, chặn PDF đã có chữ ký, kiểm hình học PyMuPDF và OpenSSL kiểm CMS `ByteRange` + phát hiện thay đổi dữ liệu. Artifact chỉ lưu PDF, PNG, JSON; chứng thư và khóa QA sinh tạm không được upload.
- Đây là bằng chứng chữ ký mật mã hợp lệ theo test fixture; **không chứng minh** tin cậy CA thương mại hoặc hỗ trợ USB Token/SmartCA, TSA, LTV. Chưa nghiệm thu chứng thư thật của người dùng.

## 2026-10-19 — Tải PDF đã ký và mở rộng đầu vào cho công cụ chữ ký

- Phân tách **mở/xem/tải bản gốc** với **ghi/chèn chữ ký**; tệp PDF đã có chữ ký không còn bị chặn ở bước tải lên. Với chữ ký cũ, PDF.js hiển thị an toàn và cho tải lại file byte-identical; các nút ghi/ký tiếp bị khóa vì chưa có incremental signing giữ chữ ký trước.
- Hỗ trợ PDF (kể cả ký số, password-view) và chuyển ảnh PNG/JPG/WebP thành PDF bằng pdf-lib. Nhận dạng magic bytes, lỗi rõ ràng với Word/Excel/CAD chưa có bộ chuyển đổi, tránh nhận là hỗ trợ mọi tệp tùy ý.
- Bỏ giới hạn cứng 200 MB ở input; vẫn giới hạn theo khả năng RAM của trình duyệt. Chứng thư và ảnh chữ ký giữ giới hạn tài nguyên riêng.
- Bổ sung kiểm thử signed fixture: xem thành công PDF 4 trang đã ký, tải tệp nguyên byte, không cho ghi lại, cộng kiểm thử từ chối định dạng văn phòng không thể chuyển; giữ test OpenSSL ByteRange không bị đổi và PDF khác vẫn ký được.

### Tải mọi phần mở rộng — bổ sung an toàn

- Bỏ bộ lọc `accept` cố định của input. Tệp không phải PDF/ảnh vẫn được nhận vào phiên, hiển thị thông báo chưa thể xem/ký và cung cấp nút tải lại **đúng byte**, không đưa tệp nhị phân lạ vào PDF.js/PDFLib.
- Test Chromium xác nhận DOCX thử nghiệm tiếp nhận và tải lại, mọi thao tác sửa/áp dụng vẫn bị khóa. Ký trực tiếp trên DOCX/CAD không được tuyên bố hỗ trợ. Chỉ PDF và ảnh đã hỗ trợ có thể sửa/ký theo thuật toán hiện hành.

### Nghiệm thu tải mọi loại tệp và PDF đã ký — 2026-10-19

- Release logic trên `master`: `f6319b775d4f91f02d104757668eada3728faafa`, bổ sung kiểm thử PNG `34566e9a5601b3ea4ce8db5e40ddd2a24b87548d` và sửa riêng kịch bản read-only `06c154c8f587227501d8aabd0673248dfce0793b`. Đổi cache-bust CSS, JS và import core của trang ký sang `20261019-upload3` tại `a389a4e3267751c80a80577091a1f58e123a0938`.
- [CI mã nguồn và OpenSSL trên master](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39197983245): **SUCCESS**; [CI trực tiếp trên GitHub Pages](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39197983272): **SUCCESS**, [Pages deployment](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39197982974): **SUCCESS**.
- Browser thực tế đã kiểm PDF ký RSA P12/PEM vẫn xem được, khóa ghi/ký tiếp, tải lại byte-perfect; DOCX thử nghiệm được tiếp nhận + tải lại đúng byte nhưng không xem/ký; PNG được chuyển thành PDF 1 trang; PDF chưa ký giữ ký tay/ký số và xuất bình thường. OpenSSL xác thực CMS ByteRange không thay đổi với PDF ký; phát hiện sửa bytes, dữ liệu biểu mẫu/trang gốc giữ nguyên.
- Đã bỏ bộ lọc phần mở rộng cho đầu vào và giới hạn cứng 200MB; không bảo đảm RAM vô hạn. Tệp Word/Excel/CAD chỉ tiếp nhận và tải lại; trước khi ký phải có PDF chuyển đổi tương ứng, không giả lập bộ đọc/ký chưa có.
- Build vendor `digital.mjs` hiện có **nondeterministic/minifier hash drift** so với artifact ghim; CI xác minh SHA bản phát hành, chạy rebuild và kiểm thử chức năng/mật mã + CI site thật thay vì báo sai rằng byte build luôn tái lập. Cần rà tiếp nguyên nhân minifier drift riêng, không liên quan chữ ký đầu vào.

### 2026-10-19 — Sửa đầu ra Word chỉ chứa ảnh scan

- Kiểm tra file `BBLV_Approved_ocr.docx` (2 trang): hai bitmap scan đặt trong header, 0 bảng Word và chỉ có mã tài liệu ở vài đoạn; không phải Word OCR có thể sửa. Đã tái tạo ví dụ `BBLV_Tai_tao_Bang_Text_Chinh_sua.docx` độc lập với 2 trang, 2 bảng nội dung Word thật, chữ Việt có thể sửa và logo/chữ ký/QR là ảnh độc lập.
- Sửa chức năng bỏ qua native: chỉ vì có mã tài liệu trên PDF scan không còn được bỏ OCR toàn trang; nếu trang có ảnh và text layer mỏng thì chuyển sang PaddleOCR / Tesseract. Bổ sung kiểm tra nội dung editable trước xuất DOCX để ngăn tạo Word chỉ có bitmap.
- Giữ nguyên engine docx 9.6.1, font Unicode và PDFium; bộ test bổ sung nhận diện scan có mã, kiểm chặn file Word sai. Vẫn cần PDF scan gốc để đo độ chính xác cell segmentation cho tài liệu thực tế.

## 2026-10-19 — Nâng cấp nén PDF theo ảnh nhúng và bảo toàn chữ/vector

- Phân tích code hiện tại: tác vụ `Giảm dung lượng PDF` trong `pdf-local-tools.js` chỉ đọc/ghi lại bằng pdf-lib, không nén ảnh XObject; studio compress cũ chứa đường dẫn bundle `/PDF-Editor-Hdv/` gây rủi ro tải engine ở URL hiện hành.
- Khảo sát repo [dgbkn/compress-pdf-lib (MIT)](https://github.com/dgbkn/compress-pdf-lib), [le0pard/qpdf-wasm](https://github.com/le0pard/qpdf-wasm), [mattdesl/pdf-optimizer](https://github.com/mattdesl/pdf-optimizer), [palpfiction/pdf-compressor (AGPL)](https://github.com/palpfiction/pdf-compressor). Quyết định áp dụng nguyên lý **recompress ảnh XObject vào đúng PDF object reference**, không raster hóa chữ/nét CAD; qpdf-WASM/Ghostscript là backlog, không giả vờ đã tích hợp.
- Thêm `pdf-compress-engine.mjs`: 3 preset safe/balanced/strong; browser canvas resize + JPEG cho ảnh nhúng DCTDecode/FlateDecode DeviceRGB/Gray 8-bit không có SMask/Decode/DecodeParms. Bỏ qua ảnh không hỗ trợ/CMYK/JPX/JBIG2 để tránh lỗi font/giá trị màu/chữ ký.
- Không ghi lại PDF có chữ ký số (`/ByteRange`, dictionary `/Sig`); không tăng dung lượng nếu tối ưu kém; kiểm tra PDF kết quả hợp lệ, số trang, kích thước và rotation.
- Kết nối tác vụ homepage `pdf-local-tools.js` và xây dựng `compress.html` + `pdf-compress-page.mjs` riêng, hiện dung lượng gốc/mới, tỉ lệ giảm thực, số ảnh được tối ưu, tiến độ, nút Áp dụng nén/ Tải PDF. Các route studio nén cũ chuyển về engine chung.
- QA: `tests/pdf-compress.test.cjs` (**9/9 kiểm thử Node**, 0 thất bại), `tests/pdf-compress-browser.cjs` (Chromium nén PDF 2 trang ảnh lớn + vector/text, xuất qua cả `compress.html` và homepage), `scripts/verify_compress.py` (PyMuPDF kiểm layer chữ, nét vector, khổ trang, rotation). [Run 39212961893](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39212961893) **SUCCESS**, [Pages smoke](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39213062812) và [Pages deployment](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39213062645) **SUCCESS**.
- Hạn chế công bố rõ tại `docs/PDF_COMPRESSION.md`: không cam kết giảm 90% hoặc đúng target KB; ảnh CCITT/JBIG2/JPX và các tài liệu tương tác rất phức tạp phải được nghiệm thu riêng. Chưa xác minh PDF thực tế của người dùng.

### Nghiệm thu website nén PDF — 2026-10-19

- [Run Chromium trực tiếp trên GitHub Pages 39213639623](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39213639623) **SUCCESS**; `compress.html` và tác vụ homepage nén PDF 2 trang có ảnh JPEG dung lượng lớn, chữ và nét vector. Sản phẩm tải xuống được kiểm độc lập bằng PyMuPDF: giữ nguyên toàn bộ text layer, vector path count, số trang, rotation và kích thước. Chế độ nén mạnh giảm >10% trên fixture synthetic (không áp dụng làm cam kết cho mọi PDF).
- [Local CI 39212961893](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39212961893) **SUCCESS**: 9/9 unit regression; browser 2 entrypoint; PyMuPDF đối chiếu. Chữ ký PDF giữ byte-identical nhờ fail-closed.
- Site công khai: `https://hieudang99dd.github.io/PDF-Editor1/compress.html`; các route `studio/compress-pdf*.html` cũ có redirect. Chưa có PDF thực tế người dùng để đo độ nén và kiểm độ nét hình học CAD A0/A1.

## 2026-10-19 — Quản lý trang PDF: dàn trang, ảnh thu nhỏ và page assembly

- Trước đây các chức năng ghép, tách, xoay, trích xuất, xóa trang tách rời; bộ `organizer.js` nhiều khả năng đã có thumbnail/grid nhưng không phải một cửa vào quy trình riêng cho tác vụ quản lý trang.
- Khảo sát Stirling-PDF (page editor), BentoPDF (PDF Multi Tool), PDF Arranger (GTK/pikepdf), PDFsam Basic (JavaFX), Mozilla PDF.js và pdf-lib. Kế thừa quy trình layout, selection/bulk/drag/drop và copyPages; **không nhúng** backend Java/GTK hoặc tuyên bố tính năng chưa có như booklet, split theo bookmark.
- Bổ sung `pages.html`, `pdf-pages.css`, `pdf-pages.mjs`, `pdf-pages-core.mjs`: lưới trang / lưới + preview / cột bên trái, ảnh thumb lazy (tối đa 2 render, cache 90), nhập trang đích, Ctrl/Shift, chọn range/chẵn/lẻ, kéo thả, xoay, nhân đôi, xóa, đảo thứ tự, thêm trang trắng, ghép nhiều PDF, hoàn tác, tách theo mốc thành ZIP, trích xuất trang chọn.
- Bắt buộc **Áp dụng & kiểm tra** trước khi **Xuất kết quả**. Copy PDF page content bằng pdf-lib, không raster toàn trang; kiểm số trang và MediaBox. PDF đã ký số chỉ cho tải lại bản gốc nguyên byte, không chỉnh/sắp xếp phá chữ ký.
- Trang chủ thêm nút `Quản lý trang PDF` và dẫn các công cụ Sắp xếp / Ghép / Xoay / Xóa / Tách / Trích xuất vào chung một giao diện. Route Studio `organize-pdf.html` và `pdf-multi-tool.html` được chuyển về `../pages.html`, vẫn giữ mã nguồn organizer.js cho chỉnh sửa/ghi chú.
- Nghiệm thu với `tests/pdf-pages.test.cjs`, `tests/pdf-pages-browser.cjs`, `.github/workflows/pdf-pages-qa.yml`: PDF nhiều nguồn, text, nét vector, khổ giấy/rotation, thumbnail, bố cục, mốc tách/ZIP, chữ ký số và nguyên-byte. Xem thêm `docs/PDF_PAGE_MANAGEMENT.md` về hạn chế bookmark, form, XFA, PDF tags và tài liệu pháp lý.

### Nghiệm thu website quản lý trang PDF — 2026-10-19

- [Page manager CI 39216815297](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39216815297): **SUCCESS** cho Chromium trang 4 + 2 nguồn PDF, nhập số trang, 3 chế độ dàn trang, xoay, chọn theo range, undo/redo, nhân đôi, split marker, trích xuất/xuất, bảo vệ chữ ký số.
- [Browser live QA 39216880318](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39216880318): **SUCCESS**, kiểm trên trang công khai GitHub Pages với dữ liệu PDF thật do bộ test tạo. Kiểm tiếp ZIP gồm 2 PDF độc lập sau mốc tách; PyMuPDF xác nhận 6 trang và nội dung chữ, nét vector. Chữ ký số được tải lại đúng từng byte, không sửa.
- [Pages deploy 39216880185](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39216880185): **SUCCESS**. Link thao tác `https://hieudang99dd.github.io/PDF-Editor1/pages.html`. Bản cache assets `20261019-pages2`.
- Các thuật toán đã được triển khai là PDF.js thumbnail, PDF-LIB copy pages + rotation + verify và JSZip split. Stirling-PDF, PDFsam, PDF Arranger và các chức năng n-up, booklet, split theo bookmark/size vẫn là tài liệu tham khảo/backlog, **không được báo đã tích hợp nguyên repo**.
- Giới hạn: `pdf-lib.copyPages` không bảo đảm giữ metadata nâng cao (bookmarks, XFA, outline, named destinations); phải dùng hồ sơ thực tế A0/A1, 100–1000 trang để nghiệm thu toàn diện.


### Cắt lề PDF — thao tác trực quan + duyệt trước khi xuất (2026-10-19)

- Thêm công cụ độc lập `crop.html`, giao diện `pdf-crop.css`, controller `pdf-crop.mjs`, lõi `pdf-crop-core.mjs`; trang chủ `index.html` và danh mục `hvd-ui-v2.js` mở trực tiếp công cụ này.
- Dùng PDF.js để render và chuyển **4 góc** từ tọa độ trang nhìn (kể cả /Rotate 0/90/180/270) về PDF user space. Dùng `pdf-lib.setCropBox` cắt hiển thị không raster nội dung vector/chữ. Giới hạn trong MediaBox/CropBox hiện tại, kiểm tra kích thước và số trang đầu ra.
- Kéo tạo vùng, kéo di chuyển, 8 điểm/cạnh; dò lề tự động có padding để hạn chế bỏ sót nét; chọn 1/tất cả/khoảng trang. PDF đã ký số ở chế độ chỉ đọc (không viết lại).
- **Áp dụng & kiểm tra** tạo PDF kết quả thực bằng pdf-lib, mở lại qua PDF.js và hiển thị ảnh trước/sau. Nhật ký ghi danh sách trang, thay đổi kích thước/lề theo mm. Phải tick xác nhận mới cho **Xuất PDF**; chỉnh vùng làm vô hiệu hóa bản review và khóa xuất ngay lập tức.
- Kiểm thử `tests/pdf-crop.test.cjs` + Playwright Chromium `tests/pdf-crop-browser.cjs`. GitHub Actions [crop QA 39225574091](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39225574091): **SUCCESS**; [Pages build 39225572827](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39225572827): **SUCCESS**, commit `a68ef36ab`.
- Phạm vi nghiệm thu: 2 trang vector khác hướng, vùng cắt, duyệt/tải kết quả, bảo toàn MediaBox & page count, chặn xuất khi chưa review hoặc sau thay đổi, khóa PDF ký số. Chưa nghiệm thu diện rộng A0/A1, nhiều lớp CAD, XFA hoặc in nhiều máy in.
- Giới hạn quan trọng: CropBox **không xóa dữ liệu ngoài vùng cắt**, không thay thế công cụ xóa bảo mật. Tham khảo `docs/PDF_CROP_REVIEW.md`.


### Đồng bộ các cập nhật trong giao diện PDF EDITOR mới — 2026-10-19
- Trang chính `index.html` dẫn vào tất cả công cụ đã triển khai; giữ các engine trang riêng để tránh xung đột PDF.js/PDFium/Web Workers và thao tác file chưa xuất.
- Thêm `pdf-editor-workspace.js`: thanh điều hướng PDF EDITOR thống nhất trên công cụ Quản lý trang, Cắt lề (có review), OCR, Chuyển đổi, Chữ ký, Xóa vector, Kiểm tra PDF, lối về Nén PDF và Sửa Text. Không đổi logic engine hoặc tải lại file ngầm.
- Giữ `studio/hvd-hub.js` trong Sửa Text upstream, không chỉnh/sửa bản build PDFium.
- Đồng nhất nhãn PDF EDITOR trong Cắt lề và Chuyển đổi, tăng version script danh mục để tránh cache cũ.
- Giữ thẻ Thuộc tính PDF và thẻ Ghép PDF riêng ngoài danh mục (ghép đã nằm trong Quản lý trang).
- Cập nhật README từ website cũ sang `https://hieudang99dd.github.io/PDF-Editor1/index.html`; thêm kiểm thử định tuyến tại `tests/pdf-editor-integration.test.cjs`.
- Không tuyên bố engine backend PP-StructureV3/Office đã chạy ngay trên web tĩnh; chúng vẫn tùy chọn hoặc cần chạy backend.

### 2026-10-19 — Sửa liên kết giao diện cũ (#hvd-tool=28)
- URL cũ `index.html?v=20261019-suite1#hvd-tool=28` mã hóa Cắt lề PDF bằng index 28, không phải URL mới của trình cắt lề.
- `index.html` chuyển hướng trực tiếp ngay ở phần head cho các nhóm chuyên dụng: Cắt lề `crop.html`, Quản lý trang `pages.html`, OCR `ocr.html`, Chuyển đổi `convert.html`, Sửa Text và các công cụ riêng. Giữ mã 0 cho Nén PDF chạy trong trang chủ.
- Asset danh mục được đổi version thành `hvd-ui-v2.js?v=20261019-legacyfix2`.
- Thêm kiểm thử Chromium với chính đường dẫn cũ có `utm_source` và `#hvd-tool=28`; phải tới màn hình cắt lề có Review trước khi xuất, không mở workspace cũ.


### 2026-10-19 — PDF-Editor1 là giao diện cuối duy nhất
- Thêm `pdf-editor-unified.js/css` và khu `#unified-ws` trong `index.html`; toàn bộ công cụ chuyên sâu mở bằng iframe cùng origin trong một shell PDF EDITOR, dùng một nav chung.
- Phân giải các hash cũ (`#hvd-tool=28` cắt lề…) thành `#workspace=crop` trong trang chính; đồng bộ nút trình duyệt Back/Forward.
- Khi iframe, `pdf-editor-workspace.js` không dựng thanh menu trùng; liên kết về trang chủ/công cụ gửi sự kiện nội bộ có kiểm tra origin tới shell. Sửa tương tự `studio/hvd-hub.js`.
- Không xóa PDF.js/PDFium/PP-Structure hoặc trang runtime vì đang là dependency. Đã nghỉ dùng các UI độc lập ở mức luồng chính; giữ làm compatibility entrypoints. OCR PP-StructureV3 và Office vẫn cần backend riêng.
- Bổ sung test link cũ, chuyển tab và về danh mục trong Chromium.
