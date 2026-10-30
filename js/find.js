// Find & replace using the CSS Custom Highlight API (no DOM changes while searching).
import { E } from './state.js';
import { h, icon, toast, debounce } from './ui.js';

const BLOCK = /^(P|H[1-6]|LI|TD|TH|BLOCKQUOTE|PRE|DIV|TR|TABLE|UL|OL|BR|HR)$/;
const st = { q: '', rep: '', cs: false, word: false, re: false, matches: [], cur: -1 };
let bar = null, qIn, rIn, cnt;
const hasHL = typeof Highlight !== 'undefined' && CSS.highlights;

function index() {
  let text = '';
  const segs = [];
  const tw = document.createTreeWalker(E.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => n.nodeType === 1 && (n.classList.contains('eq') || n.classList.contains('toc') || n.tagName === 'DEL') ? 2 : 1,
  });
  let n;
  while ((n = tw.nextNode())) {
    if (n.nodeType === 1) { if (BLOCK.test(n.tagName)) text += '\n'; continue; }
    segs.push({ n, s: text.length });
    text += n.data;
  }
  return { text, segs };
}
function locate(segs, pos, end) {
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].s <= pos - (end ? 1 : 0)) lo = m; else hi = m - 1; }
  const sg = segs[lo];
  return [sg.n, Math.min(pos - sg.s, sg.n.data.length)];
}
function pattern() {
  if (!st.q) return null;
  let src = st.re ? st.q : st.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (st.word) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
  try { return new RegExp(src, 'gu' + (st.cs ? '' : 'i')); } catch { return null; }
}
export function search(keepCur) {
  st.matches = [];
  const re = pattern();
  if (re) {
    const { text, segs } = index();
    let m;
    while ((m = re.exec(text)) && st.matches.length < 5000) {
      if (!m[0].length) { re.lastIndex++; continue; }
      if (!segs.length) break;
      const [sn, so] = locate(segs, m.index, false), [en, eo] = locate(segs, m.index + m[0].length, true);
      const r = document.createRange();
      try { r.setStart(sn, so); r.setEnd(en, eo); st.matches.push(r); } catch {}
    }
  }
  if (!keepCur || st.cur >= st.matches.length) {
    const sel = E.lastRange;
    st.cur = st.matches.length ? Math.max(0, sel ? st.matches.findIndex(r => r.compareBoundaryPoints(Range.START_TO_START, sel) >= 0) : 0) : -1;
    if (st.cur < 0 && st.matches.length) st.cur = 0;
  }
  paint();
}
function paint() {
  if (hasHL) {
    CSS.highlights.set('find', new Highlight(...st.matches));
    const cur = st.matches[st.cur];
    if (cur) CSS.highlights.set('find-cur', new Highlight(cur)); else CSS.highlights.delete('find-cur');
  }
  if (cnt) cnt.textContent = st.q ? (st.matches.length ? `${st.cur + 1} dari ${st.matches.length}` : 'Tidak ada hasil') : '';
}
function reveal() {
  const r = st.matches[st.cur];
  if (!r) return;
  const rect = r.getBoundingClientRect(), cr = E.canvas.getBoundingClientRect();
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) + 80;
  if (rect.top < cr.top + top || rect.bottom > cr.bottom - 80) E.canvas.scrollBy({ top: rect.top - cr.top - cr.height / 2.6, behavior: 'smooth' });
  if (!hasHL) { const s = getSelection(); s.removeAllRanges(); s.addRange(r.cloneRange()); }
}
export function step(d) {
  if (!st.matches.length) return;
  st.cur = (st.cur + d + st.matches.length) % st.matches.length;
  paint(); reveal();
}
export function replaceOne() {
  if (E.mode === 'view') return;
  const r = st.matches[st.cur];
  if (!r) return;
  E.hist.before();
  const txt = replacement(r.toString());
  r.deleteContents();
  if (txt) r.insertNode(document.createTextNode(txt));
  E.body.normalize();
  E.changed();
  search(true);
  reveal();
}
export function replaceAll() {
  if (E.mode === 'view') return;
  if (!st.matches.length) return;
  E.hist.before();
  const n = st.matches.length;
  for (let i = st.matches.length - 1; i >= 0; i--) {
    const r = st.matches[i];
    const txt = replacement(r.toString());
    r.deleteContents();
    if (txt) r.insertNode(document.createTextNode(txt));
  }
  E.body.normalize();
  E.changed();
  search();
  toast(`${n} kemunculan diganti`);
}
function replacement(found) {
  if (!st.re) return st.rep;
  const re = pattern();
  return re ? found.replace(new RegExp(re.source, re.flags.replace('g', '')), st.rep) : st.rep;
}

export function openFind(replace = false) {
  if (bar) { bar.classList.toggle('rep', replace || bar.classList.contains('rep')); qIn.focus(); qIn.select(); return; }
  const sel = E.range()?.toString();
  if (sel && sel.length < 100 && !sel.includes('\n')) st.q = sel;
  qIn = h('input', { class: 'tx', placeholder: 'Cari di dokumen', value: st.q, 'aria-label': 'Cari' });
  rIn = h('input', { class: 'tx', placeholder: 'Ganti dengan', value: st.rep, 'aria-label': 'Ganti dengan' });
  cnt = h('span', { class: 'cnt' });
  const run = debounce(() => { st.q = qIn.value; search(); reveal(); }, 120);
  qIn.addEventListener('input', run);
  rIn.addEventListener('input', () => { st.rep = rIn.value; });
  qIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run.now(); step(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { e.preventDefault(); closeFind(); } });
  rIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } else if (e.key === 'Escape') { e.preventDefault(); closeFind(); } });
  const opt = (k, l) => { const i = h('input', { type: 'checkbox', checked: st[k] || null }); i.onchange = () => { st[k] = i.checked; search(); }; return h('label', null, i, l); };
  bar = h('div', { class: 'findbar glass-strong refract' + (replace ? ' rep' : '') },
    h('div', { class: 'row' }, qIn, cnt,
      h('button', { class: 'ib sm', 'data-tip': 'Sebelumnya', 'data-kbd': 'Shift+Enter', onclick: () => step(-1) }, icon('keyboard_arrow_up')),
      h('button', { class: 'ib sm', 'data-tip': 'Berikutnya', 'data-kbd': 'Enter', onclick: () => step(1) }, icon('keyboard_arrow_down')),
      h('button', { class: 'ib sm', 'data-tip': 'Ganti', onclick: () => { bar.classList.toggle('rep'); (bar.classList.contains('rep') ? rIn : qIn).focus(); } }, icon('find_replace')),
      h('button', { class: 'ib sm', 'data-tip': 'Tutup', 'data-kbd': 'Escape', onclick: closeFind }, icon('close'))),
    h('div', { class: 'row rep-only' }, rIn,
      h('button', { class: 'btn btn-ghost', style: { height: '34px', padding: '0 12px' }, onclick: replaceOne }, 'Ganti'),
      h('button', { class: 'btn btn-tonal', style: { height: '34px', padding: '0 12px' }, onclick: replaceAll }, 'Ganti semua')),
    h('div', { class: 'opts rep-only' }, opt('cs', 'Cocokkan huruf besar/kecil'), opt('word', 'Kata utuh'), opt('re', 'Ekspresi reguler')));
  E.root.append(bar);
  qIn.focus(); qIn.select();
  if (st.q) { search(); reveal(); }
}
export function closeFind() {
  bar?.remove(); bar = null;
  if (hasHL) { CSS.highlights.delete('find'); CSS.highlights.delete('find-cur'); }
  const r = st.matches[st.cur];
  if (r && E.body.contains(r.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r.cloneRange()); }
  E.body?.focus({ preventScroll: true });
}
export const findOpen = () => !!bar;
export function refreshFind() { if (bar && st.q) search(true); }
