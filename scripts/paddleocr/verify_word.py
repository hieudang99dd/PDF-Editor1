#!/usr/bin/env python3
"""Independent ZIP/font checks and LibreOffice/PyMuPDF rendering acceptance."""
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
p.add_argument('docx', type=Path)
p.add_argument('source', type=Path)
p.add_argument('--render-pdf', type=Path)
args = p.parse_args()
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
with zipfile.ZipFile(args.docx) as archive:
    for name in archive.namelist():
        if name.endswith(('.xml', '.rels')):
            ET.fromstring(archive.read(name))
    body = ET.fromstring(archive.read('word/document.xml'))
    assert len(body.findall('.//w:tbl', ns)) >= 2, 'Native and scanned tables must be editable Word tables'
    assert len(body.findall('.//w:sectPr', ns)) == 3
    assert body.find('.//w:gridSpan[@w:val="4"]', ns) is not None, 'Merged header was lost'
    for kind in ['Regular', 'Bold', 'Italic', 'BoldItalic']:
        table = ET.fromstring(archive.read('word/fontTable.xml'))
        entry = table.find(f'.//w:embed{kind}', ns)
        assert entry is not None
        guid = entry.attrib[f'{{{ns["w"]}}}fontKey'].strip('{}').replace('-', '')
        key = bytes.fromhex(guid)[::-1]
        embedded = bytearray(archive.read(f'word/fonts/NotoSans-{kind}.odttf'))
        for i in range(32):
            embedded[i] ^= key[i % 16]
        original = Path(__file__).resolve().parents[2] / f'NotoSans-{kind}.ttf'
        assert bytes(embedded) == original.read_bytes(), f'Corrupt embedded font {kind}'

if args.render_pdf:
    rendered = args.render_pdf
else:
    output = args.docx.parent / 'word-render'
    output.mkdir(exist_ok=True)
    soffice = shutil.which('libreoffice') or shutil.which('soffice')
    assert soffice, 'LibreOffice Writer is required for rendering QA'
    with tempfile.TemporaryDirectory(prefix='ocr-word-profile-') as profile:
        subprocess.run([soffice, '-env:UserInstallation=' + Path(profile).as_uri(), '--headless', '--convert-to', 'pdf', '--outdir', str(output.resolve()), str(args.docx.resolve())], check=True, timeout=120, capture_output=True)
    rendered = output / (args.docx.stem + '.pdf')
with fitz.open(rendered) as document, fitz.open(args.source) as source:
    assert len(document) == 3, f'Unexpected page count: {len(document)}'
    texts = [page.get_text() for page in document]
    expected = 'HỒ SƠ THIẾT KẾ ĐƯỜNG GIAO THÔNG'
    lines = [''.join(span['text'] for span in line['spans']) for block in document[0].get_text('dict')['blocks'] if block['type'] == 0 for line in block['lines']]
    assert any(expected in line for line in lines), 'First title wrapped or lost Vietnamese glyphs'
    assert 'Khối lượng bê tông: 125,50 m3' in texts[0]
    assert 'Cốt thép' in texts[1] and '125,50' in texts[1]
    assert 'Cốt thép' in texts[2] and '125,50' in texts[2], 'Scanned table did not survive OCR → Word'
    assert '\ufffd' not in ''.join(texts)
    for i in range(3):
        assert abs(document[i].rect.width - source[i].rect.width) < 1
        assert abs(document[i].rect.height - source[i].rect.height) < 1
    # Table rules must be Word vector borders, visible above the page background.
    for page in [document[1], document[2]]:
        rules = []
        for drawing in page.get_drawings():
            for item in drawing['items']:
                if item[0] == 'l':
                    a, b = item[1], item[2]
                    if abs(a.y - b.y) < 1 and abs(a.x - b.x) > 150 and 140 < a.y < 320:
                        rules.append(round(a.y))
                elif item[0] == 're':
                    rect = item[1]
                    if rect.width > 150:
                        rules.extend(round(y) for y in [rect.y0, rect.y1] if 140 < y < 320)
        assert len(set(rules)) >= 3, 'Table row borders hidden behind background'
    # The non-text graphic remains at the original location.
    pixel = document[0].get_pixmap().pixel(600, 200)
    assert pixel[2] > 140 and pixel[1] > 90 and pixel[0] < 60, pixel
    for i, page in enumerate(document):
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(rendered.parent / f'word-qa-page-{i + 1}.png')
    (rendered.parent / 'word-qa.json').write_text(json.dumps({'pages': len(document), 'editable_tables': 2, 'fonts_verified': 4, 'title_on_one_line': True, 'graphic_preserved': True}, indent=2))
print('PASS: editable tables, merged cells, embedded fonts, Vietnamese rendering, page sizes/count, one-line title and non-text graphic.')
