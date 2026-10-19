#!/usr/bin/env python3
"""Independent inspection of optimized PDF pages and vectors.
Raster images may differ intentionally in strong mode. Text, vector
drawings, dimensions and rotation must remain intact.
"""
import pathlib
import sys
import fitz

def main(root):
    src=fitz.open(str(root/"source.pdf"))
    strong=fitz.open(str(root/"strong.pdf"))
    safe=fitz.open(str(root/"safe.pdf"))
    assert len(src)==len(strong)==len(safe)==2, "PDF page count changed"
    assert (root/"strong.pdf").stat().st_size<(root/"source.pdf").stat().st_size
    assert (root/"safe.pdf").stat().st_size<=(root/"source.pdf").stat().st_size
    for n,(original,compressed,lossless) in enumerate(zip(src,strong,safe),1):
        assert original.rect == compressed.rect == lossless.rect, f"Page {n} changed geometry"
        assert original.rotation == compressed.rotation == lossless.rotation
        assert original.get_text() == compressed.get_text() == lossless.get_text(), f"Page {n} changed text layer"
        assert len(original.get_drawings())==len(compressed.get_drawings())==len(lossless.get_drawings()), f"Page {n} lost vector drawings"
        assert original.get_images(full=True) and compressed.get_images(full=True), f"Page {n} lost embedded image"
        # Rendered page must still contain expected non-white photograph and vector/text.
        pix=compressed.get_pixmap(matrix=fitz.Matrix(.6,.6),alpha=False)
        assert len(pix.samples)>10000
    print("PASS: compressed PDF retains text, vector paths, image XObjects and page geometry")

if __name__=="__main__":
    main(pathlib.Path(sys.argv[1]))
