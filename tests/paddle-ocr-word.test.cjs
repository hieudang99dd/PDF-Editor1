const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function grid(){
 const width=1000,height=700,data=new Uint8ClampedArray(width*height*4);data.fill(255);
 const dot=(x,y)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;};
 for(const y of [100,170,240,310,380])for(let x=80;x<=900;x++)dot(x,y);
 for(const x of [80,900])for(let y=100;y<=380;y++)dot(x,y);
 for(const x of [200,650])for(let y=170;y<=380;y++)dot(x,y);
 return {data,width,height};
}
test('ruled table detector reconstructs grid and merged header',async()=>{
 const {detectRuledTables,assignItemsToTables}=await import('../pdf-ocr-word-layout.mjs');
 const tables=detectRuledTables(grid());assert.equal(tables.length,1);
 const t=tables[0];assert.equal(t.rows,4);assert.equal(t.cols,3);assert.equal(t.cells.find(c=>c.row===0).colSpan,3);
 const item=(text,x,y)=>({text,poly:[[x,y],[x+50,y],[x+50,y+18],[x,y+18]],score:1});
 const outside=item('Tiêu đề',80,30),inside=item('125,50',700,260);
 assert.deepEqual(assignItemsToTables([outside,inside],tables),[outside]);
 assert.ok(t.cells.some(c=>c.items.includes(inside)));
});
test('missing interior row boundary reconstructs a vertical merged cell',async()=>{
 const {detectRuledTables}=await import('../pdf-ocr-word-layout.mjs');const image=grid();
 for(let x=81;x<200;x++){const i=(240*image.width+x)*4;image.data[i]=image.data[i+1]=image.data[i+2]=255;}
 const tables=detectRuledTables(image);assert.ok(tables[0].cells.some(c=>c.col===0&&c.row===1&&c.rowSpan===2));
});
test('blank pages and isolated frames do not invent tables',async()=>{
 const {detectRuledTables}=await import('../pdf-ocr-word-layout.mjs');const image=grid();image.data.fill(255);assert.deepEqual(detectRuledTables(image),[]);
});
test('DOCX contains Unicode editable text, native table, sections and reversible font embedding',async()=>{
 const {createEditableDocx,obfuscateFont}=await import('../pdf-ocr-word.mjs');
 const {detectRuledTables,assignItemsToTables}=await import('../pdf-ocr-word-layout.mjs');
 const JSZip=require('../jszip.min.js');
 const fonts=Object.fromEntries(['Regular','Bold','Italic','BoldItalic'].map(k=>[k,fs.readFileSync(path.join(root,`NotoSans-${k}.ttf`))]));
 const tables=detectRuledTables(grid());const items=[{text:'Khối lượng bê tông: 125,50 m3',poly:[[80,30],[700,30],[700,65],[80,65]]},{text:'Cốt thép',poly:[[230,190],[400,190],[400,220],[230,220]]}];
 const remaining=assignItemsToTables(items,tables);
 const page={width:1000,height:700,pointWidth:700,pointHeight:490,items:remaining,tables};
 const bytes=await createEditableDocx([page,page],{JSZip,fonts,title:'Kiểm tra & dấu <Việt>'});
 const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml').async('string');
 assert.match(xml,/Khối lượng bê tông: 125,50 m3/);assert.match(xml,/Cốt thép/);
 assert.equal((xml.match(/<w:tbl>/g)||[]).length,2);assert.match(xml,/<w:gridSpan w:val="3"/);
 assert.equal((xml.match(/<w:sectPr>/g)||[]).length,2);
 const ft=await zip.file('word/fontTable.xml').async('string');const guid=ft.match(/w:fontKey="\{([^}]+)\}"/)[1];
 const embedded=await zip.file('word/fonts/NotoSans-Regular.odttf').async('uint8array');
 assert.deepEqual(Buffer.from(obfuscateFont(embedded,guid)),fonts.Regular);
 assert.ok(!(await zip.file('docProps/core.xml').async('string')).includes('<Việt>'));
});
