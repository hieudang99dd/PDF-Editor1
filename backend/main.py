"""HDV local conversion service. Documents never leave this machine."""
from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import fitz
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

MAX_UPLOAD = 50 * 1024 * 1024
MAX_PAGES = 300
ALLOWED_ORIGINS = [
    "https://hieudang99dd.github.io",
    "http://localhost:3000", "http://localhost:5173", "http://localhost:5500",
    "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5500",
]
app = FastAPI(title="PDF HDV Local Engine", version="0.2.0")
from structure_ocr import router as structure_ocr_router
app.include_router(structure_ocr_router)
from universal_convert import router as universal_convert_router
app.include_router(universal_convert_router)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
                   allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["*"])


def _require_tool(name: str):
    exe = shutil.which(name)
    if not exe:
        raise HTTPException(503, f"Chưa cài {name} trên máy chạy backend")
    return exe


def _ocr_languages() -> list[str]:
    if not shutil.which("tesseract"):
        return []
    result = subprocess.run(["tesseract", "--list-langs"], capture_output=True,
                            text=True, timeout=10, check=False)
    return sorted(x.strip() for x in result.stdout.splitlines()[1:] if x.strip())


@app.get("/api/capabilities")
def capabilities():
    return {"engine": "HDV Local", "limits": {"upload_mb": 50, "pages": MAX_PAGES},
            "convert": ["txt", "docx", "tiff", "pdf-from-office"],
            "ocr_languages": _ocr_languages(), "libreoffice": bool(shutil.which("soffice"))}


async def _read_upload(upload: UploadFile) -> bytes:
    data = await upload.read(MAX_UPLOAD + 1)
    if not data:
        raise HTTPException(400, "Tệp rỗng")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Giới hạn tải lên là 50 MB")
    return data


def _open_pdf(data: bytes) -> fitz.Document:
    if not data.startswith(b"%PDF-"):
        raise HTTPException(415, "Đầu vào không phải PDF hợp lệ")
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        if doc.is_encrypted:
            doc.close()
            raise HTTPException(422, "PDF có mật khẩu; hãy mở khóa trước")
        if len(doc) > MAX_PAGES:
            doc.close()
            raise HTTPException(413, f"PDF vượt quá {MAX_PAGES} trang")
        return doc
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as e:
        raise HTTPException(422, "Không đọc được PDF") from e


def _response(data: bytes, mime: str, filename: str) -> Response:
    from urllib.parse import quote
    return Response(content=data, media_type=mime,
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
                             "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


def _pdf_to_docx(doc: fitz.Document) -> bytes:
    # Intentionally text-editable conversion, not a promise of layout fidelity.
    from docx import Document
    word = Document()
    for index, page in enumerate(doc):
        if index:
            word.add_page_break()
        blocks = page.get_text("blocks", sort=True)
        for block in blocks:
            if len(block) < 7 or block[6] != 0:
                continue
            for line in block[4].splitlines():
                if line.strip():
                    word.add_paragraph(line)
    out = io.BytesIO()
    word.save(out)
    return out.getvalue()


def _pdf_to_tiff(doc: fitz.Document, dpi: int = 150) -> bytes:
    if len(doc) > 60:
        raise HTTPException(413, "Xuất TIFF giới hạn tối đa 60 trang mỗi lần")
    from PIL import Image
    images = []
    try:
        for page in doc:
            pix = page.get_pixmap(dpi=dpi, alpha=False, colorspace=fitz.csRGB)
            images.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
        out = io.BytesIO()
        images[0].save(out, format="TIFF", save_all=True,
                       append_images=images[1:], compression="tiff_deflate", dpi=(dpi, dpi))
        return out.getvalue()
    finally:
        for im in images:
            im.close()


def _office_to_pdf(data: bytes, filename: str) -> bytes:
    office = _require_tool("soffice")
    allowed = {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp"}
    suffix = Path(filename).suffix.lower()
    if suffix not in allowed:
        raise HTTPException(415, "Chỉ nhận tệp Word, Excel, PowerPoint và OpenDocument")
    with tempfile.TemporaryDirectory(prefix="hdv-office-") as directory:
        base = Path(directory)
        source = base / ("input" + suffix)
        target = base / "output"
        target.mkdir()
        source.write_bytes(data)
        profile = (base / "lo-profile").as_uri()
        try:
            proc = subprocess.run([office, f"-env:UserInstallation={profile}", "--headless",
                                   "--convert-to", "pdf", "--outdir", str(target), str(source)],
                                  capture_output=True, text=True, timeout=90, check=False)
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(504, "Chuyển đổi Office quá thời gian") from exc
        result = target / "input.pdf"
        if proc.returncode != 0 or not result.exists():
            raise HTTPException(422, "LibreOffice không chuyển đổi được tài liệu")
        return result.read_bytes()


@app.post("/api/convert")
async def convert(file: UploadFile = File(...), target: str = Form(...)):
    data = await _read_upload(file)
    stem = Path(file.filename or "document").stem[:80] or "document"
    if target == "pdf":
        if data.startswith(b"%PDF-"):
            raise HTTPException(400, "Tệp đã có định dạng PDF")
        result = _office_to_pdf(data, file.filename or "")
        return _response(result, "application/pdf", f"{stem}.pdf")
    if target not in {"txt", "docx", "tiff"}:
        raise HTTPException(400, "Định dạng đích chưa hỗ trợ")
    with _open_pdf(data) as doc:
        if target == "txt":
            result = "\n\n".join(page.get_text(sort=True) for page in doc).encode("utf-8-sig")
            return _response(result, "text/plain; charset=utf-8", f"{stem}.txt")
        if target == "docx":
            result = _pdf_to_docx(doc)
            return _response(result, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", f"{stem}.docx")
        result = _pdf_to_tiff(doc)
        return _response(result, "image/tiff", f"{stem}.tiff")


@app.post("/api/ocr")
async def ocr(file: UploadFile = File(...), language: str = Form("vie+eng"),
              target: str = Form("txt")):
    if target not in {"txt", "pdf"}:
        raise HTTPException(400, "OCR chỉ hỗ trợ TXT hoặc PDF có lớp chữ")
    if not language or any(ch not in "abcdefghijklmnopqrstuvwxyz+" for ch in language):
        raise HTTPException(400, "Mã ngôn ngữ OCR không hợp lệ")
    _require_tool("tesseract")
    installed = set(_ocr_languages())
    if any(lang not in installed for lang in language.split("+")):
        raise HTTPException(422, f"Chưa cài ngôn ngữ OCR: {language}")
    import pytesseract
    from PIL import Image
    data = await _read_upload(file)
    stem = Path(file.filename or "document").stem[:80]
    with _open_pdf(data) as doc:
        if len(doc) > 60:
            raise HTTPException(413, "OCR giới hạn tối đa 60 trang mỗi lần")
        extracted = []
        searchable = fitz.open()
        try:
            for page in doc:
                pix = page.get_pixmap(dpi=180, alpha=False, colorspace=fitz.csRGB)
                with Image.frombytes("RGB", (pix.width, pix.height), pix.samples) as img:
                    if target == "txt":
                        extracted.append(pytesseract.image_to_string(img, lang=language))
                    else:
                        searchable_page = pytesseract.image_to_pdf_or_hocr(img, extension="pdf", lang=language)
                        with fitz.open(stream=searchable_page, filetype="pdf") as part:
                            searchable.insert_pdf(part)
            if target == "txt":
                return _response("\n\n".join(extracted).encode("utf-8-sig"),
                                 "text/plain; charset=utf-8", f"{stem}_ocr.txt")
            return _response(searchable.tobytes(garbage=4, deflate=True),
                             "application/pdf", f"{stem}_ocr.pdf")
        finally:
            searchable.close()


@app.post("/compress")
async def compress_pdf(file: UploadFile = File(...), level: str = Form("Cơ bản")):
    data = await _read_upload(file)
    with _open_pdf(data) as doc:
        try:
            compressed = doc.tobytes(garbage=4, deflate=True, deflate_images=True, use_objstms=1)
        except (RuntimeError, ValueError) as e:
            raise HTTPException(422, "Không nén được PDF") from e
    # Never claim savings when the output is larger; avoid destructive rasterization of CAD plans.
    result = compressed if len(compressed) < len(data) else data
    return _response(result, "application/pdf", "compressed_" + Path(file.filename or "document.pdf").name[:100])
