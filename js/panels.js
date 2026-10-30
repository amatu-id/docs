// Side panels: outline (left), and a right panel hosting comments, suggestions, versions and citations.
import { E, Prefs, savePrefs, me } from './state.js';
import { h, icon, toast, fmtWhen, fmtFull, ask, confirmDlg, toggleMenu, uid, field, select } from './ui.js';
import { Store } from './store.js';
import { commentsPanel, suggestionsPanel } from './review.js';

/* ---------------- Outline ---------------- */
export function toggleOutline(force) {
  const on = force ?? !E.view.outline;
  E.view.outline = on; Prefs.outline = on; savePrefs();
  if (on) {
    if (!E.left) {
      E.left = h('aside', { class: 'side left glass refract', 'aria-label': 'Garis besar dokumen' });
      E.root.append(E.left);
    }
    refreshOutline(true);
  } else { E.left?.remove(); E.left = null; }
  E.layout();
}
let olSig = '';
export function refreshOutline(force) {
  if (!E.left) return;
  const heads = [...E.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p.title')].filter(x => x.textContent.trim());
  const sig = heads.map(x => x.tagName + x.textContent).join('|') + E.doc.summary;
  if (sig === olSig && !force) return markCurrent();
  olSig = sig;
  const sum = h('textarea', { class: 'tx', placeholder: 'Tambahkan ringkasan dokumen', rows: 3, style: { minHeight: '64px' } }, E.doc.summary || '');
  sum.addEventListener('input', () => { E.doc.summary = sum.value; E.changed({ noHist: true }); });
  const min = Math.min(...heads.map(x => x.tagName === 'P' ? 1 : +x.tagName[1]), 6);
  E.left.replaceChildren(
    h('div', { class: 'side-h' }, h('span', { class: 't' }, 'Garis besar dokumen'), h('button', { class: 'ib sm', 'aria-label': 'Tutup garis besar', onclick: () => toggleOutline(false) }, icon('close'))),
    h('div', { class: 'side-b' },
      h('div', { class: 'ol-sum' }, h('div', { class: 'lbl' }, 'Ringkasan'), sum),
      h('div', { class: 'ol-sum' }, h('div', { class: 'lbl' }, 'Garis besar')),
      ...(heads.length ? heads.map((x, i) => {
        const lvl = x.tagName === 'P' ? 1 : +x.tagName[1];
        return h('button', { class: 'ol-item l' + (lvl - min + 1), dataset: { i }, style: { paddingLeft: 8 + (lvl - min) * 14 + 'px' }, title: x.textContent, onclick: () => { E.scrollToEl(x, true); const s = getSelection(); s.collapse(x, 0); E.body.focus({ preventScroll: true }); } }, x.textContent.trim());
      }) : [h('div', { class: 'ol-empty' }, 'Judul yang Anda tambahkan ke dokumen akan muncul di sini.')])));
  E.left._heads = heads;
  markCurrent();
}
export function markCurrent() {
  if (!E.left?._heads) return;
  const lim = E.canvas.getBoundingClientRect().top + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) + 60;
  let cur = -1;
  E.left._heads.forEach((x, i) => { if (x.getBoundingClientRect().top < lim + 40) cur = i; });
  E.left.querySelectorAll('.ol-item').forEach((b, i) => b.classList.toggle('cur', i === Math.max(0, cur)));
}

/* ---------------- Right panel ---------------- */
const TITLES = { comments: 'Semua komentar', suggest: 'Saran perubahan', versions: 'Histori versi', cite: 'Kutipan' };
export function openPanel(kind) {
  if (E.view.panel === kind && E.right) { refreshPanel(); return; }
  E.view.panel = kind;
  if (!E.right) { E.right = h('aside', { class: 'side right glass refract' }); E.root.append(E.right); }
  refreshPanel();
  E.layout();
}
export function togglePanel(kind) { if (E.view.panel === kind) closePanel(); else openPanel(kind); }
export function closePanel() {
  if (E.previewing) exitPreview();
  E.view.panel = null;
  E.right?.remove(); E.right = null;
  E.layout();
}
export function refreshPanel() {
  const k = E.view.panel;
  if (!k || !E.right) return;
  const body = h('div', { class: 'side-b' });
  E.right.replaceChildren(h('div', { class: 'side-h' }, h('span', { class: 't' }, TITLES[k]), h('button', { class: 'ib sm', 'aria-label': 'Tutup panel', onclick: closePanel }, icon('close'))), body);
  if (k === 'comments') commentsPanel(body);
  else if (k === 'suggest') suggestionsPanel(body);
  else if (k === 'versions') versionsPanel(body);
  else if (k === 'cite') citePanel(body);
}

/* ---------------- Versions ---------------- */
export async function snapshot(name = '') {
  const html = E.serialize();
  const v = { vid: 'v' + Date.now().toString(36) + uid(4), doc: E.doc.id, time: Date.now(), name, author: me(), html, page: JSON.parse(JSON.stringify(E.doc.page)), styles: JSON.parse(JSON.stringify(E.doc.styles)), footnotes: { ...E.doc.footnotes }, words: E.wordCount?.().words || 0 };
  await Store.versions.add(v);
  E.lastVersion = { time: v.time, html };
  const all = await Store.versions.list(E.doc.id);
  const unnamed = all.filter(x => !x.name);
  for (const x of unnamed.slice(80)) await Store.versions.del(x.vid);
  return v;
}
export async function maybeAutoVersion() {
  if (!E.doc || E.previewing) return;
  if (!E.lastVersion) {
    const all = await Store.versions.list(E.doc.id);
    E.lastVersion = all[0] ? { time: all[0].time, html: all[0].html } : { time: 0, html: '' };
  }
  if (Date.now() - E.lastVersion.time < 10 * 60e3) return;
  const html = E.serialize();
  if (html === E.lastVersion.html) return;
  await snapshot();
  if (E.view.panel === 'versions') refreshPanel();
}
export async function nameVersion() {
  const n = await ask({ title: 'Beri nama versi saat ini', label: 'Versi bernama tidak akan dihapus otomatis.', placeholder: 'mis. Draf akhir untuk klien', ok: 'Simpan' });
  if (!n?.trim()) return;
  await E.save();
  await snapshot(n.trim());
  toast('Versi disimpan: ' + n.trim());
  if (E.view.panel === 'versions') refreshPanel();
}
async function versionsPanel(box) {
  const list = await Store.versions.list(E.doc.id);
  const onlyNamed = E._vNamed;
  const cur = h('div', { class: 'v' + (!E.previewing ? ' on' : ''), onclick: () => exitPreview() }, h('b', null, 'Versi saat ini'), h('small', null, 'Diubah ' + fmtWhen(E.doc.modified) + ' · ' + me()));
  const filter = h('label', { class: 'sw', style: { margin: '0 4px 8px' } }, h('input', { type: 'checkbox', checked: onlyNamed || null, onchange: e => { E._vNamed = e.target.checked; refreshPanel(); } }), h('i'), h('span', { class: 'small' }, 'Hanya versi bernama'));
  const groups = new Map();
  for (const v of list) {
    if (onlyNamed && !v.name) continue;
    const d = new Date(v.time);
    const key = d.toDateString() === new Date().toDateString() ? 'Hari ini' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  const els = [filter, h('div', { class: 'vlist' }, cur)];
  for (const [k, vs] of groups) {
    els.push(h('div', { class: 'vgrp' }, k));
    els.push(h('div', { class: 'vlist' }, vs.map(v => {
      const more = h('button', { class: 'ib sm', 'aria-label': 'Opsi versi' }, icon('more_vert'));
      more.onclick = e => { e.stopPropagation(); toggleMenu(more, [
        { label: 'Beri nama versi ini', icon: 'edit', run: async () => { const n = await ask({ title: 'Nama versi', value: v.name, ok: 'Simpan' }); if (n != null) { await Store.versions.rename(v.vid, n.trim()); refreshPanel(); } } },
        { label: 'Pulihkan versi ini', icon: 'restore', run: () => restoreVersion(v) },
        { label: 'Buat salinan', icon: 'content_copy', run: () => E.copyFromVersion?.(v) },
        { sep: true },
        { label: 'Hapus versi', icon: 'delete', run: async () => { await Store.versions.del(v.vid); refreshPanel(); } },
      ], { align: 'right' }); };
      return h('div', { class: 'v' + (E.previewing?.vid === v.vid ? ' on' : ''), onclick: () => previewVersion(v) },
        h('b', null, v.name || new Date(v.time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
        h('small', null, (v.name ? fmtFull(v.time) + ' · ' : '') + (v.author || '') + (v.words ? ` · ${v.words} kata` : '')), more);
    })));
  }
  if (!list.length) els.push(h('div', { class: 'ol-empty' }, 'Versi tersimpan otomatis setiap 10 menit saat Anda mengedit. Anda juga dapat memberi nama versi saat ini dari menu Berkas.'));
  els.push(h('div', { style: { padding: '14px 4px 0' } }, h('button', { class: 'btn btn-tonal', onclick: nameVersion }, icon('bookmark_add'), 'Beri nama versi saat ini')));
  box.replaceChildren(...els);
}
let banner = null;
export function previewVersion(v) {
  if (!E.previewing) { E.save(); E._liveHTML = E.body.innerHTML; }
  E.previewing = v;
  E.body.innerHTML = E.hydrate(v.html);
  E.body.contentEditable = 'false';
  E.root.dataset.preview = '1';
  banner?.remove();
  banner = h('div', { class: 'banner glass-strong' }, icon('history'), h('span', null, h('b', null, v.name || fmtFull(v.time)), ' · pratinjau versi'),
    h('button', { class: 'btn btn-primary', onclick: () => restoreVersion(v) }, 'Pulihkan versi ini'),
    h('button', { class: 'btn btn-ghost', onclick: exitPreview }, 'Kembali'));
  E.root.append(banner);
  E.paginateNow(); E.renderCards?.();
  refreshPanel();
}
export function exitPreview() {
  if (!E.previewing) return;
  E.previewing = null;
  E.body.innerHTML = E._liveHTML;
  E.body.contentEditable = E.mode === 'view' ? 'false' : 'true';
  delete E.root.dataset.preview;
  banner?.remove(); banner = null;
  E.paginateNow(); E.renderCards?.();
  refreshPanel();
}
async function restoreVersion(v) {
  if (!await confirmDlg('Pulihkan versi ini?', 'Isi dokumen saat ini akan diganti. Versi saat ini disimpan dulu di histori sehingga Anda dapat kembali kapan saja.', 'Pulihkan')) return;
  if (E.previewing) { E.body.innerHTML = E._liveHTML; E.previewing = null; }
  await snapshot('Sebelum pemulihan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  E.hist.before();
  E.body.innerHTML = E.hydrate(v.html);
  E.doc.page = JSON.parse(JSON.stringify(v.page || E.doc.page));
  E.doc.styles = JSON.parse(JSON.stringify(v.styles || E.doc.styles));
  E.doc.footnotes = { ...(v.footnotes || {}) };
  E.body.contentEditable = E.mode === 'view' ? 'false' : 'true';
  delete E.root.dataset.preview;
  banner?.remove(); banner = null;
  E.applyDocStyles();
  E.changed();
  refreshPanel();
  toast('Versi dipulihkan');
}

/* ---------------- Citations ---------------- */
const TYPES = [['book', 'Buku'], ['web', 'Situs web'], ['journal', 'Artikel jurnal'], ['other', 'Lainnya']];
const lastName = a => { const f = String(a || '').split(';')[0].trim(); if (f.includes(',')) return f.split(',')[0].trim(); const p = f.split(/\s+/); return p[p.length - 1] || 'Anonim'; };
function authorShort(src) { const n = String(src.author || '').split(';').filter(x => x.trim()).length; const l = lastName(src.author); return n > 2 ? l + ' dkk.' : n === 2 ? `${l} & ${lastName(src.author.split(';')[1])}` : l; }
export function inText(src, style) {
  const y = src.year || 't.t.';
  if (style === 'mla') return `(${authorShort(src)}${src.pages ? ' ' + src.pages : ''})`;
  if (style === 'chicago') return `(${authorShort(src)} ${y}${src.pages ? ', ' + src.pages : ''})`;
  return `(${authorShort(src)}, ${y}${src.pages ? ', hlm. ' + src.pages : ''})`;
}
function fullRef(src, style) {
  const a = String(src.author || 'Anonim').split(';').map(x => x.trim()).filter(Boolean).join(', ');
  const t = `<i>${escapeHtml(src.title || 'Tanpa judul')}</i>`;
  const pub = escapeHtml(src.publisher || '');
  const url = src.url ? ` ${escapeHtml(src.url)}` : '';
  const y = src.year || 't.t.';
  if (style === 'mla') return `${escapeHtml(a)}. ${t}. ${pub ? pub + ', ' : ''}${y}.${url}`;
  if (style === 'chicago') return `${escapeHtml(a)}. ${y}. ${t}. ${pub ? pub + '.' : ''}${url}`;
  return `${escapeHtml(a)} (${y}). ${t}.${pub ? ' ' + pub + '.' : ''}${url}`;
}
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function citePanel(box) {
  const d = E.doc;
  const styleSel = select([['apa', 'APA (edisi ke-7)'], ['mla', 'MLA (edisi ke-9)'], ['chicago', 'Chicago (penulis-tahun)']], d.citeStyle, v => { d.citeStyle = v; E.changed(); updateCitations(); refreshPanel(); });
  const form = h('div', { class: 'panel-card', hidden: true });
  const f = { type: select(TYPES, 'book'), author: h('input', { class: 'tx', placeholder: 'mis. Sutanto, Budi; Rahma, Dewi' }), title: h('input', { class: 'tx' }), year: h('input', { class: 'tx', inputmode: 'numeric' }), publisher: h('input', { class: 'tx' }), url: h('input', { class: 'tx', placeholder: 'https://' }) };
  form.append(h('div', { style: { display: 'grid', gap: '8px' } }, field('Jenis sumber', f.type), field('Penulis (pisahkan dengan ;)', f.author), field('Judul', f.title),
    h('div', { class: 'grid2' }, field('Tahun', f.year), field('Penerbit / situs', f.publisher)), field('URL (opsional)', f.url),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn btn-ghost', onclick: () => form.hidden = true }, 'Batal'),
      h('button', { class: 'btn btn-primary', onclick: () => { if (!f.title.value.trim() && !f.author.value.trim()) { f.title.focus(); return; } d.citations.push({ id: 'r' + uid(5), type: f.type.value, author: f.author.value.trim(), title: f.title.value.trim(), year: f.year.value.trim(), publisher: f.publisher.value.trim(), url: f.url.value.trim() }); E.changed(); refreshPanel(); } }, 'Tambahkan sumber'))));
  const items = d.citations.map(src => h('div', { class: 'cite-item' },
    h('div', { html: fullRef(src, d.citeStyle) }),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-tonal', style: { height: '30px', padding: '0 12px' }, onclick: () => insertCitation(src) }, icon('format_quote', 'sm'), 'Kutip'),
      h('div', { class: 'grow' }),
      h('button', { class: 'ib sm', 'data-tip': 'Hapus sumber', onclick: () => { d.citations = d.citations.filter(x => x !== src); E.changed(); refreshPanel(); } }, icon('delete')))));
  box.replaceChildren(
    field('Gaya kutipan', styleSel), h('div', { style: { height: '12px' } }),
    h('div', { class: 'row', style: { marginBottom: '12px' } }, h('button', { class: 'btn btn-primary', onclick: () => { form.hidden = false; f.author.focus(); } }, icon('add'), 'Tambah sumber'),
      h('button', { class: 'btn btn-ghost', disabled: !d.citations.length || null, onclick: insertBibliography }, 'Daftar pustaka')),
    form, ...(items.length ? items : [h('div', { class: 'ol-empty' }, 'Belum ada sumber. Tambahkan buku, situs web, atau jurnal, lalu klik "Kutip" untuk menyisipkan kutipan di posisi kursor.')]));
}
function insertCitation(src) {
  if (!E.canEdit()) return;
  E.restoreSel();
  E.insertHTML(`<span class="cite" data-src="${src.id}">${escapeHtml(inText(src, E.doc.citeStyle))}</span>&nbsp;`);
}
function insertBibliography() {
  if (!E.canEdit()) return;
  E.restoreSel();
  E.insertHTML(`<div class="biblio" contenteditable="false">${bibHtml()}</div><p><br></p>`);
}
function bibHtml() {
  const s = E.doc.citeStyle;
  const list = [...E.doc.citations].sort((a, b) => lastName(a.author).localeCompare(lastName(b.author), 'id'));
  return list.map(src => `<p>${fullRef(src, s)}</p>`).join('');
}
export function updateCitations() {
  E.body.querySelectorAll('.cite[data-src]').forEach(c => { const src = E.doc.citations.find(x => x.id === c.dataset.src); if (src) c.textContent = inText(src, E.doc.citeStyle); });
  E.body.querySelectorAll('.biblio').forEach(b => { const html = bibHtml(); if (b.innerHTML !== html) b.innerHTML = html; });
}
