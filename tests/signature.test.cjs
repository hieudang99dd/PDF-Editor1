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
