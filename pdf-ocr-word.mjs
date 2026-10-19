import { bounds } from './pdf-ocr-word-layout.mjs';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
export const escapeXml = value => String(value ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const FONT = 'Noto Sans';
export function obfuscateFont(buffer, guid) {
  const hex = guid.replace(/[{}-]/g, '');
  if (!/^[a-f\d]{32}$/i.test(hex)) throw new Error('Font key không hợp lệ.');
  const key = hex.match(/../g).map(x => parseInt(x, 16)).reverse();
  const bytes = new Uint8Array(buffer).slice();
  for (let i = 0; i < Math.min(32, bytes.length); i++) bytes[i] ^= key[i % 16];
  return bytes;
}
function run(text, size, bold = false, italic = false) {
  return `<w:r><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/><w:sz w:val="${Math.round(size * 2)}"/><w:szCs w:val="${Math.round(size * 2)}"/>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}<w:color w:val="000000"/><w:lang w:val="vi-VN"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}
function fitSize(item, unit, width, measureText) {
  const b = bounds(item), initial = (item.fontSize || (b.bottom - b.y) * .8) * unit;
  const size = Math.max(5, Math.min(72, initial));
  const measured = measureText ? measureText(item.text, size, item.bold, item.italic) : item.text.length * size * .55;
  return Math.max(5, Math.floor(Math.min(size, size * Math.max(1, width - .5) * .99 / Math.max(1, measured)) * 2) / 2);
}
function paragraph(text, size, options = {}) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${Math.round(size * 24)}" w:lineRule="atLeast"/><w:jc w:val="${options.align || 'left'}"/><w:widowControl w:val="0"/></w:pPr>${run(text, size, options.bold, options.italic)}</w:p>`;
}
function textShape(item, unit, id, measureText) {
  const b = bounds(item), x = Math.max(0, b.x * unit), y = Math.max(0, b.y * unit);
  const width = Math.max(2, (b.right - b.x) * unit + 1), height = Math.max(4, (b.bottom - b.y) * unit * 1.15);
  const size = fitSize(item, unit, width, measureText);
  const detectedAngle = Math.atan2(item.poly[1][1] - item.poly[0][1], item.poly[1][0] - item.poly[0][0]) * 180 / Math.PI;
  const angle = Math.abs(detectedAngle) < 1 ? 0 : detectedAngle;
  return `<w:r><w:pict><v:shape id="Text${id}" type="#_x0000_t202" style="position:absolute;margin-left:${x.toFixed(2)}pt;margin-top:${y.toFixed(2)}pt;width:${width.toFixed(2)}pt;height:${height.toFixed(2)}pt;rotation:${angle.toFixed(2)};z-index:251659264;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" stroked="f" filled="f"><v:textbox inset="0,0,0,0" style="mso-fit-shape-to-text:t"><w:txbxContent>${item.text.split('\n').map(text => paragraph(text, size, item)).join('')}</w:txbxContent></v:textbox></v:shape></w:pict></w:r>`;
}
function wordTable(table, unit, measureText) {
  const twip = x => Math.max(0, Math.round(x * unit * 20));
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(side => `<w:${side} w:val="single" w:sz="4" w:color="606060"/>`).join('');
  const rows = [];
  for (let r = 0; r < table.rows; r++) {
    let cells = '';
    for (let c = 0; c < table.cols;) {
      const cell = table.cells.find(x => x.col === c && r >= x.row && r < x.row + x.rowSpan);
      if (!cell) { c++; continue; }
      const continuation = r > cell.row, width = (cell.right - cell.x) * unit;
      const items = continuation ? [] : cell.items;
      const ps = items.length ? items.map(item => {
        const b = bounds(item), center = (b.x + b.right) / 2, middle = (cell.x + cell.right) / 2;
        const align = Math.abs(center - middle) < (cell.right - cell.x) * .08 ? 'center' : cell.right - b.right < (cell.right - cell.x) * .08 && b.x - cell.x > (cell.right - cell.x) * .2 ? 'right' : 'left';
        return paragraph(item.text, fitSize(item, unit, Math.min(width - 5, (b.right - b.x) * unit + 1), measureText), { ...item, align });
      }).join('') : paragraph('', 6);
      cells += `<w:tc><w:tcPr><w:tcW w:w="${twip(cell.right - cell.x)}" w:type="dxa"/>${cell.colSpan > 1 ? `<w:gridSpan w:val="${cell.colSpan}"/>` : ''}${cell.rowSpan > 1 ? continuation ? '<w:vMerge/>' : '<w:vMerge w:val="restart"/>' : ''}<w:vAlign w:val="center"/><w:tcMar><w:top w:w="10" w:type="dxa"/><w:left w:w="30" w:type="dxa"/><w:bottom w:w="10" w:type="dxa"/><w:right w:w="30" w:type="dxa"/></w:tcMar></w:tcPr>${ps}</w:tc>`;
      c += cell.colSpan;
    }
    rows.push(`<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${twip(table.ys[r + 1] - table.ys[r])}" w:hRule="atLeast"/></w:trPr>${cells}</w:tr>`);
  }
  return `<w:tbl><w:tblPr><w:tblpPr w:leftFromText="0" w:rightFromText="0" w:topFromText="0" w:bottomFromText="0" w:vertAnchor="page" w:horzAnchor="page" w:tblpX="${twip(table.x)}" w:tblpY="${twip(table.y)}"/><w:tblW w:w="${twip(table.right - table.x)}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblCellMar><w:top w:w="10" w:type="dxa"/><w:left w:w="30" w:type="dxa"/><w:bottom w:w="10" w:type="dxa"/><w:right w:w="30" w:type="dxa"/></w:tblCellMar><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${table.xs.slice(1).map((x, i) => `<w:gridCol w:w="${twip(x - table.xs[i])}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}
export async function createEditableDocx(pages, { JSZip, fonts, measureText, title = 'OCR PDF' }) {
  if (!pages.length) throw new Error('Chưa có trang để xuất Word.');
  const zip = new JSZip(), documentRels = [], fontRels = [], fontEntries = [];
  const fontKinds = ['Regular', 'Bold', 'Italic', 'BoldItalic'];
  for (let i = 0; i < fontKinds.length; i++) {
    const kind = fontKinds[i], buffer = fonts[kind];
    if (!buffer) throw new Error(`Thiếu font tiếng Việt ${kind}.`);
    const guid = crypto.randomUUID().toUpperCase(), target = `fonts/NotoSans-${kind}.odttf`;
    zip.file('word/' + target, obfuscateFont(buffer, guid));
    fontRels.push(`<Relationship Id="Font${i}" Type="${officeRel}font" Target="${target}"/>`);
    fontEntries.push(`<w:embed${kind} r:id="Font${i}" w:fontKey="{${guid}}" w:subsetted="false"/>`);
  }
  const rootNs = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"';
  let shapeId = 0, lastSection = '';
  const body = pages.map((page, index) => {
    const physicalScale = Math.min(1, 1584 / Math.max(page.pointWidth, page.pointHeight));
    const pageWidth = page.pointWidth * physicalScale, pageHeight = page.pointHeight * physicalScale;
    const unit = pageWidth / page.width;
    const imageId = 'PageImage' + index;
    if (page.background) {
      zip.file(`word/media/page-${index + 1}.png`, page.background);
      documentRels.push(`<Relationship Id="Header${index}" Type="${officeRel}header" Target="header-${index + 1}.xml"/>`);
      zip.file(`word/_rels/header-${index + 1}.xml.rels`, XML + `<Relationships xmlns="${relNs}"><Relationship Id="${imageId}" Type="${officeRel}image" Target="media/page-${index + 1}.png"/></Relationships>`);
    }
    const definitions = '<w:r><w:pict><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" o:preferrelative="t" path="m@4@5l@4@11@9@11@9@5xe" filled="f" stroked="f"><v:path o:connecttype="rect"/></v:shapetype></w:pict></w:r>';
    const background = page.background ? `<w:r><w:pict><v:shape id="Page${index + 1}" type="#_x0000_t75" style="position:absolute;margin-left:0pt;margin-top:0pt;width:${pageWidth.toFixed(2)}pt;height:${pageHeight.toFixed(2)}pt;z-index:-251654144;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" stroked="f"><v:imagedata r:id="${imageId}" o:title="Đồ họa trang ${index + 1}"/></v:shape></w:pict></w:r>` : '';
    if (page.background) zip.file(`word/header-${index + 1}.xml`, XML + `<w:hdr ${rootNs}><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>${definitions}${background}</w:p></w:hdr>`);
    const text = page.items.filter(i => i.text.trim()).map(item => textShape(item, unit, ++shapeId, measureText)).join('');
    const section = `<w:sectPr>${page.background ? `<w:headerReference w:type="default" r:id="Header${index}"/>` : ''}<w:type w:val="nextPage"/><w:pgSz w:w="${Math.round(pageWidth * 20)}" w:h="${Math.round(pageHeight * 20)}"${pageWidth > pageHeight ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
    lastSection = section;
    return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>${index === 0 ? definitions : ''}${text}</w:p>${page.tables.map(t => wordTable(t, unit, measureText)).join('')}${index < pages.length - 1 ? `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>${section}</w:pPr></w:p>` : ''}`;
  }).join('');
  zip.file('word/document.xml', XML + `<w:document ${rootNs}><w:body>${body}${lastSection}</w:body></w:document>`);
  zip.file('word/fontTable.xml', XML + `<w:fonts ${rootNs}><w:font w:name="${FONT}"><w:family w:val="swiss"/>${fontEntries.join('')}</w:font></w:fonts>`);
  zip.file('word/_rels/fontTable.xml.rels', XML + `<Relationships xmlns="${relNs}">${fontRels.join('')}</Relationships>`);
  zip.file('word/styles.xml', XML + `<w:styles ${rootNs}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="22"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  zip.file('word/settings.xml', XML + `<w:settings ${rootNs}><w:embedTrueTypeFonts/><w:saveSubsetFonts w:val="false"/><w:doNotEmbedSystemFonts w:val="false"/></w:settings>`);
  for (const [id, target] of [['Styles', 'styles'], ['Settings', 'settings'], ['FontTable', 'fontTable']])
    documentRels.push(`<Relationship Id="${id}" Type="${officeRel}${target}" Target="${target}.xml"/>`);
  zip.file('word/_rels/document.xml.rels', XML + `<Relationships xmlns="${relNs}">${documentRels.join('')}</Relationships>`);
  zip.file('_rels/.rels', XML + `<Relationships xmlns="${relNs}"><Relationship Id="Document" Type="${officeRel}officeDocument" Target="word/document.xml"/><Relationship Id="Core" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('docProps/core.xml', XML + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>PDF EDITOR</dc:creator><dc:language>vi-VN</dc:language></cp:coreProperties>`);
  const headerOverrides = pages.map((page, i) => page.background ? `<Override PartName="/word/header-${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` : '').join('');
  const overrides = [['document', 'document.main'], ['styles', 'styles'], ['settings', 'settings'], ['fontTable', 'fontTable']].map(([file, type]) => `<Override PartName="/word/${file}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`).join('');
  zip.file('[Content_Types].xml', XML + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>${overrides}${headerOverrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
