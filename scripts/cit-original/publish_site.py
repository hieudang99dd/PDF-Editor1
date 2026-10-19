#!/usr/bin/env python3
"""Publish entire upstream CIT-PDF 1.0.0 frontend under the HVD Pages prefix.

The upstream TypeScript, original format dock, PDFium WASM and all dependent
assets are compiled upstream in GitHub Actions. This stage preserves every
HVD static tool in the repository and only redirects the dedicated Text
workspace after native Chromium tests pass.
"""
from __future__ import annotations

import html
import json
import pathlib
import shutil
import sys
from brand_site import main as brand_frontend

root = pathlib.Path(__file__).resolve().parents[2]
upstream_dist = pathlib.Path(sys.argv[1]).resolve()
dest = pathlib.Path(sys.argv[2]).resolve()
excluded = {
    ".git", ".github", "node_modules", "cit-upstream", "cit-stage",
    "tests", "test-results", "scripts", "backend", "__pycache__", ".venv", "studio", "cit-native"
}
if not (upstream_dist / "edit-pdf-text.html").is_file():
    raise SystemExit("No original CIT Vite editor to publish")
if dest == root or root in dest.parents and dest.name not in {"cit-stage", "site-dist"}:
    raise SystemExit("Refusing unsafe publishing path")
if dest.exists():
    shutil.rmtree(dest)
dest.mkdir(parents=True)
for item in root.iterdir():
    if item.name in excluded or item == dest:
        continue
    if item.is_dir():
        shutil.copytree(item, dest / item.name, symlinks=False)
    elif item.is_file() and item.suffix not in {".zip", ".pyc"}:
        shutil.copy2(item, dest / item.name)

# Preserve the real HVD editor as fallback; never overwrite it with the
# primary CIT redirect on subsequent builds. This was possible once master
# itself contained the redirected text-editor.html from an earlier release.
legacy_editor = dest / "text-editor.html"
fallback_editor = dest / "text-editor-hdv.html"
if legacy_editor.exists():
    current_html = legacy_editor.read_text(encoding="utf-8")
    if "studio/edit-pdf-text.html" in current_html or "cit-native/edit-pdf-text.html" in current_html:
        legacy_editor.unlink()
        if not fallback_editor.is_file() or any(p in fallback_editor.read_text(encoding="utf-8") for p in ("studio/edit-pdf-text.html", "cit-native/edit-pdf-text.html")):
            raise SystemExit("Missing real HVD native text fallback; refusing to publish")
    elif fallback_editor.is_file():
        legacy_editor.unlink()
    else:
        legacy_editor.rename(fallback_editor)
if not fallback_editor.is_file():
    raise SystemExit("HVD fallback editor is unavailable")

# Keep Vite-generated CIT JS/CSS/WASM untouched. Only add two external HVD
# navigation/branding assets to the generated HTML (not the CIT algorithms).
# The original Vite output is still built from a pinned upstream commit.
cit_dir = dest / "studio"
shutil.copytree(upstream_dist, cit_dir)
for name in ("hvd-hub.js", "hvd-hub.css", "hvd-mark.svg"):
    shutil.copy2(root / "scripts" / "cit-original" / name, cit_dir / name)
brand_frontend(cit_dir)
# Keep the canonical browser OCR workspace when rebuilding all Studio routes.
ocr_redirect = root / "studio" / "ocr-pdf.html"
if ocr_redirect.is_file():
    shutil.copy2(ocr_redirect, cit_dir / "ocr-pdf.html")
    compressed = ocr_redirect.with_suffix(".html.br")
    if compressed.is_file():
        shutil.copy2(compressed, cit_dir / "ocr-pdf.html.br")

(dest / ".nojekyll").write_text("", encoding="utf-8")

target = "./studio/edit-pdf-text.html"
redirect = f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport"
content="width=device-width,initial-scale=1">
<title>PDF HVD – Chỉnh sửa văn bản PDF</title>
<meta http-equiv="refresh" content="0;url={html.escape(target)}">
<link rel="canonical" href="{html.escape(target)}"></head>
<body><p>Đang mở trình chỉnh sửa văn bản PDF HVD…
<a href="{html.escape(target)}">Nhấn vào đây nếu không tự chuyển</a>.</p>
<script>location.replace({json.dumps(target)}+location.search+location.hash);</script>
</body></html>
"""
legacy_editor.write_text(redirect, encoding="utf-8")
meta = {
    "upstream_repo": "https://github.com/Cuongyd196/cit-pdf",
    "upstream_tag": "1.0.0",
    "upstream_commit": "3c9c138d980a417de7439f383f37882a1d730ab6",
    "engine": "original pinned CIT Vite+PDFium runtime, unmodified algorithms",
    "hvd_bridge": "PDF HVD branding, SEO and navigation; copyright retained in NOTICE.md",
    "path": "/PDF-Editor-Hdv/studio/edit-pdf-text.html",
    "legacy_fallback": "/PDF-Editor-Hdv/text-editor-hdv.html",
    "license": "AGPL-3.0-only"
}
(dest / "studio" / "hvd-vendor-lock.json").write_text(
    json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print("HVD + original CIT stage:", dest)
print("CIT editor:", dest / "studio" / "edit-pdf-text.html")
print("Legacy editor:", dest / "text-editor-hdv.html")
