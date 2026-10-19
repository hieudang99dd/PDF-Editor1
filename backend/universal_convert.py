"""Unified conversion router, using existing PyMuPDF, Pillow, LibreOffice and Word engines."""
from __future__ import annotations
import io
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
import fitz
from PIL import Image, ImageOps
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

router = APIRouter()
MAX_BYTES = 50 * 1024 * 1024
IMG = {"png", "jpg", "jpeg", "tif", "tiff", "webp", "bmp"}
OFFICE = {"doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf"}
SUPPORTED = {"pdf", "txt", *IMG, *OFFICE}
OUTPUTS = {"pdf", "docx", "txt", "png", "jpg", "tiff", "zip"}


def _response(data, suffix, stem):
    types = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "txt": "text/plain; charset=utf-8", "png": "image/png", "jpg": "image/jpeg", "tiff": "image/tiff", "zip": "application/zip"}
    from urllib.parse import quote
    return Response(data, media_type=types[suffix],
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(stem + '.' + suffix)}", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


def _office_pdf(data, suffix):
    exe = shutil.which("soffice")
    if not exe:
        raise HTTPException(503, "Chuyển Office cần LibreOffice ở máy xử lý")
    with tempfile.TemporaryDirectory(prefix="hdv-convert-") as folder:
        root = Path(folder)
        source = root / ("source." + suffix)
        source.write_bytes(data)
        output = root / "out"
        output.mkdir()
        try:
            p = subprocess.run([exe, "-env:UserInstallation=" + (root / "lo-profile").as_uri(),
                "--headless", "--convert-to", "pdf", "--outdir", str(output), str(source)],
                capture_output=True, timeout=120, check=False)
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(504, "LibreOffice quá thời gian") from exc
        pdf = output / "source.pdf"
        if p.returncode or not pdf.exists():
            raise HTTPException(422, "Không chuyển được tài liệu bằng LibreOffice")
        return pdf.read_bytes()


def _image_pdf(data):
    try:
        with Image.open(io.BytesIO(data)) as original:
            if original.width * original.height > 35_000_000:
                raise HTTPException(413, "Ảnh quá lớn")
            image = ImageOps.exif_transpose(original)
            frames = []
            for n in range(min(getattr(image, "n_frames", 1), 50)):
                image.seek(n)
                page = image.convert("RGB")
                stream = io.BytesIO()
                page.save(stream, format="PNG")
                frames.append(stream.getvalue())
            pdf = fitz.open()
            try:
                for frame in frames:
                    with Image.open(io.BytesIO(frame)) as im:
                        w, h = im.size
                    page = pdf.new_page(width=w * 72 / 96, height=h * 72 / 96)
                    page.insert_image(page.rect, stream=frame)
                return pdf.tobytes(garbage=3, deflate=True)
            finally:
                pdf.close()
    except HTTPException:
        raise
    except (OSError, ValueError) as exc:
        raise HTTPException(422, "Ảnh đầu vào không hợp lệ") from exc


@router.get("/api/universal-convert/capabilities")
def available():
    return {"inputs": sorted(SUPPORTED), "outputs": sorted(OUTPUTS),
            "office": bool(shutil.which("soffice")), "max_mb": 50,
            "notes": "DOCX từ PDF scan cần OCR riêng; PDF ký số chuyển đổi sẽ không bảo toàn chữ ký."}


@router.post("/api/universal-convert")
async def universal_convert(file: UploadFile = File(...), target: str = Form(...),
                            dpi: int = Form(180)):
    suffix = Path(file.filename or "").suffix.lstrip(".").lower()
    target = target.lower()
    if suffix not in SUPPORTED or target not in OUTPUTS:
        raise HTTPException(415, "Chưa hỗ trợ cặp định dạng này")
    if not 72 <= dpi <= 300:
        raise HTTPException(400, "DPI nằm trong 72–300")
    data = await file.read(MAX_BYTES + 1)
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "Tệp rỗng hoặc lớn hơn 50MB")
    stem = Path(file.filename or "document").stem[:80] or "document"
    if suffix in IMG:
        if target != "pdf":
            raise HTTPException(422, "Ảnh đầu vào hiện hỗ trợ xuất PDF; định dạng khác cần bổ sung.")
        return _response(_image_pdf(data), target, stem)
    if suffix in OFFICE or suffix == "txt":
        if target != "pdf":
            raise HTTPException(422, "Office/TXT hiện hỗ trợ xuất PDF.")
        if suffix == "txt":
            try:
                value = data.decode("utf-8-sig")
            except UnicodeError as exc:
                raise HTTPException(422, "TXT phải là UTF-8") from exc
            doc = fitz.open()
            try:
                page = doc.new_page()
                # PDF base fonts lack Vietnamese glyphs; require an installed Unicode font.
                font_path = next((p for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", "C:/Windows/Fonts/arial.ttf"] if Path(p).exists()), None)
                if not font_path:
                    raise HTTPException(503, "Chưa có font Unicode trên máy xử lý TXT → PDF")
                page.insert_font(fontname="UnicodeText", fontfile=font_path)
                page.insert_textbox(fitz.Rect(40, 40, 555, 800), value, fontsize=11, fontname="UnicodeText")
                return _response(doc.tobytes(), "pdf", stem)
            finally:
                doc.close()
        return _response(_office_pdf(data, suffix), "pdf", stem)
    if not data.startswith(b"%PDF-"):
        raise HTTPException(415, "Đầu vào không phải PDF")
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise HTTPException(422, "PDF không hợp lệ") from exc
    with doc:
        if doc.needs_pass:
            raise HTTPException(422, "PDF có mật khẩu")
        if len(doc) > 100:
            raise HTTPException(413, "Chuyển đổi giới hạn 100 trang mỗi lượt")
        if target == "txt":
            return _response("\n\n".join(p.get_text(sort=True) for p in doc).encode("utf-8-sig"), "txt", stem)
        if target == "docx":
            if sum(len(p.get_text().strip()) for p in doc) < 30:
                raise HTTPException(422, "PDF scan cần nhận dạng OCR trước khi xuất DOCX sửa được")
            from docx import Document
            word = Document()
            for index, page in enumerate(doc):
                if index: word.add_page_break()
                for block in page.get_text("blocks", sort=True):
                    if len(block) >= 7 and block[6] == 0:
                        for line in block[4].splitlines():
                            if line.strip(): word.add_paragraph(line)
            stream = io.BytesIO()
            word.save(stream)
            return _response(stream.getvalue(), "docx", stem)
        if target in {"png", "jpg", "tiff", "zip"}:
            image_type = "png" if target in {"png", "zip"} else ("jpeg" if target == "jpg" else "tiff")
            content = []
            for index, page in enumerate(doc, 1):
                pix = page.get_pixmap(dpi=dpi, alpha=False, colorspace=fitz.csRGB)
                if pix.width * pix.height > 35_000_000:
                    raise HTTPException(413, "Trang ảnh quá lớn; giảm DPI")
                with Image.frombytes("RGB", (pix.width, pix.height), pix.samples) as img:
                    out = io.BytesIO()
                    img.save(out, format=image_type, quality=90 if image_type == "jpeg" else None)
                    content.append((f"{stem}_{index:03d}." + ("png" if target == "zip" else target), out.getvalue()))
            if len(content) == 1 and target != "zip":
                return _response(content[0][1], target, stem)
            out = io.BytesIO()
            with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
                for name, item in content: z.writestr(name, item)
            return _response(out.getvalue(), "zip", stem + "_pages")
        raise HTTPException(422, "Không hỗ trợ PDF sang định dạng này")
