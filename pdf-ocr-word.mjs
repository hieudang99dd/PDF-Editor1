import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, ImageRun,
  BorderStyle, TableLayoutType, WidthType, HeightRule, VerticalAlign, SectionType,
  PageOrientation, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType } from './vendor/docx/docx.mjs';
import { bounds } from './pdf-ocr-word-layout.mjs';
import { cleanText, mergeTextLines, flowBlocks } from './pdf-ocr-word-flow.mjs';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const FONT = 'Noto Sans';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const escapeXml = value => cleanText(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export function obfuscateFont(buffer, guid) {
  const hex = guid.replace(/[{}-]/g, '');
  if (!/^[a-f\d]{32}$/i.test(hex)) throw new Error('Font key không hợp lệ.');
  const key = hex.match(/../g).map(x => parseInt(x, 16)).reverse(), bytes = new Uint8Array(buffer).slice();
  for (let i = 0; i < Math.min(32, bytes.length); i++) bytes[i] ^= key[i % 16];
  return bytes;
}
const twip = pt => Math.max(0, Math.round(pt * 20));
const empty = () => new Paragraph({ spacing: { before: 0, after: 0, line: 20 }, children: [] });
function paragraph(lines, unit, width, measureText, options = {}) {
  const initial = Math.max(5, Math.min(72, lines[0].fontSize * unit));
  let size = initial;
  if (measureText) for (const line of lines) {
    const measured = measureText(line.text, initial, line.runs[0]?.bold, line.runs[0]?.italic);
    size = Math.min(size, initial * Math.max(1, width - 2) / Math.max(1, measured));
  }
  size = Math.max(5, Math.floor(size * 2) / 2);
  const chunks = [];
  for (const [n, line] of lines.entries()) {
    for (const [i, run] of line.runs.entries()) {
      const text = (n > 0 && i === 0 ? ' ' : '') + run.text;
      const previous = chunks.at(-1);
      if (previous && Boolean(previous.bold) === Boolean(run.bold) && Boolean(previous.italic) === Boolean(run.italic)) previous.text = cleanText(previous.text + text);
      else chunks.push({ text: cleanText(text), bold: run.bold, italic: run.italic });
    }
  }
  const first = lines[0], last = lines.at(-1);
  const isCentered = options.center || (lines.length === 1 && Math.abs((first.x + first.right) / 2 - (options.left + options.right) / 2) < first.fontSize && first.right - first.x < (options.right - options.left) * .85);
  return new Paragraph({
    alignment: isCentered ? 'center' : options.align || 'left',
    indent: { left: twip(isCentered ? 0 : options.indent || 0) },
    spacing: { before: twip(options.before || 0), after: 0,
      // Automatic line height keeps Vietnamese diacritics visible when fonts are changed.
      line: Math.max(240, Math.round(lines.length > 1 ? (last.baseline - first.baseline) * unit / (lines.length - 1) / size * 240 : 264)), lineRule: 'auto' },
    widowControl: false,
    children: chunks.map(run => new TextRun({ ...run, size: Math.round(size * 2), font: FONT, color: '000000', language: { value: 'vi-VN' } }))
  });
}
function wordTable(table, unit, measureText, left) {
  const widths = table.xs.slice(1).map((x, i) => twip((x - table.xs[i]) * unit));
  const rule = { style: BorderStyle.SINGLE, size: 4, color: '606060' };
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    indent: { size: twip((table.x - left) * unit), type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
    borders: { top: rule, left: rule, right: rule, bottom: rule, insideHorizontal: rule, insideVertical: rule },
    margins: { top: 10, bottom: 10, left: 35, right: 35 },
    rows: Array.from({ length: table.rows }, (_, r) => new TableRow({ cantSplit: true,
      height: { value: twip((table.ys[r + 1] - table.ys[r]) * unit), rule: HeightRule.ATLEAST },
      children: table.cells.filter(c => c.row === r).sort((a, b) => a.col - b.col).map(cell => {
        const lines = mergeTextLines(cell.items), width = (cell.right - cell.x) * unit;
        return new TableCell({ width: { size: twip(width), type: WidthType.DXA }, columnSpan: cell.colSpan, rowSpan: cell.rowSpan,
          verticalAlign: VerticalAlign.CENTER,
          children: lines.length ? lines.map(line => paragraph([line], unit, width - 4, measureText, { left: cell.x, right: cell.right })) : [empty()] });
      })
    }))
  });
}
function pairedHeading(block, unit, measureText, left) {
  const no = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const widths = [(block.split - block.x) * unit, (block.right - block.split) * unit];
  return new Table({ width: { size: twip(widths[0] + widths[1]), type: WidthType.DXA }, columnWidths: widths.map(twip),
    indent: { size: twip((block.x - left) * unit), type: WidthType.DXA }, layout: TableLayoutType.FIXED,
    borders: { top: no, left: no, right: no, bottom: no, insideHorizontal: no, insideVertical: no },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows: [new TableRow({ children: block.columns.map((lines, i) => new TableCell({
      width: { size: twip(widths[i]), type: WidthType.DXA },
      children: lines.map(line => paragraph([line], unit, widths[i], measureText, { center: true }))
    })) })]
  });
}
// docx owns the document, tables, DrawingML, sections and ZIP. This small adapter embeds
// all four faces of one family; docx 9.6.1's public font option supports regular faces only.
async function embedFonts(bytes, JSZip, fonts) {
  const zip = await JSZip.loadAsync(bytes), entries = [], relationships = [];
  for (const [i, kind] of ['Regular', 'Bold', 'Italic', 'BoldItalic'].entries()) {
    if (!fonts[kind]) throw new Error(`Thiếu font tiếng Việt ${kind}.`);
    const guid = crypto.randomUUID().toUpperCase(), target = `fonts/NotoSans-${kind}.odttf`;
    zip.file('word/' + target, obfuscateFont(fonts[kind], guid));
    entries.push(`<w:embed${kind} r:id="Font${i}" w:fontKey="{${guid}}" w:subsetted="false"/>`);
    relationships.push(`<Relationship Id="Font${i}" Type="${R}/font" Target="${target}"/>`);
  }
  zip.file('word/fontTable.xml', XML + `<w:fonts xmlns:w="${W}" xmlns:r="${R}"><w:font w:name="${FONT}"><w:family w:val="swiss"/>${entries.join('')}</w:font></w:fonts>`);
  zip.file('word/_rels/fontTable.xml.rels', XML + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>`);
  const types = await zip.file('[Content_Types].xml').async('string');
  if (!types.includes('Extension="odttf"')) zip.file('[Content_Types].xml', types.replace('</Types>', '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/></Types>'));
  const settings = await zip.file('word/settings.xml').async('string');
  zip.file('word/settings.xml', settings.replace('</w:settings>', '<w:embedTrueTypeFonts/><w:saveSubsetFonts w:val="false"/><w:doNotEmbedSystemFonts w:val="false"/></w:settings>'));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
export function validateEditablePages(pages) {
  for (const page of pages) {
    const body = (page.items || []).map(item => item.text || '');
    const cells = (page.tables || []).flatMap(table => table.cells || []).flatMap(cell => (cell.items || []).map(item => item.text || ''));
    const nonempty = [...body,...cells].join(' ').replace(/\\s+/g,' ').trim();
    if (!nonempty) throw new Error(`Trang ${page.number || '?'} mới chỉ có ảnh scan, chưa có chữ. Hãy chạy OCR trang đó trước khi xuất Word.`);
    if (!page.native && nonempty.length < 40 && !(page.tables || []).length) {
      throw new Error(`Trang ${page.number || '?'} mới nhận được quá ít chữ (${nonempty.length} ký tự). Hãy kiểm tra OCR toàn trang và bảng trước khi xuất Word.`);
    }
  }
  return true;
}
export async function createEditableDocx(pages, { JSZip, fonts, measureText, title = 'OCR PDF' }) {
  if (!pages.length) throw new Error('Chưa có trang để xuất Word.');
  validateEditablePages(pages);
  const sections = pages.map(page => {
    const physicalScale = Math.min(1, 1584 / Math.max(page.pointWidth, page.pointHeight));
    const width = page.pointWidth * physicalScale, height = page.pointHeight * physicalScale, unit = width / page.width;
    const flow = flowBlocks(page.items, page.tables, page.width);
    const left = Math.max(0, flow.left * unit - 1), right = Math.max(2, width - flow.right * unit - 2);
    const top = Math.max(0, flow.top * unit - 1), children = [];
    let bottom = flow.top;
    for (const block of flow.blocks) {
      const before = Math.max(0, (block.y - bottom) * unit);
      if (block.kind !== 'paragraph' && before > 1) children.push(new Paragraph({ spacing: { before: 0, after: 0, line: twip(before), lineRule: 'exact' }, children: [] }));
      if (block.kind === 'table') children.push(wordTable(block, unit, measureText, left / unit));
      else if (block.kind === 'columns') children.push(pairedHeading(block, unit, measureText, left / unit));
      else children.push(paragraph(block.lines, unit, width - left - right, measureText, {
        left: flow.left, right: flow.right, before, indent: Math.max(0, (block.x * unit - left))
      }));
      bottom = block.bottom;
    }
    if (!children.length || flow.blocks.at(-1)?.kind !== 'paragraph') children.push(empty());
    const header = page.background ? new Header({ children: [new Paragraph({ spacing: { before: 0, after: 0, line: 20 }, children: [new ImageRun({
      type: 'png', data: page.background, transformation: { width: width * 96 / 72, height: height * 96 / 72 },
      floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE } }
    })] })] }) : undefined;
    return { properties: { type: SectionType.NEXT_PAGE, page: { size: { width: twip(Math.min(width, height)), height: twip(Math.max(width, height)), orientation: width > height ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
      margin: { top: twip(top), left: twip(left), right: twip(right), bottom: 20, header: 0, footer: 0 } } }, headers: header ? { default: header } : undefined, children };
  });
  const document = new Document({ creator: 'PDF EDITOR', title, compatabilityModeVersion: 15,
    styles: { default: { document: { run: { font: FONT, size: 22, language: { value: 'vi-VN' } }, paragraph: { spacing: { before: 0, after: 0 } } } } }, sections });
  const bytes = await Packer.toArrayBuffer(document);
  return embedFonts(bytes, JSZip, fonts);
}
