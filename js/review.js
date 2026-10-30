// Review: comments anchored to text, and suggesting mode (tracked insertions/deletions).
import { E, Prefs, savePrefs, me } from './state.js';
import { h, icon, avatar, fmtWhen, fmtFull, toast, openMenu, toggleMenu, uid, ask, esc } from './ui.js';
import { wrapRange, textNodesIn, unwrap } from './format.js';

const cards = new Map();

/* ---------------- Comments ---------------- */
export async function addComment() {
  E.restoreSel();
  const s = getSelection();
  let r = E.range();
  if (!r || !E.body.contains(r.commonAncestorContainer)) { toast('Tempatkan kursor pada isi dokumen terlebih dahulu'); return; }
  if (r.collapsed) {
    s.modify('move', 'backward', 'word'); s.modify('extend', 'forward', 'word');
    r = s.getRangeAt(0);
    if (r.collapsed || !r.toString().trim()) { toast('Pilih teks yang ingin dikomentari'); return; }
  }
  if (!Prefs.name) {
    const n = await ask({ title: 'Nama Anda', label: 'Nama ini ditampilkan pada komentar dan saran yang Anda buat.', placeholder: 'Nama lengkap', ok: 'Simpan' });
    if (n?.trim()) { Prefs.name = n.trim(); savePrefs(); E.refreshAvatar?.(); }
    E.restoreSel();
    r = E.range();
  }
  if (E.draft) cancelDraft();
  const quote = r.toString().slice(0, 240);
  const id = 'c' + uid(7);
  E.hist.before();
  const spans = wrapRange(r, () => h('span', { class: 'cmt', dataset: { c: id } }));
  if (!spans.length) { toast('Teks ini tidak dapat dikomentari'); return; }
  s.removeAllRanges();
  E.draft = { id, quote };
  E.activeC = id;
  E.changed();
  if (!E.view.cmtFits) E.openPanel('comments');
  renderCards();
  requestAnimationFrame(() => (cards.get(id)?.querySelector('textarea') || document.querySelector(`.side [data-draft] textarea`))?.focus());
}
function cancelDraft() {
  const d = E.draft;
  if (!d) return;
  E.body.querySelectorAll(`.cmt[data-c="${d.id}"]`).forEach(unwrap);
  E.draft = null;
  cards.get(d.id)?.remove(); cards.delete(d.id);
  E.changed();
}
function postDraft(text) {
  const d = E.draft;
  if (!d || !text.trim()) return;
  E.doc.comments.push({ id: d.id, author: me(), time: Date.now(), text: text.trim(), resolved: false, replies: [], quote: d.quote });
  E.draft = null;
  cards.get(d.id)?.remove(); cards.delete(d.id);
  E.changed(); renderCards(); E.refreshPanel?.();
}
const findC = id => E.doc.comments.find(c => c.id === id);
export function resolveComment(id, val = true) {
  const c = findC(id); if (!c) return;
  c.resolved = val;
  E.body.querySelectorAll(`.cmt[data-c="${id}"]`).forEach(s => s.classList.toggle('resolved', val));
  if (val && E.activeC === id) E.activeC = null;
  E.changed(); renderCards(); E.refreshPanel?.();
  if (val) toast('Komentar diselesaikan', { action: 'Urungkan', onAction: () => resolveComment(id, false) });
}
export function deleteComment(id) {
  E.doc.comments = E.doc.comments.filter(c => c.id !== id);
  E.hist.before();
  E.body.querySelectorAll(`.cmt[data-c="${id}"]`).forEach(unwrap);
  cards.get(id)?.remove(); cards.delete(id);
  E.changed(); renderCards(); E.refreshPanel?.();
}
export function activate(id, scroll) {
  E.activeC = id;
  E.body.querySelectorAll('.cmt.on, .sg.on').forEach(x => x.classList.remove('on'));
  if (id) E.body.querySelectorAll(`.cmt[data-c="${id}"], .sg[data-s="${id}"]`).forEach(x => x.classList.add('on'));
  if (scroll && id) { const a = E.body.querySelector(`[data-c="${id}"], [data-s="${id}"]`); if (a) E.scrollToEl(a); }
  renderCards();
  E.refreshPanel?.();
}

/* ---------------- Suggestions ---------------- */
function sid() {
  const now = Date.now();
  if (E._sg && now - E._sg.t < 6000) { E._sg.t = now; return E._sg.id; }
  E._sg = { id: 's' + uid(6), t: now };
  return E._sg.id;
}
const mine = el => el && el.tagName === 'INS' && el.classList.contains('sg') && el.dataset.a === me();

export function beforeInput(e) {
  const t = e.inputType;
  if (t === 'insertText' || t === 'insertReplacementText' || t === 'insertFromPaste' || t === 'insertFromDrop') {
    let text = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
    if (!text) return false;
    e.preventDefault();
    if (t === 'insertReplacementText') { const tr = e.getTargetRanges?.()[0]; if (tr) { const r = document.createRange(); r.setStart(tr.startContainer, tr.startOffset); r.setEnd(tr.endContainer, tr.endOffset); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
    insert(text);
    return true;
  }
  if (t.startsWith('delete')) {
    e.preventDefault();
    del(t);
    return true;
  }
  return false;
}
export function insert(text) {
  const s = getSelection();
  if (!s.rangeCount) return;
  E.hist.typing('sg');
  let r = s.getRangeAt(0);
  if (!r.collapsed) { markDelete(r, false); r = s.getRangeAt(0); }
  let node = r.startContainer, off = r.startOffset;
  const host = node.nodeType === 3 ? node.parentElement : node;
  const delEl = host.closest?.('del.sg');
  if (delEl && E.body.contains(delEl)) { r.setStartAfter(delEl); r.collapse(true); node = r.startContainer; off = r.startOffset; }
  const insEl = (node.nodeType === 3 ? node.parentElement : node).closest?.('ins.sg');
  if (mine(insEl) && node.nodeType === 3) {
    node.insertData(off, text); s.collapse(node, off + text.length); insEl.dataset.t = Date.now();
    E.changed(); return;
  }
  const prev = node.nodeType === 3 ? (off === 0 ? node.previousSibling : null) : node.childNodes[off - 1];
  if (mine(prev)) {
    let tn = prev.lastChild;
    if (!tn || tn.nodeType !== 3) { tn = document.createTextNode(''); prev.append(tn); }
    tn.appendData(text); s.collapse(tn, tn.data.length);
    E.changed(); return;
  }
  const ins = h('ins', { class: 'sg', dataset: { s: sid(), a: me(), t: String(Date.now()) } }, text);
  r.insertNode(ins);
  s.collapse(ins.firstChild, text.length);
  E.changed();
}
function allDeleted(r) {
  const nodes = textNodesIn(r).filter(n => {
    const s = n === r.startContainer ? r.startOffset : 0, e = n === r.endContainer ? r.endOffset : n.data.length;
    return e > s;
  });
  return nodes.length > 0 && nodes.every(n => n.parentElement.closest('del.sg'));
}
function del(t) {
  const s = getSelection();
  const back = /Backward/.test(t);
  if (s.isCollapsed) {
    const unit = /Word/.test(t) ? 'word' : /Line/.test(t) ? 'lineboundary' : 'character';
    s.modify('extend', back ? 'backward' : 'forward', unit);
    for (let g = 0; g < 400 && !s.isCollapsed && allDeleted(s.getRangeAt(0)); g++) {
      const before = s.getRangeAt(0).toString().length;
      s.modify('extend', back ? 'backward' : 'forward', 'character');
      if (s.getRangeAt(0).toString().length === before) break;
    }
  }
  if (s.isCollapsed) return;
  markDelete(s.getRangeAt(0), back);
}
function markDelete(r, back) {
  E.hist.typing('sg');
  const id = sid(), now = String(Date.now()), who = me();
  const wraps = wrapRange(r, () => h('del', { class: 'sg', dataset: { s: id, a: who, t: now } }), n => !n.parentElement.closest('del.sg'));
  for (const w of wraps) {
    const ins = w.parentElement?.closest('ins.sg');
    if (ins && ins.dataset.a === who) { w.remove(); if (!ins.textContent) ins.remove(); }
  }
  let live = wraps.filter(w => w.isConnected);
  for (const w of live) {
    for (const sib of [w.previousSibling, w.nextSibling]) {
      if (sib?.nodeType === 1 && sib.tagName === 'DEL' && sib.classList.contains('sg') && sib.dataset.s === w.dataset.s && sib.isConnected) {
        if (sib === w.previousSibling) sib.append(...w.childNodes); else sib.prepend(...w.childNodes);
        w.remove(); sib.normalize();
        live = live.map(x => x === w ? sib : x);
        break;
      }
    }
  }
  live = [...new Set(live)].filter(w => w.isConnected);
  const s = getSelection();
  const rr = document.createRange();
  if (live.length) { if (back) rr.setStartBefore(live[0]); else rr.setStartAfter(live[live.length - 1]); }
  else { rr.setStart(r.startContainer, Math.min(r.startOffset, r.startContainer.nodeType === 3 ? r.startContainer.length : r.startContainer.childNodes.length)); }
  rr.collapse(true);
  s.removeAllRanges(); s.addRange(rr);
  E.changed();
}
export function resolveSuggestion(id, accept) {
  E.hist.before();
  E.body.querySelectorAll(`.sg[data-s="${id}"]`).forEach(el => { if ((el.tagName === 'INS') === accept) unwrap(el); else el.remove(); });
  cards.get(id)?.remove(); cards.delete(id);
  if (E.activeC === id) E.activeC = null;
  E.changed(); renderCards(); E.refreshPanel?.();
}
export function resolveAll(accept) {
  const els = E.body.querySelectorAll('.sg');
  if (!els.length) { toast('Tidak ada saran'); return; }
  E.hist.before();
  els.forEach(el => { if ((el.tagName === 'INS') === accept) unwrap(el); else el.remove(); });
  cards.forEach((c, k) => { if (k.startsWith('s')) { c.remove(); cards.delete(k); } });
  E.changed(); renderCards(); E.refreshPanel?.();
  toast(accept ? 'Semua saran diterima' : 'Semua saran ditolak');
}
export function suggestions() {
  const map = new Map();
  E.body.querySelectorAll('ins.sg, del.sg').forEach(el => {
    const id = el.dataset.s || 's';
    let g = map.get(id);
    if (!g) map.set(id, g = { id, author: el.dataset.a || 'Anonim', time: +el.dataset.t || Date.now(), add: '', del: '', els: [] });
    g.els.push(el);
    if (el.tagName === 'INS') g.add += el.textContent; else g.del += el.textContent;
  });
  return [...map.values()];
}

/* ---------------- Cards (margin column) ---------------- */
function cardFor(kind, item) {
  let el = cards.get(item.id);
  const sig = kind === 'c' ? JSON.stringify([item.text, item.replies, item.resolved, E.activeC === item.id, E.editingC]) : JSON.stringify([item.add, item.del, item.author]);
  if (el && el._sig === sig) return el;
  const focused = el?.contains(document.activeElement) ? document.activeElement : null;
  if (focused && focused.tagName === 'TEXTAREA') { return el; }
  if (!el) {
    el = h('div', { class: 'cc glass-strong', dataset: { id: item.id } });
    el.addEventListener('click', e => { if (!e.target.closest('button, textarea, a') && E.activeC !== item.id) activate(item.id); });
    cards.set(item.id, el);
  }
  el._sig = sig;
  el.replaceChildren(...(kind === 'c' ? commentBody(item) : kind === 'd' ? draftBody() : suggestionBody(item)));
  return el;
}
function commentBody(c) {
  const more = h('button', { class: 'ib', 'aria-label': 'Opsi lainnya' }, icon('more_vert'));
  more.onclick = e => { e.stopPropagation(); toggleMenu(more, [
    { label: 'Edit', icon: 'edit', enabled: () => c.author === me(), run: () => { E.editingC = c.id; renderCards(); } },
    { label: 'Hapus', icon: 'delete', run: () => deleteComment(c.id) },
    { label: 'Salin teks komentar', icon: 'content_copy', run: () => navigator.clipboard?.writeText(c.text) },
  ], { align: 'right' }); };
  const head = h('div', { class: 'cc-h' }, avatar(c.author), h('div', { class: 'cc-who' }, h('b', null, c.author), h('span', { title: fmtFull(c.time) }, fmtWhen(c.time))),
    h('button', { class: 'ib', 'data-tip': 'Tandai sebagai selesai dan sembunyikan diskusi', onclick: e => { e.stopPropagation(); resolveComment(c.id); } }, icon('check')), more);
  const body = [head];
  if (E.editingC === c.id) {
    const ta = h('textarea', { class: 'tx' }, c.text);
    body.push(h('div', { class: 'cc-form' }, ta, h('div', { class: 'row' },
      h('button', { class: 'btn btn-ghost', onclick: () => { E.editingC = null; renderCards(); } }, 'Batal'),
      h('button', { class: 'btn btn-primary', onclick: () => { c.text = ta.value.trim() || c.text; c.edited = Date.now(); E.editingC = null; E.changed(); renderCards(); } }, 'Simpan'))));
    requestAnimationFrame(() => ta.focus());
  } else body.push(h('div', { class: 'cc-txt' }, c.text));
  for (const rp of c.replies || []) {
    body.push(h('div', { class: 'cc-rep' }, h('div', { class: 'cc-h' }, avatar(rp.author, 'sm'), h('div', { class: 'cc-who' }, h('b', null, rp.author), h('span', null, fmtWhen(rp.time))),
      rp.author === me() ? h('button', { class: 'ib', 'aria-label': 'Hapus balasan', onclick: e => { e.stopPropagation(); c.replies = c.replies.filter(x => x !== rp); E.changed(); renderCards(); } }, icon('close', 'sm')) : null),
      h('div', { class: 'cc-txt' }, rp.text)));
  }
  const ta = h('textarea', { class: 'tx', placeholder: 'Balas', rows: 1 });
  const send = () => { if (!ta.value.trim()) return; (c.replies ||= []).push({ id: uid(6), author: me(), time: Date.now(), text: ta.value.trim() }); ta.value = ''; E.changed(); renderCards(); E.refreshPanel?.(); };
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } if (e.key === 'Escape') { ta.blur(); activate(null); } });
  body.push(h('div', { class: 'cc-form reply' }, ta, h('div', { class: 'row' }, h('button', { class: 'btn btn-ghost', onclick: () => { ta.value = ''; activate(null); } }, 'Batal'), h('button', { class: 'btn btn-primary', onclick: send }, 'Balas'))));
  return body;
}
function draftBody() {
  const ta = h('textarea', { class: 'tx', placeholder: 'Tambahkan komentar', rows: 2 });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); postDraft(ta.value); } if (e.key === 'Escape') { e.preventDefault(); cancelDraft(); renderCards(); } });
  return [h('div', { class: 'cc-h' }, avatar(me()), h('div', { class: 'cc-who' }, h('b', null, me()))),
    h('div', { class: 'cc-form', 'data-draft': '1' }, ta, h('div', { class: 'row' },
      h('button', { class: 'btn btn-ghost', onclick: () => { cancelDraft(); renderCards(); } }, 'Batal'),
      h('button', { class: 'btn btn-primary', onclick: () => postDraft(ta.value) }, 'Komentar')))];
}
function suggestionBody(g) {
  const body = [h('div', { class: 'cc-h' }, avatar(g.author), h('div', { class: 'cc-who' }, h('b', null, g.author), h('span', { title: fmtFull(g.time) }, fmtWhen(g.time))),
    E.mode !== 'view' ? h('button', { class: 'ib', 'data-tip': 'Terima saran', onclick: e => { e.stopPropagation(); resolveSuggestion(g.id, true); } }, icon('check')) : null,
    E.mode !== 'view' ? h('button', { class: 'ib', 'data-tip': 'Tolak saran', onclick: e => { e.stopPropagation(); resolveSuggestion(g.id, false); } }, icon('close')) : null)];
  const clip = s => s.length > 90 ? s.slice(0, 90) + '…' : s;
  const txt = h('div', { class: 'cc-txt' });
  if (g.add && g.del) txt.append(h('span', { class: 'sg-k' }, 'Ganti: '), h('span', { class: 'sg-del' }, `"${clip(g.del)}"`), ' dengan ', h('span', { class: 'sg-add' }, `"${clip(g.add)}"`));
  else if (g.add) txt.append(h('span', { class: 'sg-k' }, 'Tambahkan: '), h('span', { class: 'sg-add' }, `"${clip(g.add)}"`));
  else txt.append(h('span', { class: 'sg-k' }, 'Hapus: '), h('span', { class: 'sg-del' }, `"${clip(g.del)}"`));
  body.push(txt);
  return body;
}

export function renderCards() {
  const col = E.cmtCol;
  if (!col || !E.doc) return;
  if (!E.view.cmtFits) { col.hidden = true; return; }
  col.hidden = false;
  const ir = E.inner.getBoundingClientRect();
  const items = [];
  const topOf = el => el.getBoundingClientRect().top - ir.top;
  const seen = new Set();
  for (const c of E.doc.comments) {
    if (c.resolved) continue;
    const a = E.body.querySelector(`.cmt[data-c="${c.id}"]`);
    if (!a) continue;
    items.push({ id: c.id, top: topOf(a), el: cardFor('c', c) }); seen.add(c.id);
  }
  if (E.draft) {
    const a = E.body.querySelector(`.cmt[data-c="${E.draft.id}"]`);
    if (a) { items.push({ id: E.draft.id, top: topOf(a), el: cardFor('d', E.draft) }); seen.add(E.draft.id); }
  }
  for (const g of suggestions()) { items.push({ id: g.id, top: topOf(g.els[0]), el: cardFor('s', g) }); seen.add(g.id); }
  for (const [k, el] of cards) if (!seen.has(k)) { el.remove(); cards.delete(k); }
  items.sort((a, b) => a.top - b.top);
  for (const it of items) { if (it.el.parentElement !== col) col.append(it.el); it.el.classList.toggle('on', it.id === E.activeC); }
  for (const it of items) it.h = it.el.offsetHeight;
  const gap = 10;
  const ai = items.findIndex(i => i.id === E.activeC);
  if (ai < 0) { let y = -1e9; for (const it of items) { it.y = Math.max(it.top, y); y = it.y + it.h + gap; } }
  else {
    items[ai].y = items[ai].top;
    let y = items[ai].y + items[ai].h + gap;
    for (let i = ai + 1; i < items.length; i++) { items[i].y = Math.max(items[i].top, y); y = items[i].y + items[i].h + gap; }
    y = items[ai].y;
    for (let i = ai - 1; i >= 0; i--) { items[i].y = Math.min(items[i].top, y - gap - items[i].h); y = items[i].y; }
  }
  for (const it of items) it.el.style.top = it.y + 'px';
  E.updateStatus?.();
}

/* ---------------- Side panel lists ---------------- */
export function commentsPanel(box) {
  const f = E._cfilter ||= 'open';
  const seg = h('div', { class: 'seg', style: { marginBottom: '12px' } }, [['open', 'Terbuka'], ['resolved', 'Selesai'], ['all', 'Semua']].map(([k, l]) => h('button', { class: f === k ? 'on' : '', onclick: () => { E._cfilter = k; E.refreshPanel(); } }, l)));
  const list = E.doc.comments.filter(c => f === 'all' || (f === 'open' ? !c.resolved : c.resolved)).slice().reverse();
  const rows = list.map(c => h('div', { class: 'panel-card', style: { cursor: 'pointer', outline: E.activeC === c.id ? '2px solid var(--accent)' : null }, onclick: () => { if (!c.resolved) activate(c.id, true); } },
    h('div', { class: 'cc-h' }, avatar(c.author, 'sm'), h('div', { class: 'cc-who' }, h('b', null, c.author), h('span', null, fmtWhen(c.time))),
      c.resolved ? h('button', { class: 'btn-text', onclick: e => { e.stopPropagation(); resolveComment(c.id, false); } }, 'Buka kembali') : h('button', { class: 'ib sm', 'data-tip': 'Selesaikan', onclick: e => { e.stopPropagation(); resolveComment(c.id); } }, icon('check'))),
    c.quote ? h('div', { class: 'cc-q' }, c.quote) : null,
    h('div', { class: 'cc-txt' }, c.text),
    c.replies?.length ? h('div', { class: 'cc-more' }, `${c.replies.length} balasan`) : null,
    !E.body.querySelector(`.cmt[data-c="${c.id}"]`) ? h('div', { class: 'cc-more' }, 'Teks aslinya telah dihapus') : null));
  const draftBox = E.draft && !E.view.cmtFits ? h('div', { class: 'panel-card', 'data-draft': '1' }, h('div', { class: 'cc-q' }, E.draft.quote), ...draftBody()) : null;
  box.replaceChildren(seg, draftBox || '', ...(rows.length ? rows : [h('div', { class: 'ol-empty' }, f === 'resolved' ? 'Belum ada komentar yang diselesaikan.' : 'Belum ada komentar. Pilih teks lalu klik ikon komentar.')]));
  if (draftBox) requestAnimationFrame(() => draftBox.querySelector('textarea')?.focus());
}
export function suggestionsPanel(box) {
  const list = suggestions();
  const head = h('div', { class: 'row', style: { marginBottom: '12px' } },
    h('button', { class: 'btn btn-tonal', disabled: !list.length || E.mode === 'view' || null, onclick: () => resolveAll(true) }, icon('done_all'), 'Terima semua'),
    h('button', { class: 'btn btn-ghost', disabled: !list.length || E.mode === 'view' || null, onclick: () => resolveAll(false) }, 'Tolak semua'));
  const rows = list.map(g => {
    const el = h('div', { class: 'panel-card', style: { cursor: 'pointer' }, onclick: e => { if (!e.target.closest('button')) activate(g.id, true); } }, ...suggestionBody(g));
    return el;
  });
  box.replaceChildren(head, ...(rows.length ? rows : [h('div', { class: 'ol-empty' }, 'Tidak ada saran. Ubah mode ke "Menyarankan" untuk mengusulkan perubahan yang dapat diterima atau ditolak.')]));
}
export { esc };
