// Optional PP-StructureV3 path. Basic browser OCR remains fully offline.
const select = document.getElementById('file');
const button = document.getElementById('structure-run');
const info = document.getElementById('structure-status');
const controller = { current: null };
button?.addEventListener('click', async () => {
  const pdf = select?.files?.[0];
  if (!pdf) { info.textContent = 'Hãy chọn một PDF trước.'; return; }
  if (pdf.size > 50 * 1024 * 1024) { info.textContent = 'OCR nâng cao giới hạn tệp 50 MB.'; return; }
  if (controller.current) {
    controller.current.abort(); return;
  }
  const abort = new AbortController();
  controller.current = abort;
  button.textContent = 'Hủy OCR nâng cao';
  info.textContent = 'Đang kết nối engine PP-StructureV3 trên máy xử lý…';
  try {
    const form = new FormData();
    form.append('file', pdf, pdf.name);
    form.append('dpi', document.getElementById('dpi')?.value || '200');
    const response = await fetch('http://127.0.0.1:8000/api/ocr-structure', {
      method: 'POST', body: form, signal: abort.signal
    });
    if (!response.ok) {
      let message = 'Máy xử lý trả lỗi ' + response.status;
      try { const data = await response.json(); message = data.detail || message; } catch { /* fallback */ }
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = (pdf.name.replace(/\.[^.]+$/, '') || 'document') + '_structure.zip';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    info.textContent = 'Đã nhận gói Word + cấu trúc JSON theo từng trang. Kiểm tra trước khi sử dụng.';
  } catch (error) {
    info.textContent = error.name === 'AbortError'
      ? 'Đã hủy tải kết quả (máy xử lý có thể vẫn đang nhận dạng).'
      : 'Không sử dụng được OCR nâng cao: ' + error.message +
        '. Cần chạy backend local; nếu trình duyệt chặn kết nối localhost, hãy mở web ở địa chỉ HTTP local.';
  } finally {
    controller.current = null;
    button.textContent = 'OCR nâng cao · Bảng & bố cục';
  }
});
