# PP-StructureV3 — tùy chọn OCR tài liệu phức tạp

## Trạng thái

Đã thêm API backend tùy chọn, **đã nối nút OCR nâng cao trong `ocr.html` với backend localhost tùy chọn**. Chưa kiểm thử nhận dạng thực tế hoặc triển khai máy chủ. Không được ghi 'đã tích hợp hoàn chỉnh' khi chưa hoàn tất frontend, test và deployment.

## Cài đặt local

```sh
cd backend
pip install -r requirements-structure.txt
# Cài thêm paddlepaddle tương thích Windows/Linux và CPU/GPU theo tài liệu chính thức.
uvicorn main:app --host 127.0.0.1 --port 8000
```

Kiểm tra: `GET http://127.0.0.1:8000/api/ocr-structure/capabilities`.

Gửi PDF/ảnh bằng `POST /api/ocr-structure` multipart `file`, `dpi=200`. Kết quả hiện tại là ZIP gồm DOCX và JSON trên từng trang. Chưa ghép nhiều trang thành một file DOCX, chưa có xuất XLSX bảng riêng.

## Kiến trúc

- OCR nhanh: giữ PaddleOCR.js/Tesseract chạy trong browser, không tải hồ sơ ra ngoài.
- OCR cấu trúc: PP-StructureV3 xử lý ở máy chạy FastAPI, theo trang, phát hiện layout và bảng, xuất DOCX trực tiếp.
- Chỉ hỗ trợ PDF và ảnh phổ biến, tối đa 50MB, 20 trang và 20MP/trang. Tệp chỉ giữ trong thư mục tạm; module trả kết quả dạng ZIP trong bộ nhớ.
- Backend mặc định localhost; tuyệt đối không public cổng không có xác thực. Trình duyệt HTTPS có thể chặn truy cập localhost.
- Việc upload PDF ký số để *đọc OCR* không tương đương sửa PDF ký số. Xuất file mới không duy trì hiệu lực chữ ký cũ.
- PDF scan phức tạp, chữ Việt, dấu, ô gộp, bảng không viền, đa cột phải có golden samples và kiểm tra bằng Word desktop.

## Còn phải làm

1. Cài môi trường Paddle thực tế, chạy test smoke với PDF scan Việt có bảng.
2. Hoàn thiện frontend: hiện có nút khởi chạy và hủy yêu cầu HTTP, nhưng chưa có xem trước kết quả và hủy inference phía server.
3. Hợp nhất DOCX đa trang, bảo toàn cấu trúc hình ảnh/ô gộp, thêm xuất XLSX.
4. Đo CER/WER và độ chính xác ô/bảng trên bộ dữ liệu thực tế.
5. Chỉ phát hành tính năng khi có kết quả acceptance tests và xác minh an toàn.
