#!/usr/bin/env python3
"""Independent editable-letter font-change and raster-ghost regression."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
import fitz
p = argparse.ArgumentParser()
p.add_argument('directory', type=Path)
p.add_argument('--rendered', action='store_true')
a = p.parse_args()
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with zipfile.ZipFile(a.directory / 'editable.docx') as z:
    body = ET.fromstring(z.read('word/document.xml'))
    assert body.find('.//w:txbxContent', ns) is None
    assert len(body.findall('.//w:tbl', ns)) == 1, 'Paired letterhead must retain separate columns'
    for n in z.namelist():
        if n.startswith('word/media/') and n.endswith('.png'):
            image = fitz.Pixmap(z.read(n))
            assert all(v >= 245 for v in image.samples), 'Ghost accents or glyphs remain in raster background'
for name, folder, expected_font in [('editable', 'render', 'NotoSans'), ('changed-font', 'changed-render', 'LiberationSerif')]:
    output = a.directory / folder
    output.mkdir(exist_ok=True)
    if not a.rendered:
        soffice = shutil.which('libreoffice') or shutil.which('soffice')
        with tempfile.TemporaryDirectory(prefix='word-letter-profile-') as profile:
            subprocess.run([soffice, '-env:UserInstallation=' + Path(profile).as_uri(), '--headless', '--convert-to', 'pdf', '--outdir', str(output.resolve()), str((a.directory / (name + '.docx')).resolve())], check=True, timeout=120, capture_output=True)
    with fitz.open(output / (name + '.pdf')) as doc:
        assert len(doc) == 1
        text = doc[0].get_text()
        for expected in ['Sở Xây dựng Thành phố Hồ Chí Minh', '125,50 m3', '2.350.000.000 đồng', 'ă â ê ô ơ ư đ']:
            assert expected in text, (name, expected, text)
        fonts = [f[3] for f in doc[0].get_fonts()]
        assert any(expected_font in f for f in fonts), (name, fonts)
        doc[0].get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(output / 'qa-letter.png')
(a.directory / 'font-change-verification.json').write_text(json.dumps({'normal_paragraphs': True, 'paired_header': True, 'no_raster_ghosts': True, 'font_change_rendered': True}, indent=2))
print('PASS: normal editable letter, Vietnamese spaces and numbers, paired header, no raster ghosts, changed font rendered independently.')
