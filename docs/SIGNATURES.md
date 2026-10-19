# Chèn chữ ký và ký số PDF

Tính năng độc lập tại `sign.html`, mở từ thẻ **Chèn chữ ký** trên trang chủ. Giao diện tiếng Việt, xử lý trong trình duyệt; không gọi dịch vụ ký cloud hoặc gửi tài liệu/chứng thư/mật khẩu ra ngoài.

## Đã tích hợp

| Cách ký | Thực hiện | Giới hạn |
| --- | --- | --- |
| Ký tay | Signature Pad 5.1.4: nội suy Bézier, nét thay đổi theo vận tốc, chuột/bút/cảm ứng, lùi/xóa nét, chọn màu/độ dày | Đây là hình hiển thị; không chứa chứng thực mật mã |
| Nhập tên | Canvas và Noto Sans hỗ trợ dấu Việt, chữ nghiêng/thường, cắt phần nền thừa | Hình chữ ký nhập tên, không phục hồi nét tay |
| Ảnh chữ ký/con dấu | PNG/JPEG/WebP, giữ alpha, tùy chọn làm trong nền trắng, tự cắt vùng trong suốt | Không xác thực nguồn gốc ảnh; không nhận SVG tùy ý |
| Chứng thư P12/PFX | @signpdf 3.3.0 + node-forge 1.4.0: RSA >=2048, SHA-256, CMS/PKCS#7 detached trong PDF | Cần chứng thư/khóa của người ký; chưa hỗ trợ ECDSA |
| PEM | PEM chứa chứng thư và khóa riêng RSA, khóa có thể mã hóa bằng mật khẩu | Không dùng được khi chỉ có chứng thư công khai |

Người dùng được đặt nhiều chữ ký khác nhau, chọn trang, kéo/đổi kích thước bằng chuột, đổi chiều rộng mm, lặp trên mọi trang, xóa khung; phím mũi tên dịch khung, Shift tăng bước, Delete xóa. **Áp dụng và xem trước** tạo bản nháp hiển thị; **Xuất PDF** thực hiện ký số nếu bật rồi tải kết quả. Thay đổi vị trí, lựa chọn chứng thư hoặc metadata sẽ khóa xuất cho đến khi áp dụng lại. Liên kết tải vẫn còn trong trang; chỉnh lại nội dung sẽ thu hồi kết quả cũ.

## Nguồn GitHub và khả năng tái dựng

- https://github.com/szimek/signature_pad — MIT, 5.1.4.
- https://github.com/vbuch/node-signpdf — MIT, bộ @signpdf/signpdf, signer-p12, placeholder-pdf-lib 3.3.0. Tích hợp placeholder dựa trên pdf-lib thay vì sửa chuỗi PDF bằng thuật toán plain.
- https://github.com/digitalbazaar/forge — BSD-3-Clause/GPL-2.0, node-forge 1.4.0; dùng theo BSD cho PKCS#12/PEM, ASN.1, RSA và CMS.
- https://github.com/Hopding/pdf-lib — MIT, 1.17.1; vẽ ảnh trực tiếp, giữ nội dung trang dạng PDF.

Tái dựng: `cd scripts/signature && npm ci && npm run build`. Lockfile ghim toàn bộ dependency; bundle browser/manifest SHA-256 và giấy phép nằm tại `vendor/signature/`. Bundle ký số được tải khi mở Worker, không sửa bundle Studio. Các repo bổ sung như zgapdfsigner/BentoPDF đã được đối chiếu; không tự gọi proxy/AIA/TSA của các dự án đó và không tuyên bố đã tích hợp mọi engine trên GitHub.

## Mật mã và dữ liệu

Worker `pdf-sign-worker.mjs` mở chứng thư, đối chiếu khóa riêng với chứng thư RSA, hạn hiệu lực và KeyUsage nếu có. P12 được chuẩn hóa trong bộ nhớ để hỗ trợ cả keyBag và encrypted keyBag trước khi gọi upstream P12Signer. Toàn bộ chuỗi chứng thư có sẵn trong tệp được đóng gói; không tự tải chứng thư AIA. Metadata tên/lý do/địa điểm dùng chuỗi UTF-16 để không mất dấu Việt.

Không log hoặc lưu khóa/mật khẩu trong localStorage/IndexedDB/server. Worker kết thúc sau mỗi tác vụ; dữ liệu chứng thư truyền được xóa trong Worker. Ô mật khẩu được xóa sau khi xuất; Làm mới xóa tệp/ảnh/chứng thư và kết quả phiên. Đây không phải cam kết xóa an toàn toàn bộ bản sao trong bộ nhớ của trình duyệt hoặc hệ điều hành.

## Giới hạn cần phân biệt

- Chữ ký mật mã hợp lệ không đồng nghĩa chứng thư được CA tin cậy. Chứng thư tự ký có thể báo chưa tin cậy. Chưa kiểm tra chuỗi CA, OCSP/CRL hoặc chứng thực pháp lý; không tuyên bố PAdES LT/LTA.
- Chưa có TSA/timestamp tin cậy, LTV, ECDSA, PKCS#11 USB Token, HSM, SmartCA/remote signing, hoặc dịch vụ yêu cầu nhiều người ký. Những loại này cần adapter/phần mềm/API và tài khoản nhà cung cấp; không có nút giả lập.
- **Cho phép mở, xem và tải lại nguyên byte PDF đã ký số**, kể cả khi có signature dictionary trong object stream. Công cụ tự động chuyển sang chế độ chỉ đọc, khóa Áp dụng/Ký lại để tránh phá chữ ký cũ. Chưa hỗ trợ incremental multi-sign/countersign, DocMDP hoặc ký tiếp mà giữ chữ ký trước.
- PDF có mật khẩu: trình xem PDF.js hỏi mật khẩu để hiển thị; nếu bộ ghi không đọc an toàn thì chỉ xem/tải nguyên tệp. Chưa tự động điền trường ký có sẵn; tạo trường ký mới ẩn và cho phép hình hiển thị riêng trên một/nhiều trang.
- Hình ký vẽ trực tiếp lên trang không phải đối tượng riêng để trình đọc PDF kéo lại sau xuất; sửa vị trí trong phiên trước khi xuất. Không raster hóa toàn bộ trang.
- Giới hạn PDF 200 MB, ảnh/chứng thư 10 MB, ảnh tối đa 16 MP; tài liệu/chuỗi chứng thư quá lớn có thể vượt bộ nhớ hoặc vùng trống chữ ký (32 KB).

## Kiểm định

- Node: hình học giới hạn khung, alpha matting/crop, phát hiện signature nén, hash và route tài sản.
- Chromium thật: vẽ nét upstream, kéo/resize/lặp nhiều trang, Apply/Export và tải PDF, P12/PEM, sai mật khẩu, hết hạn, chặn PDF đã ký, nhập tên Việt, tải ảnh, viewport mobile và không gọi HTTP ngoài origin.
- PyMuPDF độc lập: bốn trang xoay/cắt khác nhau, vị trí ảnh khớp tọa độ xem trước, chữ gốc/CropBox/Rotate không đổi; render và kiểm tra ảnh từng trang.
- OpenSSL độc lập: xác minh CMS detached trên đúng ByteRange của toàn PDF, kiểm tra metadata Việt; sửa dữ liệu phải xác minh thất bại. Dùng `-noverify` để tách kiểm tra chữ ký khỏi tin cậy CA; không báo chứng thư tự ký là chứng thư tin cậy.
- Chứng thư QA được sinh tạm trong `test-results/signature/`, không commit; CI chỉ tải PDF/PNG/JSON kiểm chứng, không tải khóa/chứng thư riêng.
- Workflow: `.github/workflows/signature.yml`. Chưa có chứng thư thật của người dùng hoặc kiểm thử Microsoft Acrobat/USB Token trên Windows.

## Trạng thái phát hành — 2026-10-19

- Nhánh phát triển `codex/signature` đã được fast-forward vào `master`, commit `fa7dfc4ad82e45b87b5e7739de6d2c2c6b85d86a`, không sửa lịch sử cũ.
- Chạy thành công bộ kiểm thử mã nguồn/ký số/browser trên nhánh thử nghiệm ([39194936345](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39194936345)) và khi đưa lên `master` ([39195292511](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39195292511)). GitHub Pages ([39195291882](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39195291882)), Pages smoke ([39195292503](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39195292503)) và UX Chrome ([39195292445](https://github.com/hieudang99dd/PDF-Editor1/actions/runs/39195292445)) đều đạt.
- Route công khai: [PDF EDITOR – Chữ ký](https://hieudang99dd.github.io/PDF-Editor1/sign.html).
- Bổ sung workflow `.github/workflows/signature-live.yml` để nghiệm thu bằng Chromium và OpenSSL **trực tiếp trên GitHub Pages** sau triển khai; kết quả từng lượt phải tham khảo CI, không suy diễn chỉ từ kiểm thử local.
- Chưa hỗ trợ ký số bằng USB Token/PKCS#11, SmartCA, HSM, TSA, OCSP/CRL hay ký nối tiếp trên tài liệu đã có chữ ký. Chưa nghiệm thu chứng thư thương mại thực tế trên Acrobat.

## Tải tệp mở rộng — 2026-10-19

- Bộ chọn tệp hỗ trợ **PDF có/không có chữ ký số**, PDF có mật khẩu ở chế độ xem, và ảnh PNG/JPEG/WebP (chuyển thành PDF trước khi chèn chữ ký). Xác định loại theo magic bytes thay vì chỉ kiểm tên file.
- Với PDF đã ký hoặc PDF không thể xác minh an toàn bằng pdf-lib: cho xem và tải bản gốc **đúng byte**. Khóa mọi tác vụ ghi/chèn thêm bằng API hiện tại; không giả định rằng ký lại qua pdf-lib là ký nối tiếp hợp lệ.
- Bỏ giới hạn cứng 200 MB khi tải PDF; tệp lớn được cảnh báo vì RAM/trình duyệt có thể hết bộ nhớ. Không thể bảo đảm mở tệp vô hạn dung lượng hay hỗ trợ mọi định dạng nhị phân.
- DOCX/XLSX/CAD và các tệp không phải PDF/ảnh hỗ trợ chưa được chuyển đổi bằng chính công cụ chữ ký; hiển thị lỗi rõ ràng, không lén xử lý thành PDF. Chứng thư và ảnh chữ ký vẫn có giới hạn an toàn riêng.
- QA: kiểm bằng PDF ký RSA thật, nút tải lại bất biến từng byte, chặn rewrite, xem trước 4 trang và phản hồi với file định dạng không hỗ trợ.

### Nhận mọi loại tệp để tải lại nguyên bản

- Nút chọn tệp **không lọc phần mở rộng**, bao gồm PDF đã ký số và các tệp Word/Excel/CAD/khác. Loại chưa có bộ đọc vẫn được giữ nguyên byte trong phiên và có nút **Tải bản gốc**, nhưng không có xem trước hoặc khả năng ký/chỉnh nội dung.
- Chỉ PDF (bao gồm PDF ký số ở chế độ xem) và PNG/JPG/WebP (chuyển thành PDF) là loại đang được hiển thị/xử lý. Không quảng cáo rằng bất kỳ tệp nào cũng có thể ký số.
