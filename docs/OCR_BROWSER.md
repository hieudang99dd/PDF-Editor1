# OCR trên trình duyệt — PDF EDITOR

Ngày: 2026-10-19. Route chính `ocr.html`; `studio/ocr-pdf.html` chuyển đến cùng công cụ. Trang chủ mở trực tiếp công cụ này, không yêu cầu localhost.

## Engine và dữ liệu

- PaddleOCR.js 0.4.2, PP-OCRv6 small detection/recognition, ONNX Runtime Web 1.24.3 chạy WASM trong Worker. Dùng một luồng WASM để hoạt động trên GitHub Pages không cần COOP/COEP.
- Mô hình mặc định còn thiếu nhiều ký tự tiếng Việt có dấu. Thử thật trên cùng ảnh: Paddle thuần trả `Khi lưng bê tông`; không dùng điểm tin cậy cao để suy ra đúng ngữ nghĩa.
- Tùy chọn **Kiểm tra dấu tiếng Việt bằng Tesseract** bật sẵn. Tesseract.js 6.0.1 / core 6.0.0, tessdata_fast `vie+eng` nhận dạng lại từng vùng dòng do Paddle phát hiện. Đây là nhận dạng lại từ ảnh, không đoán/sửa số liệu bằng từ điển. Có thể tắt để dùng Paddle thuần.
- Mô hình, WASM, worker, ngôn ngữ và font đều cùng origin; không tải tài liệu lên máy chủ và không gọi API cloud. Bộ runtime được tải theo nhu cầu, trình duyệt có thể dùng HTTP cache.
- Hash SHA-256, kích thước và phiên bản trong `vendor/paddleocr/manifest.json`; source dependency lock tại `scripts/paddleocr/package-lock.json`. Giấy phép trong NOTICE và vendor.

## Luồng thao tác

1. Chọn PDF; chọn tất cả hoặc khoảng trang `1-3, 5`; chọn 180/240 DPI.
2. Mặc định giữ trang đã có bất kỳ chữ gốc. Với trang hỗn hợp ảnh/chữ có thể bỏ tùy chọn này; có nguy cơ lớp chữ trùng ở phần đã có text.
3. Nhận dạng tuần tự, giới hạn canvas 8 triệu pixel và cạnh 4096 px; có tiến trình và Hủy. Kết quả hoàn tất được giữ nếu hủy/lỗi; chạy lại bắt đầu một bộ kết quả mới.
4. Chọn trang ở cột trái, sửa từng dòng bên phải. Polygon hiển thị vị trí; điểm tin cậy dưới 85% có viền cam. Điểm của Paddle/Tesseract không phải thước đo xác suất đã được hiệu chuẩn.
5. Xuất PDF giữ toàn bộ trang gốc, thêm Unicode text rendering mode 3 tại trang OCR; trang đã có chữ và ngoài phạm vi không thêm lớp chữ. TXT chỉ gồm các trang được xử lý.

Tọa độ polygon từ canvas được đổi qua `viewport.convertToPdfPoint`, giữ CropBox và Rotate trong hệ tọa độ gốc. Lớp chữ dùng Noto Sans nhúng subset, ToUnicode qua pdf-lib/fontkit. Không tái dựng trang từ ảnh. OCR không khôi phục chắc chắn font gốc; xuất qua pdf-lib không bảo toàn hiệu lực chữ ký số của PDF đã ký.

## Kiểm thử

- `node --test tests/*.test.cjs`: regression và kiểm tra phạm vi trang, giới hạn ảnh, ma trận chữ ở bốn góc xoay/CropBox, NFC, hash vendor.
- `NODE_PATH=scripts/paddleocr/node_modules node tests/paddle-ocr-browser.cjs`: Playwright + PDF scan tổng hợp thật, không mock OCR. Kiểm tra tiếng Việt có dấu, số `125,50`, hủy/chạy lại, sửa kết quả, xuất PDF/TXT, giữ trang native và trang ngoài phạm vi; so toàn bộ pixel trước/sau và kiểm tra không có HTTP request ngoài origin.
- PyMuPDF độc lập đã xác nhận trích xuất được Unicode và ảnh trang trước/sau giống nhau trên mẫu xuất local.
- Browser evidence lưu trong `test-results/paddle-ocr/` (không commit PDF/artifact), CI upload artifact `paddle-ocr-browser-evidence`.

Mẫu tổng hợp không chứng minh độ chính xác cho mọi hồ sơ A0/A1, bảng dày, ảnh mờ hoặc chữ viết tay. Bản vẽ lớn nên OCR theo trang nhỏ hoặc chia tệp; giới hạn tải 200 MB. Chưa có chọn vùng bằng chuột, nhận dạng cấu trúc bảng hay chỉnh sửa nội dung scan trực tiếp.

## Build và phát hành

```bash
cd scripts/paddleocr
npm ci --no-audit --no-fund
node build.mjs
```

Build tải model/ngôn ngữ chính thức, kiểm tra hash đã duyệt, tạo bundle main và sao nguyên worker/WASM. Workflow `.github/workflows/paddle-ocr.yml` chạy regression, browser acceptance rồi mới commit runtime được kiểm thử; từ chối ghi đè nếu nhánh đã tiến lên. Studio Text/PDFium không đổi thuật toán. Full publish script giữ redirect OCR riêng khi tạo lại Studio.
