const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const PDFLib=require('../pdf-lib.min.js');
test('placement clamps out-of-page and malformed dimensions',async()=>{
 const {clampBox}=await import('../pdf-sign-core.mjs');assert.deepEqual(clampBox({x:-10,y:999,width:2000,height:50},600,800),{x:0,y:750,width:600,height:50});assert.ok(Number.isFinite(clampBox({x:NaN,y:NaN,width:NaN,height:NaN},600,800).x));
});
test('white matting preserves colored ink and crops transparency',async()=>{
 const {removeWhite,imageInkBounds}=await import('../pdf-sign-core.mjs');const data=new Uint8ClampedArray(16*16*4);for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=data[i+3]=255;}
 const j=(8*16+8)*4;data.set([10,50,120,255],j);removeWhite(data);assert.equal(data[3],0);assert.deepEqual([...data.slice(j,j+4)],[10,50,120,255]);assert.ok(imageInkBounds({data,width:16,height:16}).width<16);data.fill(0);assert.equal(imageInkBounds({data,width:16,height:16}),null);
});
test('signature detection rejects an actual compressed signature dictionary',async()=>{
 const {assertUnsignedDocument}=await import('../pdf-sign-core.mjs');const d=await PDFLib.PDFDocument.create();d.addPage();assertUnsignedDocument(d,PDFLib);
 d.context.register(d.context.obj({Type:'Sig',ByteRange:[0,20,40,10]}));const reloaded=await PDFLib.PDFDocument.load(await d.save());assert.throws(()=>assertUnsignedDocument(reloaded,PDFLib),/đã có chữ ký số/);
});
test('signing routes and pinned vendors are complete and local',()=>{
 const root=path.resolve(__dirname,'..');const m=JSON.parse(fs.readFileSync(path.join(root,'vendor/signature/manifest.json')));const crypto=require('node:crypto');
 for(const [file,hash]of Object.entries(m.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'vendor/signature',file))).digest('hex'),hash);
 assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/location.href='\.\/sign.html'/);
});

test('signed PDFs are accepted for viewing, but never rewritten',async()=>{
 const {inspectPdfForEditing,detectUploadFormat,assertUnsignedDocument}=await import('../pdf-sign-core.mjs');
 const pdf=await PDFLib.PDFDocument.create();pdf.addPage();
 pdf.context.register(pdf.context.obj({Type:'Sig',ByteRange:[0,20,40,10]}));
 const signed=new Uint8Array(await pdf.save());
 assert.equal(detectUploadFormat(signed),'pdf');
 const info=await inspectPdfForEditing(signed,PDFLib);
 assert.equal(info.signed,true);assert.equal(info.readOnly,true);
 const loaded=await PDFLib.PDFDocument.load(signed);
 assert.throws(()=>assertUnsignedDocument(loaded,PDFLib),/chữ ký số/);
 const unsigned=await PDFLib.PDFDocument.create();unsigned.addPage();
 const safe=await inspectPdfForEditing(new Uint8Array(await unsigned.save()),PDFLib);
 assert.equal(safe.readOnly,false);
});
test('file chooser routes PDF by magic and supported images by signature',async()=>{
 const {detectUploadFormat,buildImagePdf,inspectPdfForEditing}=await import('../pdf-sign-core.mjs');
 const pdf=await PDFLib.PDFDocument.create();pdf.addPage();
 const bytes=new Uint8Array(await pdf.save());
 assert.equal(detectUploadFormat(bytes),'pdf');
 assert.equal(detectUploadFormat(Uint8Array.from([0xff,0xd8,0xff,0x00,0x00])),'jpeg');
 assert.equal(detectUploadFormat(Uint8Array.from([0x89,0x50,0x4e,0x47,13,10,26,10])),'png');
 assert.equal(detectUploadFormat(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80])),'webp');
 assert.throws(()=>detectUploadFormat(new TextEncoder().encode('Notes document')),/Định dạng/);
 assert.equal((await inspectPdfForEditing(new TextEncoder().encode('%PDF- broken'),PDFLib)).readOnly,true);
});
