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

Mẫu tổng hợp không chứng minh độ chính xác cho mọi hồ sơ A0/A1, bảng dày, ảnh mờ hoặc chữ viết tay. Bản vẽ lớn nên OCR theo trang nhỏ hoặc chia tệp; giới hạn tải 200 MB. Chưa có chọn vùng bằng chuột hay chỉnh sửa ảnh scan trực tiếp; xuất Word và bảng có đường kẻ được mô tả bên dưới.

## Build và phát hành

```bash
cd scripts/paddleocr
npm ci --no-audit --no-fund
node build.mjs
```

Build tải model/ngôn ngữ chính thức, kiểm tra hash đã duyệt, tạo bundle main và sao nguyên worker/WASM. Workflow `.github/workflows/paddle-ocr.yml` chạy regression, browser acceptance rồi mới commit runtime được kiểm thử; từ chối ghi đè nếu nhánh đã tiến lên. Studio Text/PDFium không đổi thuật toán. Full publish script giữ redirect OCR riêng khi tạo lại Studio.

## Xuất Word chỉnh sửa được (cập nhật 2026-10-19)

Nút **Xuất Word sửa được (.docx)** xuất các trang đã xử lý, gồm cả trang giữ lớp chữ gốc. Các trang ngoài phạm vi không được tự thêm vào Word. PDF tìm kiếm được vẫn giữ toàn bộ trang.

### Thư viện GitHub được tích hợp

- [dolanmiu/docx](https://github.com/dolanmiu/docx), MIT, bản ghim **9.6.1**: thực sự tạo Paragraph/TextRun/Table, section, DrawingML và gói DOCX ngay trong trình duyệt. Bundle cùng origin tại `vendor/docx/docx.mjs`, SHA-256 và giấy phép kèm theo. Tái dựng: `cd scripts/word && npm ci && npm run build`.
- Đã đối chiếu [ArtifexSoftware/pdf2docx](https://github.com/ArtifexSoftware/pdf2docx), Python. Không tích hợp hoặc giả lập engine Python này trong website tĩnh. Hình học ghép dòng/đoạn và nhận bảng bên dưới là mã ứng dụng, không phải thuật toán của thư viện docx.

### Kiến trúc và sửa lỗi

- `pdf-ocr-word-client.mjs` render từng trang, lấy chữ PDF hoặc kết quả OCR đã sửa và nhận bảng có đường kẻ. Nền giữ đồ họa; xóa toàn dòng chữ bằng biên an toàn theo cỡ font để loại dấu tiếng Việt còn sót. Bảng scan được OCR lại theo ô trước bước xuất.
- `pdf-ocr-word-layout.mjs` trả các mảnh chữ native **kèm dấu cách**, tách gán vào ô trước khi ghép; nhận đường kẻ/gộp ô chữ nhật như trước.
- `pdf-ocr-word-flow.mjs` ghép theo baseline và khoảng cách, giữ dấu cách riêng, chuẩn hóa Unicode NFC, không ghép qua khoảng trống cột lớn. Gom dòng liền thành đoạn khi đủ bằng chứng hình học; tiêu đề cơ quan hai bên được giữ trong bảng Word không viền.
- `pdf-ocr-word.mjs` dùng **đoạn văn thông thường và bảng Word trong luồng**, không tạo TextBox cho từng dòng, không ép giãn ký tự. Chữ sửa và đổi font được; hàng bảng dùng chiều cao tối thiểu để giãn khi sửa. Mỗi trang nguồn là một section, giữ kích thước/hướng; giấy hơn 22 inch được thu tỷ lệ.
- Font Noto Sans Regular/Bold/Italic/BoldItalic nhúng đủ, không subset, kiểm chứng giải mã khớp byte TTF. Adapter nhỏ bổ sung bốn face vì API font của docx 9.6.1 chỉ công khai regular. Compatibility mode 15. Không chuyển sang VNI/TCVN3, không tuyên bố khôi phục font gốc.

### Giới hạn

Ưu tiên khả năng sửa chữ và bảng với bố cục gần bản gốc; không bảo đảm giống tuyệt đối. Đổi font/cỡ chữ hoặc thêm nội dung có thể dàn lại và tăng số trang. Văn bản nhiều cột phức tạp, chữ xoay, bảng không đường kẻ/mờ, bảng CAD và ảnh kém vẫn cần kiểm tra. Nền ảnh giữ đồ họa không tự dàn lại theo chữ; vùng chữ chưa nhận dạng có thể còn trong nền. Mask biên rộng có thể ảnh hưởng đồ họa sát chữ. Nhúng font tùy khả năng trình đọc; chưa tự động kiểm thử bằng Microsoft Word desktop.

PDF có lớp chữ sai ToUnicode/VNI/TCVN3 không tự sửa bằng đổi font. Bỏ chọn **Bỏ qua trang đã có chữ**, chạy nhận dạng lại rồi kiểm tra/sửa dấu và số liệu trước khi xuất. OCR cũng không bảo đảm mọi dấu/số liệu đúng.

### Kiểm định

- Mẫu bốn trang: scan chữ Việt + đồ họa, bảng native, bảng scan, trang ngoài phạm vi; xuất ba trang, hai bảng thật có ô gộp, bốn font nhúng. Browser kiểm tra OCR thật, sửa chữ, hủy/chạy lại, PDF/TXT/DOCX, không TextBox, không thêm trang ngoài phạm vi, tài sản cùng origin.
- Mẫu văn bản hành chính: PDF.js thực sự tách từ/dấu cách, tiêu đề hai bên, chữ Việt và số tiền. Xuất Word và bản đổi font sang Liberation Serif; LibreOffice/PyMuPDF kiểm tra hiển thị hai font khác nhau, khoảng trắng và số liệu. Kiểm tra nền mẫu toàn chữ không còn pixel mực để bắt lỗi dấu/nét ma.
- Render và xem toàn bộ trang PNG bằng quy trình tài liệu; không dùng kiểm tra XML thay cho kiểm tra hình ảnh. CI `ocr-word.yml` tái dựng thư viện ghim và giữ bằng chứng browser/render.
- Chưa có PDF/DOCX gốc của ảnh người dùng báo lỗi; mẫu tổng hợp kiểm chứng nguyên nhân chung, không chứng minh tài liệu đó đã chuyển đúng hoàn toàn.

### OCR → Word: xử lý PDF scan có mã tài liệu dạng lớp chữ (2026-10-19)

- Từ file người dùng `BBLV_Approved_ocr.docx`: có **hai ảnh nguyên trang** trong header, không có bảng Word, chỉ còn vài đoạn mã văn bản. Đây là kết quả sai, không đạt mục tiêu Word tái tạo.
- Nguyên nhân đường mã được xác định: tùy chọn bỏ qua trang native trước đây bỏ cả trang chỉ vì **một chuỗi chữ duy nhất**, thường mã tài liệu/QR của ảnh scan. Bổ sung `preserveNativeTextLayer()`: yêu cầu lớp chữ có ít nhất 90 ký tự, thuộc ≥3 baseline nếu trang có ảnh; trường hợp PDF không có ảnh vẫn giữ trang native ngắn.
- Bổ sung `validateEditablePages()` trước khi đóng gói DOCX: từ chối xuất chỉ có ảnh scan, hoặc trang scan OCR nhận quá ít chữ mà không có bảng, hiển thị hướng dẫn chạy lại OCR. Không báo thành công giả.
- Lưu ý đây là **chặn xuất lỗi và sửa phân loại trang**; nhận diện chuẩn bảng/ô, phân tách logo/chữ ký/QR khỏi nền cần thêm kiểm thử trên PDF scan gốc. File Word mẫu được tái tạo độc lập từ ảnh scan và hai bảng Word thật, không dùng ảnh nguyên trang thay chữ.
