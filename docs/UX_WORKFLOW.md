# PDF HVD — Đặc tả kỹ thuật cải tổ trải nghiệm người dùng (UX Workflow v1)

**Ngày:** 2026-10-16  
**Phạm vi thực thi v1:** danh mục và công cụ browser trong `index.html`; PDFium Preflight; quản lý kết quả từ browser/local engine/CIT advanced. Các hành vi native Studio và organizer phải giữ API gốc và có kế hoạch E2E trước khi can thiệp sâu.

## 1. Nguyên tắc trải nghiệm bắt buộc

1. **Sau khi tải xuống hoặc lưu:** không tự chuyển về trang chủ, không xóa tài liệu và không reset tùy chọn. Ở nguyên công cụ; có thể tải lại hoặc thay tham số rồi chạy lại.
2. **Làm mới tác vụ:** giữ tệp đã chọn, xóa kết quả đang hiển thị, khôi phục form về mặc định; phải xác nhận nếu có dữ liệu/tùy chọn đang nhập. Không gọi `location.reload()`.
3. **Tệp khác:** xóa danh sách tệp và kết quả, nhưng không thay đổi công cụ, route hoặc danh mục. Có xác nhận nếu đã nạp dữ liệu.
4. **Danh mục công cụ:** chủ động quay về trang chủ. Nếu đã tạo kết quả mà chưa bấm tải thì cảnh báo trước khi rời.
5. **Back/Forward trình duyệt:** công cụ browser dùng `history.pushState` + `#hvd-tool=N`, khi Back về danh mục, Forward mở lại cùng công cụ. Trong cùng phiên và với cùng công cụ, file `File` đang ở RAM có thể được giữ khi Forward. Sau F5 / đóng tab **không giữ file gốc** và cần người dùng chọn lại; tuyệt đối không ghi PDF vào `localStorage`, `sessionStorage`.
6. **Lỗi xử lý:** thông báo ngay trong công cụ; nút thực hiện được mở lại để thử lại. Lỗi không tự quay về danh mục.
7. **Tiến trình và trạng thái:** một tác vụ cần có trạng thái rõ ràng: chưa có file, đã chọn file, đang xử lý, đã có kết quả, lỗi. Khi đang xử lý, nút làm mới/thoát thủ công phải ngăn thao tác để tránh hủy DOM trước khi kết quả trả về.
8. **Tệp đầu ra:** có tên thực, thuộc tính `download` và Object URL; không tạo thông báo đã lưu thành công nếu mới chỉ gửi yêu cầu tải cho trình duyệt.
9. **Điều hướng và tiếp cận:** các nút là `button type=button` có nhãn tiếng Việt; các trạng thái sử dụng `role=status`/`aria-live=polite`, responsive đến 320px, keyboard Tab/Enter.
10. **Nhận diện HDV:** thống nhất trên công cụ chính, Studio, Preflight; không can thiệp giấy phép và attribution.

## 2. Ma trận hành vi chuẩn

| Màn hình / trạng thái | Làm mới | Tệp khác | Tải / Lưu | Quay lại |
| --- | --- | --- | --- | --- |
| Trang chủ | Xóa bộ lọc và từ khóa, không reload | Không áp dụng | Không áp dụng | Back native của browser |
| Công cụ browser – chưa có file | Làm mới form | Ở cùng tool | Chưa khả dụng | Danh mục |
| Công cụ browser – đã chọn file | Giữ file, đặt lại form sau xác nhận | Xóa file sau xác nhận | Chạy thực tế mới có download | Danh mục |
| Công cụ browser – đang chạy | Chặn, thông báo chờ | Chặn, thông báo chờ | Không bấm nhiều lần | Chặn thao tác Back thủ công |
| Công cụ browser – kết quả sẵn | Xóa kết quả nhưng giữ file | Xóa file và kết quả | Link tải ngay, vẫn ở tool | Cảnh báo nếu chưa yêu cầu tải |
| Preflight – có PDF | Xóa báo cáo, giữ PDF | Xóa báo cáo và đổi tệp | Xuất JSON, không thoát | Link danh mục |
| Organizer HVD | **`#po-new-document` đóng PDF và mở lại uploader** (xác nhận nếu có tệp); `#po-tb-reset` chỉ hoàn nguyên cấu trúc trang | Dùng uploader ngay trong cùng công cụ | `executeSave` không tự về trang chủ; có thể lưu tiếp | Nút `#po-back` lớn ở header, xác nhận thay đổi chưa lưu |
| Studio CIT | **Giữ cơ chế native gốc** | Dùng trình nhập PDF native | `#save` không bị adapter HVD thay thế | `#exitEditor` native; `#back-to-tools` tại uploader về danh mục |

**Phân biệt quan trọng:** Dữ liệu file được ghi/tải và trạng thái chỉnh sửa là hai việc khác nhau. Trình duyệt có thể chặn tải xuống hoặc đổi nơi lưu; thông báo UI chỉ xác nhận *đã yêu cầu tải*.

## 3. State machine (browser tool)

```text
CATALOG
  └── OpenTool(index) ──> EMPTY
                          │ add(File)
                          ▼
                       READY ── Run ──> PROCESSING ──> RESULT
                          ▲                 │           │
                          │                 └── error ──> ERROR
                          ├──────── Refresh (keep file) ◄─┘
                          └──────── Retry / Add another
RESULT -- Download --> RESULT   [không navigate; link có thể bấm lại]
RESULT -- New file --> EMPTY    [cùng workspace]
RESULT -- Back --> CATALOG     [confirm khi chưa request tải]
```

- `T[i]` vẫn là registry chính; không nhân bản thuật toán trong UI.
- `openTool(i, restore)`: điều hướng ngoại vi (Studio/Preflight) bằng route đang có; công cụ trang chủ push history entry nếu là người dùng mở.
- `back()/showCatalog()`: tách việc đổi màn hình với lịch sử browser để không vòng lặp.
- `resetWorkspace(clearFiles)`: chung cho nút `#ws-refresh`, `#ws-new` và refresh header.
- `render()`: dựng lại form; không tự đổi tool hoặc làm mất URL.
- `hvdTrackDownloadUrl` + `hvdReleaseWorkspaceDownloads`: tập URL kết quả được thu hồi trì hoãn 120 giây để tránh hỏng download PDF lớn khi DOM bị thay đổi. URL từ `img`/thumbnail không được thu hồi sớm trước khi render xong.
- Không dùng `window.location.replace` trong luồng tải kết quả.

## 4. Phân lớp kỹ thuật và vùng tác động

| Vùng | Tệp | Hành động |
| --- | --- | --- |
| Main shell | `index.html`, `hvd-ui-v2.css` | Thêm thanh điều hướng tác vụ, state/history, refresh, theme và nhãn trạng thái |
| Browser/local output | `pdf-local-tools.js`, `cit-advanced-ui.js` | Trả URL tải về tại chỗ, thu hồi URL cũ theo vòng đời |
| Chẩn đoán PDFium | `pdfium-preflight.html` | Reset báo cáo giữ file, thay file cùng trang |
| Native editor | `organizer.js`, `text-editor-shell.js`, `studio/assets/` | Không can thiệp trong v1: đã có xử lý riêng với Unsaved/Undo/Redo |
| Kiểm thử | `tests/ux-session.test.cjs`, `tests/home-layout.test.cjs`, `.github/workflows/pages-smoke.yml` | Cập nhật hồi quy cho các trạng thái; cần Chrome E2E cho bản phát hành |

## 5. QA bắt buộc trước nghiệm thu thực địa

- Desktop 1366×768, 1920×1080; mobile 320/375/768; light/dark.
- File PDF 1 trang, 50 trang, CAD khổ A1/A0, font subset/Type3, bản scan PDF, tên có dấu tiếng Việt.
- Chọn file → xử lý → tải → bấm tải lại → đổi tham số → chạy lại; **không điều hướng ra ngoài**.
- Làm mới sau khi tải giữ file; tệp khác mở vùng chọn file; Back/Forward giữ đúng tool; F5 không lưu file PDF vào storage.
- PDF bị lỗi, engine localhost ngừng chạy, thiếu OCR/LibreOffice: có thông báo trong tool, có thể thử lại.
- Ký/sửa text có thay đổi chưa lưu: giữ nguyên xác nhận bảo vệ editor hiện tại.
- Chrome, Edge và Firefox: kiểm tra hệ thống có gửi tệp download hay không, **không mặc nhiên tuyên bố đã lưu thành công**.
- Kiểm tra `performance.memory`/Object URL khi xử lý hàng chục PDF và sửa liên tục.
- Không có HTTP upload ra ngoài khi thao tác browser.
- CI `pages-smoke.yml` PASS; xác nhận riêng trạng thái GitHub Pages và chạy browser smoke trên bản deploy.

## 6. Giai đoạn tiếp theo chưa tự nhận đã hoàn tất

- **Studio native toàn bộ màn hình:** đánh giá thực tế sự kiện `#save`, `#exitEditor` và lifecycle; chỉ thêm nút New/Refresh nếu có API native an toàn và kiểm chứng mất dữ liệu. Không gắn nút Reset vào một lần `window.location.reload` vì sẽ xóa dữ liệu.
- **Hủy tiến trình/Abort:** cần bổ sung cancellation token và quản lý worker/fetch cho từng engine; không hiển thị nút Hủy giả.
- **Undo/Redo xuyên tác vụ và phiên:** không lưu bản PDF thô vào localStorage; cần mô hình dự án riêng và lưu file có chủ đích trước khi hỗ trợ khôi phục.
- **Tối ưu các URL nguồn và tải nhiều tệp lớn:** tách render image URL khỏi result URL, tài nguyên có thời hạn và kiểm thử browser thực.
- **Đồng bộ mobile toolbar** ở Studio: cần test Chromium để không phá view native.

Từng vòng phải cập nhật `IMPLEMENTATION_PROGRESS.md`. Nếu chưa có E2E thực tế, chỉ công bố phạm vi đã qua unit/CI, không dùng từ "triệt để" hoặc "mọi màn hình".


## 7. Chỉnh sửa PDF — làm mới tài liệu đúng nghĩa (2026-10-16)

**Đường dẫn:** Trang chủ → Biên tập → Chỉnh sửa & chú thích → Chỉnh sửa PDF.

- Từ trạng thái có tài liệu, nút **↻ Làm mới** trên thanh đầu đóng phiên xử lý và đưa về màn hình **Mở tài liệu PDF** ngay trong cùng chức năng. Việc đóng tài liệu không phụ thuộc việc đã tải file kết quả; không điều hướng lên danh mục. File PDF gốc trên máy tính không bị xóa.
- Có tệp đang nạp: hộp thoại xác nhận rõ rằng những thay đổi chưa lưu sẽ bị bỏ. Chọn Hủy → giữ nguyên PDF và lịch sử. Khi đọc hoặc xuất PDF đang diễn ra, nút reset không xóa DOM/worker, thay bằng thông báo chờ hoàn tất.
- Sau xác nhận: gọi `PDFOrganizer.destroy()` để dừng listener qua AbortController, giải phóng PDF.js, worker native, ảnh xem trước, Object URL, thumbnail; sau đó `window.initOrganizer([])` dựng phiên rỗng. **Không reload cả website** và không mất chức năng đang mở.
- Nút mũi tên quay lại 32×32 px được thay bằng nút chữ **← Danh mục công cụ** lớn, vùng bấm tối thiểu 39px và nằm cạnh nhóm quản lý phiên tài liệu.
- Nút `#po-tb-reset` được đổi nhãn **↶ Hoàn nguyên trang**. Nó phục hồi sơ đồ/trạng thái trang từ history gốc, không tương đương “Làm mới” và không có quyền tuyên bố hoàn nguyên mọi nội dung text đã sửa.
- Thanh đầu: trái là tên tính năng; phải có “Làm mới”, “Danh mục công cụ”, Undo, Redo, Xuất trang chọn, Lưu tài liệu. Thanh thứ hai chỉ dành cho thao tác chọn/sắp xếp/biên tập trang.
- Phần header thương hiệu tối dư thừa `#hvd-brandbar` trên màn hình Studio được ẩn; không xóa `NOTICE.md` hay các quyền tác giả trong nguồn. Studio vẫn giữ lệnh `#exitEditor` gốc trong thanh công cụ.
- Kiểm thử: `tests/organizer-reset.test.cjs` (hủy/cho phép khi đang lưu), `tests/ux-browser.cjs` (PDF thật → thoát file → uploader → chọn PDF khác) và kiểm thử hồi quy các PDF bằng Node.


### 7.1. Kiểm soát tác động của build Studio

- `.github/workflows/cit-original-build.yml` chỉ tự kích hoạt khi tệp đầu vào chuyên biệt của Studio thay đổi (`scripts/cit-original/**`, kiểm thử CIT browser hoặc file lock upstream). Chỉnh sửa Organizer, trang chủ và engine browser **không** được tự biên dịch lại toàn bộ Studio và ghi đè thư mục `studio/` đang hoạt động.
- Build Studio thủ công vẫn được hỗ trợ qua `workflow_dispatch`. Khi cần rebuild upstream, kiểm tra thay đổi giao diện đã cá nhân hóa và giấy phép trước khi ghi đè artifact.


## 8. Xuất PDF không phụ thuộc quyền thư mục của Chrome (2026-11-06)

- Đối với **Chỉnh sửa PDF** (Organizer, route #hvd-tool=22), luồng xuất chính không gọi File System Access API: showSaveFilePicker, showDirectoryPicker, createWritable. Chrome không cho phép website ghi vào một số thư mục hệ thống.
- Luồng chỉ yêu cầu **tên PDF** → xây dựng PDF trong trình duyệt → tạo Blob URL kèm liên kết tải xuống. Sau khi thử tự tải, giữ nút **↓ Tải PDF** để có thể bấm lại cho đến khi đổi kết quả hoặc đóng phiên.
- Không khẳng định đã ghi file thành công xuống máy chỉ vì trình duyệt nhận yêu cầu tải; không đánh dấu lịch sử chỉnh sửa là đã lưu dựa trên yêu cầu tải.
- Muốn chọn vị trí lưu mỗi lần, tự bật Chrome > Cài đặt > Tệp tải xuống > Hỏi nơi lưu từng tệp trước khi tải xuống; không tắt bảo vệ trình duyệt.
- Nếu đang có phiên cũ với chỉnh sửa chưa lưu, chọn Hủy trong hộp thoại lỗi rồi đổi Cách lưu thành Tải xuống theo cài đặt trình duyệt trước khi tải lại trang.
- Hồi quy tự động: tests/pdf-save-no-picker.test.cjs kiểm tra chế độ không dùng picker, tên Unicode, liên kết tải lại, và xuất PDF có chú thích chữ.
