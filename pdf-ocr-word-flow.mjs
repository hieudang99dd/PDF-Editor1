// Geometric reconstruction only: never guess words, change quantities or force character spacing.
import { bounds } from './pdf-ocr-word-layout.mjs';
export const cleanText = text => String(text ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const boxOf = items => ({ x: Math.min(...items.map(i => bounds(i).x)), y: Math.min(...items.map(i => bounds(i).y)), right: Math.max(...items.map(i => bounds(i).right)), bottom: Math.max(...items.map(i => bounds(i).bottom)) });
export function mergeTextLines(items) {
  const bands = [];
  for (const item of items.filter(i => cleanText(i.text).length)) {
    const b = bounds(item), size = item.fontSize || (b.bottom - b.y) * .8;
    // PDF.js represents a column gutter as a single very wide whitespace item.
    // Keep ordinary spaces, but never let a gutter join two independent columns.
    if (!item.text.trim() && b.right - b.x > size * 1.5) continue;
    const baseline = item.baseline ?? b.bottom;
    let band = bands.find(row => Math.abs(row.baseline - baseline) < Math.max(1, Math.min(row.size, size) * .3));
    if (!band) { band = { baseline, size, items: [] }; bands.push(band); }
    band.items.push({ ...item, text: cleanText(item.text), fontSize: size });
  }
  const lines = [];
  for (const band of bands.sort((a, b) => a.baseline - b.baseline)) {
    let line;
    for (const item of band.items.sort((a, b) => bounds(a).x - bounds(b).x)) {
      const b = bounds(item), last = line?.items.at(-1), l = last && bounds(last);
      // Column/cell gaps are boundaries. Explicit PDF spaces and combining marks survive.
      if (!line || b.x - l.right > Math.max(item.fontSize, last.fontSize) * 1.5) {
        line = { items: [], runs: [], text: '', baseline: band.baseline, fontSize: band.size }; lines.push(line);
      }
      const gap = last ? b.x - l.right : 0;
      const separator = last && !/\s$/.test(line.text) && !/^\s|^\p{M}/u.test(item.text) && gap > Math.min(item.fontSize, last.fontSize) * .14 ? ' ' : '';
      line.text = cleanText(line.text + separator + item.text);
      line.runs.push({ ...item, text: separator + item.text }); line.items.push(item);
      Object.assign(line, boxOf(line.items));
    }
  }
  return lines.filter(l => l.text.trim()).map(l => ({ ...l, text: l.text.trim().normalize('NFC') }));
}
export function flowBlocks(items, tables, pageWidth) {
  const lines = mergeTextLines(items), content = [...lines, ...tables];
  if (!content.length) return { blocks: [], left: pageWidth * .08, right: pageWidth * .92, top: 0 };
  const left = Math.min(...content.map(b => b.x)), right = Math.max(...content.map(b => b.right));
  const blocks = [];
  const sorted = [...lines.map(l => ({ ...l, kind: 'paragraph', lines: [l] })), ...tables.map(t => ({ ...t, kind: 'table' }))].sort((a, b) => a.y - b.y || a.x - b.x);
  // A paired institutional heading is a borderless two-cell Word table, not floating text.
  for (let i = 0; i < sorted.length;) {
    const first = sorted[i];
    if (first.kind === 'paragraph') {
      const peer = sorted.slice(i + 1).find(p => p.kind === 'paragraph' && Math.abs(p.baseline - first.baseline) < first.fontSize * .4 && p.x - first.right > first.fontSize * 2);
      if (peer) {
        const split = (first.right + peer.x) / 2, selected = [];
        let bottom = Math.max(first.bottom, peer.bottom);
        for (const candidate of sorted.slice(i)) {
          if (candidate.kind !== 'paragraph' || candidate.y > bottom + first.fontSize * 1.5) break;
          if (candidate.right <= split || candidate.x >= split) { selected.push(candidate); bottom = Math.max(bottom, candidate.bottom); } else break;
        }
        if (selected.length >= 2) {
          const a = selected.filter(l => l.right <= split), b = selected.filter(l => l.x >= split);
          blocks.push({ kind: 'columns', x: first.x, right: peer.right, y: first.y, bottom, split, columns: [a, b] });
          selected.forEach(p => sorted.splice(sorted.indexOf(p), 1)); continue;
        }
      }
    }
    const previous = blocks.at(-1), previousLine = previous?.lines?.at(-1);
    const canJoin = previous?.kind === 'paragraph' && first.kind === 'paragraph' &&
      first.y >= previous.y && first.baseline - previousLine.baseline < first.fontSize * 1.8 &&
      first.baseline - previousLine.baseline > first.fontSize * .55 &&
      Math.abs(first.x - Math.min(...previous.lines.map(l => l.x))) < first.fontSize * .65 &&
      previousLine.right > right - first.fontSize * 2 &&
      Math.abs(first.fontSize - previousLine.fontSize) < first.fontSize * .15 &&
      Boolean(first.runs[0]?.bold) === Boolean(previousLine.runs[0]?.bold);
    if (canJoin) { previous.lines.push(first); previous.bottom = first.bottom; previous.right = Math.max(previous.right, first.right); }
    else blocks.push(first);
    i++;
  }
  return { blocks, left, right, top: Math.min(...content.map(b => b.y)) };
}
