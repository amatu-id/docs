// Header & footer editing in place, plus page-number presets.
import { E } from './state.js';
import { h, icon, toggle, dialog, field, select, segmented } from './ui.js';
import { renderSheets, fillFields } from './paginate.js';

export function enterHF(kind, page = 0) {
  if (E.mode === 'view' || E.doc.page.pageless) return;
  exitHF();
  const pf = E.fg.querySelector(`.pfg[data-p="${page}"]`);
  const region = pf?.querySelector(`.hf.${kind === 'header' ? 'hdr' : 'ftr'}`);
  if (!region) return;
  const inner = region.querySelector('.hf-in');
  const first = E.doc.page.firstDiff && page === 0;
  if (!inner.innerHTML.trim()) inner.innerHTML = '<p><br></p>';
  inner.contentEditable = 'true';
  region.classList.add('editing');
  E.root.classList.add('hf-mode');
  E.hfEditing = { kind, page, first, el: inner };
  const g = E.geo;
  const firstT = toggle('Halaman pertama berbeda', E.doc.page.firstDiff, v => { E.doc.page.firstDiff = v; E.changed(); exitHF(); enterHF(kind, page); });
  const bar = h('div', { class: 'hf-bar glass-strong' },
    h('span', { class: 'lbl' }, (kind === 'header' ? 'Header' : 'Footer') + (first ? ' halaman pertama' : '')),
    firstT,
    h('button', { class: 'btn-text', onclick: () => insertField('page') }, icon('tag', 'sm'), ' Nomor halaman'),
    h('button', { class: 'btn-text', onclick: () => insertField('pages') }, 'Jumlah halaman'),
    h('button', { class: 'btn-text', onclick: () => { inner.innerHTML = '<p><br></p>'; sync(); } }, 'Hapus'),
    h('button', { class: 'btn btn-primary', style: { height: '30px' }, onclick: exitHF }, 'Selesai'));
  bar.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });
  bar.style.left = g.ML + 'px';
  if (kind === 'header') bar.style.top = (g.MT + 4) + 'px'; else bar.style.bottom = (g.MB + 4) + 'px';
  pf.append(bar);
  E.hfEditing.bar = bar;
  inner.addEventListener('input', sync);
  inner.addEventListener('keydown', onKey);
  inner.focus();
  const r = document.createRange(); r.selectNodeContents(inner.lastElementChild || inner); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  E.lastEd = inner;
  setTimeout(() => document.addEventListener('mousedown', outside, true));
}
function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); exitHF(); } }
function outside(e) {
  const ed = E.hfEditing;
  if (!ed) return;
  if (ed.el.closest('.hf').contains(e.target) || ed.bar?.contains(e.target) || e.target.closest('.menu, .ed-top, .dlg-ov')) return;
  exitHF();
}
function clean(html) {
  const t = document.createElement('div');
  t.innerHTML = html;
  t.querySelectorAll('.fld').forEach(f => { f.textContent = '#'; });
  const txt = t.textContent.replace(/#/g, '').trim();
  if (!txt && !t.querySelector('.fld, img')) return '';
  return t.innerHTML;
}
function sync() {
  const ed = E.hfEditing;
  if (!ed) return;
  const html = clean(ed.el.innerHTML);
  const src = E.doc.page[ed.kind];
  if (ed.first) src.first = html; else src.html = html;
  E.changed({ noHist: true });
}
export function exitHF() {
  const ed = E.hfEditing;
  if (!ed) return;
  document.removeEventListener('mousedown', outside, true);
  sync();
  ed.el.contentEditable = 'false';
  ed.el.removeEventListener('input', sync);
  ed.el.removeEventListener('keydown', onKey);
  ed.el.closest('.hf')?.classList.remove('editing');
  ed.bar?.remove();
  E.root.classList.remove('hf-mode');
  E.hfEditing = null;
  E.lastEd = E.body;
  renderSheets(true);
}
export function insertField(f) {
  const ed = E.hfEditing;
  if (!ed) return;
  ed.el.focus();
  const s = getSelection();
  let r = s.rangeCount ? s.getRangeAt(0) : null;
  if (!r || !ed.el.contains(r.startContainer) || r.startContainer === ed.el) {
    r = document.createRange(); r.selectNodeContents(ed.el.lastElementChild || ed.el); r.collapse(false);
  }
  r.deleteContents();
  const span = h('span', { class: 'fld', dataset: { f }, contenteditable: 'false' }, '#');
  const gap = document.createTextNode('\u00a0');
  r.insertNode(gap);
  r.insertNode(span);
  span.parentElement.querySelector(':scope > br:last-child')?.remove();
  const after = document.createRange(); after.setStartAfter(gap); after.collapse(true);
  s.removeAllRanges(); s.addRange(after);
  fillFields(ed.el, ed.page);
  sync();
}

export function goHF(kind) {
  if (E.doc.page.pageless) { E.togglePageless(false); }
  const p = Math.max(0, (E.caretPage?.() ?? 0));
  const pf = E.fg.querySelector(`.pfg[data-p="${p}"]`);
  pf?.scrollIntoView({ block: kind === 'header' ? 'start' : 'end', behavior: 'smooth' });
  setTimeout(() => enterHF(kind, p), 250);
}

export async function pageNumbersDialog() {
  const pg = E.doc.page;
  let pos = 'footer', al = 'right', fmt = 'n', first = true;
  const posSeg = segmented([['header', 'Header', 'vertical_align_top'], ['footer', 'Footer', 'vertical_align_bottom']], pos, v => pos = v);
  const alSeg = segmented([['left', 'Kiri', 'format_align_left'], ['center', 'Tengah', 'format_align_center'], ['right', 'Kanan', 'format_align_right']], al, v => al = v);
  const fmtSel = select([['n', '1, 2, 3'], ['hal', 'Halaman 1'], ['of', 'Halaman 1 dari 10'], ['slash', '1 / 10']], fmt, v => fmt = v);
  const firstT = toggle('Tampilkan pada halaman pertama', first, v => first = v);
  const ok = await dialog({
    title: 'Nomor halaman', width: 460,
    body: h('div', { style: { display: 'grid', gap: '16px' } }, field('Posisi', posSeg), field('Perataan', alSeg), field('Format', fmtSel), firstT),
    buttons: [{ label: 'Hapus nomor halaman', value: 'remove' }, { spacer: true }, { label: 'Batal', value: null }, { label: 'Terapkan', primary: true, value: 'ok' }],
  });
  if (!ok) return;
  E.hist.before();
  const strip = html => { const t = document.createElement('div'); t.innerHTML = html || ''; t.querySelectorAll('p').forEach(p => { if (p.querySelector('.fld[data-f="page"]')) p.remove(); }); return t.innerHTML.trim(); };
  for (const k of ['header', 'footer']) { pg[k].html = strip(pg[k].html); pg[k].first = strip(pg[k].first); }
  if (ok === 'remove') { E.changed(); renderSheets(true); return; }
  const P = '<span class="fld" data-f="page" contenteditable="false">1</span>', N = '<span class="fld" data-f="pages" contenteditable="false">1</span>';
  const inner = fmt === 'hal' ? `Halaman ${P}` : fmt === 'of' ? `Halaman ${P} dari ${N}` : fmt === 'slash' ? `${P} / ${N}` : P;
  const line = `<p style="text-align:${al}">${inner}</p>`;
  pg[pos].html = (pg[pos].html ? pg[pos].html : '') + line;
  if (!first) { pg.firstDiff = true; }
  else if (pg.firstDiff) pg[pos].first = (pg[pos].first || '') + line;
  E.changed();
  renderSheets(true);
}
