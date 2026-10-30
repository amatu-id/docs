// Pagination: pushes top-level blocks onto the next page when they would cross the bottom margin,
// then paints sheets (paper, header, footer, footnotes, watermark) behind/above the single editable body.
import { E } from './state.js';
import { h } from './ui.js';
import { paperPx, cm2px } from './docmodel.js';

const SEP_H = 14;

export function geometry() {
  const p = E.doc.page;
  const sz = paperPx(p.size);
  let PW = sz.w, PH = sz.h;
  if (p.orient === 'landscape') [PW, PH] = [PH, PW];
  const pageless = !!p.pageless && !E.printing;
  const g = {
    PW, PH, MT: cm2px(p.margins.t), MB: cm2px(p.margins.b), ML: cm2px(p.margins.l), MR: cm2px(p.margins.r),
    GAP: E.printing ? 0 : 16, HD: cm2px(p.hfDist ?? 1.27), pageless,
  };
  if (pageless) {
    const avail = Math.max(360, (E.canvas?.clientWidth || 1000) / (E.zoom || 1) - 48);
    g.PW = Math.min(avail, 1040); g.ML = g.MR = Math.min(72, g.PW * .07); g.MT = 48; g.MB = 72;
  }
  return g;
}

function units() {
  const out = [];
  for (const el of E.body.children) {
    if (el.tagName === 'UL' || el.tagName === 'OL') { for (const li of el.children) out.push(li); }
    else out.push(el);
  }
  return out;
}

const noteCache = new Map();
let measurer = null;
function noteHeights(width) {
  if (!measurer || !measurer.isConnected) { measurer = h('div', { class: 'fn-measure doc-root' }); E.pages.append(measurer); }
  measurer.style.width = width + 'px';
  const out = new Map();
  for (const [id, html] of Object.entries(E.doc.footnotes)) {
    const key = id + '|' + width + '|' + html;
    let hgt = noteCache.get(key);
    if (hgt == null) {
      measurer.innerHTML = `<div class="fn-item"><sup>0</sup><div class="fn-text">${html || '<br>'}</div></div>`;
      hgt = measurer.firstChild.offsetHeight + 2;
      noteCache.set(key, hgt);
    }
    out.set(id, hgt);
  }
  return out;
}

const hfCache = new Map();
function hfHeight(kind, width) {
  const pg = E.doc.page;
  let max = 0;
  for (const html of [pg[kind].html, pg.firstDiff ? pg[kind].first : '']) {
    if (!html) continue;
    const key = kind + width + html;
    let v = hfCache.get(key);
    if (v == null) {
      if (!measurer || !measurer.isConnected) { measurer = h('div', { class: 'fn-measure doc-root' }); E.pages.append(measurer); }
      measurer.style.width = width + 'px';
      measurer.innerHTML = `<div class="hf-in">${html}</div>`;
      v = measurer.firstChild.offsetHeight;
      hfCache.set(key, v);
    }
    max = Math.max(max, v);
  }
  return max;
}

export function paginateNow() {
  if (!E.doc || !E.body) return;
  const g = E.geo = geometry();
  if (!g.pageless) {
    const w = g.PW - g.ML - g.MR;
    const hh = hfHeight('header', w), fh = hfHeight('footer', w);
    if (hh) g.MT = Math.max(g.MT, g.HD + hh + 10);
    if (fh) g.MB = Math.max(g.MB, g.HD + fh + 10);
  }
  const body = E.body;
  body.style.width = g.PW + 'px';
  body.style.padding = `${g.MT}px ${g.MR}px ${g.MB}px ${g.ML}px`;
  E.pages.style.width = g.PW + 'px';
  for (const el of body.querySelectorAll('[style*="--pg"]')) {
    el.style.removeProperty('--pg');
    if (!el.getAttribute('style')) el.removeAttribute('style');
  }
  E.fnOrder = [...body.querySelectorAll('sup.fn')].map(s => s.dataset.fn);
  const pageOf = new Map();
  if (g.pageless) {
    body.style.minHeight = '';
    E.pageCount = 1; E.pageOf = pageOf; E.pageNotes = [E.fnOrder.slice()];
    renderSheets();
    return;
  }
  const step = g.PH + g.GAP;
  const cTop = p => p * step + g.MT;
  const cBot = p => p * step + g.PH - g.MB;
  const nh = E.fnOrder.length ? noteHeights(g.PW - g.ML - g.MR) : new Map();
  const notes = [[]];
  let p = 0, reserve = 0, force = false;
  const shift = (el, target) => {
    for (let k = 0; k < 3; k++) {
      const d = target - el.offsetTop;
      if (Math.abs(d) < .5) break;
      const cur = parseFloat(el.style.getPropertyValue('--pg')) || 0;
      el.style.setProperty('--pg', (cur + d) + 'px');
    }
  };
  const newPage = q => { p = q; reserve = 0; notes[p] ||= []; };

  for (const el of units()) {
    if (el.tagName === 'HR' && el.classList.contains('pb')) { pageOf.set(el, p); force = true; continue; }
    let top = el.offsetTop;
    const hgt = el.offsetHeight;
    const sp = Math.floor(top / step);
    if (sp > p) newPage(sp);
    const fns = el.querySelector ? [...el.querySelectorAll('sup.fn')].map(s => s.dataset.fn) : [];
    const fnH = (pg) => fns.length ? fns.reduce((a, id) => a + (nh.get(id) || 0), 0) + (notes[pg]?.length ? 0 : SEP_H) : 0;
    if (force || (top + hgt > cBot(p) - reserve - fnH(p) && top > cTop(p) + 1)) newPage(p + 1);
    force = false;
    if (top < cTop(p)) { shift(el, cTop(p)); top = el.offsetTop; }
    pageOf.set(el, p);
    if (fns.length) { reserve += fnH(p); notes[p].push(...fns); }
    const endP = Math.floor((top + hgt - 1) / step);
    if (endP > p) newPage(endP);
  }
  if (force) newPage(p + 1);
  E.pageCount = p + 1;
  E.pageOf = pageOf;
  E.pageNotes = notes;
  body.style.minHeight = (E.pageCount * step - g.GAP) + 'px';
  renderSheets();
}

function fieldValue(f, i) {
  if (f === 'page') return String(i + 1);
  if (f === 'pages') return String(E.pageCount);
  if (f === 'title') return E.doc.title || '';
  if (f === 'date') return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return '';
}
export function fillFields(el, i) { el.querySelectorAll('.fld').forEach(x => { x.textContent = fieldValue(x.dataset.f, i); x.contentEditable = 'false'; }); }

export function hfHtml(kind, i) {
  const pg = E.doc.page, src = pg[kind];
  return pg.firstDiff && i === 0 ? (src.first || '') : (src.html || '');
}

let lastSig = '';
export function renderSheets(force = false) {
  const g = E.geo, d = E.doc, pg = d.page;
  const n = g.pageless ? 1 : E.pageCount;
  const step = g.PH + g.GAP;
  const totalH = g.pageless ? Math.max(E.body.offsetHeight, (E.canvas.clientHeight / E.zoom) - 120) : n * step - g.GAP;
  E.pages.style.height = totalH + 'px';
  const editing = E.hfEditing;
  const sig = JSON.stringify([n, g, pg.header, pg.footer, pg.firstDiff, pg.color, pg.wm, pg.border, d.title, E.pageNotes, d.footnotes, E.fnOrder, editing?.page, editing?.kind]);
  if (sig === lastSig && !force && E.bg.childElementCount === n) { E.layout?.(); return; }
  lastSig = sig;

  // Paper layer
  const bg = E.bg;
  while (bg.childElementCount > n) bg.lastChild.remove();
  while (bg.childElementCount < n) bg.append(h('div', { class: 'sheet' }));
  [...bg.children].forEach((s, i) => {
    s.style.top = i * step + 'px';
    s.style.width = g.PW + 'px';
    s.style.height = (g.pageless ? totalH : g.PH) + 'px';
    s.style.background = pg.color || '#fff';
    s.replaceChildren();
    if (pg.wm && !g.pageless) s.append(watermark(pg.wm));
    if (pg.border && !g.pageless) {
      const b = pg.border, o = b.offset ?? 24;
      s.append(h('div', { class: 'pborder', style: { inset: o + 'px', border: `${b.w || 1}px ${b.style || 'solid'} ${b.color || '#000'}` } }));
    }
  });

  // Foreground layer: header, footer, footnotes
  const fg = E.fg;
  const keep = editing?.el?.isConnected ? editing.el.closest('.pfg') : null;
  const activeNote = document.activeElement?.closest?.('.fn-text') ? document.activeElement : null;
  [...fg.children].forEach(c => { if (c !== keep && !(activeNote && c.contains(activeNote))) c.remove(); });
  for (let i = 0; i < n; i++) {
    const existing = [...fg.children].find(c => +c.dataset.p === i);
    if (existing) { existing.style.top = i * step + 'px'; positionNotes(existing, i); continue; }
    const pf = h('div', { class: 'pfg', dataset: { p: i }, style: { position: 'absolute', left: 0, top: i * step + 'px', width: g.PW + 'px', height: g.PH + 'px' } });
    if (!g.pageless) {
      const hdr = h('div', { class: 'hf hdr', dataset: { kind: 'header', p: i }, style: { height: g.MT + 'px', padding: `${g.HD}px ${g.MR}px 0 ${g.ML}px` } }, h('div', { class: 'hf-in doc-root', html: hfHtml('header', i) }));
      const ftr = h('div', { class: 'hf ftr', dataset: { kind: 'footer', p: i }, style: { height: g.MB + 'px', padding: `0 ${g.MR}px ${g.HD}px ${g.ML}px` } }, h('div', { class: 'hf-in doc-root', html: hfHtml('footer', i) }));
      fillFields(hdr, i); fillFields(ftr, i);
      pf.append(hdr, ftr);
    }
    positionNotes(pf, i);
    fg.append(pf);
  }
  [...fg.children].sort((a, b) => a.dataset.p - b.dataset.p).forEach(c => fg.append(c));
  E.layout?.();
}

function positionNotes(pf, i) {
  const g = E.geo;
  const ids = E.pageNotes[i] || [];
  let box = pf.querySelector('.fnotes');
  const sig = ids.map(id => id + ':' + E.fnOrder.indexOf(id)).join(',');
  if (!ids.length) { box?.remove(); return; }
  if (box && box.dataset.sig === sig) { box.style.bottom = (g.pageless ? 24 : g.MB) + 'px'; return; }
  if (box && box.contains(document.activeElement)) return;
  box?.remove();
  box = h('div', { class: 'fnotes doc-root', dataset: { sig }, style: { left: g.ML + 'px', right: g.MR + 'px', bottom: (g.pageless ? 24 : g.MB) + 'px' } }, h('div', { class: 'sep' }));
  for (const id of ids) {
    const num = E.fnOrder.indexOf(id) + 1;
    const txt = h('div', { class: 'fn-text', contenteditable: E.mode === 'view' ? 'false' : 'true', dataset: { fn: id }, html: E.doc.footnotes[id] || '' });
    box.append(h('div', { class: 'fn-item' }, h('sup', null, String(num)), txt));
  }
  if (g.pageless) { box.style.position = 'relative'; }
  pf.append(box);
}

function watermark(wm) {
  const box = h('div', { class: 'wm' });
  if (wm.type === 'image' && wm.asset) {
    box.append(h('img', { src: E.assetURL(wm.asset), style: { opacity: wm.opacity ?? .25, width: (wm.scale || 60) + '%', objectFit: 'contain' } }));
  } else if (wm.text) {
    box.append(h('span', { style: { fontSize: (wm.size || 72) + 'pt', color: wm.color || '#9aa0a6', opacity: wm.opacity ?? .3, transform: wm.diag === false ? 'none' : 'rotate(-45deg)', fontFamily: wm.font || 'Arial, sans-serif' } }, wm.text));
  }
  return box;
}

// Page index (0-based) for a y coordinate in page space.
export function pageAtY(y) {
  const g = E.geo;
  if (!g || g.pageless) return 0;
  return Math.max(0, Math.min(E.pageCount - 1, Math.floor(y / (g.PH + g.GAP))));
}
export function caretPage() {
  const s = getSelection();
  if (!s.rangeCount || !E.body.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0);
  let rect = r.getClientRects()[0] || (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).getBoundingClientRect();
  const pr = E.pages.getBoundingClientRect();
  return pageAtY((rect.top - pr.top) / E.zoom);
}
