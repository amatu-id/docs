// Hyperlinks, link chip and bookmarks.
import { E } from './state.js';
import { h, icon, toast, openMenu, closeMenus, esc, uid } from './ui.js';
import { inTag, mutate } from './format.js';

export function normalizeUrl(u) {
  u = u.trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:|#)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u;
  if (/^\+?[\d\s-]{7,}$/.test(u)) return 'tel:' + u.replace(/\s/g, '');
  return 'https://' + u.replace(/^\/+/, '');
}

function targets() {
  const out = [];
  E.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p.title').forEach(x => { if (x.textContent.trim()) out.push({ el: x, label: x.textContent.trim(), icon: 'title', kind: 'h' }); });
  E.body.querySelectorAll('.bm').forEach(b => out.push({ el: b, label: (b.closest('p,li,h1,h2,h3,h4,h5,h6')?.textContent.trim().slice(0, 50) || 'Bookmark'), icon: 'bookmark', kind: 'b' }));
  return out;
}
function anchorFor(t) {
  if (!t.el.id) t.el.id = (t.kind === 'b' ? 'bm-' : 'h-') + uid(6);
  return '#' + t.el.id;
}

export function linkDialog() {
  if (!E.canEdit()) return;
  E.restoreSel();
  const r = E.range();
  if (!r) return;
  const a = inTag('a');
  const sel = r.toString();
  const textIn = h('input', { class: 'tx', placeholder: 'Teks', value: a ? a.textContent : sel });
  const urlIn = h('input', { class: 'tx', placeholder: 'Telusuri atau tempel tautan', value: a?.getAttribute('href') || (/^(https?:\/\/|www\.)\S+$/.test(sel) ? sel : '') });
  const sugg = h('div', { style: { maxHeight: '180px', overflow: 'auto', margin: '2px -4px 0' } });
  const apply = () => {
    const url = normalizeUrl(urlIn.value);
    if (!url) { urlIn.focus(); return; }
    closeMenus(0);
    applyLink(url, textIn.value, a);
  };
  const renderSugg = () => {
    const q = urlIn.value.trim().toLowerCase();
    const list = targets().filter(t => !q || t.label.toLowerCase().includes(q)).slice(0, 12);
    sugg.replaceChildren(...(list.length ? [h('div', { class: 'menu-head' }, 'Judul dan bookmark di dokumen ini')] : []),
      ...list.map(t => h('div', { class: 'mi', onclick: () => { urlIn.value = anchorFor(t); if (!textIn.value) textIn.value = t.label; apply(); } }, h('span', { class: 'mi-ic' }, icon(t.icon)), h('span', { class: 'mi-l' }, t.label))));
  };
  urlIn.addEventListener('input', renderSugg);
  [textIn, urlIn].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }));
  const panel = h('div', { style: { display: 'grid', gap: '8px', width: '360px', maxWidth: 'calc(100vw - 48px)' } },
    h('div', { class: 'row' }, icon('text_fields'), textIn),
    h('div', { class: 'row' }, icon('link'), urlIn, h('button', { class: 'btn btn-primary', style: { height: '36px' }, onclick: apply }, 'Terapkan')),
    sugg);
  renderSugg();
  const rect = caretRect();
  openMenu({ x: rect.left, y: rect.bottom + 4 }, [{ el: panel }], { cls: 'pop', focus: false });
  requestAnimationFrame(() => (textIn.value ? urlIn : textIn).focus());
}
export function caretRect() {
  const r = E.range();
  const rr = r?.getClientRects?.()[0] || r?.getBoundingClientRect?.();
  if (rr && (rr.width || rr.height)) return rr;
  const el = r?.startContainer?.nodeType === 1 ? r.startContainer : r?.startContainer?.parentElement;
  return el?.getBoundingClientRect() || { left: innerWidth / 2, top: 200, bottom: 220 };
}

export function applyLink(url, text, existing) {
  E.restoreSel();
  E.hist.before();
  if (existing) {
    existing.setAttribute('href', url);
    if (text && text !== existing.textContent) existing.textContent = text;
  } else {
    const r = E.range();
    if (r.collapsed || (text && text !== r.toString())) {
      document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(text || url)}</a>`);
    } else {
      document.execCommand('createLink', false, url);
    }
  }
  E.changed();
  updateChip();
}
export function unlink(a = inTag('a')) {
  if (!a) return;
  mutate(() => a.replaceWith(...a.childNodes));
  hideChip();
}

let chip = null;
export function hideChip() { chip?.remove(); chip = null; }
export function updateChip() {
  const r = E.range();
  const a = r && r.collapsed ? inTag('a') : null;
  if (!a || !E.body.contains(a) || E.selImg) { hideChip(); return; }
  const href = a.getAttribute('href') || '';
  const label = href.startsWith('#') ? (E.body.querySelector(href.replace(/[^\w#-]/g, ''))?.textContent.trim().slice(0, 40) || 'Bagian dokumen') : href.replace(/^mailto:/, '');
  hideChip();
  chip = h('div', { class: 'float-bar glass-strong' },
    h('a', { class: 'lnk', href, target: href.startsWith('#') ? null : '_blank', rel: 'noopener', onclick: e => { if (href.startsWith('#')) { e.preventDefault(); goTo(href); } } }, icon(href.startsWith('#') ? 'subdirectory_arrow_right' : 'public', 'sm'), label),
    h('div', { class: 'tb-sep' }),
    h('button', { class: 'ib sm', 'data-tip': 'Salin tautan', onclick: () => { navigator.clipboard?.writeText(href.startsWith('#') ? location.href.split('#')[0] + location.hash : href); toast('Tautan disalin'); } }, icon('content_copy')),
    E.mode !== 'view' ? h('button', { class: 'ib sm', 'data-tip': 'Edit tautan', onclick: linkDialog }, icon('edit')) : null,
    E.mode !== 'view' ? h('button', { class: 'ib sm', 'data-tip': 'Hapus tautan', onclick: () => unlink(a) }, icon('link_off')) : null);
  chip.addEventListener('mousedown', e => e.preventDefault());
  document.body.append(chip);
  const ar = a.getBoundingClientRect(), cr = chip.getBoundingClientRect();
  chip.style.left = Math.max(8, Math.min(innerWidth - cr.width - 8, ar.left)) + 'px';
  chip.style.top = Math.min(innerHeight - cr.height - 8, ar.bottom + 8) + 'px';
}
export function goTo(href) {
  const t = E.body.querySelector('#' + CSS.escape(href.slice(1)));
  if (!t) { toast('Tujuan tautan tidak ditemukan'); return; }
  E.scrollToEl(t);
  const s = getSelection(); s.collapse(t.nodeType === 1 && t.classList.contains('bm') ? t.parentNode : t, 0);
}

export function insertBookmark() {
  if (!E.canEdit()) return;
  E.restoreSel();
  const id = 'bm-' + uid(6);
  E.insertHTML(`<span class="bm" id="${id}" contenteditable="false"></span>`);
  toast('Bookmark ditambahkan. Gunakan Sisipkan › Tautan untuk menautkannya.');
}
