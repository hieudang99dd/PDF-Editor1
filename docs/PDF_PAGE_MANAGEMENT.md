# PDF EDITOR — Quản lý trang PDF bằng dàn trang trực quan

Ngày triển khai: 2026-10-19. Trang chạy độc lập: `/pages.html`. Không xóa `organizer.js` hiện có dành cho chế độ chỉnh sửa nội dung.

## 1. Đánh giá hiện trạng

- Trang chủ trước đó có nhiều công cụ tách lẻ: `Ghép PDF`, `Cắt PDF`, `Xoay PDF`, `Xóa trang`, `Trích xuất trang`, `Sắp xếp PDF`; người dùng phải vào mỗi tác vụ riêng và thiếu trải nghiệm dàn trang nhất quán.
- `organizer.js` hiện có hơn 160KB và đã có `IntersectionObserver` để tạo ảnh trang theo cuộn, `Sortable`, lịch sử undo/redo, khung xem trước, lựa chọn chẵn/lẻ/range. Không loại bỏ engine này hoặc thay các tính năng sửa chữ đã chốt.
- Cần trang **Quản lý trang PDF** độc lập dễ tìm trên danh mục, ba kiểu dàn trang và quy trình **Thao tác → Áp dụng/kiểm tra → Xuất** rõ ràng.

## 2. Repo/thuật toán tham khảo

| Nguồn | Đặc điểm | Quyết định áp dụng |
| --- | --- | --- |
| [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | Workspace nhiều tệp; chọn trang/đổi thứ tự, sắp xếp trang, dàn trang theo hàng hoặc theo tệp; chia theo điểm; khôi phục. | Kế thừa **quy trình nhiều tệp, chọn tập hợp, hành động hàng loạt**. Chưa nhúng backend Java/PDFBox hoặc triển khai PDF split by size/bookmarks. |
| [BentoPDF](https://github.com/alam00000/bentopdf) | `PDF Multi Tool`, lưới thumb; drag/reorder, duplicate/delete, blank, rotate, split ZIP. | Kế thừa **tư duy tổ chức trang thống nhất trong một workspace**, không sao chép nguyên frontend/bundle cũ. |
| [PDF Arranger](https://github.com/pdfarranger/pdfarranger) | Thumbnail dàn trang, đa chọn Ctrl/Shift, scale, xoay, trích xuất, thao tác bằng bàn phím; dùng pikepdf. GPL-3.0. | Áp dụng nguyên lý UX và page selection. Không nhúng GTK/pikepdf runtime vào GitHub Pages tĩnh. |
| [PDFsam Basic](https://github.com/torakiki/pdfsam) | Split/merge/extract/mix, chia theo bookmarks/dung lượng và bộ quy tắc trang; JavaFX/AGPL. | Tham khảo các chế độ chia trang; **không** tuyên bố đã tích hợp tất cả thuật toán Java. |
| [Mozilla PDF.js](https://github.com/mozilla/pdf.js) | Render PDF page viewport → canvas, PDF page lazily by page number. | **Sử dụng phiên bản pdf.min.js/pdf.worker.min.js đã có trong repo**, render thumbnail bằng `IntersectionObserver`, chỉ 2 tác vụ cùng lúc, cache 90 ảnh nhỏ. |
| [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib) | `PDFDocument.copyPages`, `addPage`, `setRotation`, `save`. | **Tích hợp** để sao chép trang gốc (không raster), gom nhiều PDF, thêm trang trắng và xuất. |
| [JSZip](https://stuk.github.io/jszip/) | Tạo ZIP từ các PDF tách ra. | Dùng bản `jszip.min.js` sẵn có trong dự án. |

Giữ NOTICE/LICENSE của các thư viện được phân phối; các dự án chỉ tham khảo UX/thuật toán không đồng nghĩa nhúng mã nguồn của chúng vào sản phẩm.

## 3. Quy trình và triển khai

- `pages.html`: giao diện tổ chức mới, cột dàn trang kèm xem trước và nút `Áp dụng & kiểm tra` riêng với `Xuất kết quả`.
- `pdf-pages.css`: 3 bố cục **Lưới**, **Dàn trang + xem trước**, **Cột trang bên trái**; có điều chỉnh kích thước hình, responsive, độc lập scroll từng vùng.
- `pdf-pages.mjs`: tải nhiều PDF vào danh sách trang, ảnh thumbnail tải theo vùng cuộn, xem trước khi chọn, Ctrl/Shift chọn nhiều, nhập range `1-5, 8`, nhập số đến trang, kéo thả sắp xếp, xoay trái/phải, xóa, nhân đôi, chèn trang trắng, đảo thứ tự, hoàn tác/làm lại; đặt/xóa mốc tách, xuất phần được chọn riêng, xuất kết quả tổng hợp/ZIP.
- `pdf-pages-core.mjs`: thuật toán pure manifest theo `id/source/index/rotation/kind`; dùng `pdf-lib.copyPages`, không thay raster toàn trang, kiểm số trang và MediaBox; `parsePageRange`, `movePageIds`, `splitAtIndices`, `rotateDegrees`.
- Nhiều tệp: các trang cùng tồn tại trên một grid và có thể di chuyển/trộn. File gốc được giữ trong RAM của tab, không upload lên backend.
- Bảo vệ chữ ký: phát hiện `/Sig`/`ByteRange` trong PDF; PDF đã ký chỉ xem và tải lại nguyên file nếu là một tài liệu đơn lẻ, không rewrite. PDF mã hóa hoặc không đọc an toàn bằng pdf-lib cũng được đánh dấu chỉ xem.
- Trang chủ: **Quản lý trang PDF** mới trong nhóm `Sắp xếp`, các tác vụ liên quan (ghép, tách, xoay, xóa, trích xuất và sắp xếp) mở chung `pages.html`. `studio/organize-pdf.html` và `studio/pdf-multi-tool.html` chuyển về cùng một trình quản lý.

## 4. Tiêu chuẩn và kiểm thử

- Unit: `tests/pdf-pages.test.cjs` xác thực range, xuống/up 90°, lịch sử page manifest, PDF 2 nguồn trộn, clone, blank và copyPages giữ MediaBox; chữ ký chặn xuất.
- Browser: `tests/pdf-pages-browser.cjs` chạy Chromium trên PDF thật, kiểm tải nhiều tệp, thumbnail, 3 bố cục, chọn khoảng, xoay, undo/redo, nhân bản, jump, mốc tách, xuất và tải lại PDF; kiểm PDF ký số mở chỉ xem và tải byte-identical.
- Split ZIP: kiểm tạo 2 PDF thật với số trang tương ứng, không nhầm ZIP với PDF.
- Independent: PyMuPDF kiểm PDF kết quả còn chữ có thể tìm, nét vector, đúng số trang/khổ giấy.
- CI: `.github/workflows/pdf-pages-qa.yml`; đồng thời trang chủ phải đạt workflow `pages-smoke`.

## 5. Giới hạn không được quảng cáo sai

- `pdf-lib.copyPages` không bảo đảm bảo toàn tất cả cấu trúc nâng cao khi tái lắp trang: bookmarks/outline, named destinations, interactive AcroForms/XFA, PDF/UA tags, embedded attachments, linked annotations. **Không sử dụng đầu ra chưa kiểm tra để thay thế hồ sơ đã ký, tài liệu lưu trữ pháp lý hoặc PDF có cấu trúc đặc biệt.**
- Chưa triển khai n-up/multi-page printing, booklet, crop nâng cao, split by bookmark/size, PDF Arranger copy annotation/destination 100%, hoặc PDFsam/PDFBox backend. Đây là các hạng mục tiếp theo, không được đánh dấu đã hoàn thành.
- Với tệp 500–2000 trang, thumbnail lazy giảm tải nhưng RAM trong browser vẫn phụ thuộc số trang, kích thước/tổng PDF; cần benchmark hồ sơ thực tế.
- PDF chữ ký số phải giữ nguyên byte nếu tải lại bản gốc. Thao tác xóa/ghép/xoay làm mất chữ ký; trình quản lý hiện cố ý không cho thực hiện.
