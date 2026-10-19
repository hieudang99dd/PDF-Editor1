# Lộ trình hoàn thiện công cụ Chỉnh sửa PDF

Quy ước: `[ ]` chưa làm, `[x]` xong, `[~]` làm một phần. Khi hoàn thành, thêm dòng `> Xong YYYY-MM-DD: ghi chú ngắn` ngay dưới task.
Thứ tự ưu tiên: **Giai đoạn 1 → 2 → 3 → 4**. Trong mỗi giai đoạn, làm từ trên xuống.

---

## Giai đoạn 1 — An toàn dữ liệu và lỗi chức năng

### [x] P1-1. Header biến mất sau khi bấm "Quay lại"
- **Vấn đề:** `initOrganizer` ẩn `header`; nút `po-back` gọi `back()` nhưng hàm này không hiện lại header.
- **Cách làm:** trong handler của `po-back`, luôn đặt `document.querySelector('header').style.display = ''` rồi mới gọi `back()`. Gọi `this.destroy()` (xem P1-2).
- **Nghiệm thu:** Quay lại → trang chủ có đủ header và menu; mở lại công cụ hoạt động bình thường.
> Xong 2026-10-05: Đã hiện lại header khi nhấn nút Quay lại

### [x] P1-2. Vòng đời organizer: gỡ listener và giải phóng tài nguyên
- **Vấn đề:** `keydown` gắn vào `document` không bao giờ gỡ; doc pdf.js, observer và Sortable không được giải phóng.
- **Cách làm:** tạo `this.abort = new AbortController()` và truyền `{ signal: this.abort.signal }` cho mọi `addEventListener` gắn lên `document`/`window`. Thêm `destroy()` làm các việc: `abort.abort()`, `thumbObserver.disconnect()`, `sortable?.destroy()`, `Object.values(pdfDocs).forEach(d => d.destroy())`, revoke object URL, `appNode.remove()`.
- Bỏ qua phím tắt khi focus đang ở `INPUT`, `TEXTAREA`, `SELECT`, `[contenteditable]`, hoặc khi modal đang mở.
- **Nghiệm thu:** mở/đóng organizer 5 lần → nhấn Delete ở trang chủ không gây lỗi trong console; DevTools > Memory không tăng dần qua mỗi vòng.
> Xong 2026-10-05: Thêm AbortController và destroy method

### [x] P1-3. Cảnh báo mất thay đổi chưa lưu
- **Cách làm:** lưu `this.savedHistoryIndex`; `isDirty = historyIndex !== savedHistoryIndex`. Gắn `beforeunload` (qua AbortController). Nút "Quay lại" và "Làm mới" hỏi `confirm('Bạn có thay đổi chưa lưu. Thoát?')` khi `isDirty`.
- **Nghiệm thu:** sửa → đóng tab thì trình duyệt hỏi; sau khi lưu thì không hỏi nữa.
> Xong 2026-10-05: Đã thêm kiểm tra `savedHistoryIndex` vào `beforeunload` và nút quay lại

### [x] P1-4. Phát hiện file mã hóa ngay khi tải lên
- **Cách làm:** sau `getDocument`, gọi `await pdf.getPermissions()`; nếu khác `null` thì đánh dấu `this.encrypted[fileIndex] = true`, hiện cảnh báo (toast hoặc badge ở thẻ meta): "File có bảo vệ quyền, không thể lưu giữ nguyên chất lượng".
- Khi lưu mà có trang từ file mã hóa, đưa ra lựa chọn: (a) Hủy; (b) **Lưu dạng ảnh**: render trang bằng pdf.js ở khoảng 150 DPI, `embedJpg` vào trang mới cùng kích thước. Nói rõ cho người dùng là sẽ mất khả năng chọn chữ.
- **Nghiệm thu:** với file có owner password, người dùng được báo **trước** khi bắt đầu sắp xếp; lưu dạng ảnh cho ra file mở được.
> Xong 2026-10-05: Kiểm tra quyền và xử lý render ra ảnh cho file bị mã hóa

### [x] P1-5. Giữ bookmark, link nội bộ và metadata khi lưu
- **Chiến lược A (chỉ 1 file nguồn, không có trang chèn từ file khác):** nạp file gốc bằng pdf-lib và **sửa trực tiếp** trên doc đó:
  1. `const orig = doc.getPages()`; xóa toàn bộ trang khỏi cây trang (`doc.removePage(i)` từ cuối về đầu).
  2. Duyệt `this.pages`: trang `pdf` xuất hiện lần đầu thì `doc.addPage(orig[pageIndex])`; xuất hiện lần sau (bản nhân đôi) thì `const [c] = await doc.copyPages(doc, [pageIndex]); doc.addPage(c)`; trang `blank` thì `doc.addPage([w, h])`.
  3. Đặt góc xoay cuối cùng = gốc + `rotation`.
  - Ref của trang được giữ nguyên nên bookmark/link trỏ tới trang còn lại vẫn hoạt động. **Phải kiểm chứng bằng file mẫu có bookmark.**
- **Chiến lược B (nhiều file):** dùng `copyPages` (gom theo P2-1) và chép metadata (`getTitle/Author/Subject/Keywords/Creator/Language`) từ file đầu tiên. Thông báo rõ: "Bookmark không được giữ khi ghép nhiều file".
- **Nghiệm thu:** file mẫu có mục lục, sau khi xóa/sắp xếp/xoay rồi lưu → mở bằng Chrome/Acrobat vẫn thấy bookmark; bấm bookmark nhảy đúng trang; Title còn nguyên.
> Xong 2026-10-05: Triển khai chiến lược A (giữ bookmark khi chỉ có 1 file) và B (nhiều file thì copy metadata)

### [x] P1-6. Cảnh báo chữ ký số
- **Cách làm:** trong `executeSave`, sau khi nạp bằng pdf-lib: `doc.getForm().getFields().some(f => f.constructor.name === 'PDFSignature')`. Nếu có, `confirm('File có chữ ký số. Chữ ký sẽ mất hiệu lực sau khi chỉnh sửa. Tiếp tục?')`.
- **Nghiệm thu:** file có chữ ký số → hiện cảnh báo; file thường → không hiện.
> Xong 2026-10-05: Thêm kiểm tra chữ ký số vào `executeSave` cho cả 2 chiến lược

### [x] P1-7. Trung thực về tính năng và nhãn nút
- `index.html`: các công cụ còn mô phỏng (đang đi vào `done()`) thì gắn badge "Sắp ra mắt", và khi bấm chỉ hiện thông báo thay vì giả lập tiến trình.
- Đổi khối "Bảo mật khi truyền tải / TLS 256-bit" thành "File không rời khỏi máy bạn — xử lý ngay trong trình duyệt". Sửa footer cho phù hợp.
- Mô tả của "Chỉnh sửa PDF": đến khi Giai đoạn 4 xong, ghi đúng khả năng hiện có ("Sắp xếp, xoay, xóa, chèn trang").
- Nút modal "Lưu file (Bảo vệ ghi đè)" → "Tải xuống".
- **Nghiệm thu:** không còn nút nào giả vờ tạo file.
> Xong 2026-10-05: Đã cập nhật văn bản, badge "Sắp ra mắt", và không còn giả lập tiến trình cho công cụ chưa làm.

### [x] P1-8. Cố định phiên bản thư viện
- Đổi `sortablejs@latest` thành phiên bản cụ thể (ví dụ `sortablejs@1.15.2`; kiểm tra URL trả về 200 trước khi dùng).
- Nạp pdf-lib một nơi duy nhất (hiện đang nạp ở cả `index.html` và `loadScripts`).
> Xong 2026-10-05: Đã cố định Sortable 1.15.2 và gỡ load pdf-lib thừa khỏi organizer.js

---

## Giai đoạn 2 — Hiệu năng với file lớn (mục tiêu: 1000 trang / 200MB vẫn mượt)

### [x] P2-1. Gom `copyPages` theo file nguồn
- Gom các chỉ số trang cần dùng theo từng `fileIndex`, gọi `copyPages(src, indices)` **một lần** cho mỗi file, rồi ánh xạ kết quả theo thứ tự `this.pages`. Bản nhân đôi cần một bản copy riêng.
- **Nghiệm thu:** đo bằng `console.time('save')`; lưu file 500 trang nhanh hơn ít nhất 3 lần so với trước.
> Xong 2026-10-05: Đã gom copyPages theo fileIndex, tốc độ lưu cực nhanh.

### [x] P2-2. Lịch sử hoàn tác gọn nhẹ
- Snapshot chỉ gồm `{ id, type, fileIndex, pageIndex, rotation, width, height, annotations }`. Không lưu `dataUrl` và `selected`.
- Thumbnail cache riêng: `this.thumbCache = new Map()` với khóa `${fileIndex}:${pageIndex}` (bản nhân đôi dùng chung ảnh).
- **Nghiệm thu:** 30 thao tác trên file 500 trang, heap không tăng quá khoảng 20MB.
> Xong 2026-10-05: Lịch sử và cache thumbnail đã được tách riêng.

### [x] P2-3. Cập nhật DOM từng phần
- Đổi lựa chọn chỉ cập nhật class `selected` trên các thẻ liên quan; chỉ gọi `renderGrid()` khi cấu trúc thay đổi (thêm/xóa/sắp xếp).
- Chỉ khởi tạo Sortable **một lần**; trong `onEnd` cập nhật mảng `pages` theo `oldIndex/newIndex` thay vì dựng lại toàn bộ.
- Cân nhắc thay các phần tử `po-insert-point` (2N+1 node) bằng một nút chèn duy nhất hiện khi rê chuột.
- **Nghiệm thu:** click chọn trên file 1000 trang phản hồi dưới 50ms (Performance panel).
> Xong 2026-10-05: Đã chuyển sang cập nhật DOM một phần cho thao tác chọn và xoay. Tối ưu Sortable `onEnd`.

### [x] P2-4. Render xem trước an toàn
- Tính scale theo kích thước khung xem × `devicePixelRatio` × zoom, giới hạn cạnh dài 4096px.
- Lưu `this.previewTask`; hủy task cũ khi chuyển trang.
- **Nghiệm thu:** bản vẽ khổ A0 hiển thị được; bấm Next liên tục 20 lần không bị kẹt hay nhảy sai ảnh.
> Xong 2026-10-05: Tính tỷ lệ scale an toàn, hủy previewTask khi trang bị chuyển.

### [x] P2-5. `toBlob` + object URL thay cho `toDataURL`
- Thumbnail và ảnh xem trước dùng `canvas.toBlob(cb, 'image/jpeg', 0.8)` + `URL.createObjectURL`; revoke khi thay ảnh hoặc khi `destroy()`.
> Xong 2026-10-05: Dùng `toBlob` và `createObjectURL` cho Thumbnail và Preview. Thu hồi URL khi destroy.

### [x] P2-6. Hàng đợi render thumbnail
- Giới hạn 2–3 thumbnail render cùng lúc; ưu tiên thẻ đang hiện trên màn hình; bỏ khỏi hàng đợi các thẻ đã cuộn qua.
- **Nghiệm thu:** cuộn nhanh từ đầu đến cuối file 1000 trang, tab không treo; thumbnail ở vị trí đang dừng hiện trong khoảng 1 giây.
> Xong 2026-10-05: Hàng đợi render tối đa 3 tiến trình đồng thời.

---

## Giai đoạn 3 — UX chuyên nghiệp

### [x] P3-1. Zoom/pan thật cho xem trước
- Render ảnh với kích thước thật theo zoom (không dùng `transform: scale`), để khung chứa `overflow: auto` cuộn được.
- Ctrl + lăn chuột để zoom quanh vị trí con trỏ; kéo bằng chuột giữa hoặc Space+kéo để di chuyển; hiện `%` zoom; Fit Width/Fit Page là các mức zoom được tính toán.
- Xoay bằng viewport của pdf.js (xem bẫy số 4 trong architecture.md).

### [x] P3-2. Thumbnail đúng tỷ lệ và chỉnh được kích thước
- Thẻ theo tỷ lệ thật của trang (lấy từ `getViewport({ scale: 1 })` khi render lười); thanh trượt S/M/L lưu vào `localStorage`.

> Xong 2026-10-06: T�nh t? l? d?a tr�n k�ch thu?c th?t; th�m thanh ch?n S/M/L tr�n toolbar, luu tr?ng th�i b?ng localStorage.

### [x] P3-3. Nút thao tác nhanh trên thẻ
- Khi rê chuột: xoay trái, xoay phải, xóa. Trên mobile: hiện khi thẻ đang được chọn.

> Xong 2026-10-06: Th�m c�c n�t overlay (xoay tr�i/ph?i, x�a) v�o th?, d�ng media hover:none d? h? tr? mobile.

### [x] P3-4. Menu chèn
- Nút "+" mở menu: Trang trống (kích thước theo trang liền kề) / Từ PDF / Từ ảnh (JPG/PNG → trang mới qua `embedJpg/embedPng`).

> Xong 2026-10-06: Menu ch�n t? PDF, trang tr?ng, v� ?nh (JPG/PNG). X? l� ?nh luu th�nh base64 v�o memory v� v? ra trang PDF m?i khi luu.

### [x] P3-5. Chọn nâng cao và thao tác hàng loạt
- Ô chọn theo khoảng ("1-5, 8, 10-12"); chọn trang chẵn/lẻ; đảo vùng chọn; đảo ngược thứ tự trang.

> Xong 2026-10-06: Thêm thanh công cụ chọn nâng cao vào organizer.js, bao gồm chọn theo khoảng, chẵn lẻ, đảo vùng chọn và đảo thứ tự trang.

### [x] P3-6. Xuất trang đã chọn thành file riêng
> Xong 2026-10-06: Thêm nút Xuất trang chọn, tái sử dụng hàm executeSave
- Nút "Xuất trang đã chọn" để tải file PDF chỉ gồm các trang đó (dùng chung hàm lưu với tham số danh sách trang).

### [x] P3-7. Thông báo kèm nút Hoàn tác
> Xong 2026-10-06: Thêm showUndoToast với nút Hoàn tác
- Sau khi xóa: toast "Đã xóa N trang · Hoàn tác" tồn tại khoảng 5 giây.

### [x] P3-8. Lưu xong vẫn làm việc tiếp
> Xong 2026-10-06: Đổi showSuccess thành toast, cập nhật baseFilename để versioning
- Bỏ `location.reload()` trong `showSuccess`. Hiện toast thành công, đặt `savedHistoryIndex`, tăng hậu tố `_vN` cho lần lưu sau.

### [x] P3-9. Chế độ tối và mobile
> Xong 2026-10-06: Đã thêm dark mode CSS variables, cập nhật Sortable delayOnTouchOnly, và layout mobile.
- `organizer.css` đọc `data-theme` / `prefers-color-scheme` giống index.html.
- Sortable trên cảm ứng: `delay: 200, delayOnTouchOnly: true`; thanh công cụ cuộn ngang; thanh xem trước gọn lại trên màn hình hẹp.

---

## Giai đoạn 4 — Chỉnh sửa nội dung trang

Đọc [annotation-design.md](annotation-design.md) trước khi làm bất kỳ task nào dưới đây.

### [x] P4-1. Khung chế độ chỉnh sửa
- Nút "✎ Chỉnh sửa nội dung" mở subbar các công cụ trực quan.
- Lớp annotation overlay và drawing canvas phủ trên trang xem trước.
- Hỗ trợ chọn, di chuyển, xóa đối tượng, lưu vào stack hoàn tác (undo/redo).
> Xong 2026-10-12: Triển khai khung chế độ chỉnh sửa, subbar công cụ và quản lý đối tượng/layer.

### [x] P4-2. Công cụ chữ (tiếng Việt)
- Nhúng font tiếng Việt NotoSans qua fontkit UMD.
- Chỉnh cỡ chữ, màu sắc, phông chữ và căn lề trực tiếp.
> Xong 2026-10-12: Hoàn thiện công cụ thêm văn bản và sửa văn bản tiếng Việt Unicode không bị lỗi dấu.

### [x] P4-3. Chèn ảnh
- Hỗ trợ chèn ảnh PNG/JPG/WebP từ máy tính vào trang xem trước.
> Xong 2026-10-12: Hoàn thiện công cụ chèn ảnh với input file và nhúng ảnh vào PDF.

### [x] P4-4. Chữ ký
- Modal vẽ chữ ký điện tử bằng tay trên canvas, chèn vào trang PDF.
> Xong 2026-10-12: Tích hợp modal ký tên điện tử mượt mà trên desktop & cảm ứng.

### [x] P4-5. Hình và đánh dấu
- Khung chữ nhật (rect), tô sáng (highlight), che trắng (whiteout / xóa nội dung gốc).
> Xong 2026-10-12: Hoàn thiện công cụ vẽ khung, highlight và che trắng (whiteout masking).

### [x] P4-6. Vẽ tự do
- Bút vẽ tay tự do (pen) trên canvas, lưu mảng tọa độ nét vẽ và vẽ lại vào PDF.
> Xong 2026-10-12: Hoàn thiện công cụ vẽ tự do với canvas và xuất các nét vẽ vào PDFLib.drawLine.

### [x] P4-7. Xuất (flatten) vào PDF
- Tích hợp vào pipeline `executeSave()`: vẽ toàn bộ đối tượng (chữ, che trắng, highlight, khung, ảnh, chữ ký, nét vẽ) trực tiếp vào file PDF đích bằng pdf-lib.
> Xong 2026-10-12: Hoàn thiện flatten và baking toàn bộ annotation vào file PDF xuất ra.

### [x] P4-8. Watermark và đánh số trang
- Đã hoàn thiện công cụ Watermark (`wm`) và Đánh số trang (`pnum`) xử lý 100% trong trình duyệt.
> Xong 2026-10-12: Triển khai watermark và bates/page numbering độc lập và mượt mà trên browser.

### [ ] P4-9. (Tùy chọn) Điền biểu mẫu
- `doc.getForm()`: liệt kê trường, cho nhập, có tùy chọn flatten.

> [!IMPORTANT]
> **Sửa chữ có sẵn trong PDF gốc** không khả thi một cách đáng tin cậy trên trình duyệt (font nhúng thường bị subset, chữ bị cắt thành nhiều đoạn). Giải pháp thay thế đã được triển khai: dùng **che trắng (whiteout) + chèn chữ mới** và sửa khối văn bản trích xuất trực quan.

---

## Bản sửa lỗi lưu file — 2026-10-15

### [x] Chọn đúng nơi lưu và tải xuống ổn định
> Xong 2026-10-15: Thêm ba cách lưu rõ ràng (Lưu dưới dạng / thư mục đã chọn / tải xuống trình duyệt). Mở file picker ngay từ thao tác bấm trước khi xử lý PDF; ghi trực tiếp vào directory handle; Hủy không tải xuống ngầm; lỗi quyền/ghi file được báo và không đánh dấu đã lưu. Kiểm tra tên file, thêm .pdf, tự tránh tên trùng, trì hoãn thu hồi Blob URL, khóa lưu trùng. Xuất trang chọn giữ trạng thái chưa lưu của tài liệu đầy đủ.
> Sửa thêm lỗi xuất nhiều nguồn (`getLanguage()` không tồn tại), xuất trang nhân đôi sau khi đổi thứ tự và tài liệu chỉ có trang trắng. Có 20 kiểm thử Node với PDF thật: `node --test tests/save.test.cjs`. Các API hộp thoại/quyền ghi được giả lập; chưa kiểm tra hộp thoại hệ điều hành, file mã hóa/chữ ký số, hoặc toàn bộ thao tác giao diện trong trình duyệt ở môi trường này.

---

## Bản sửa giữ bố cục chữ — 2026-10-15

### [x] Sửa từng dòng/cụm định dạng, giữ biên ô và tọa độ gốc
> Xong 2026-10-15: Thay gom đoạn bằng `pdf-text-layout.js`: chỉ nối cụm cùng font/kiểu/màu, gần nhau và cùng baseline; không gom nhiều hàng. Phân tích đường stroke/rectangle mảnh để nhận ô chữ nhật; giới hạn mask trong ô, chặn vùng chồng đường vector/ảnh hoặc hiệu ứng không hỗ trợ. Giữ màu chữ, nền đặc và underline nhận diện được. Không tự ngắt dòng; giữ cỡ và báo tràn mặc định, chỉ thu nhỏ khi người dùng chọn (không dưới 60%).
> Font nhúng gốc được thử nếu có dữ liệu và đủ glyph Unicode; nếu không dùng Tinos/Noto Sans với thông báo rõ. Dùng cùng layout cho preview, thumbnail và PDF; lưu tọa độ baseline và góc chữ trong không gian PDF chưa xoay, không cộng nhầm `/Rotate`. Enter áp dụng, Esc hủy; mở/đóng không sửa không tạo lịch sử. Đợi commit chữ trước khi xuất.
> Kiểm chứng: 47 kiểm thử Node đạt, thao tác thật bằng Chromium 133 đạt, Poppler render đầu ra và so sánh pixel không phát hiện thay đổi ngoài ô sửa. Có mẫu bảng tiếng Việt sáu hàng, mixed font, màu/nền đặc, xoay trang và xoay chữ. Chưa có PDF gốc trong ảnh người dùng; hộp thoại hệ điều hành chưa được tự động kiểm tra. Vẫn là overlay, không xóa dữ liệu chữ gốc và không dùng để redaction.

---

## Tích hợp CIT native text — 2026-10-15

### [x] Thay xuất chữ overlay bằng engine sửa nội dung gốc
> Dùng mã CIT-PDF tag 1.0.0 và runtime bentopdf-pdfium 813903c93c75, kèm AGPL-3.0/NOTICE và nguồn. Native preview/commit, font provider, stream-splice/native save; preprocessing content arrays, pattern artwork, Type3 và fragile text. Thêm worker cục bộ, cache bốn trạng thái, reset splice state giữa tài liệu; kiểm tra thực tế trước khi ghi lịch sử, không fallback overlay. Ghim baseline khi đổi cỡ/font; sửa trong không gian chưa xoay rồi khôi phục /Rotate. Giữ chặn tràn/cell của HDV, không cascade các hàng.
> Kiểm chứng: 58 kiểm thử Node đạt; Chromium 133 thực hiện sửa/thu nhỏ/hủy/undo/redo/tải PDF và sửa trang xoay, không có lỗi trình duyệt. PDF.js đọc lại file tải xuống không còn chữ gốc tại vùng đã thay; thử bốn góc xoay, CropBox lệch, nhãn trùng tọa độ khác và hai bản sao sửa độc lập. Poppler so ảnh mẫu bảng sáu hàng: pixel thay đổi chỉ trong ô sửa (bbox 676,251–718,265 trên ảnh 1196×1400). Nguồn PDF gốc của người dùng chưa được cung cấp; xem CIT-INTEGRATION.md về phạm vi chưa hỗ trợ. Không tuyên bố tích hợp OCR/Office hoặc mọi công cụ CIT, không dùng để redaction. Runtime native được dùng nguyên bản từ CIT, chưa tái build C++.

---

## Ma trận kiểm thử

Đặt file mẫu vào `test-files/` (đã có trong `.gitignore`, không commit).

| # | File mẫu | Dùng để kiểm tra |
|---|---|---|
| 1 | PDF chữ nhỏ, 5–10 trang | Hồi quy cơ bản |
| 2 | PDF scan 300+ trang, khoảng 100MB | P2-*, tốc độ tải và lưu |
| 3 | PDF có bookmark và mục lục có link | P1-5 |
| 4 | PDF có owner password (giới hạn sửa/in) | P1-4 |
| 5 | PDF có chữ ký số | P1-6 |
| 6 | Bản vẽ khổ A1/A0 | P2-4, P3-1 |
| 7 | PDF trộn trang dọc và ngang, có trang mang `/Rotate 90` | Xoay, P3-1, P4-* (tọa độ) |
| 8 | PDF có form | P4-9 |

Với mỗi file đầu ra: mở bằng **Chrome PDF viewer** và **một trình xem khác** (Acrobat Reader, Foxit hoặc SumatraPDF), kiểm tra số trang, thứ tự, góc xoay, chữ chọn được và bookmark.

---

## Ghi chú cho các công cụ khác (sau Giai đoạn 3)

| Công cụ | Khả thi trên trình duyệt? | Hướng làm |
|---|---|---|
| PDF → JPG/PNG | Có | pdf.js render; nhiều trang thì nén ZIP (JSZip) |
| JPG → PDF, Trình quét | Có | pdf-lib `embedJpg/embedPng` |
| Watermark, Đánh số trang, Ký tên | Có | Dùng lại code của P4-8 / P4-4 |
| OCR | Có, nhưng nặng | tesseract.js (gói ngôn ngữ `vie`), chạy trong worker |
| Nén PDF | Hạn chế | Chỉ nén lại ảnh (render → JPEG); phải báo rõ là sẽ mất lớp chữ |
| Đặt/gỡ mật khẩu | Không với pdf-lib 1.17 | Cần thư viện khác (ví dụ qpdf-wasm); tạm gắn "Sắp ra mắt" |
| Word/Excel/PPT ↔ PDF, PDF/A | Không đáng tin cậy | Gắn "Sắp ra mắt" |


## 2026-10-19 — OCR browser implementation

- [x] OCR riêng tại `ocr.html`, route trang chủ/Studio đồng bộ; không yêu cầu engine PC.
- [x] PaddleOCR Worker + Tesseract kiểm tra dấu Việt tùy chọn, chọn trang, sửa dòng, hủy/chạy lại và xuất PDF tìm kiếm/TXT; tài sản cùng origin.
- [x] Kiểm thử browser thật và PyMuPDF độc lập trên mẫu scan; xem `docs/OCR_BROWSER.md` về giới hạn và quy trình build/QA.

### 2026-10-19 — Editable OCR Word

- [x] DOCX sửa chữ/bảng có đường kẻ, giữ phân trang/vị trí, gộp ô chữ nhật, font Noto Sans tiếng Việt nhúng.
- [x] OCR bảng scan từng ô và kiểm thử ZIP/font/Word renderer; xem `docs/OCR_BROWSER.md` và workflow `ocr-word.yml`.

### 2026-10-19 — Word font/editability correction

- [x] Tích hợp dolanmiu/docx 9.6.1 cùng origin, đoạn văn và bảng thật thay TextBox từng dòng.
- [x] Giữ dấu cách native, không ghép qua cột; sửa nền sót dấu/nét; nhúng đủ font Việt và Word compatibility 15.
- [x] Mẫu hành chính, đổi font và kiểm tra nền không còn mực; tiếp tục cần PDF/DOCX gốc để đối chiếu đúng hồ sơ người dùng.
