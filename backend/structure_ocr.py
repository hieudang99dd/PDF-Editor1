"""Optional PP-StructureV3 OCR route. Heavy models are loaded lazily, never on GitHub Pages."""
from __future__ import annotations
import io
import json
import tempfile
import threading
import zipfile
from pathlib import Path

import fitz
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

router = APIRouter()
_model = None
_lock = threading.Lock()
MAX_SIZE = 50 * 1024 * 1024
MAX_PAGES = 20


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                try:
                    from paddleocr import PPStructureV3
                except ImportError as exc:
                    raise HTTPException(503, "Chưa cài PP-StructureV3: pip install -r requirements-structure.txt") from exc
                _model = PPStructureV3(
                    use_table_recognition=True,
                    use_doc_orientation_classify=True,
                    use_doc_unwarping=False,
                    use_formula_recognition=False,
                )
    return _model


@router.get("/api/ocr-structure/capabilities")
def structure_capabilities():
    try:
        import importlib.util
        installed = importlib.util.find_spec("paddleocr") is not None
    except (ImportError, ValueError):
        installed = False
    return {"available": installed, "engine": "PP-StructureV3",
            "formats": ["pdf", "png", "jpg", "jpeg", "tif", "tiff"],
            "export": "zip (editable DOCX and layout JSON for each page)",
            "max_pages": MAX_PAGES}


@router.post("/api/ocr-structure")
async def structure_ocr(file: UploadFile = File(...), dpi: int = Form(200)):
    if not 120 <= dpi <= 300:
        raise HTTPException(400, "DPI phải nằm trong khoảng 120–300")
    data = await file.read(MAX_SIZE + 1)
    if not data or len(data) > MAX_SIZE:
        raise HTTPException(413, "Tệp rỗng hoặc vượt giới hạn 50 MB")
    is_pdf = data.startswith(b"%PDF-")
    from PIL import Image, UnidentifiedImageError
    pages = []
    try:
        if is_pdf:
            with fitz.open(stream=data, filetype="pdf") as doc:
                if doc.is_encrypted:
                    raise HTTPException(422, "PDF có mật khẩu; hãy mở khóa trước")
                if len(doc) > MAX_PAGES:
                    raise HTTPException(413, "OCR nâng cao tối đa 20 trang/lần")
                for page in doc:
                    pix = page.get_pixmap(dpi=dpi, alpha=False, colorspace=fitz.csRGB)
                    if pix.width * pix.height > 20_000_000:
                        raise HTTPException(413, "Trang quá lớn; hãy giảm DPI")
                    pages.append(pix.tobytes("png"))
        else:
            try:
                with Image.open(io.BytesIO(data)) as img:
                    if img.width * img.height > 20_000_000:
                        raise HTTPException(413, "Ảnh quá lớn")
                    img.seek(0)
                    output = io.BytesIO()
                    img.convert("RGB").save(output, format="PNG")
                    pages.append(output.getvalue())
            except (UnidentifiedImageError, OSError) as exc:
                raise HTTPException(415, "Chỉ hỗ trợ PDF hoặc ảnh tài liệu hợp lệ") from exc
        model = _get_model()
        package = io.BytesIO()
        with tempfile.TemporaryDirectory(prefix="hdv-structure-") as folder:
            root = Path(folder)
            with zipfile.ZipFile(package, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                manifest = {"engine": "PP-StructureV3", "pages": len(pages), "files": []}
                for number, png in enumerate(pages, 1):
                    image_path = root / f"page_{number:03d}.png"
                    image_path.write_bytes(png)
                    export_dir = root / f"result_{number:03d}"
                    export_dir.mkdir()
                    results = model.predict(input=str(image_path))
                    if results is None:
                        raise HTTPException(422, f"Không thể nhận dạng trang {number}")
                    found_docx = False
                    for result in results:
                        result.save_to_json(save_path=str(export_dir))
                        result.save_to_word(save_path=str(export_dir))
                    for artifact in export_dir.rglob("*"):
                        if artifact.is_file() and artifact.suffix.lower() in {".docx", ".json"}:
                            name = f"page_{number:03d}/{artifact.name}"
                            archive.write(artifact, name)
                            manifest["files"].append(name)
                            found_docx |= artifact.suffix.lower() == ".docx"
                    if not found_docx:
                        raise HTTPException(502, f"PP-StructureV3 không xuất được DOCX trang {number}")
                archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        return Response(
            package.getvalue(), media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=ocr-structure.zip",
                     "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"PP-StructureV3 xử lý thất bại: {type(exc).__name__}") from exc
