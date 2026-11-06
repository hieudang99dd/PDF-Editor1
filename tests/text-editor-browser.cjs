// Optional desktop/headless integration checks. Requires Playwright and a Chromium binary.
// PDF_EDITOR_CHROMIUM=/path/to/chromium node tests/text-editor-browser.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
const PDFLib=require('../pdf-lib.min.js');
const PDFJS=require('../pdf.min.js');
PDFJS.GlobalWorkerOptions.workerSrc=path.resolve(__dirname,'../pdf.worker.min.js');
const fontkit=require('../fontkit.umd.min.js');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright') : 'playwright');
const root=path.resolve(__dirname,'..');
const outputDir=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-text-editor-'));
async function readText(filename) {
    const reader=await PDFJS.getDocument({data:new Uint8Array(fs.readFileSync(filename)),verbosity:0}).promise;
    try {return (await (await reader.getPage(1)).getTextContent()).items.map(i=>i.str).join('\n');}
    finally {await reader.destroy();}
}
async function fixture() {
    const doc=await PDFLib.PDFDocument.create();doc.registerFontkit(fontkit);
    const regular=await doc.embedFont(fs.readFileSync(path.join(root,'fonts/Tinos-Regular.ttf')));
    const bold=await doc.embedFont(fs.readFileSync(path.join(root,'fonts/Tinos-Bold.ttf')));
    const page=doc.addPage([700,820]);
    page.drawText('BẢNG KHỐI LƯỢNG RÃNH',{x:170,y:745,size:16,font:bold});
    page.drawText('TÊN ĐƯỜNG',{x:90,y:696,size:12,font:bold});
    page.drawText('TÊN RÃNH',{x:350,y:696,size:12,font:bold});
    for(let r=0;r<6;r++) {
        const y=665-r*24;
        page.drawText('ĐƯỜNG GOM TRÁI '+(10+r),{x:45,y,size:11,font:regular});
        page.drawText('RÃNH BẰNG ĐƯỜNG KM1+'+(260+r)+'.65',{x:250,y,size:11,font:regular});
        page.drawText((6.68+r).toFixed(2),{x:585,y,size:11,font:regular});
    }
    for(const y of [725,685,653,629,605,581,557,533]) page.drawLine({start:{x:40,y},end:{x:660,y},thickness:0.5});
    for(const x of [40,245,570,660]) page.drawLine({start:{x,y:533},end:{x,y:725},thickness:0.5});
    const filename=path.join(outputDir,'table.pdf');fs.writeFileSync(filename,await doc.save());return filename;
}
async function main() {
    const file=await fixture();
    const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.css':'text/css','.ttf':'font/ttf'};
    const server=http.createServer((req,res)=>{
        const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
        const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
        if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
        fs.readFile(filename,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream'});res.end(error?'Not found':data);});
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const browser=await chromium.launch({headless:true,...(process.env.PDF_EDITOR_CHROMIUM?{executablePath:process.env.PDF_EDITOR_CHROMIUM}:{}),args:['--no-sandbox','--no-zygote','--disable-gpu','--disable-dev-shm-usage']});
    try {
        const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error' && !m.text().includes('favicon'))errors.push(m.text());});
        page.on('dialog',async d=>{errors.push('Unexpected dialog: '+d.message());await d.dismiss();});
        await page.goto('http://127.0.0.1:'+server.address().port+'/');
        await page.evaluate(()=>initOrganizer([]));
        await page.locator('#po-file-input').setInputFiles(file);
        await page.waitForFunction(()=>organizerInstance.pages.length===1 && document.querySelectorAll('.po-text-box').length>=21);
        await page.locator('#po-tb-edit-text').click();
        await page.waitForFunction(()=>document.getElementById('po-preview-img').complete && document.getElementById('po-preview-img').naturalWidth>100);
        const rowId=await page.evaluate(()=>[...document.querySelectorAll('.po-text-box')].find(d=>d.textContent.includes('KM1+260.65')).dataset.id);
        const row=()=>page.locator('.po-text-box[data-id="'+rowId+'"]');
        const state=()=>page.evaluate(()=>({history:organizerInstance.historyIndex,edits:organizerInstance.pages[0].textEdits?.length||0}));
        const initial=await state();
        const tableRuns=await page.evaluate(()=>[...document.querySelectorAll('.po-text-box')].filter(d=>d.textContent.startsWith('RÃNH')).map(d=>({text:d.textContent,height:d._textRun.height,cell:d._textRun.cell})));
        assert.equal(tableRuns.length,6);assert.ok(tableRuns.every(r=>r.cell && r.height<24));
        await page.screenshot({path:path.join(outputDir,'before.png')});
        await row().click();await row().press('Enter');
        assert.deepEqual(await state(),initial,'open/close without changes must not alter history');
        await row().click();await row().fill('NỘI DUNG SẼ HỦY');await row().press('Escape');
        await page.waitForFunction(()=>!organizerInstance.activeEditDiv && document.querySelectorAll('.po-text-box').length>=21);
        assert.deepEqual(await state(),initial,'Escape must cancel without changing history');
        await row().click();await row().fill('A'.repeat(300));
        await page.locator('#po-ft-done').click();
        await page.waitForFunction(()=>document.getElementById('po-ft-status').textContent.includes('vượt vùng'));
        assert.deepEqual(await state(),initial,'invalid edit must not alter history');
        await page.locator('#po-ft-cancel').click();
        await page.waitForFunction(()=>!organizerInstance.activeEditDiv && document.querySelectorAll('.po-text-box').length>=21);
        await row().click();await row().fill('A'.repeat(48));
        await page.locator('#po-ft-overflow').selectOption('shrink');
        await page.locator('#po-ft-done').click();
        await page.waitForFunction(()=>organizerInstance.pages[0].textEdits?.length===1 && !organizerInstance.activeEditDiv).catch(async e=>{console.error('NATIVE STATUS',await page.locator('#po-ft-status').textContent(),errors);throw e;});
        assert.equal(await page.evaluate(async()=>{
            const edit=organizerInstance.pages[0].textEdits[0];
            const font=await organizerInstance.getTextEditFont(await organizerInstance.getTextMeasureDoc(),edit);
            return PDFTextLayout.layout(edit,font.pdfFont).size<edit.size;
        }),true);
        await page.evaluate(()=>organizerInstance.undo());
        await page.waitForFunction(()=>!organizerInstance.pages[0].textEdits?.length && !organizerInstance.previewTask);
        await row().click();await row().fill('RÃNH BẰNG ĐƯỜNG KM1+299.99');
        await page.locator('#po-ft-done').click();
        await page.waitForFunction(()=>organizerInstance.pages[0].textEdits?.length===1 && !organizerInstance.activeEditDiv).catch(async e=>{console.error('NATIVE STATUS',await page.locator('#po-ft-status').textContent(),errors);throw e;});
        await page.waitForFunction(()=>!organizerInstance.previewTask);
        const savedEdit=await page.evaluate(()=>organizerInstance.pages[0].textEdits[0]);
        assert.equal(savedEdit.originalFamily,'serif','embedded Tinos must retain the serif family even when PDF.js reports a generic fallback');
        assert.equal(savedEdit.layoutVersion,2);assert.equal(savedEdit.y,665);assert.equal(savedEdit.newText,'RÃNH BẰNG ĐƯỜNG KM1+299.99');
        await page.screenshot({path:path.join(outputDir,'after.png')});
        await page.evaluate(()=>organizerInstance.undo());
        await page.waitForFunction(()=>!organizerInstance.pages[0].textEdits?.length && !organizerInstance.previewTask);
        await page.evaluate(()=>organizerInstance.redo());
        await page.waitForFunction(()=>organizerInstance.pages[0].textEdits?.length===1 && !organizerInstance.previewTask);
        await page.locator('#po-save').click();
        await page.locator('#po-save-confirm').click();
        await page.locator('#po-save-download-link:visible').waitFor({timeout:120000});
        const downloadPromise=page.waitForEvent('download');
        await page.locator('#po-save-download-link').click();
        const download=await downloadPromise;
        const destination=path.join(outputDir,'edited.pdf');await download.saveAs(destination);
        const output=await PDFLib.PDFDocument.load(fs.readFileSync(destination));assert.equal(output.getPageCount(),1);
        const downloadedText=await readText(destination);
        assert.ok(downloadedText.includes('KM1+299.99'));
        assert.ok(!downloadedText.includes('KM1+260.65'),'download must replace original text, not cover it');
        assert.ok(downloadedText.includes('KM1+261.65'),'neighbor row must remain untouched');
        await page.evaluate(()=>organizerInstance.pages[0].rotation=90);
        await page.evaluate(()=>organizerInstance.focusPage(organizerInstance.pages[0].id,true));
        await page.waitForFunction(()=>!organizerInstance.previewTask && document.querySelectorAll('.po-text-box').length>=21);
        assert.equal(await page.locator('#po-text-layer').isVisible(),true);
        const rotatedId=await page.locator('.po-text-box').filter({hasText:'KM1+261.65'}).getAttribute('data-id');
        const rotatedRow=page.locator('.po-text-box[data-id="'+rotatedId+'"]');
        await rotatedRow.click();await rotatedRow.fill('RÃNH BẰNG ĐƯỜNG KM1+300.00');await rotatedRow.press('Enter');
        await page.waitForFunction(()=>organizerInstance.pages[0].textEdits?.length===2 && !organizerInstance.previewTask).catch(async e=>{console.error('ROTATED STATUS',await page.locator('#po-ft-status').textContent(),errors);throw e;});
        await page.screenshot({path:path.join(outputDir,'rotated.png')});
        await page.locator('#po-save').click();
        await page.locator('#po-save-confirm').click();
        await page.locator('#po-save-download-link:visible').waitFor({timeout:120000});
        const rotatedDownloadPromise=page.waitForEvent('download');
        await page.locator('#po-save-download-link').click();
        const rotatedDownload=await rotatedDownloadPromise;
        const rotatedDestination=path.join(outputDir,'rotated-edited.pdf');await rotatedDownload.saveAs(rotatedDestination);
        const rotatedOutput=await PDFLib.PDFDocument.load(fs.readFileSync(rotatedDestination));
        assert.equal(rotatedOutput.getPage(0).getRotation().angle,90);
        const rotatedText=await readText(rotatedDestination);
        assert.ok(rotatedText.includes('KM1+299.99') && rotatedText.includes('KM1+300.00'));
        assert.ok(!rotatedText.includes('KM1+260.65') && !rotatedText.includes('KM1+261.65'));
        await page.locator('#po-back').click();
        await page.waitForFunction(()=>!document.querySelector('.po-container'));
        assert.equal(await page.locator('header').isVisible(),true);
        const totalTools=await page.locator('.tool').count();
        await page.locator('#q').fill('Ghép');
        assert.ok(await page.locator('.tool').count()<totalTools);
        await page.locator('#q').fill('');
        assert.equal(await page.locator('.tool').count(),totalTools);
        await page.locator('.chip[data-c="Sắp xếp"]').click();
        assert.ok(await page.locator('.tool').count()<totalTools);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({result:'PASS',checks:['six table rows','no-op edit','Escape cancel','overflow rejection','explicit shrink','Vietnamese text commit','undo/redo','native download: old text absent','rotated native edit and PDF export','return home, search and filter','no browser errors'],outputDir}));
    } finally {await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
