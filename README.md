# PDF EDITOR

Bộ công cụ PDF EDITOR: sửa văn bản gốc, biên tập trang, chuyển đổi, kiểm tra chất lượng PDF OCR trên trình duyệt và các tác vụ Office qua engine PC tùy chọn. Trang chính triển khai bằng GitHub Pages, dữ liệu PDF trên các công cụ browser không tự tải lên dịch vụ cloud.

**Truy cập:** https://hieudang99dd.github.io/PDF-Editor1/index.html

## Luồng chức năng

| Luồng | Đường dẫn chạy | Thành phần chính |
| --- | --- | --- |
| Trang chủ/các công cụ browser | `index.html` | `hvd-ui-v2.js/css`, `pdf-local-tools.js`, `cit-advanced-core.js`, `cit-advanced-ui.js` |
| Chỉnh sửa text chuyên sâu | `text-editor.html` → `studio/edit-pdf-text.html` | Frontend Vite đã biên dịch, PDFium WASM và worker upstream |
| Trình sửa PDF EDITOR dự phòng | `text-editor-hdv.html` | `organizer.js/css`, `text-editor-shell.js/css`, `pdf-native-*.mjs`, `pdf-text-layout.js` |
| Xóa vector theo vùng độc lập | `region-eraser.html` | `region-eraser.js/css`, `pdf-region-geometry.mjs`, `pdf-region-client/worker/native.mjs` |
| Kiểm tra chất lượng PDF | `pdfium-preflight.html` | `pdfium-preflight-core.mjs`, `pdfium-preflight-worker.mjs` |
| Ký PDF | `sign.html` | Ký tay/nhập tên/ảnh; ký số RSA P12/PFX/PEM trong Worker cục bộ |
| OCR trên trình duyệt | `ocr.html` (Studio OCR chuyển về cùng route) | PaddleOCR.js Worker + kiểm tra dấu Việt bằng Tesseract tùy chọn |
| Xử lý Office/OCR bằng PC (dự phòng) | `backend/` | FastAPI localhost; chỉ cần chạy cho các thao tác có ghi chú cần PC |

**Không gộp cưỡng bức** core, UI adapter, worker, font, WASM hoặc các JavaScript chunk chỉ vì chúng có tên gần giống nhau: các thành phần có runtime và vòng đời riêng. `studio/` là **artifact của bản build đầy đủ**, không phải tệp rác. Tham chiếu mã nguồn ngoài, font và thông báo bản quyền nằm trong `NOTICE.md` và `LICENSE`.

## Tài liệu đã chuẩn hóa

- [Sửa Text PDF / Native engine](docs/TEXT_ENGINE.md) — các giai đoạn hoàn thiện engine, giới hạn hình học, Undo/Redo.
- [Frontend, nhận diện, build/deploy](docs/STUDIO_DEPLOYMENT.md) — frontend upstream được ghim, luồng tái dựng, branding HDV.
- [Thuật toán xử lý PDF và kiểm định](docs/PROCESSING_AND_QA.md) — chức năng nâng cao, PDFium preflight.
- [Kiểm kê tính năng gốc](CIT-FEATURE-PORTING-MATRIX.md) — bảng đối chiếu lịch sử, không phải cam kết tính năng đã hoạt động.
- [Tiến độ và thay đổi](IMPLEMENTATION_PROGRESS.md).
- [Sổ tay cấu trúc và chính sách dọn dẹp](docs/REPOSITORY_MAP.md).
- [Đặc tả UX: Làm mới, Tệp khác, Back/Forward, Tải xuống không thoát tác vụ](docs/UX_WORKFLOW.md).
- [Xóa vector theo vùng bằng PDFium: thuật toán, giao diện, giới hạn và kiểm thử](docs/REGION_ERASER.md).
- [Thông tin nguồn/giấy phép](NOTICE.md).
- [Engine Office/OCR cục bộ](backend/README.md).

OCR có thể xuất PDF tìm kiếm được, TXT và Word (.docx) có chữ/bảng chỉnh sửa được, nhúng font tiếng Việt. Xem [quy trình, engine và giới hạn](docs/OCR_BROWSER.md).

## Kiểm thử

```bash
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_brand_site.py' -v
```

Bài test browser end-to-end và build frontend CIT yêu cầu dependencies được mô tả tại `.github/workflows/`. Mỗi thay đổi phải chạy `.github/workflows/pages-smoke.yml`; thay đổi Studio/upstream cần thêm build và browser QA tương ứng.

## Quy tắc phát triển

- Ưu tiên bảo toàn tính năng sửa text gốc, glyph Unicode, giới hạn bảng, baseline, trang xoay và lịch sử Undo/Redo.
- UI/UX tiếng Việt, chỉ hiện công cụ có route thật, không tuyên bố tính năng vượt mức đã kiểm chứng.
- Dọn bản vá thử nghiệm khỏi nhánh phát hành; sử dụng `tests/` và workflow CI để tái hiện lỗi.
- Không xóa các tệp `LICENSE`, `NOTICE.md`, thư mục `vendor/`, font, `studio/assets/` hoặc cấu hình deploy chỉ dựa trên tên file.
- Nếu cần quay lại trước đợt dọn dẹp, sử dụng lịch sử Git của repository.

### Giới hạn tệp lớn của Xóa vector theo vùng

Công cụ độc lập tại `region-eraser.html` nhận PDF tối đa **512 MiB**, cảnh báo bộ nhớ từ 256 MiB, xử lý trong Worker và giới hạn canvas xem trước 16 triệu pixel. Máy tính/trình duyệt vẫn có thể thiếu RAM với PDF phức tạp; xem `docs/REGION_ERASER.md`.

### Xóa vector theo vùng: dàn trang và ba phép xóa

Mở `region-eraser.html`, chọn trang trong dàn trang để phóng to. Hỗ trợ hợp nhiều vùng, xóa phần giữa hai đường bao lồng nhau và chỉ xóa phần giao của hai vùng. Có tùy chọn áp dụng các vùng đã vẽ hoặc áp dụng một mẫu vùng cho khoảng trang Từ–Đến. Nút **Áp dụng & xuất PDF** xử lý ngay, hiển thị PDF thực trước/sau, sau đó mới tải. Xem `docs/REGION_ERASER.md`.

**PDF có trang xoay:** Xóa vector theo vùng tự căn chỉnh phép chọn trên các trang /Rotate 0°/90°/180°/270° và CropBox tùy biến, không cần chuẩn hóa trang thủ công. Các đối tượng không phải PATH vector hỗ trợ vẫn theo giới hạn trong `docs/REGION_ERASER.md`.


**Xóa mọi đối tượng giao vùng:** công cụ độc lập hỗ trợ gỡ toàn bộ page object chữ/ảnh/đường tô/Form có hộp bao giao vùng. Có chế độ riêng giữ thuật toán cắt vector chính xác; với xóa nguyên object, nội dung ngoài đường bao cũng có thể mất. PDF đã ký có tùy chọn tạo bản sao sau khi chấp nhận chữ ký cũ mất hiệu lực. Đây chưa phải redaction bảo đảm loại bỏ dữ liệu bí mật; xem `docs/REGION_ERASER.md`.


**Quy trình xác nhận trước khi xuất:** công cụ Xóa vector theo vùng có hai nút độc lập **Áp dụng** (thực thi PDFium ngay trên web, mở kết quả để xem) và **Xuất PDF** (chỉ được bật sau khi áp dụng thành công). Có nút **Chỉnh sửa lại** giữ các vùng đã chọn và cho phép áp dụng lại, không tải PDF khi mới bấm Áp dụng; xem `docs/REGION_ERASER.md`.


## Giao diện thống nhất — PDF EDITOR (2026-10-19)

**Trang chủ chính thức:** https://hieudang99dd.github.io/PDF-Editor1/index.html

Giao diện `index.html` là điểm vào chung; các thuật toán chuyên sâu vẫn nằm ở trang độc lập để không thay đổi vòng đời PDF.js, PDFium, Worker hoặc file đang xử lý. Các trang `pages.html`, `crop.html`, `ocr.html`, `convert.html`, `sign.html`, `region-eraser.html` và `pdfium-preflight.html` có thanh chuyển công cụ PDF EDITOR chung (`pdf-editor-workspace.js`). Trình sửa Text tại `studio/edit-pdf-text.html` đã có `studio/hvd-hub.js` điều hướng về trang chủ, nên không tiêm thanh điều hướng mới vào bản build upstream.

- **Quản lý trang PDF:** có ghép PDF; thẻ Ghép PDF trùng lặp đã ẩn khỏi danh mục.
- **Cắt lề PDF:** áp dụng thực, review hình ảnh trước/sau, xác nhận trước khi xuất.
- **OCR:** PaddleOCR.js chạy web; PP-StructureV3 là lựa chọn backend riêng, chưa được coi là hoạt động trên GitHub Pages.
- **Chuyển đổi:** giao diện tập trung; những định dạng cần FastAPI/LibreOffice phải chạy engine tương ứng, GitHub Pages không thể chạy Python.
- **Các công cụ khác:** Nén PDF, sửa Text, ký PDF, xóa vector theo vùng giữ nguyên runtime.

Luồng sử dụng: mở `index.html` → chọn công cụ → xử lý → kiểm tra/áp dụng → xuất khi tác vụ hỗ trợ. Không tự chuyển file giữa các công cụ (để bảo vệ dữ liệu). Thay đổi này chỉ đồng bộ giao diện và điều hướng, **không** tuyên bố bổ sung thuật toán PDF mới.
