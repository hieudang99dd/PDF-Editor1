// Regression for real PDF.js fragments, Vietnamese spaces, normal Word editing and font changes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/paddle-ocr/letter');fs.mkdirSync(out,{recursive:true});
 const port=8094,base=process.env.OCR_LIVE_BASE||`http://127.0.0.1:${port}`;
 const server=process.env.OCR_LIVE_BASE?null:spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<40;i++){try{if((await fetch(base+'/ocr.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const proxy=process.env.OCR_LIVE_BASE&&process.env.HTTPS_PROXY?new URL(process.env.HTTPS_PROXY):null;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox'],...(proxy?{proxy:{server:proxy.protocol+'//'+proxy.host,username:decodeURIComponent(proxy.username),password:decodeURIComponent(proxy.password)}}:{})});
  const page=await browser.newPage({ignoreHTTPSErrors:!!proxy});await page.goto(base+'/ocr.html');
  const result=await page.evaluate(async()=>{
   const {exportEditableWord}=await import('./pdf-ocr-word-client.mjs');
   const doc=await PDFLib.PDFDocument.create();doc.registerFontkit(fontkit);
   const font=await doc.embedFont(await(await fetch('./NotoSans-Regular.ttf')).arrayBuffer());
   const bold=await doc.embedFont(await(await fetch('./NotoSans-Bold.ttf')).arrayBuffer(),{subset:true});
   const page=doc.addPage([595,842]);
   const draw=(text,x,y,size=11,b=false)=>page.drawText(text,{x,y,size,font:b?bold:font});
   draw('ỦY BAN NHÂN DÂN',45,790,11,true);draw('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',285,790,10,true);
   draw('SỞ XÂY DỰNG',57,773,11,true);draw('Độc lập - Tự do - Hạnh phúc',325,773,10);
   draw('THÔNG BÁO',245,725,14,true);draw('Kết luận về tổ chức giao thông',180,703,11,true);
   let y=663;const phrase='Sở Xây dựng Thành phố Hồ Chí Minh tổ chức cuộc họp về phương án giao thông.';
   // Draw words and explicit spaces as separate PDF text operations.
   let x=45;for(const word of phrase.split(/( )/)){draw(word,x,y);x+=font.widthOfTextAtSize(word,11);}
   const lines=[
    'Nội dung được trình bày thành đoạn văn để có thể chỉnh sửa trực tiếp trong Word.',
    'Các đơn vị kiểm tra khối lượng bê tông, cốt thép và bảo đảm tiến độ thực hiện.',
    '1. Phạm vi thực hiện',
    'Đường giao thông được tổ chức phù hợp với hồ sơ thiết kế đã phê duyệt.',
    'Khối lượng bê tông: 125,50 m3. Chi phí dự kiến: 2.350.000.000 đồng.',
    '2. Trách nhiệm phối hợp',
    'Sở Xây dựng đề nghị các đơn vị phối hợp thực hiện và báo cáo kết quả.',
    'Văn bản sử dụng đầy đủ dấu tiếng Việt: ă â ê ô ơ ư đ Ắ Ầ Ễ Ộ Ớ Ữ Đ.'
   ];
   for(const line of lines){y-=22;draw(line,45,y,11);}
   const source=await doc.save(),pdf=await pdfjsLib.getDocument({data:source.slice()}).promise;
   const exported=await exportEditableWord(pdf,new Map([[1,{native:true}]]),pdfjsLib,JSZip);
   const zip=await JSZip.loadAsync(exported.bytes),xml=await zip.file('word/document.xml').async('string');
   const parsed=new DOMParser().parseFromString(xml,'application/xml'),ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
   const paragraphs=[...parsed.getElementsByTagNameNS(ns,'p')].map(p=>[...p.getElementsByTagNameNS(ns,'t')].map(t=>t.textContent).join(''));
   if(!paragraphs.some(p=>p.includes(phrase)))throw new Error('PDF explicit word spaces were lost: '+paragraphs.join('|'));
   if(xml.includes('txbxContent'))throw new Error('Text boxes are forbidden in editable flow');
   // Simulate selecting all normal text and changing its font, without moving/rewriting text.
   zip.file('word/document.xml',xml.replaceAll('Noto Sans','Liberation Serif'));
   const styles=await zip.file('word/styles.xml').async('string');zip.file('word/styles.xml',styles.replaceAll('Noto Sans','Liberation Serif'));
   return {source:[...source],word:[...exported.bytes],changed:[...await zip.generateAsync({type:'uint8array'})],paragraphs};
  });
  fs.writeFileSync(path.join(out,'source.pdf'),Buffer.from(result.source));fs.writeFileSync(path.join(out,'editable.docx'),Buffer.from(result.word));fs.writeFileSync(path.join(out,'changed-font.docx'),Buffer.from(result.changed));
  fs.writeFileSync(path.join(out,'paragraphs.json'),JSON.stringify(result.paragraphs,null,2));
  assert.ok(result.paragraphs.some(p=>p.includes('125,50 m3')));console.log('PASS: administrative letter, real PDF fragments, explicit Vietnamese spaces, editable paragraphs and changed-font DOCX');
 }finally{if(browser)await browser.close();if(server)server.kill();}
})().catch(e=>{console.error(e);process.exit(1);});
