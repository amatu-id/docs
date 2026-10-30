// Text and paragraph formatting.
import { E } from './state.js';
import { h, toast, toHex } from './ui.js';
import { fontCss, fontNameOf, ensureFont } from './fonts.js';
import { Prefs, savePrefs } from './state.js';

export const LEAF = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE']);
export const SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96];
const RETAG = new WeakMap();

export function editRoot(n) {
  const el = n?.nodeType === 1 ? n : n?.parentElement;
  return el?.closest?.('.doc-body, .hf-in, .fn-text') || null;
}
export function blockOf(node) {
  const root = editRoot(node);
  let n = node?.nodeType === 1 ? node : node?.parentElement;
  while (n && n !== root) {
    if (LEAF.has(n.tagName)) return n;
    if (n.tagName === 'DIV' && n.parentElement === root) return n;
    n = n.parentElement;
  }
  return null;
}
export function selBlocks() {
  const r = E.range();
  if (!r) return [];
  const root = editRoot(r.startContainer);
  if (!root) return [];
  const a = blockOf(r.startContainer), b = blockOf(r.endContainer);
  if (!a) return [];
  const out = [a];
  if (a === b || !b) return out;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, { acceptNode: n => LEAF.has(n.tagName) ? 1 : 3 });
  tw.currentNode = a;
  let n;
  while ((n = tw.nextNode())) { out.push(n); if (n === b) break; }
  return out;
}
export function topBlocks() {
  const set = new Set();
  for (const b of selBlocks()) {
    let n = b;
    while (n.parentElement && n.parentElement !== E.body && !n.parentElement.classList.contains('cols')) n = n.parentElement;
    if (n.parentElement) set.add(n);
  }
  return [...set];
}
export function inTag(tag) {
  const r = E.range();
  if (!r) return null;
  const el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  const root = editRoot(el);
  const t = el?.closest(tag);
  return t && root?.contains(t) ? t : null;
}

export function retag(el, tag) {
  const n = document.createElement(tag);
  for (const a of el.attributes) n.setAttribute(a.name, a.value);
  while (el.firstChild) n.append(el.firstChild);
  el.replaceWith(n);
  RETAG.set(el, n);
  return n;
}
// Runs a DOM mutation as one undo step, keeping the caret on the same text nodes.
export function mutate(fn) {
  if (!E.canEdit()) return;
  E.restoreSel();
  const s = getSelection();
  const sv = s.rangeCount ? [s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset] : null;
  E.hist.before();
  const res = fn();
  if (sv) {
    const fix = n => n?.isConnected ? n : RETAG.get(n) || null;
    const a = fix(sv[0]), f = fix(sv[2]);
    if (a && f) try { s.setBaseAndExtent(a, Math.min(sv[1], maxOff(a)), f, Math.min(sv[3], maxOff(f))); } catch {}
  }
  E.changed();
  E.updateToolbar();
  return res;
}
const maxOff = n => n.nodeType === 3 ? n.data.length : n.childNodes.length;

/* ---- Paragraph styles ---- */
const STCLS = ['title', 'subtitle', 'st-title', 'st-subtitle', 'st-h1', 'st-h2', 'st-h3', 'st-h4', 'st-h5', 'st-h6'];
export function setStyle(key) {
  mutate(() => {
    for (const b of selBlocks()) {
      if (b.tagName === 'LI') { b.classList.remove(...STCLS); if (key !== 'normal' && key !== 'quote' && key !== 'code') b.classList.add('st-' + key); if (!b.className) b.removeAttribute('class'); continue; }
      if (b.tagName === 'DIV') continue;
      const tag = /^h\d$/.test(key) ? key.toUpperCase() : key === 'quote' ? 'BLOCKQUOTE' : key === 'code' ? 'PRE' : 'P';
      const el = b.tagName === tag ? b : retag(b, tag);
      el.classList.remove(...STCLS);
      if (key === 'title' || key === 'subtitle') el.classList.add(key);
      if (!el.className) el.removeAttribute('class');
    }
  });
}
export function currentStyle() {
  const r = E.range();
  const b = r && blockOf(r.startContainer);
  if (!b) return 'normal';
  if (b.tagName === 'LI') { const c = [...b.classList].find(x => x.startsWith('st-')); return c ? c.slice(3) : 'normal'; }
  if (/^H\d$/.test(b.tagName)) return b.tagName.toLowerCase();
  if (b.tagName === 'BLOCKQUOTE') return 'quote';
  if (b.tagName === 'PRE') return 'code';
  if (b.classList.contains('title')) return 'title';
  if (b.classList.contains('subtitle')) return 'subtitle';
  return 'normal';
}
// "Update Heading 1 to match": capture the formatting at the caret into the document style.
export function updateStyleFromSelection(key) {
  const r = E.range();
  if (!r) return;
  let el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  if (r.startContainer.nodeType === 1 && r.startContainer.childNodes[r.startOffset]?.nodeType === 1) el = r.startContainer.childNodes[r.startOffset];
  const cs = getComputedStyle(el);
  const blk = blockOf(r.startContainer);
  const bcs = blk ? getComputedStyle(blk) : cs;
  const s = E.doc.styles[key] ||= {};
  s.font = fontNameOf(cs.fontFamily);
  s.size = Math.round(parseFloat(cs.fontSize) * .75 * 2) / 2;
  s.color = toHex(cs.color);
  s.bold = parseInt(cs.fontWeight) >= 600;
  s.italic = cs.fontStyle === 'italic';
  const lh = parseFloat(bcs.lineHeight) / parseFloat(bcs.fontSize);
  if (isFinite(lh)) s.lh = Math.round(lh * 100) / 100;
  E.hist.before();
  E.applyDocStyles();
  E.changed();
  toast(`Gaya "${key === 'normal' ? 'Teks normal' : key.toUpperCase().replace('H', 'Heading ')}" diperbarui`);
}

/* ---- Inline ---- */
export function setFontSize(pt) {
  if (!E.canEdit()) return;
  pt = Math.max(1, Math.min(400, Math.round(pt * 2) / 2));
  E.restoreSel();
  const r = E.range();
  if (!r) return;
  E.hist.before();
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  document.execCommand('styleWithCSS', false, true);
  if (r.collapsed) { E.pendingSize = pt; E.updateToolbar({ size: pt }); return; }
  convertFont7(pt, false);
  E.changed();
  E.updateToolbar();
}
export function convertFont7(pt, collapseEnd) {
  const fonts = E.root.querySelectorAll('font[size="7"]');
  if (!fonts.length) return false;
  let first = null, last = null;
  fonts.forEach(f => {
    const sp = document.createElement('span');
    sp.style.fontSize = pt + 'pt';
    if (f.color) sp.style.color = f.color;
    if (f.face) sp.style.fontFamily = f.face;
    while (f.firstChild) sp.append(f.firstChild);
    f.replaceWith(sp);
    sp.querySelectorAll('[style]').forEach(x => { x.style.fontSize = ''; if (!x.getAttribute('style')) x.removeAttribute('style'); });
    sp.querySelectorAll('font[size]').forEach(x => x.removeAttribute('size'));
    first ||= sp; last = sp;
  });
  const s = getSelection(), r = document.createRange();
  if (collapseEnd) { const t = last.lastChild; if (t?.nodeType === 3) r.setStart(t, t.data.length); else r.setStart(last, last.childNodes.length); r.collapse(true); }
  else { r.setStartBefore(first); r.setEndAfter(last); }
  s.removeAllRanges(); s.addRange(r);
  return true;
}
export function currentSize() {
  if (E.pendingSize) return E.pendingSize;
  const el = anchorEl();
  return el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * .75 * 2) / 2 : 11;
}
export function stepSize(dir) {
  const c = currentSize();
  const next = dir > 0 ? (SIZES.find(s => s > c) ?? c + 12) : ([...SIZES].reverse().find(s => s < c) ?? Math.max(1, c - 1));
  setFontSize(next);
}
export function setFont(name) {
  ensureFont(name);
  E.exec('fontName', fontCss(name));
  Prefs.recentFonts = [name, ...Prefs.recentFonts.filter(f => f !== name)].slice(0, 5);
  savePrefs();
}
export function currentFont() {
  const el = anchorEl();
  return el ? fontNameOf(getComputedStyle(el).fontFamily) : 'Arial';
}
export function anchorEl() {
  const r = E.range();
  if (!r) return null;
  let n = r.startContainer;
  if (n.nodeType === 1 && n.childNodes[r.startOffset]) { const c = n.childNodes[r.startOffset]; n = c.nodeType === 1 ? c : n; }
  return n.nodeType === 1 ? n : n.parentElement;
}

export function changeCase(kind) {
  const r = E.range();
  if (!r || r.collapsed) { toast('Pilih teks terlebih dahulu'); return; }
  mutate(() => {
    const nodes = textNodesIn(r);
    let sentenceStart = true;
    for (const n of nodes) {
      const s = n === r.startContainer ? r.startOffset : 0, e = n === r.endContainer ? r.endOffset : n.data.length;
      let t = n.data.slice(s, e);
      if (kind === 'lower') t = t.toLocaleLowerCase('id');
      else if (kind === 'upper') t = t.toLocaleUpperCase('id');
      else if (kind === 'title') t = t.toLocaleLowerCase('id').replace(/(^|[\s(\[{"'“‘-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('id'));
      else if (kind === 'sentence') {
        t = [...t.toLocaleLowerCase('id')].map(ch => {
          if (sentenceStart && /\p{L}/u.test(ch)) { sentenceStart = false; return ch.toLocaleUpperCase('id'); }
          if (/[.!?]/.test(ch)) sentenceStart = true;
          return ch;
        }).join('');
      }
      n.replaceData(s, e - s, t);
    }
  });
}

export function clearFormatting() {
  if (!E.canEdit()) return;
  E.restoreSel();
  const r = E.range();
  if (!r) return;
  E.hist.before();
  document.execCommand('removeFormat');
  document.execCommand('unlink');
  const root = editRoot(r.commonAncestorContainer) || E.body;
  for (const el of [...root.querySelectorAll('span, font, b, strong, i, em, u, s, strike, sup, sub, mark, code')]) {
    if (!r.intersectsNode(el) || el.closest('.cmt, ins.sg, del.sg') === el || el.classList.contains('fld') || el.classList.contains('eq') || el.classList.contains('chip') || el.classList.contains('cmt') || el.classList.contains('fn') || el.classList.contains('bm')) continue;
    const full = r.toString().includes(el.textContent) || el.contains(r.startContainer) && el.contains(r.endContainer);
    if (!full) continue;
    el.replaceWith(...el.childNodes);
  }
  E.pendingSize = null;
  E.changed();
  E.updateToolbar();
}

/* ---- Paint format ---- */
export function capturePaint(sticky) {
  const el = anchorEl();
  if (!el) return;
  const cs = getComputedStyle(el);
  E.paint = {
    sticky,
    bold: parseInt(cs.fontWeight) >= 600, italic: cs.fontStyle === 'italic',
    underline: /underline/.test(cs.textDecorationLine), strike: /line-through/.test(cs.textDecorationLine),
    color: toHex(cs.color), bg: inlineBg(el), size: Math.round(parseFloat(cs.fontSize) * .75 * 2) / 2, font: cs.fontFamily,
  };
  E.root.classList.add('painting');
  E.body.style.cursor = 'copy';
  E.updateToolbar();
}
function inlineBg(el) {
  for (let n = el; n && !LEAF.has(n.tagName) && n !== E.body; n = n.parentElement) {
    const b = getComputedStyle(n).backgroundColor;
    if (b && toHex(b) !== 'transparent' && b !== 'rgba(0, 0, 0, 0)') return toHex(b);
  }
  return null;
}
export function applyPaint() {
  const p = E.paint, r = E.range();
  if (!p || !r || r.collapsed) return;
  E.hist.before();
  document.execCommand('removeFormat');
  document.execCommand('styleWithCSS', false, true);
  if (p.bold) document.execCommand('bold');
  if (p.italic) document.execCommand('italic');
  if (p.underline) document.execCommand('underline');
  if (p.strike) document.execCommand('strikeThrough');
  document.execCommand('foreColor', false, p.color);
  if (p.bg) document.execCommand('hiliteColor', false, p.bg);
  document.execCommand('fontName', false, p.font);
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  document.execCommand('styleWithCSS', false, true);
  convertFont7(p.size, false);
  if (!p.sticky) endPaint();
  E.changed();
}
export function endPaint() { E.paint = null; E.root?.classList.remove('painting'); if (E.body) E.body.style.cursor = ''; E.updateToolbar?.(); }

/* ---- Lists ---- */
export function toggleList(kind) {
  if (!E.canEdit()) return;
  const ul = inTag('ul'), ol = inTag('ol');
  const cur = (ul && ol) ? (ul.contains(ol) ? ol : ul) : (ul || ol);
  if (kind === 'check') {
    if (cur?.tagName === 'UL' && cur.classList.contains('checklist')) return E.exec('insertUnorderedList');
    if (cur?.tagName === 'UL') return mutate(() => cur.classList.add('checklist'));
    E.exec(cur?.tagName === 'OL' ? 'insertOrderedList' : null);
    E.exec('insertUnorderedList');
    const u = inTag('ul');
    if (u) { u.classList.add('checklist'); E.changed(); }
    return;
  }
  if (kind === 'bullet') {
    if (cur?.tagName === 'UL' && cur.classList.contains('checklist')) return mutate(() => { cur.classList.remove('checklist'); cur.querySelectorAll('li').forEach(li => li.removeAttribute('data-checked')); if (!cur.className) cur.removeAttribute('class'); });
    return E.exec('insertUnorderedList');
  }
  return E.exec('insertOrderedList');
}
export function setListStyle(kind, style) {
  if (!E.canEdit()) return;
  let list = inTag(kind === 'bullet' ? 'ul' : 'ol');
  if (!list || list.classList.contains('checklist')) { toggleList(kind); list = inTag(kind === 'bullet' ? 'ul' : 'ol'); }
  if (!list) return;
  mutate(() => { list.style.listStyleType = style; });
}
export function restartNumbering() {
  const ol = inTag('ol');
  if (!ol) return;
  mutate(() => ol.setAttribute('start', '1'));
}

/* ---- Paragraph ---- */
const INDENT = 48;
export function indent(dir) {
  if (!E.canEdit()) return;
  if (inTag('li')) return E.exec(dir > 0 ? 'indent' : 'outdent');
  mutate(() => {
    for (const b of selBlocks()) {
      if (b.closest('td,th') && dir > 0 && false) continue;
      const cur = parseFloat(b.style.marginLeft) || 0;
      const v = Math.max(0, Math.round((cur + dir * INDENT) / INDENT) * INDENT);
      b.style.marginLeft = v ? v + 'px' : '';
      if (!b.getAttribute('style')) b.removeAttribute('style');
    }
  });
}
export function setLineHeight(v) {
  mutate(() => { for (const b of selBlocks()) { b.style.lineHeight = v ? String(v) : ''; if (!b.getAttribute('style')) b.removeAttribute('style'); } });
}
export function currentLineHeight() {
  const b = blockOf(E.range()?.startContainer);
  if (!b) return null;
  if (b.style.lineHeight) return parseFloat(b.style.lineHeight);
  const n = E.doc.styles?.normal?.lh ?? 1.15;
  return n;
}
export function setSpace(which, pt) {
  mutate(() => {
    for (const b of selBlocks()) {
      const k = which === 'before' ? '--sb' : '--sa';
      if (pt == null) b.style.removeProperty(k); else b.style.setProperty(k, pt + 'pt');
      if (!b.getAttribute('style')) b.removeAttribute('style');
    }
  });
}
export function hasSpace(which) {
  const b = blockOf(E.range()?.startContainer);
  if (!b) return false;
  const v = b.style.getPropertyValue(which === 'before' ? '--sb' : '--sa');
  if (v) return parseFloat(v) > 0;
  const cs = getComputedStyle(b);
  return parseFloat(which === 'before' ? cs.marginTop : cs.marginBottom) > 1;
}
export function setIndentPx({ left, right, first }) {
  mutate(() => {
    for (const b of selBlocks()) {
      if (left != null) b.style.marginLeft = left ? left + 'px' : '';
      if (right != null) b.style.marginRight = right ? right + 'px' : '';
      if (first != null) b.style.textIndent = first ? first + 'px' : '';
      if (!b.getAttribute('style')) b.removeAttribute('style');
    }
  });
}
export function align(a) {
  const map = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' };
  E.exec(map[a]);
}
export function currentAlign() {
  const b = blockOf(E.range()?.startContainer);
  if (!b) return 'left';
  const a = getComputedStyle(b).textAlign;
  return a === 'center' ? 'center' : a === 'right' || a === 'end' ? 'right' : a === 'justify' ? 'justify' : 'left';
}

export function setColumns(n) {
  const blocks = topBlocks();
  if (!blocks.length) return;
  mutate(() => {
    const ex = blocks[0].parentElement?.classList.contains('cols') ? blocks[0].parentElement : null;
    if (ex) { if (n <= 1) ex.replaceWith(...ex.childNodes); else ex.style.columnCount = n; return; }
    if (n <= 1) return;
    const wrap = h('div', { class: 'cols', style: { columnCount: n } });
    blocks[0].before(wrap);
    blocks.forEach(b => wrap.append(b));
  });
}
export function currentColumns() {
  const b = blockOf(E.range()?.startContainer);
  const c = b?.closest('.cols');
  return c ? +c.style.columnCount || 2 : 1;
}

export function toggleDropCap() {
  const b = selBlocks().find(x => x.tagName === 'P');
  if (!b) { toast('Drop cap hanya untuk paragraf teks normal'); return; }
  mutate(() => b.classList.toggle('dropcap'));
}
export function sortBlocks(dir) {
  const blocks = topBlocks();
  if (blocks.length < 2) { toast('Pilih beberapa paragraf untuk diurutkan'); return; }
  mutate(() => {
    const anchor = blocks[0].previousSibling, parent = blocks[0].parentElement;
    const sorted = [...blocks].sort((a, b) => a.textContent.localeCompare(b.textContent, 'id', { numeric: true }) * dir);
    let ref = anchor ? anchor.nextSibling : parent.firstChild;
    for (const b of sorted) { parent.insertBefore(b, ref); ref = b.nextSibling; }
  });
}
export function setBlockBorder(o) {
  mutate(() => {
    for (const b of selBlocks()) {
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) b.style['border' + side] = '';
      b.style.padding = ''; b.style.backgroundColor = '';
      const bd = `${o.width}pt ${o.style} ${o.color}`;
      if (o.sides.includes('all')) b.style.border = bd;
      else o.sides.forEach(s => b.style['border' + s[0].toUpperCase() + s.slice(1)] = bd);
      if (o.sides.length) b.style.padding = o.pad + 'pt';
      if (o.shade) b.style.backgroundColor = o.shade;
      if (!b.getAttribute('style')) b.removeAttribute('style');
    }
  });
}

/* ---- Selection text helpers ---- */
export function textNodesIn(range) {
  const root = range.commonAncestorContainer;
  if (root.nodeType === 3) return [root];
  const out = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => range.intersectsNode(n) ? 1 : 2 });
  while (tw.nextNode()) out.push(tw.currentNode);
  return out;
}
const SKIP_PARENT = /^(TABLE|TBODY|THEAD|TFOOT|TR|UL|OL|COLGROUP)$/;
export function wrapRange(range, mk, filter) {
  const out = [];
  const items = textNodesIn(range).map(n => [n, n === range.startContainer ? range.startOffset : 0, n === range.endContainer ? range.endOffset : n.data.length]);
  for (let [n, s, e] of items) {
    if (s >= e || SKIP_PARENT.test(n.parentNode?.nodeName || '')) continue;
    if (filter && !filter(n)) continue;
    if (e < n.data.length) n.splitText(e);
    if (s > 0) n = n.splitText(s);
    const w = mk();
    n.parentNode.insertBefore(w, n);
    w.append(n);
    out.push(w);
  }
  return out;
}
export const unwrap = el => el.replaceWith(...el.childNodes);
