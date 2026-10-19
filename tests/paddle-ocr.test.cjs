const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=()=>import('../pdf-ocr-core.mjs');
test('page selection rejects invalid/out-of-range input and deduplicates',async()=>{
 const {parsePages}=await core();
 assert.deepEqual(parsePages('3, 1-3, 5',5),[1,2,3,5]);assert.deepEqual(parsePages('',2),[1,2]);
 for(const value of ['0','1-9','3-1','NaN','1,,2','2.5'])assert.throws(()=>parsePages(value,5));
});
test('large drawing raster has bounded memory and side length',async()=>{
 const {boundedScale}=await core();const w=50000,h=30000,s=boundedScale(w,h,240);
 assert.ok(w*h*s*s<=8000001);assert.ok(Math.max(w,h)*s<=4096);
});
test('text matrices follow original coordinates for all page rotations and crop offsets',async()=>{
 const {textMatrix}=await core();const poly=[[10,20],[110,20],[110,40],[10,40]];
 const transforms=[(x,y)=>[x+50,400-y],(x,y)=>[y+50,x+70],(x,y)=>[400-x,100+y],(x,y)=>[300-y,400-x]];
 for(const f of transforms){const m=textMatrix(poly,f,10);const tl=f(10,20),tr=f(110,20),bl=f(10,40);
 assert.ok(Math.abs(m[0]*10-(tr[0]-tl[0]))<1e-6);
 assert.ok(Math.abs(m[1]*10-(tr[1]-tl[1]))<1e-6);
 assert.ok(Math.abs(m[2]-(tl[0]-bl[0]))<1e-6);assert.ok(Math.abs(m[3]-(tl[1]-bl[1]))<1e-6);
 }
});
test('OCR normalizes Vietnamese and rejects non-finite geometry',async()=>{
 const {normalizeItems}=await core();const items=normalizeItems([{text:'Bê tông',score:.8,poly:[[0,0],[20,0],[20,10],[0,10]]},{text:'bad',poly:[[NaN,0],[20,0],[20,10],[0,10]]}],100,100);
 assert.equal(items.length,1);assert.equal(items[0].text,'Bê tông');
});
test('same-origin runtime assets match reviewed hashes',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/paddleocr/manifest.json')));
 for(const [file,{sha256}] of Object.entries(manifest.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'vendor/paddleocr',file))).digest('hex'),sha256,file);
});
