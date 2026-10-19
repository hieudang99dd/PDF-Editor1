# PDF EDITOR — nén PDF theo loại nội dung (2026-10-19)

## Nguyên nhân thuật toán cũ không đạt

Trong `pdf-local-tools.js`, tác vụ `Giảm dung lượng PDF` trước đây chỉ `PDFLib.PDFDocument.load` → `save({ useObjectStreams: true })`: thay đổi cấu trúc file nhưng **không giảm chất lượng hoặc kích thước ảnh nhúng**. Các scan/chụp ảnh vì vậy thường không giảm nhiều. Những route `studio/compress-pdf*.html` cũ vẫn trỏ bundle `/PDF-Editor-Hdv/` từ project cũ, có nguy cơ lỗi engine JS.

## Nguồn mở đã đánh giá

| Repository / giấy phép | Kỹ thuật | Quyết định |
| --- | --- | --- |
| [dgbkn/compress-pdf-lib](https://github.com/dgbkn/compress-pdf-lib) — MIT | Recompress các XObject nhúng trong PDF tại đúng object reference, dùng pdf-lib và trình mã hóa JPEG phía client. | **Kế thừa nguyên lý**, viết module tự chủ không cần Vite worker bundle, giới hạn ảnh đủ an toàn. |
| [le0pard/qpdf-wasm](https://github.com/le0pard/qpdf-wasm) | Nén stream/object PDF và tối ưu ảnh tùy bản QPDF | Nguồn tham khảo **tối ưu lossless bằng WASM** về sau; chưa tuyên bố đã tích hợp executable này vào nén mới. |
| [mattdesl/pdf-optimizer](https://github.com/mattdesl/pdf-optimizer) | MuPDF + codec ảnh/worker | Hướng nâng cấp codec và hiệu năng ảnh nặng. |
| [palpfiction/pdf-compressor](https://github.com/palpfiction/pdf-compressor) — AGPL-3.0 | Ghostscript WASM, giảm dung lượng sâu | Chưa nhúng để tránh tăng kích thước runtime, các vấn đề giấy phép và hành vi raster/ghi lại PDF cần kiểm chứng. |

Theo tài liệu qpdf, `--object-streams=generate`, `--recompress-flate`, `--compression-level=9` có thể giảm kích thước cấu trúc; riêng QPDF không giảm độ phân giải ảnh. [QPDF docs](https://qpdf.readthedocs.io/en/latest/cli.html#optimizing-file-size).

## Tính năng đã đưa vào sản phẩm

- Lõi `pdf-compress-engine.mjs`: đọc PDF byte trực tiếp, liệt kê Image XObject qua pdf-lib và chỉ tối ưu ảnh JPEG / FlateDecode 8 bit DeviceRGB hoặc DeviceGray có thể chuyển an toàn.
- Với ảnh đủ điều kiện, sử dụng canvas của trình duyệt để tái mã hóa JPEG (quality/scale khác nhau), **thay đúng reference ảnh**, không vẽ lại cả trang PDF. Không thay glyph font, stream lệnh vẽ vector hay biến trang thành ảnh.
- Bỏ qua ảnh có alpha, SMask, Mask, DecodeParms, Decode, JPX/JBIG2/CCITT, ICC, CMYK hoặc bitmap quá lớn; không tuyên bố xử lý mọi codec.
- Có 3 chế độ:
  - **Bảo toàn**: tối ưu cấu trúc, không động ảnh.
  - **Cân bằng**: JPEG quality 0.76, scale 0.85 (chỉ ảnh đủ điều kiện).
  - **Mạnh**: quality 0.58, scale 0.68 (chỉ ảnh đủ điều kiện).
- Bảo vệ chữ ký số bằng `/ByteRange` hoặc chữ ký loại `/Sig`: trả **đúng bytes gốc**. Nếu PDF mã hóa/không thể đọc, báo lỗi thay vì phá file.
- Kiểm PDF đầu ra bằng pdf-lib, đối chiếu số trang, kích thước và rotation; nếu kết quả không nhỏ hơn sẽ trả lại bản gốc, **không tăng dung lượng**.
- `pdf-local-tools.js`: thay logic nén cũ trên trang chủ, hiện tiến độ, dung lượng và phần trăm thực tế, ba mức nén.
- `compress.html` + `pdf-compress-page.mjs`: giao diện chuyên nghiệp độc lập, chọn/thả PDF, thống kê và hai nút **Áp dụng nén / Tải PDF kết quả**, xem tệp sau nén.
- Các URL `studio/compress-pdf*.html` trước đây chuyển hướng về `../compress.html`, tránh chạy lại JS cũ.

## Nghiệm thu và giới hạn

- `tests/pdf-compress.test.cjs`: kiểm hoạt động offline, chặn PDF giả, chế độ bảo toàn không tăng dung lượng, bảo vệ bytes chữ ký số.
- `tests/pdf-compress-browser.cjs`: tạo PDF 2 trang có ảnh JPEG dữ liệu lớn + chữ và đường kẻ vector, nén trên Chromium, kiểm tệp xuất và so sánh dung lượng.
- `scripts/verify_compress.py`: dùng PyMuPDF xác nhận **text layer giống nhau**, vector drawing count, kích thước, rotation và ảnh vẫn có trong mỗi trang.
- `.github/workflows/pdf-compress-qa.yml`: Node regression, Chromium và PyMuPDF độc lập.
- Không khẳng định mọi PDF đều giảm 90%. Không bảo đảm chính xác giới hạn đích 100KB/200KB khi điều đó đòi hỏi mất chất lượng.
- PDF có form/XFA/embedded attachment, cấu trúc PDF đặc biệt cần thêm bộ mẫu nghiệm thu. Trang nén không tự xử lý các loại nội dung không thể an toàn với pdf-lib.
- Không gửi file lên server; toàn bộ xử lý trong browser. Tốc độ/dung lượng tối đa phụ thuộc RAM/CPU của thiết bị.

## Backlog

1. Kiểm trên PDF bản vẽ Civil 3D nhiều lớp, kích thước A0/A1 và hồ sơ PDF scan 200–1000 trang do người dùng cung cấp.
2. Thử nghiệm mã hóa ảnh nhóm CCITT/JBIG2/JPX giữ metadata; chỉ triển khai khi kiểm chứng chất lượng bản vẽ và giấy phép codec.
3. Bổ sung profile target size **theo điều kiện**; không cam kết mức KB khi không thể giữ chất lượng.
4. Đo hiệu năng lớn bằng Web Worker, AbortController và thông báo RAM.
