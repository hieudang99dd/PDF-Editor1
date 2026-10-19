# PDF HVD — Bản đồ repository và quy tắc vệ sinh mã nguồn

Ngày cập nhật: 2026-10-16. Tài liệu này là điểm tham chiếu chung cho các agent/lập trình viên.

## Bố cục được bảo vệ

| Nhóm | Thư mục / file | Giữ vì |
| --- | --- | --- |
| Website | `index.html`, `hvd-ui-v2.*`, `pdf-local-tools.js` | Trang chủ, filter, router, tác vụ PDF |
| PDF editor HVD | `organizer.js/css`, `text-editor-hdv.html`, `text-editor-shell.js/css`, `pdf-text-layout.js`, `pdf-batch-text.js` | Engine dự phòng, undo/redo, PDF CAD |
| PDFium native | `pdf-native-*.mjs`, `vendor/cit-pdf/`, `fonts/`, `NotoSans-*.ttf` | WASM, Unicode, font và ghi chữ gốc |
| Studio | `studio/`, `scripts/cit-original/`, `CIT-ORIGINAL-FRONTEND.lock.json` | Frontend Vite, bundle phụ thuộc, build có thể tái lập |
| PDF tools | `cit-advanced-core.js`, `cit-advanced-ui.js`, `pdf-lib.min.js`, `pdf.min.js` | Core tách UI adapter; API browser |
| Kiểm tra | `pdfium-preflight-core.mjs`, `pdfium-preflight-worker.mjs`, `pdfium-preflight.html` | Module thuần dữ liệu và Worker có vòng đời riêng |
| OCR và Word | `ocr.html`, `pdf-ocr*.mjs/css`, `vendor/paddleocr/` | OCR Worker, sửa kết quả, PDF/TXT/DOCX; chữ/bảng Word chỉnh sửa được và font Việt nhúng |
| PC engine | `backend/` | OCR/Office/TIFF qua localhost |
| Thử nghiệm hồi quy | `tests/`, `.github/workflows/` | Kiểm thử chức năng trước khi merge |
| Bản quyền | `LICENSE`, `NOTICE.md`, `fonts/*OFL*`, `vendor/*LICENSE*` | Thông tin nguồn và quyền sử dụng |

## Tài liệu hợp nhất theo nghiệp vụ

- `docs/TEXT_ENGINE.md`: các giai đoạn xử lý text native, sửa hàng loạt, biên ô CAD, Type3 và hạn chế.
- `docs/STUDIO_DEPLOYMENT.md`: frontend Vite, ghim upstream, branding HVD, đường dẫn tái build, kiểm thử Studio.
- `docs/PROCESSING_AND_QA.md`: thuật toán xử lý trang/nâng cao và PDFium kiểm tra trước khi sửa.
- `CIT-FEATURE-PORTING-MATRIX.md`: bảng 119 entrypoint của upstream (danh mục lịch sử), giữ riêng vì phục vụ tra cứu chuyên sâu.
- `IMPLEMENTATION_PROGRESS.md`: nhật ký tiến độ liên tục, không dùng làm file chứa thuật toán.
- `backend/README.md`: hướng dẫn vận hành PC engine.
- `.agents/skills/pdf-editor-completion/`: kiến trúc, quy trình/roadmap cho agent.

## Quyết định vệ sinh đợt 2026-10-16

- **7 file tài liệu theo lần tích hợp** được hợp nhất thành 3 file trong `docs/`.
- Xóa **19 script tạm** tại `scratch/` (nhiều file patch trực tiếp `organizer.js`, có thể tạo lỗi nếu chạy lại).
- Xóa `debug_run.py`, `debug_run2.py`: bản debug thử cũ dùng selector/API không còn đồng bộ.
- Xóa `hvd-home-v2.css` (mẫu CSS cũ không nạp từ `index.html`) và `hvd-legal.js` (điều khiển dialog cũ không còn giao diện tương ứng).
- Thêm `.gitignore` cho artifact tạm; không làm mất lịch sử Git, có thể khôi phục từng file theo commit trước đợt vệ sinh.
- Không gộp `cit-advanced-core.js` với `cit-advanced-ui.js`, không gộp `pdfium-preflight-core.mjs` với worker và không chỉnh `studio/assets/` vì **phân định runtime có chủ đích**.
- Không xóa `.br`, `woff`, wasm, font hoặc chunk hash trong `studio/` nếu chưa có manifest build và kiểm thử lại. Nhiều file trông giống nhau nhưng gắn với URL hash hoặc lazy-load.
- Cần chạy đủ Node suite, kiểm tra route, JS syntax và quy trình phát hành sau khi dọn.

## Quy trình khi muốn dọn thêm

1. Kiểm kê đường dẫn ứng viên và SHA bằng GitHub, đánh giá thông số sử dụng.
2. Tìm tất cả import / script src / manifest / GitHub Actions / test / document link tới file đó.
3. Phân biệt **cùng nghiệp vụ** với **trùng mã**: Worker/UI/core và nguồn vs artifact không phải bản sao để xóa.
4. Di chuyển hoặc hợp nhất vào file duy nhất; sửa mọi tham chiếu trước khi xóa file cũ.
5. Chạy test đơn vị và E2E nếu động đến công cụ dùng PDF thực; không tuyên bố pass khi chưa có bằng chứng.
6. PR vào `master`, kiểm tra Pages/CI và ghi vào `IMPLEMENTATION_PROGRESS.md`.

Không chứa tài liệu PDF cá nhân, token/secret, file test người dùng hoặc output debug trong repository phát hành.

## Tác vụ riêng: Xóa vector theo vùng

- Trang `region-eraser.html` là chức năng độc lập, route `region-eraser-route` từ trang chủ.
- Adapter `region-eraser.js/css` quản lý PDF.js preview, state/Undo, UI vùng; core `pdf-region-*.mjs` dùng worker PDFium.
- Không đưa `eraseRegions`, CSS `po-region-*` hoặc toolbar `po-tb-region` trở lại Organizer. Muốn mở rộng lõi xử lý thì thay trong `pdf-region-native.mjs` và kiểm thử ở `tests/pdf-region*.test.cjs`.
