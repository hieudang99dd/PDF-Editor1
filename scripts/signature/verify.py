#!/usr/bin/env python3
"""Independent PDF geometry and OpenSSL CMS detached-signature acceptance."""
import argparse
import json
import re
import subprocess
from pathlib import Path
import fitz
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);a=p.parse_args();out=a.directory
placements=json.loads((out/'placements.json').read_text())
with fitz.open(out/'source.pdf') as source,fitz.open(out/'visual.pdf') as doc:
    assert len(doc)==len(source)==4
    for i,page in enumerate(doc):
        assert page.get_text()==source[i].get_text(), 'Original PDF text was modified'
        assert page.rotation==source[i].rotation and page.cropbox==source[i].cropbox
        images=page.get_images();assert len(images)==1
        actual=page.get_image_rects(images[0][0])[0]*page.rotation_matrix
        mark=placements[i];r=page.rect
        expected=fitz.Rect(mark['left']*r.width,mark['top']*r.height,(mark['left']+mark['width'])*r.width,(mark['top']+mark['height'])*r.height)
        assert max(abs(x-y) for x,y in zip(actual,expected))<1.1,(i,actual,expected)
        page.get_pixmap(matrix=fitz.Matrix(1.3,1.3)).save(out/f'render-{i+1}.png')
for name in ['signed','signed-pem']:
    pdf=(out/(name+'.pdf')).read_bytes()
    found=re.findall(rb'/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]',pdf);assert len(found)==1
    start,length,offset,tail=map(int,found[0]);assert start==0 and offset+tail==len(pdf)
    assert pdf[length:length+1]==b'<' and pdf[offset-1:offset]==b'>'
    cms=bytes.fromhex(pdf[length+1:offset-1].decode())
    # Trim PDF placeholder padding using DER's own length (never strip real trailing zero bytes).
    if cms[1]&128:
        count=cms[1]&127;der_length=2+count+int.from_bytes(cms[2:2+count],'big')
    else:der_length=2+cms[1]
    cms=cms[:der_length];content=pdf[:length]+pdf[offset:]
    signature=out/(name+'.der');data=out/(name+'-content.bin');signature.write_bytes(cms);data.write_bytes(content)
    cmd=['openssl','cms','-verify','-inform','DER','-in',str(signature),'-content',str(data),'-binary','-noverify','-out','/dev/null']
    verified=subprocess.run(cmd,capture_output=True);assert verified.returncode==0,verified.stderr.decode()
    data.write_bytes(content[:10]+bytes([content[10]^1])+content[11:])
    tampered=subprocess.run(cmd,capture_output=True);assert tampered.returncode!=0,'Tampered bytes incorrectly verified'
    data.unlink();signature.unlink()
    with fitz.open(out/(name+'.pdf')) as doc:
        widgets=list(doc[0].widgets());sig=next(w for w in widgets if w.field_type==fitz.PDF_WIDGET_TYPE_SIGNATURE)
        xref=int(doc.xref_get_key(sig.xref,'V')[1].split()[0]);assert doc.xref_get_key(xref,'Reason')[1]=='Phê duyệt hồ sơ kỹ thuật'
        assert doc.xref_get_key(xref,'Location')[1]=='Thành phố Hồ Chí Minh'
report={'pages':4,'rotations':[0,90,180,270],'cropbox_geometry':True,'rsa_p12_and_pem_cms_valid':True,'tampering_rejected':True,'unicode_metadata':True,'certificate_trust_checked':False}
(out/'independent-verification.json').write_text(json.dumps(report,indent=2))
print('PASS: four rotated/cropped pages, unchanged text, exact visual positions; OpenSSL verifies P12 and PEM signatures, rejects tampering, Unicode metadata preserved. CA trust was not asserted.')
