// Geometry-only layout inference. Coordinates are in rendered page pixels.
export function bounds(item) {
  const xs = item.poly.map(p => p[0]), ys = item.poly.map(p => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}
function coalesce(lines) {
  const out = [];
  for (const line of lines.sort((a, b) => a.pos - b.pos)) {
    const same = out.find(x => Math.abs(x.pos - line.pos) <= 3 && Math.min(x.end, line.end) - Math.max(x.start, line.start) > Math.min(x.end - x.start, line.end - line.start) * .7);
    if (same) { same.start = Math.min(same.start, line.start); same.end = Math.max(same.end, line.end); }
    else out.push({ ...line });
  }
  return out;
}
export function detectRuledTables({ data, width, height }) {
  const dark = (x, y) => { const i = (y * width + x) * 4; return data[i + 3] > 120 && data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114 < 135; };
  function segments(horizontal) {
    const length = horizontal ? width : height, count = horizontal ? height : width;
    const min = horizontal ? Math.max(55, width * .1) : Math.max(30, height * .035), lines = [];
    for (let row = 0; row < count; row++) {
      let start = -1, last = -1;
      for (let col = 0; col <= length + 2; col++) {
        if (col < length && (horizontal ? dark(col, row) : dark(row, col))) {
          if (start < 0) start = col; last = col;
        } else if (start >= 0 && col - last > 2) {
          if (last - start >= min) lines.push({ pos: row, start, end: last });
          start = -1;
        }
      }
    }
    return coalesce(lines);
  }
  const hs = segments(true), vs = segments(false), nodes = [...hs, ...vs];
  if (nodes.length > 3000) return []; // dense CAD linework must not become thousands of Word cells
  const parents = nodes.map((_, i) => i);
  const find = i => parents[i] === i ? i : (parents[i] = find(parents[i]));
  function union(a, b) { parents[find(a)] = find(b); }
  hs.forEach((h, hi) => vs.forEach((v, vi) => {
    if (v.pos >= h.start - 4 && v.pos <= h.end + 4 && h.pos >= v.start - 4 && h.pos <= v.end + 4) union(hi, hs.length + vi);
  }));
  const groups = new Map();
  nodes.forEach((line, i) => { const key = find(i); if (!groups.has(key)) groups.set(key, { h: [], v: [] }); groups.get(key)[i < hs.length ? 'h' : 'v'].push(line); });
  const unique = values => values.sort((a, b) => a - b).filter((n, i, a) => !i || n - a[i - 1] > 4);
  const tables = [];
  for (const group of groups.values()) {
    const xs = unique(group.v.map(v => v.pos)), ys = unique(group.h.map(h => h.pos));
    if (xs.length < 3 || ys.length < 3 || xs.length > 40 || ys.length > 200) continue;
    const left = xs[0], right = xs.at(-1), top = ys[0], bottom = ys.at(-1);
    const outer = group.h.filter(h => h.end - h.start >= (right - left) * .85).length;
    if (outer < 2 || right - left < width * .15 || bottom - top < 25) continue;
    const rows = ys.length - 1, cols = xs.length - 1, cells = [], cellParents = Array.from({ length: rows * cols }, (_, i) => i);
    const cellFind = i => cellParents[i] === i ? i : (cellParents[i] = cellFind(cellParents[i]));
    const cellUnion = (a, b) => { cellParents[cellFind(a)] = cellFind(b); };
    const covers = (lines, pos, start, end) => lines.some(l => Math.abs(l.pos - pos) < 5 && l.start <= start + 4 && l.end >= end - 4);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && !covers(group.v, xs[c + 1], ys[r], ys[r + 1])) cellUnion(r * cols + c, r * cols + c + 1);
      if (r + 1 < rows && !covers(group.h, ys[r + 1], xs[c], xs[c + 1])) cellUnion(r * cols + c, (r + 1) * cols + c);
    }
    const merged = new Map();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const key = cellFind(r * cols + c); if (!merged.has(key)) merged.set(key, []); merged.get(key).push([r, c]);
    }
    for (const group of merged.values()) {
      const r0 = Math.min(...group.map(p => p[0])), r1 = Math.max(...group.map(p => p[0]));
      const c0 = Math.min(...group.map(p => p[1])), c1 = Math.max(...group.map(p => p[1]));
      if ((r1 - r0 + 1) * (c1 - c0 + 1) !== group.length) {
        group.forEach(([r, c]) => cells.push({ row: r, col: c, rowSpan: 1, colSpan: 1, x: xs[c], y: ys[r], right: xs[c + 1], bottom: ys[r + 1], items: [] }));
      } else cells.push({ row: r0, col: c0, rowSpan: r1 - r0 + 1, colSpan: c1 - c0 + 1, x: xs[c0], y: ys[r0], right: xs[c1 + 1], bottom: ys[r1 + 1], items: [] });
    }
    tables.push({ x: left, y: top, right, bottom, xs, ys, cells, rows, cols });
  }
  return tables.sort((a, b) => a.y - b.y || a.x - b.x);
}
export function assignItemsToTables(items, tables) {
  const remaining = [];
  for (const item of items) {
    const box = bounds(item), x = (box.x + box.right) / 2, y = (box.y + box.bottom) / 2;
    const cell = tables.flatMap(t => t.cells).find(c => x > c.x && x < c.right && y > c.y && y < c.bottom);
    if (cell) cell.items.push(item); else remaining.push(item);
  }
  tables.forEach(t => t.cells.forEach(c => c.items.sort((a, b) => bounds(a).y - bounds(b).y || bounds(a).x - bounds(b).x)));
  return remaining;
}
export function nativeTextItems(layer, viewport, pdfjs) {
  const raw = layer.items.filter(i => typeof i.str === 'string' && i.str.trim()).map(item => {
    const t = pdfjs.Util.transform(viewport.transform, item.transform);
    const height = Math.hypot(t[2], t[3]);
    const style = layer.styles[item.fontName] || {}, ascent = Number.isFinite(style.ascent) ? style.ascent : .8;
    const angle = Math.atan2(t[1], t[0]), width = Math.abs(item.width * viewport.scale);
    const dx = Math.cos(angle), dy = Math.sin(angle), ux = Math.sin(angle), uy = -Math.cos(angle);
    const bl = [t[4] - ux * height * (1 - ascent), t[5] - uy * height * (1 - ascent)];
    const tl = [bl[0] + ux * height, bl[1] + uy * height];
    return { text: item.str.normalize('NFC'), score: 1, fontSize: height,
      bold: /bold|black|heavy/i.test(item.fontName + ' ' + style.fontFamily),
      italic: /italic|oblique/i.test(item.fontName + ' ' + style.fontFamily),
      poly: [tl, [tl[0] + dx * width, tl[1] + dy * width], [bl[0] + dx * width, bl[1] + dy * width], bl] };
  });
  // Merge PDF.js fragments within one text line, while keeping cell/column gaps.
  const visible = raw.filter(item => { const b = bounds(item); return b.right > 0 && b.bottom > 0 && b.x < viewport.width && b.y < viewport.height; });
  const merged = [];
  for (const item of visible.sort((a, b) => bounds(a).y - bounds(b).y || bounds(a).x - bounds(b).x)) {
    const b = bounds(item), last = merged.at(-1), l = last && bounds(last);
    if (last && Math.abs(b.y - l.y) < Math.min(item.fontSize, last.fontSize) * .2 && b.x >= l.right - 1 && b.x - l.right < item.fontSize * .8 && Math.abs(last.fontSize - item.fontSize) < 1) {
      last.text += (b.x - l.right > item.fontSize * .2 ? ' ' : '') + item.text;
      last.poly[1] = item.poly[1]; last.poly[2] = item.poly[2];
    } else merged.push(item);
  }
  return merged;
}
