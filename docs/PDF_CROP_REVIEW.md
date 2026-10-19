# Cắt lề PDF — engine bảo toàn vector và quy trình kiểm tra trước khi xuất

Ngày 2026-10-19. Trang độc lập: `crop.html`. Khởi chạy từ thẻ **Cắt lề PDF** trong danh mục *Tổ chức*.

## Kiến trúc nguồn mở và phạm vi đã viết mã

- **PDF.js** — hiển thị trang theo CropBox, CropBox offset, /Rotate 0/90/180/270; phương thức `viewport.convertToPdfPoint` ánh xạ cả **bốn góc** vùng cắt từ màn hình về PDF user space, sau đó dùng min/max. Không suy đoán bằng phép hoán vị thủ công.
- **pdf-lib** — dùng `PDFPage.getCropBox/getMediaBox/setCropBox`, lưu lại tài liệu gốc, giữ nội dung PDF trong content streams. Không raster hóa trong quá trình xuất, không viết lại page bằng ảnh và không sửa MediaBox.
- **Ứng dụng nội bộ**: `pdf-crop-core.mjs` xử lý vùng chuẩn hóa, giới hạn nằm trong giao của MediaBox/CropBox hiện tại, phát hiện biên nét bằng ảnh PDF.js với ngưỡng + đệm an toàn. Thuật toán dò lề chỉ *đề xuất* và phải qua xem trước bằng mắt.
- Tham khảo thiết kế và ranh giới của PyMuPDF `Page.set_cropbox`, jsami/pdfcrop; **không** nhúng trực tiếp mã Python hoặc desktop vào browser.
- Cắt lề **không xóa** chữ, hình, vector ẩn bên ngoài CropBox và **không** bảo đảm bí mật dữ liệu. Nếu mục tiêu là xóa nội dung vĩnh viễn, sử dụng công cụ xóa/redaction chuyên biệt.

## Quy trình bắt buộc

1. Tải PDF, kiểm tra số trang và phát hiện chữ ký số bằng `containsSignature` có sẵn từ `pdf-pages-core.mjs`. Tệp được ký chỉ đọc, không ghi lại.
2. Chọn trang và kéo vùng cắt (hoặc dò lề tự động), chỉnh bằng **8 điểm/cạnh** hay kéo di chuyển vùng. Có thể áp dụng cho trang hiện tại, tất cả trang hoặc danh sách `1-3, 8`.
3. Bấm **Áp dụng & kiểm tra**: pdf-lib cập nhật CropBox, save thành PDF thật; mở lại PDF bằng pdf-lib + PDF.js; kiểm tra số trang, MediaBox và các CropBox thay đổi. Không có thay đổi thì chặn.
4. Xem **trước / sau** dựng từ hai PDF thực. Nhật ký gồm số trang, khổ trước/sau, bốn lề bị ẩn (mm), tổng số trang bị tác động; có thể mở PDF tạm để kiểm tra.
5. Chỉ sau khi ảnh xem trước hoàn tất và người dùng tick **đã kiểm tra**, nút **Xuất PDF** mới được bật. Mọi thay đổi vùng/scope làm mất trạng thái phê duyệt và yêu cầu áp dụng lại.

## Chú ý

- CropBox là clip *hiển thị*, không phải xóa dữ liệu; không hiệu quả để che dữ liệu nhạy cảm.
- PDF có mật khẩu hoặc không tương thích với pdf-lib không được cưỡng bức ghi lại.
- Dò lề trên raster dễ bỏ sót nét mảnh màu nhạt, watermark, chú thích nhỏ, nên cố ý cộng padding và có xem trước. Bản vẽ hạ tầng A0/A1 cần kiểm thử thực.
- Áp dụng cùng vùng cắt theo **tỷ lệ tương đối trên trang đang nhìn** lên các trang khác. Hữu ích cho tài liệu nhiều khổ giấy/rotation nhưng người dùng cần kiểm tra danh sách trang bị cắt.
- Vì không raster, dung lượng có thể gần như không giảm. Các trang có trường form/XFA, layers đặc biệt và cấu trúc metadata nâng cao cần kiểm định riêng.

## Tệp và kiểm thử

- UI: `crop.html`, `pdf-crop.css`, `pdf-crop.mjs`.
- Core: `pdf-crop-core.mjs`.
- Geometry/structural: `tests/pdf-crop.test.cjs`; browser real-PDF: `tests/pdf-crop-browser.cjs`.
- CI: `.github/workflows/pdf-crop-qa.yml`; lưu ảnh so sánh vào artifact `pdf-crop-review-evidence` trên CI.

Giới hạn QA: mặc dù unit có trang xoay + non-zero CropBox, cần thêm tài liệu sản xuất thực tế khổ A0/A1 có CAD linework mảnh, bảng ký, page geometry lạ, conformance.


## 2026-10-19 — Một giao diện chính và kiểm soát trạng thái xuất
- Truy cập chính: `index.html#workspace=crop`; thẻ danh mục dùng route ổn định `data-pdf-route="crop"`, bỏ phụ thuộc vào số thứ tự công cụ trong danh sách cũ.
- Layout hai cột của `crop.html?embedded=1` được hiển thị trong shell, không lặp header. Thanh hành động Apply / Review / Export chỉ có ở shell khi nhúng.
- Cầu nối `postMessage` cùng origin chuyển lệnh thao tác và trạng thái nút thực. Engine kiểm tra lệnh ở cả hai đầu; nút Xuất chỉ hoạt động khi kết quả đã review và checkbox được xác nhận. Mọi chỉnh sửa vùng chọn thu hồi phê duyệt ngay.
- QA tự động: `tests/pdf-crop-browser.cjs` kiểm tra trực tiếp thẻ Cắt lề từ danh mục, bố cục sidebar/preview, tạo PDF đầu ra và khóa nút sau khi sửa lại.
