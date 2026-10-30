// Tables: insertion, row/column operations on a span-aware grid, merging, resizing, properties.
import { E } from './state.js';
import { h, toast, dialog, field, select, numInput, palette, toHex, openMenu, closeMenus } from './ui.js';
import { mutate, inTag } from './format.js';

const cellHTML = '<td><p><br></p></td>';
export function insertTable(rows, cols) {
  if (!E.canEdit()) return;
  const tag = 'n' + Date.now();
  E.insertHTML(`<table class="dt" data-new="${tag}"><tbody>${('<tr>' + cellHTML.repeat(cols) + '</tr>').repeat(rows)}</tbody></table><p><br></p>`);
  const tb = E.body.querySelector(`table[data-new="${tag}"]`);
  if (!tb) return;
  tb.removeAttribute('data-new');
  const first = tb.querySelector('td p');
  if (first) { const r = document.createRange(); r.setStart(first, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
}

export function grid(table) {
  const G = [];
  [...table.rows].forEach((tr, r) => {
    G[r] ||= [];
    let c = 0;
    for (const td of tr.cells) {
      while (G[r][c]) c++;
      const rs = td.rowSpan || 1, cs = td.colSpan || 1;
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) (G[r + i] ||= [])[c + j] = td;
      td._r = r; td._c = c;
      c += cs;
    }
  });
  return G;
}
export const curCell = () => inTag('td') || inTag('th');
export const curTable = () => curCell()?.closest('table') || null;

export function selectedCells() {
  const r = E.range(), tb = curTable();
  if (!r || !tb) return [];
  const cells = [...tb.querySelectorAll('td,th')].filter(c => c.closest('table') === tb && r.intersectsNode(c));
  if (cells.length < 2) return cells;
  const G = grid(tb);
  let r0 = 1e9, r1 = -1, c0 = 1e9, c1 = -1;
  for (const c of cells) { r0 = Math.min(r0, c._r); c0 = Math.min(c0, c._c); r1 = Math.max(r1, c._r + c.rowSpan - 1); c1 = Math.max(c1, c._c + c.colSpan - 1); }
  const set = new Set();
  for (let i = r0; i <= r1; i++) for (let j = c0; j <= c1; j++) if (G[i]?.[j]) set.add(G[i][j]);
  return [...set];
}
export function highlightCells() {
  E.body.querySelectorAll('.cell-sel').forEach(c => c.classList.remove('cell-sel'));
  const cells = selectedCells();
  if (cells.length > 1) cells.forEach(c => c.classList.add('cell-sel'));
}

const newCell = (tag = 'td') => { const c = document.createElement(tag); c.innerHTML = '<p><br></p>'; return c; };

export function insertRow(after) {
  const cell = curCell(); if (!cell) return;
  mutate(() => {
    const tb = cell.closest('table'), G = grid(tb);
    const r = after ? cell._r + cell.rowSpan - 1 : cell._r;
    const tr = document.createElement('tr');
    const grown = new Set();
    const cols = G[r].length;
    for (let c = 0; c < cols; c++) {
      const x = G[r][c];
      const crosses = after ? G[r + 1]?.[c] === x : G[r - 1]?.[c] === x;
      if (crosses) { if (!grown.has(x)) { x.rowSpan++; grown.add(x); } continue; }
      const nc = newCell(x?.tagName === 'TH' && after ? 'td' : 'td');
      if (x?.style.backgroundColor && !after) nc.style.backgroundColor = '';
      tr.append(nc);
      c += (x?.colSpan || 1) - 1;
    }
    const ref = tb.rows[r];
    if (after) ref.after(tr); else ref.before(tr);
  });
}
export function insertCol(right) {
  const cell = curCell(); if (!cell) return;
  mutate(() => {
    const tb = cell.closest('table'), G = grid(tb);
    const c = right ? cell._c + cell.colSpan - 1 : cell._c;
    const grown = new Set();
    G.forEach((row, r) => {
      const x = row[c];
      if (!x) return;
      const crosses = right ? row[c + 1] === x : row[c - 1] === x;
      if (crosses) { if (!grown.has(x)) { x.colSpan++; grown.add(x); } return; }
      if (x._r !== r && grown.has(x)) return;
      const tr = tb.rows[r];
      const nc = newCell(x.tagName === 'TH' ? 'th' : 'td');
      const next = [...tr.cells].find(td => right ? td._c > c : td._c >= c);
      if (next) next.before(nc); else tr.append(nc);
    });
    const cg = tb.querySelector('colgroup');
    if (cg) { const cols = [...cg.children]; const w = cols[c] ? parseFloat(cols[c].style.width) / 2 : 0; if (cols[c] && w) cols[c].style.width = (w) + (cols[c].style.width.endsWith('%') ? '%' : 'px'); const n = document.createElement('col'); if (w) n.style.width = cols[c].style.width; right ? cols[c]?.after(n) : cols[c]?.before(n); }
  });
}
export function deleteRow() {
  const cell = curCell(); if (!cell) return;
  const tb = cell.closest('table');
  if (tb.rows.length <= 1) return deleteTable();
  mutate(() => {
    const G = grid(tb);
    const rows = new Set(selectedCells().map(x => x._r)); if (!rows.size) rows.add(cell._r);
    [...rows].sort((a, b) => b - a).forEach(r => {
      const G2 = grid(tb), row = G2[r], tr = tb.rows[r];
      const done = new Set();
      row.forEach((x, c) => {
        if (!x || done.has(x)) return; done.add(x);
        if (x._r < r) { x.rowSpan--; return; }
        if (x.rowSpan > 1) {
          const nc = x.cloneNode(false); nc.innerHTML = '<p><br></p>'; nc.rowSpan = x.rowSpan - 1;
          const ntr = tb.rows[r + 1];
          const next = [...ntr.cells].find(td => td._c > c);
          next ? next.before(nc) : ntr.append(nc);
        }
      });
      tr.remove();
    });
    void G;
  });
}
export function deleteCol() {
  const cell = curCell(); if (!cell) return;
  const tb = cell.closest('table');
  const G = grid(tb);
  if (G[0].length <= 1) return deleteTable();
  mutate(() => {
    const cols = new Set(selectedCells().map(x => x._c)); if (!cols.size) cols.add(cell._c);
    [...cols].sort((a, b) => b - a).forEach(c => {
      const G2 = grid(tb), done = new Set();
      G2.forEach(row => { const x = row[c]; if (!x || done.has(x)) return; done.add(x); if (x.colSpan > 1) x.colSpan--; else x.remove(); });
      const cg = tb.querySelector('colgroup'); cg?.children[c]?.remove();
    });
    [...tb.rows].forEach(tr => { if (!tr.cells.length) tr.remove(); });
  });
}
export function deleteTable() {
  const tb = curTable(); if (!tb) return;
  mutate(() => {
    const p = document.createElement('p'); p.innerHTML = '<br>';
    tb.replaceWith(p);
    const s = getSelection(); s.collapse(p, 0);
  });
}
export function mergeCells() {
  const cells = selectedCells();
  if (cells.length < 2) { toast('Pilih dua sel atau lebih untuk digabungkan'); return; }
  mutate(() => {
    const tb = cells[0].closest('table'); grid(tb);
    let r0 = 1e9, r1 = -1, c0 = 1e9, c1 = -1;
    for (const c of cells) { r0 = Math.min(r0, c._r); c0 = Math.min(c0, c._c); r1 = Math.max(r1, c._r + c.rowSpan - 1); c1 = Math.max(c1, c._c + c.colSpan - 1); }
    const first = cells.find(c => c._r === r0 && c._c === c0) || cells[0];
    for (const c of cells) {
      if (c === first) continue;
      const kids = [...c.childNodes].filter(n => !(n.nodeType === 1 && n.tagName === 'P' && !n.textContent.trim() && !n.querySelector('img')));
      first.append(...kids);
      c.remove();
    }
    first.rowSpan = r1 - r0 + 1; first.colSpan = c1 - c0 + 1;
    first.classList.remove('cell-sel');
    [...tb.rows].forEach(tr => { if (!tr.cells.length) { tr.remove(); first.rowSpan = Math.max(1, first.rowSpan - 1); } });
    getSelection().collapse(first.querySelector('p') || first, 0);
  });
}
export function unmergeCell() {
  const cell = curCell();
  if (!cell || (cell.rowSpan === 1 && cell.colSpan === 1)) { toast('Sel ini tidak digabungkan'); return; }
  mutate(() => {
    const tb = cell.closest('table'); grid(tb);
    const r0 = cell._r, c0 = cell._c, rs = cell.rowSpan, cs = cell.colSpan;
    cell.rowSpan = 1; cell.colSpan = 1;
    for (let i = 0; i < rs; i++) {
      const tr = tb.rows[r0 + i];
      grid(tb);
      for (let j = 0; j < cs; j++) {
        if (i === 0 && j === 0) continue;
        const nc = newCell(cell.tagName.toLowerCase());
        const next = [...tr.cells].find(td => td._c > c0 + j - (i === 0 ? 0 : 1) && td !== cell && td._c >= c0 + j);
        next ? next.before(nc) : tr.append(nc);
        grid(tb);
      }
    }
  });
}
export function distributeCols() {
  const tb = curTable(); if (!tb) return;
  mutate(() => { tb.querySelector('colgroup')?.remove(); tb.querySelectorAll('td,th').forEach(c => c.style.width = ''); });
}
export function cellBg(color) {
  const cells = selectedCells(); if (!cells.length) { const c = curCell(); if (c) cells.push(c); }
  if (!cells.length) return;
  mutate(() => cells.forEach(c => { c.style.backgroundColor = color || ''; if (!c.getAttribute('style')) c.removeAttribute('style'); }));
}
export function cellVAlign(v) {
  const cells = selectedCells(); if (!cells.length) { const c = curCell(); if (c) cells.push(c); }
  mutate(() => cells.forEach(c => c.style.verticalAlign = v === 'top' ? '' : v));
}
export function toggleHeaderRow() {
  const tb = curTable(); if (!tb) return;
  mutate(() => {
    const tr = tb.rows[0];
    const isHead = [...tr.cells].every(c => c.tagName === 'TH');
    [...tr.cells].forEach(c => {
      const n = document.createElement(isHead ? 'td' : 'th');
      for (const a of c.attributes) n.setAttribute(a.name, a.value);
      n.append(...c.childNodes); c.replaceWith(n);
    });
  });
}
export function sortTable(dir) {
  const cell = curCell(); if (!cell) return;
  const tb = cell.closest('table');
  if ([...tb.querySelectorAll('td,th')].some(c => c.rowSpan > 1)) { toast('Tabel dengan sel gabungan vertikal tidak dapat diurutkan'); return; }
  mutate(() => {
    grid(tb);
    const col = cell._c;
    const rows = [...tb.rows];
    const head = rows[0] && [...rows[0].cells].every(c => c.tagName === 'TH') ? rows.shift() : null;
    const val = tr => { const c = [...tr.cells].find(x => x._c <= col && x._c + x.colSpan > col); return c?.textContent.trim() || ''; };
    rows.sort((a, b) => {
      const x = val(a), y = val(b);
      const nx = parseFloat(x.replace(/\./g, '').replace(',', '.')), ny = parseFloat(y.replace(/\./g, '').replace(',', '.'));
      const r = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, 'id', { numeric: true });
      return r * dir;
    });
    const body = rows[0]?.parentElement || tb.tBodies[0];
    rows.forEach(r => body.append(r));
    if (head) head.parentElement.prepend(head);
  });
}

export function onTab(e) {
  const cell = curCell();
  if (!cell) return false;
  e.preventDefault();
  const tb = cell.closest('table');
  const cells = [...tb.querySelectorAll('td,th')].filter(c => c.closest('table') === tb);
  let i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
  if (i >= cells.length) { insertRow(true); const all = [...tb.querySelectorAll('td,th')].filter(c => c.closest('table') === tb); i = cells.length; return focusCell(all[i] || all[all.length - 1]), true; }
  if (i < 0) return true;
  focusCell(cells[i]);
  return true;
}
function focusCell(c) {
  if (!c) return;
  const r = document.createRange();
  r.selectNodeContents(c.querySelector('p') || c);
  if (!r.toString()) r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

/* Column resizing by dragging cell borders */
export function initResize() {
  let drag = null;
  E.body.addEventListener('mousemove', e => {
    if (drag || E.mode === 'view') return;
    const td = e.target.closest?.('td,th');
    let on = false;
    if (td && E.body.contains(td)) {
      const r = td.getBoundingClientRect();
      on = Math.abs(e.clientX - r.right) < 4 && td.nextElementSibling;
    }
    E.root.classList.toggle('col-resize', !!on);
    E.body._resizeCell = on ? td : null;
  });
  E.body.addEventListener('mousedown', e => {
    const td = E.body._resizeCell;
    if (!td || e.button !== 0) return;
    e.preventDefault();
    const tb = td.closest('table'), G = grid(tb);
    const ncols = G[0].length;
    let cg = tb.querySelector('colgroup');
    const widths = [];
    for (let c = 0; c < ncols; c++) {
      let w = 0;
      for (const row of G) { const x = row[c]; if (x && x.colSpan === 1) { w = x.getBoundingClientRect().width / E.zoom; break; } }
      widths.push(w || tb.getBoundingClientRect().width / E.zoom / ncols);
    }
    if (!cg) { cg = document.createElement('colgroup'); tb.prepend(cg); }
    cg.replaceChildren(...widths.map(w => { const c = document.createElement('col'); c.style.width = w + 'px'; return c; }));
    const c = td._c + td.colSpan - 1;
    E.hist.before();
    drag = { cg, c, x: e.clientX, a: widths[c], b: widths[c + 1] };
    const guide = h('div', { class: 'r-guide', style: { left: e.clientX + 'px' } });
    document.body.append(guide);
    const mv = ev => {
      const d = (ev.clientX - drag.x) / E.zoom;
      const a = Math.max(24, drag.a + d), b = Math.max(24, drag.b - (a - drag.a));
      const aa = drag.a + drag.b - b;
      cg.children[c].style.width = aa + 'px';
      cg.children[c + 1].style.width = b + 'px';
      guide.style.left = ev.clientX + 'px';
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); guide.remove(); drag = null; E.changed(); };
    addEventListener('mousemove', mv);
    addEventListener('mouseup', up);
  });
}

export async function tableProps() {
  const tb = curTable(); if (!tb) return;
  const c0 = tb.querySelector('td,th');
  const cs = getComputedStyle(c0);
  let bw = parseFloat(c0.style.borderWidth || cs.borderTopWidth) * .75 || 0;
  if (tb.classList.contains('nb')) bw = 0;
  let bc = toHex(c0.style.borderColor || cs.borderTopColor) || '#000000';
  let bg = null;
  const width = numInput(parseFloat(tb.style.width) || 100, { min: 10, max: 100, step: 1 });
  const alignSel = select([['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']], tb.style.marginLeft === 'auto' && tb.style.marginRight === 'auto' ? 'center' : tb.style.marginLeft === 'auto' ? 'right' : 'left');
  const bwSel = select([['0', 'Tanpa garis'], ['0.5', '½ pt'], ['0.75', '¾ pt'], ['1', '1 pt'], ['1.5', '1½ pt'], ['2.25', '2¼ pt'], ['3', '3 pt']], String(bw || 0));
  const pad = numInput(Math.round(parseFloat(cs.paddingTop) * .75 * 10) / 10, { min: 0, max: 40, step: .5 });
  const valign = select([['top', 'Atas'], ['middle', 'Tengah'], ['bottom', 'Bawah']], cs.verticalAlign === 'middle' ? 'middle' : cs.verticalAlign === 'bottom' ? 'bottom' : 'top');
  const bcBtn = h('button', { class: 'btn btn-ghost', style: { justifyContent: 'flex-start' } });
  const bgBtn = h('button', { class: 'btn btn-ghost', style: { justifyContent: 'flex-start' } });
  const sw = (b, c, l) => b.replaceChildren(h('span', { style: { width: '16px', height: '16px', borderRadius: '50%', background: c || 'transparent', boxShadow: 'inset 0 0 0 1px var(--line2)' } }), l);
  sw(bcBtn, bc, 'Warna garis'); sw(bgBtn, bg, 'Warna latar sel');
  const pickTo = (btn, cb) => btn.onclick = () => openMenu(btn, [{ el: palette({ value: '', reset: 'Tidak ada', onPick: v => { cb(v); closeMenus(0); } }) }], { cls: 'pop' });
  pickTo(bcBtn, v => { bc = v || '#000000'; sw(bcBtn, bc, 'Warna garis'); });
  pickTo(bgBtn, v => { bg = v || ''; sw(bgBtn, bg, 'Warna latar sel'); });
  const ok = await dialog({
    title: 'Properti tabel', width: 520,
    body: h('div', { style: { display: 'grid', gap: '14px' } },
      h('div', { class: 'grid2' }, field('Lebar tabel (%)', width), field('Perataan', alignSel)),
      h('div', { class: 'grid2' }, field('Ketebalan garis', bwSel), field('Bantalan sel (pt)', pad)),
      h('div', { class: 'grid2' }, field('Perataan vertikal sel', valign), h('div', { class: 'fx' }, h('span', { class: 'fx-l' }, 'Warna'), h('div', { class: 'row' }, bcBtn))),
      h('div', { class: 'row' }, bgBtn, h('span', { class: 'small muted' }, 'Berlaku untuk sel yang dipilih'))),
    buttons: [{ label: 'Batal', value: false }, { label: 'Terapkan', primary: true, value: true }],
  });
  if (!ok) return;
  const cellsSel = selectedCells();
  mutate(() => {
    const w = Math.max(10, Math.min(100, +width.value || 100));
    tb.style.width = w === 100 ? '' : w + '%';
    const al = alignSel.value;
    tb.style.marginLeft = al === 'center' || al === 'right' ? 'auto' : '';
    tb.style.marginRight = al === 'center' ? 'auto' : '';
    const b = +bwSel.value;
    tb.classList.toggle('nb', b === 0);
    tb.querySelectorAll('td,th').forEach(c => {
      if (c.closest('table') !== tb) return;
      c.style.borderWidth = b ? b + 'pt' : '';
      c.style.borderColor = b ? bc : '';
      c.style.padding = pad.value !== '' ? pad.value + 'pt' : '';
      c.style.verticalAlign = valign.value === 'top' ? '' : valign.value;
      if (!c.getAttribute('style')) c.removeAttribute('style');
    });
    if (bg !== null) (cellsSel.length ? cellsSel : [curCell()]).forEach(c => c && (c.style.backgroundColor = bg));
    if (!tb.getAttribute('style')) tb.removeAttribute('style');
  });
}
