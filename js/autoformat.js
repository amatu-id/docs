// As-you-type formatting: Markdown shortcuts, smart quotes, autocorrect, autolinks.
import { E, Prefs } from './state.js';
import { blockOf, setStyle, toggleList } from './format.js';

const REPL = [['--', '—'], ['->', '→'], ['<-', '←'], ['=>', '⇒'], ['(c)', '©'], ['(C)', '©'], ['(r)', '®'], ['(R)', '®'], ['(tm)', '™'], ['(TM)', '™'], ['1/2', '½'], ['1/4', '¼'], ['3/4', '¾'], ['...', '…'], ['!=', '≠'], ['<=', '≤'], ['>=', '≥'], ['+-', '±']];

function caretInfo() {
  const s = getSelection();
  if (!s.rangeCount || !s.isCollapsed) return null;
  const node = s.anchorNode, off = s.anchorOffset;
  const blk = blockOf(node);
  if (!blk || !E.body.contains(blk)) return null;
  const r = document.createRange();
  r.selectNodeContents(blk);
  r.setEnd(node, off);
  return { s, node, off, blk, before: r.toString() };
}
function clearPrefix(blk, len) {
  const r = document.createRange();
  r.selectNodeContents(blk);
  const tw = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT);
  let n, left = len, end = null;
  while ((n = tw.nextNode())) { if (n.data.length >= left) { end = [n, left]; break; } left -= n.data.length; }
  if (!end) return;
  r.setEnd(end[0], end[1]);
  r.deleteContents();
  if (!blk.textContent && !blk.querySelector('br,img')) blk.append(document.createElement('br'));
  const s = getSelection();
  const first = blk.firstChild;
  if (first?.nodeType === 3) s.collapse(first, 0); else s.collapse(blk, 0);
}

export function onSpace() {
  const c = caretInfo();
  if (!c) return;
  const { blk, before } = c;
  if (Prefs.autoList && blk.tagName === 'P' && blk.parentElement === E.body) {
    let m;
    if ((m = before.match(/^(#{1,6}) $/))) { clearPrefix(blk, m[0].length); setStyle('h' + m[1].length); return; }
    if (/^[-*•] $/.test(before)) { clearPrefix(blk, 2); toggleList('bullet'); return; }
    if (/^(\[\]|\[ \]) $/.test(before)) { clearPrefix(blk, before.length); toggleList('check'); return; }
    if ((m = before.match(/^(1|a|A|i|I)[.)] $/))) {
      clearPrefix(blk, m[0].length);
      toggleList('number');
      const ol = getSelection().anchorNode && (getSelection().anchorNode.nodeType === 1 ? getSelection().anchorNode : getSelection().anchorNode.parentElement).closest('ol');
      const t = { a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' }[m[1]];
      if (ol && t) ol.style.listStyleType = t;
      return;
    }
    if (/^> $/.test(before)) { clearPrefix(blk, 2); setStyle('quote'); return; }
  }
  const { node, off } = c;
  if (node.nodeType !== 3) return;
  const text = node.data.slice(0, off - 1);
  if (Prefs.autoCorrect) {
    for (const [a, b] of REPL) {
      if (text.endsWith(a) && !(a === '--' && text.endsWith('---'))) {
        node.replaceData(off - 1 - a.length, a.length, b);
        c.s.collapse(node, off - a.length + b.length);
        return;
      }
    }
  }
  if (Prefs.autoLink && !node.parentElement.closest('a')) {
    const m = text.match(/(?:^|\s)((?:https?:\/\/|www\.)[^\s<>"]+\.[^\s<>"]+)$/);
    if (m) {
      const url = m[1].replace(/[.,;:!?)]+$/, '');
      const start = off - 1 - m[1].length;
      const r = document.createRange();
      r.setStart(node, start); r.setEnd(node, start + url.length);
      const a = document.createElement('a');
      a.href = url.startsWith('www.') ? 'https://' + url : url;
      try { r.surroundContents(a); } catch { return; }
      const after = a.nextSibling;
      if (after?.nodeType === 3) c.s.collapse(after, Math.min(after.length, 1 + (m[1].length - url.length)));
    }
  }
}

// Called on Enter before the browser splits the block. Returns true when handled.
export function onEnter(e) {
  const c = caretInfo();
  if (!c) return false;
  const { blk, before } = c;
  if (Prefs.autoList && blk.tagName === 'P' && blk.parentElement === E.body && /^(-{3,}|_{3,}|\*{3,})$/.test(before.trim()) && blk.textContent.trim() === before.trim()) {
    e.preventDefault();
    E.hist.before();
    const hr = document.createElement('hr');
    const p = document.createElement('p'); p.innerHTML = '<br>';
    blk.replaceWith(hr, p);
    getSelection().collapse(p, 0);
    E.changed();
    return true;
  }
  return false;
}

export function smartQuote(ch) {
  const c = caretInfo();
  const prev = c?.before.slice(-1) || '';
  const open = !prev || /[\s(\[{“‘—–-]/.test(prev);
  if (ch === '"') return open ? '“' : '”';
  return open ? '‘' : '’';
}

export function fixAfterParagraph() {
  const s = getSelection();
  const li = blockOf(s.anchorNode);
  if (li?.tagName === 'LI' && li.parentElement?.classList.contains('checklist')) li.removeAttribute('data-checked');
  if (li && li.tagName !== 'LI') { li.classList.remove('dropcap'); if (!li.className) li.removeAttribute('class'); }
  const blk = li;
  if (blk && blk.id && E.body.querySelectorAll('#' + CSS.escape(blk.id)).length > 1) blk.removeAttribute('id');
}
