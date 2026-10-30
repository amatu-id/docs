// Insertable objects: TOC, footnotes, equations, date chips, special characters, drawings, charts, date & time.
import { E, Prefs, savePrefs } from './state.js';
import { h, icon, toast, dialog, field, select, uid, esc, loadScript, loadCSS, openMenu, closeMenus, palette, segmented } from './ui.js';
import { insertImage } from './images.js';

/* ---------------- Simple blocks ---------------- */
export function pageBreak() { if (E.canEdit()) E.insertHTML('<hr class="pb"><p><br></p>'); }
export function hRule() { if (E.canEdit()) E.insertHTML('<hr><p><br></p>'); }

/* ---------------- Table of contents ---------------- */
export function insertToc(kind) {
  if (!E.canEdit()) return;
  E.insertHTML(`<div class="toc" contenteditable="false" data-kind="${kind}"></div><p><br></p>`);
  renderTocs(true);
}
let tocBusy = false;
export function renderTocs(force) {
  const tocs = E.body.querySelectorAll('.toc');
  if (!tocs.length || tocBusy) return false;
  const heads = [...E.body.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(x => x.textContent.trim() && !x.closest('.toc'));
  let changed = false;
  for (const x of heads) if (!x.id) { x.id = 'h-' + uid(6); }
  const top = el => { let n = el; while (n.parentElement && n.parentElement !== E.body) n = n.parentElement; return n; };
  for (const t of tocs) {
    const nums = t.dataset.kind !== 'links';
    const html = heads.length ? heads.map(x => {
      const lvl = +x.tagName[1];
      const pg = (E.pageOf.get(top(x)) ?? 0) + 1;
      return `<p class="l${lvl}"><a href="#${x.id}">${esc(x.textContent.trim())}</a>${nums ? `<span class="lead"></span><span class="pn">${pg}</span>` : ''}</p>`;
    }).join('') : '<p class="toc-empty">Tambahkan judul (Format › Gaya paragraf) untuk membuat daftar isi.</p>';
    if (t.innerHTML !== html) { t.innerHTML = html; changed = true; }
  }
  return changed || force;
}
export function tocMenu(t) {
  return [
    { label: 'Perbarui daftar isi', icon: 'refresh', run: () => { E.hist.before(); renderTocs(true); E.changed(); } },
    { label: t.dataset.kind === 'links' ? 'Tampilkan nomor halaman' : 'Gunakan tautan biru', icon: 'format_list_numbered', run: () => { E.hist.before(); t.dataset.kind = t.dataset.kind === 'links' ? 'numbers' : 'links'; renderTocs(true); E.changed(); } },
    { sep: true },
    { label: 'Hapus daftar isi', icon: 'delete', run: () => { E.hist.before(); t.remove(); E.changed(); } },
  ];
}

/* ---------------- Footnotes ---------------- */
export function insertFootnote() {
  if (!E.canEdit()) return;
  if (E.doc.page.pageless) toast('Catatan kaki ditampilkan di akhir dokumen dalam mode tanpa halaman');
  E.restoreSel();
  const id = 'f' + uid(6);
  E.doc.footnotes[id] = '';
  E.insertHTML(`<sup class="fn" data-fn="${id}" contenteditable="false"></sup>`);
  E.paginateNow();
  requestAnimationFrame(() => {
    const t = E.fg.querySelector(`.fn-text[data-fn="${id}"]`);
    if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.focus(); }
  });
}
export function bindFootnotes() {
  E.fg.addEventListener('input', e => {
    const t = e.target.closest?.('.fn-text');
    if (!t) return;
    E.doc.footnotes[t.dataset.fn] = t.innerHTML === '<br>' ? '' : t.innerHTML;
    E.changed({ noHist: true });
  });
  E.fg.addEventListener('keydown', e => {
    const t = e.target.closest?.('.fn-text');
    if (t && e.key === 'Escape') { const ref = E.body.querySelector(`sup.fn[data-fn="${t.dataset.fn}"]`); if (ref) { E.scrollToEl(ref); const r = document.createRange(); r.setStartAfter(ref); r.collapse(true); E.body.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
  });
}
export function gcFootnotes() {
  const live = new Set([...E.body.querySelectorAll('sup.fn')].map(s => s.dataset.fn));
  for (const k of Object.keys(E.doc.footnotes)) if (!live.has(k)) delete E.doc.footnotes[k];
}

/* ---------------- Equations ---------------- */
const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/';
let katexP = null;
export function loadKatex() { return katexP ||= Promise.all([loadCSS(KATEX + 'katex.min.css'), loadScript(KATEX + 'katex.min.js')]).then(() => window.katex); }
export async function renderEquations(root = E.body) {
  const eqs = root.querySelectorAll('.eq');
  if (!eqs.length) return;
  try { const k = await loadKatex(); eqs.forEach(el => { if (!el.childElementCount) k.render(el.dataset.tex || '', el, { throwOnError: false }); }); E.paginate?.(); }
  catch { /* falls back to the TeX source via CSS */ }
}
const EQ_KEYS = [['x²', '^{2}'], ['xₙ', '_{n}'], ['a/b', '\\frac{a}{b}'], ['√', '\\sqrt{x}'], ['ⁿ√', '\\sqrt[n]{x}'], ['Σ', '\\sum_{i=1}^{n}'], ['∫', '\\int_{a}^{b}'], ['lim', '\\lim_{x \\to \\infty}'], ['( )', '\\left( \\right)'], ['α', '\\alpha'], ['β', '\\beta'], ['π', '\\pi'], ['θ', '\\theta'], ['Δ', '\\Delta'], ['λ', '\\lambda'], ['μ', '\\mu'], ['σ', '\\sigma'], ['Ω', '\\Omega'], ['±', '\\pm'], ['×', '\\times'], ['÷', '\\div'], ['≤', '\\le'], ['≥', '\\ge'], ['≠', '\\neq'], ['≈', '\\approx'], ['∞', '\\infty'], ['→', '\\rightarrow'], ['matriks', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}']];
export async function equationDialog(el) {
  if (!E.canEdit()) return;
  E.restoreSel();
  const saved = E.range()?.cloneRange();
  const ta = h('textarea', { class: 'tx', style: { fontFamily: 'ui-monospace, Menlo, monospace', minHeight: '90px' }, placeholder: 'Tulis dalam LaTeX, mis. E = mc^2 atau \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' }, el?.dataset.tex || '');
  const prev = h('div', { class: 'eq-prev' }, 'Memuat pratinjau…');
  let k = null;
  const draw = () => { if (!k) return; try { k.render(ta.value || '\\text{Pratinjau}', prev, { throwOnError: false, displayMode: true }); } catch { prev.textContent = ta.value; } };
  loadKatex().then(x => { k = x; draw(); }).catch(() => { prev.textContent = 'Pratinjau tidak tersedia (offline). Persamaan tetap disimpan sebagai LaTeX.'; });
  ta.addEventListener('input', draw);
  const keys = h('div', { class: 'eq-keys' }, EQ_KEYS.map(([l, t]) => h('button', { type: 'button', onclick: () => { const s = ta.selectionStart; ta.setRangeText(t, s, ta.selectionEnd, 'end'); ta.focus(); draw(); } }, l)));
  const tex = await dialog({
    title: el ? 'Edit persamaan' : 'Sisipkan persamaan', width: 620,
    body: h('div', { style: { display: 'grid', gap: '12px' } }, keys, ta, prev),
    buttons: [{ label: 'Batal', value: null }, { label: el ? 'Simpan' : 'Sisipkan', primary: true, action: () => ta.value.trim() || false }],
  });
  if (!tex) return;
  if (el) { E.hist.before(); el.dataset.tex = tex; el.innerHTML = ''; renderEquations(); E.changed(); return; }
  if (saved) { const s = getSelection(); E.body.focus(); s.removeAllRanges(); s.addRange(saved); }
  E.insertHTML(`<span class="eq" contenteditable="false" data-tex="${esc(tex)}"></span>&nbsp;`);
  renderEquations();
}

/* ---------------- Date chip & date/time ---------------- */
export function fmtDate(iso, f = 'long') {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  if (f === 'short') return d.toLocaleDateString('id-ID');
  if (f === 'full') return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function insertDateChip() {
  if (!E.canEdit()) return;
  const iso = new Date().toISOString().slice(0, 10);
  E.insertHTML(`<span class="chip date" contenteditable="false" data-date="${iso}">${fmtDate(iso)}</span>&nbsp;`);
}
export function dateChipPopover(chip) {
  if (E.mode === 'view') return;
  const inp = h('input', { class: 'tx', type: 'date', value: chip.dataset.date });
  const fmtS = select([['long', 'Tanggal pendek (12 Okt 2026)'], ['full', 'Tanggal lengkap'], ['short', 'Angka (12/10/2026)']], chip.dataset.f || 'long');
  const apply = () => { E.hist.before(); chip.dataset.date = inp.value; chip.dataset.f = fmtS.value; chip.textContent = fmtDate(inp.value, fmtS.value); E.changed(); closeMenus(0); };
  openMenu(chip, [{ el: h('div', { style: { display: 'grid', gap: '8px', width: '260px' } }, field('Tanggal', inp), field('Format', fmtS), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn btn-primary', onclick: apply }, 'Terapkan'))) }], { cls: 'pop', focus: false });
}
export async function dateTimeDialog() {
  if (!E.canEdit()) return;
  E.restoreSel();
  const saved = E.range()?.cloneRange();
  const now = new Date();
  const opts = [
    now.toLocaleDateString('id-ID'),
    now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
    now.toISOString().slice(0, 10),
    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    now.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  ];
  let pick = opts[1];
  const list = h('div', { style: { display: 'grid', gap: '4px', maxHeight: '320px', overflow: 'auto' } }, opts.map(o => {
    const b = h('button', { class: 'mi', style: { width: '100%', border: 0, background: o === pick ? 'var(--acc-soft)' : 'transparent' }, onclick: () => { pick = o; [...list.children].forEach(c => c.style.background = c === b ? 'var(--acc-soft)' : 'transparent'); }, ondblclick: () => document.querySelector('.dlg [data-primary]')?.click() }, h('span', { class: 'mi-l' }, o));
    return b;
  }));
  const v = await dialog({ title: 'Tanggal & waktu', width: 420, body: list, buttons: [{ label: 'Batal', value: null }, { label: 'Sisipkan', primary: true, action: () => pick }] });
  if (!v) return;
  if (saved) { E.body.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
  E.insertText(v);
}

/* ---------------- Special characters ---------------- */
const CHARS = {
  'Umum': '©®™§¶†‡•·…‰′″°№℃℉µΩ℮✓✗✔✘★☆♥♦♣♠☎✉✈☀☁☂☃♪♫',
  'Tanda baca': '–—‘’“”‚„«»‹›¡¿¦¨¯´¸ˆ˜‖⁄※',
  'Panah': '←↑→↓↔↕↖↗↘↙⇐⇑⇒⇓⇔⇕↩↪↺↻⇄⇆➔➜➝➞➤➢▶◀▲▼►◄',
  'Matematika': '±×÷=≠≈≡≤≥<>∞∑∏√∛∫∬∮∂∆∇∈∉∋⊂⊃⊆⊇∪∩∧∨¬∀∃∅∝∠⊥∥≅∼∴∵⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉½⅓⅔¼¾⅛⅜⅝⅞',
  'Mata uang': '$¢£¥€₹₽₩₪₫₱₦₺₴₸₿¤',
  'Yunani': 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω',
  'Latin': 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝßàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿĀāĒēĪīŌōŪūŠšŽžŒœ',
  'Bentuk': '■□▪▫▬▭▮▯▰▱▲△▴▵▶▷▸▹►▻▼▽▾▿◀◁◂◃◄◅◆◇◈◉◊○◌◍◎●◐◑◒◓◔◕◖◗◘◙◚◛◜◝◞◟◠◡◢◣◤◥◦◧◨◩◪◫◬◭◮◯',
  'Kotak': '─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬░▒▓█▀▄▌▐',
};
const NAMES = { '©': 'hak cipta copyright', '®': 'terdaftar registered', '™': 'merek dagang trademark', '°': 'derajat degree', '±': 'plus minus', '×': 'kali multiply', '÷': 'bagi divide', '€': 'euro', '£': 'pound', '¥': 'yen', '$': 'dolar dollar', '→': 'panah kanan arrow right', '←': 'panah kiri arrow left', '↑': 'panah atas up', '↓': 'panah bawah down', '✓': 'centang check', '✗': 'silang cross', '★': 'bintang star', '♥': 'hati heart', '–': 'en dash tanda pisah', '—': 'em dash tanda pisah', '…': 'elipsis', '≤': 'kurang dari sama dengan', '≥': 'lebih dari sama dengan', '≠': 'tidak sama dengan', '≈': 'kira-kira hampir', '∞': 'tak hingga infinity', '√': 'akar root', '²': 'kuadrat pangkat dua', '³': 'kubik pangkat tiga', '½': 'setengah half', 'π': 'pi', 'Ω': 'ohm omega', 'µ': 'mikro micro', '§': 'pasal section', '¶': 'pilcrow paragraf', '•': 'butir bullet', '№': 'nomor', '₹': 'rupee', '₿': 'bitcoin' };
export function specialChars() {
  if (!E.canEdit()) return;
  E.restoreSel();
  const saved = E.range()?.cloneRange();
  const q = h('input', { class: 'tx', placeholder: 'Cari (mis. panah, derajat, euro, pi)' });
  const cat = select(['Terakhir', ...Object.keys(CHARS)].map(k => [k, k]), Prefs.recentChars.length ? 'Terakhir' : 'Umum');
  const grid = h('div', { class: 'chars' });
  const put = ch => {
    if (saved) { E.body.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
    E.insertText(ch);
    const r = E.range(); if (r) { saved.setStart(r.startContainer, r.startOffset); saved.collapse(true); }
    Prefs.recentChars = [ch, ...Prefs.recentChars.filter(c => c !== ch)].slice(0, 30); savePrefs();
  };
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    let list;
    if (s) list = [...new Set(Object.values(CHARS).join(''))].filter(c => (NAMES[c] || '').includes(s) || c === s);
    else list = cat.value === 'Terakhir' ? Prefs.recentChars : [...CHARS[cat.value]];
    grid.replaceChildren(...(list.length ? list.map(c => h('button', { title: NAMES[c] || c, 'aria-label': NAMES[c] || c, onclick: () => put(c) }, c)) : [h('div', { class: 'muted small', style: { gridColumn: '1/-1', padding: '10px' } }, 'Tidak ditemukan')]));
  };
  q.addEventListener('input', draw); cat.addEventListener('change', draw);
  draw();
  dialog({ title: 'Karakter khusus', width: 520, body: h('div', { style: { display: 'grid', gap: '10px' } }, h('div', { class: 'grid2' }, cat, q), grid), buttons: [{ label: 'Tutup', primary: true }] });
}

/* ---------------- Drawing ---------------- */
export async function drawingDialog(img) {
  if (!E.canEdit()) return;
  E.restoreSel();
  const saved = E.range()?.cloneRange();
  const id = img?.dataset.drawing;
  let shapes = id && E.doc.drawings[id] ? JSON.parse(JSON.stringify(E.doc.drawings[id])) : [];
  const redo = [];
  let tool = 'pen', color = '#1a73e8', width = 3, fill = false;
  const W = 1600, H = 900;
  const cv = h('canvas', { class: 'draw-canvas', width: W, height: H });
  const ctx = cv.getContext('2d');
  const draw = (extra) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    for (const s of [...shapes, ...(extra ? [extra] : [])]) paintShape(ctx, s);
  };
  const toolBtn = (t, ic, tip) => h('button', { class: 'ib' + (t === tool ? ' on' : ''), 'data-tip': tip, dataset: { t }, onclick: e => { tool = t; e.currentTarget.parentElement.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); } }, icon(ic));
  const colorBtn = h('button', { class: 'ib cbtn', 'data-tip': 'Warna' }, icon('palette'), h('span', { class: 'bar', style: { color } }));
  colorBtn.onclick = () => openMenu(colorBtn, [{ el: palette({ value: color, onPick: c => { if (c) { color = c; colorBtn.querySelector('.bar').style.color = c; } closeMenus(0); } }) }], { cls: 'pop' });
  const widthSel = select([['2', 'Tipis'], ['3', 'Sedang'], ['6', 'Tebal'], ['12', 'Sangat tebal']], '3', v => width = +v);
  widthSel.style.width = '130px'; widthSel.style.height = '34px';
  const fillT = h('button', { class: 'ib', 'data-tip': 'Isi bentuk' }, icon('format_color_fill'));
  fillT.onclick = () => { fill = !fill; fillT.classList.toggle('on', fill); };
  const tools = h('div', { class: 'draw-tools' },
    toolBtn('pen', 'draw', 'Pena'), toolBtn('line', 'horizontal_rule', 'Garis'), toolBtn('arrow', 'arrow_right_alt', 'Panah'),
    toolBtn('rect', 'crop_square', 'Persegi'), toolBtn('ellipse', 'circle', 'Elips'), toolBtn('text', 'title', 'Teks'),
    h('div', { class: 'tb-sep' }), colorBtn, fillT, widthSel, h('div', { class: 'grow' }),
    h('button', { class: 'ib', 'data-tip': 'Urungkan', onclick: () => { if (shapes.length) { redo.push(shapes.pop()); draw(); } } }, icon('undo')),
    h('button', { class: 'ib', 'data-tip': 'Ulangi', onclick: () => { if (redo.length) { shapes.push(redo.pop()); draw(); } } }, icon('redo')),
    h('button', { class: 'ib', 'data-tip': 'Bersihkan', onclick: () => { shapes = []; draw(); } }, icon('delete_sweep')));
  let cur = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  cv.addEventListener('pointerdown', async e => {
    cv.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (tool === 'text') {
      const t = prompt_inline(cv, e, async txt => { if (txt) { shapes.push({ t: 'text', p: [p], c: color, w: width, text: txt }); draw(); } });
      void t; return;
    }
    cur = { t: tool, p: [p, p], c: color, w: width, f: fill };
  });
  cv.addEventListener('pointermove', e => {
    if (!cur) return;
    const p = pos(e);
    if (cur.t === 'pen') cur.p.push(p); else cur.p[1] = p;
    draw(cur);
  });
  cv.addEventListener('pointerup', () => { if (cur) { shapes.push(cur); redo.length = 0; cur = null; draw(); } });
  draw();
  const ok = await dialog({ title: img ? 'Edit gambar' : 'Gambar', width: 900, body: h('div', { class: 'draw-wrap' }, tools, cv), buttons: [{ label: 'Batal', value: false }, { label: 'Simpan dan tutup', primary: true, value: true }] });
  if (!ok || !shapes.length) return;
  const bb = bounds(shapes);
  const pad = 16;
  const out = document.createElement('canvas');
  out.width = Math.max(10, bb[2] - bb[0] + pad * 2); out.height = Math.max(10, bb[3] - bb[1] + pad * 2);
  const ox = out.getContext('2d');
  ox.translate(pad - bb[0], pad - bb[1]);
  shapes.forEach(s => paintShape(ox, s));
  const url = out.toDataURL('image/png');
  const did = id || 'g' + uid(6);
  E.doc.drawings[did] = shapes;
  if (img) {
    E.hist.before();
    const aid = E.addAsset(url);
    img.dataset.asset = aid; img.src = E.assetURL(aid);
    img.style.width = Math.min(out.width / 2, E.geo.PW - E.geo.ML - E.geo.MR) + 'px';
    E.changed(); return;
  }
  if (saved) { E.body.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
  const aid = E.addAsset(url);
  E.insertHTML(`<img src="${E.assetURL(aid)}" data-asset="${aid}" data-drawing="${did}" alt="Gambar" style="width:${Math.round(Math.min(out.width / 2, E.geo.PW - E.geo.ML - E.geo.MR))}px">`);
}
function prompt_inline(cv, e, cb) {
  const r = cv.getBoundingClientRect();
  const inp = h('input', { class: 'tx', style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY - 18 + 'px', width: '220px', zIndex: 2000 }, placeholder: 'Ketik teks lalu Enter' });
  document.body.append(inp);
  inp.focus();
  const done = v => { inp.remove(); cb(v); };
  inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') done(inp.value.trim()); if (ev.key === 'Escape') done(''); });
  inp.addEventListener('blur', () => done(inp.value.trim()));
  void r;
}
function paintShape(x, s) {
  x.save();
  x.strokeStyle = s.c; x.fillStyle = s.c; x.lineWidth = s.w * 2; x.lineCap = 'round'; x.lineJoin = 'round';
  const [a, b] = s.p;
  if (s.t === 'pen') { x.beginPath(); s.p.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); }
  else if (s.t === 'line' || s.t === 'arrow') {
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    if (s.t === 'arrow') { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 14 + s.w * 4; x.beginPath(); x.moveTo(b[0], b[1]); x.lineTo(b[0] - L * Math.cos(ang - .45), b[1] - L * Math.sin(ang - .45)); x.lineTo(b[0] - L * Math.cos(ang + .45), b[1] - L * Math.sin(ang + .45)); x.closePath(); x.fill(); }
  } else if (s.t === 'rect') {
    const rx = Math.min(a[0], b[0]), ry = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), hh = Math.abs(b[1] - a[1]);
    if (s.f) { x.globalAlpha = .25; x.fillRect(rx, ry, w, hh); x.globalAlpha = 1; }
    x.strokeRect(rx, ry, w, hh);
  } else if (s.t === 'ellipse') {
    x.beginPath(); x.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
    if (s.f) { x.globalAlpha = .25; x.fill(); x.globalAlpha = 1; }
    x.stroke();
  } else if (s.t === 'text') { x.font = `${18 + s.w * 6}px Arial, sans-serif`; x.textBaseline = 'middle'; x.fillText(s.text, a[0], a[1]); }
  x.restore();
}
function bounds(shapes) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of shapes) {
    for (const [px, py] of s.p) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
    if (s.t === 'text') { x1 = Math.max(x1, s.p[0][0] + s.text.length * (10 + s.w * 4)); y0 = Math.min(y0, s.p[0][1] - 24); y1 = Math.max(y1, s.p[0][1] + 24); }
    x0 -= s.w; y0 -= s.w; x1 += s.w; y1 += s.w;
  }
  return [Math.max(0, x0), Math.max(0, y0), x1, y1];
}

/* ---------------- Charts ---------------- */
const CHART_COLORS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#7b61ff', '#c2185b'];
export function chartSVG(spec) {
  const W = 640, H = 380, P = { l: 56, r: 20, t: spec.title ? 46 : 20, b: 56 };
  const cats = spec.cats, ser = spec.series;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`];
  if (spec.title) parts.push(`<text x="${W / 2}" y="28" text-anchor="middle" font-size="17" font-weight="700" fill="#202124">${esc(spec.title)}</text>`);
  if (spec.type === 'pie') {
    const vals = cats.map((_, i) => Math.max(0, +ser[0]?.v[i] || 0));
    const tot = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = 230, cy = (H + P.t) / 2, R = Math.min(140, (H - P.t - 24) / 2);
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + v / tot * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a) => `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`;
      parts.push(v / tot >= .9999 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${CHART_COLORS[i % 8]}"/>` : `<path d="M${cx},${cy} L${p(a0)} A${R},${R} 0 ${large} 1 ${p(a1)} Z" fill="${CHART_COLORS[i % 8]}" stroke="#fff" stroke-width="2"/>`);
      const am = (a0 + a1) / 2;
      if (v / tot > .05) parts.push(`<text x="${cx + R * .62 * Math.cos(am)}" y="${cy + R * .62 * Math.sin(am)}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#fff">${Math.round(v / tot * 100)}%</text>`);
      a0 = a1;
    });
    cats.forEach((c, i) => parts.push(`<rect x="420" y="${P.t + 20 + i * 26}" width="14" height="14" rx="3" fill="${CHART_COLORS[i % 8]}"/><text x="442" y="${P.t + 32 + i * 26}" font-size="13" fill="#3c4043">${esc(c)}</text>`));
    parts.push('</svg>');
    return parts.join('');
  }
  const all = ser.flatMap(s => s.v.map(Number).filter(v => !isNaN(v)));
  let max = Math.max(0, ...all), min = Math.min(0, ...all);
  if (max === min) max = min + 1;
  const nice = n => { const e = Math.pow(10, Math.floor(Math.log10(n))); const f = n / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
  const stepV = nice((max - min) / 5); max = Math.ceil(max / stepV) * stepV; min = Math.floor(min / stepV) * stepV;
  const horiz = spec.type === 'bar';
  const pw = W - P.l - P.r, ph = H - P.t - P.b;
  const legendH = ser.length > 1 ? 22 : 0;
  const ph2 = ph - legendH;
  const val2 = v => horiz ? P.l + (v - min) / (max - min) * pw : P.t + ph2 - (v - min) / (max - min) * ph2;
  for (let v = min; v <= max + 1e-9; v += stepV) {
    const lbl = Math.abs(v) >= 1000 ? new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v) : +v.toFixed(2);
    if (horiz) parts.push(`<line x1="${val2(v)}" x2="${val2(v)}" y1="${P.t}" y2="${P.t + ph2}" stroke="#e8eaed"/><text x="${val2(v)}" y="${P.t + ph2 + 18}" text-anchor="middle" font-size="12" fill="#5f6368">${lbl}</text>`);
    else parts.push(`<line x1="${P.l}" x2="${W - P.r}" y1="${val2(v)}" y2="${val2(v)}" stroke="#e8eaed"/><text x="${P.l - 8}" y="${val2(v) + 4}" text-anchor="end" font-size="12" fill="#5f6368">${lbl}</text>`);
  }
  const n = cats.length || 1;
  const band = (horiz ? ph2 : pw) / n;
  cats.forEach((c, i) => {
    const mid = (horiz ? P.t : P.l) + band * (i + .5);
    if (horiz) parts.push(`<text x="${P.l - 8}" y="${mid + 4}" text-anchor="end" font-size="12" fill="#3c4043">${esc(c)}</text>`);
    else parts.push(`<text x="${mid}" y="${P.t + ph2 + 18}" text-anchor="middle" font-size="12" fill="#3c4043">${esc(c)}</text>`);
  });
  if (spec.type === 'line') {
    ser.forEach((s, k) => {
      const pts = cats.map((_, i) => `${P.l + band * (i + .5)},${val2(+s.v[i] || 0)}`);
      parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${CHART_COLORS[k % 8]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
      pts.forEach(p => { const [x, y] = p.split(','); parts.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="#fff" stroke="${CHART_COLORS[k % 8]}" stroke-width="2.5"/>`); });
    });
  } else {
    const inner = band * .72, bw = inner / ser.length;
    ser.forEach((s, k) => cats.forEach((_, i) => {
      const v = +s.v[i] || 0, z = val2(0), e = val2(v);
      const o = (horiz ? P.t : P.l) + band * i + (band - inner) / 2 + bw * k;
      if (horiz) parts.push(`<rect x="${Math.min(z, e)}" y="${o + 1}" width="${Math.abs(e - z)}" height="${bw - 2}" rx="3" fill="${CHART_COLORS[k % 8]}"/>`);
      else parts.push(`<rect x="${o + 1}" y="${Math.min(z, e)}" width="${bw - 2}" height="${Math.abs(e - z)}" rx="3" fill="${CHART_COLORS[k % 8]}"/>`);
    }));
  }
  parts.push(`<line x1="${P.l}" x2="${horiz ? P.l : W - P.r}" y1="${horiz ? P.t : val2(0)}" y2="${horiz ? P.t + ph2 : val2(0)}" stroke="#9aa0a6"/>`);
  if (ser.length > 1) {
    let x = P.l;
    ser.forEach((s, k) => { parts.push(`<rect x="${x}" y="${H - 22}" width="12" height="12" rx="3" fill="${CHART_COLORS[k % 8]}"/><text x="${x + 18}" y="${H - 12}" font-size="12.5" fill="#3c4043">${esc(s.name)}</text>`); x += 30 + s.name.length * 7.5; });
  }
  parts.push('</svg>');
  return parts.join('');
}
export async function chartDialog(typeOrImg) {
  if (!E.canEdit()) return;
  E.restoreSel();
  const saved = E.range()?.cloneRange();
  const img = typeOrImg instanceof Element ? typeOrImg : null;
  let spec = img && E.doc.charts[img.dataset.chart] ? JSON.parse(JSON.stringify(E.doc.charts[img.dataset.chart])) : {
    type: typeof typeOrImg === 'string' ? typeOrImg : 'column', title: 'Judul diagram',
    cats: ['Jan', 'Feb', 'Mar', 'Apr'], series: [{ name: 'Seri 1', v: [12, 19, 15, 24] }, { name: 'Seri 2', v: [8, 11, 14, 17] }],
  };
  if (spec.type === 'pie') spec.series = spec.series.slice(0, 1);
  const prev = h('div', { class: 'chart-prev' });
  const table = h('table', { class: 'chart-data' });
  const typeSeg = segmented([['column', 'Kolom', 'bar_chart'], ['bar', 'Batang', 'align_horizontal_left'], ['line', 'Garis', 'show_chart'], ['pie', 'Lingkaran', 'pie_chart']], spec.type, v => { spec.type = v; if (v === 'pie') spec.series = spec.series.slice(0, 1); build(); });
  const title = h('input', { class: 'tx', value: spec.title, placeholder: 'Judul diagram' });
  title.addEventListener('input', () => { spec.title = title.value; draw(); });
  const draw = () => { prev.innerHTML = chartSVG(spec); };
  const build = () => {
    const rows = [h('tr', null, h('td', null, h('input', { value: 'Kategori', disabled: true })), spec.series.map((s, k) => h('td', null, h('input', { value: s.name, oninput: e => { spec.series[k].name = e.target.value; draw(); } }))))];
    spec.cats.forEach((c, i) => rows.push(h('tr', null, h('td', null, h('input', { value: c, oninput: e => { spec.cats[i] = e.target.value; draw(); } })),
      spec.series.map((s, k) => h('td', null, h('input', { value: s.v[i] ?? '', inputmode: 'decimal', oninput: e => { spec.series[k].v[i] = parseFloat(e.target.value.replace(',', '.')) || 0; draw(); } }))))));
    table.replaceChildren(...rows);
    draw();
  };
  build();
  const ctl = h('div', { class: 'row', style: { flexWrap: 'wrap' } },
    h('button', { class: 'btn btn-ghost', style: { height: '32px' }, onclick: () => { spec.cats.push('Baru'); spec.series.forEach(s => s.v.push(0)); build(); } }, icon('add'), 'Baris'),
    h('button', { class: 'btn btn-ghost', style: { height: '32px' }, onclick: () => { if (spec.cats.length > 1) { spec.cats.pop(); spec.series.forEach(s => s.v.pop()); build(); } } }, icon('remove'), 'Baris'),
    spec.type !== 'pie' ? h('button', { class: 'btn btn-ghost', style: { height: '32px' }, onclick: () => { if (spec.type === 'pie') return; spec.series.push({ name: 'Seri ' + (spec.series.length + 1), v: spec.cats.map(() => 0) }); build(); } }, icon('add'), 'Seri') : null,
    h('button', { class: 'btn btn-ghost', style: { height: '32px' }, onclick: () => { if (spec.series.length > 1) { spec.series.pop(); build(); } } }, icon('remove'), 'Seri'));
  const ok = await dialog({
    title: img ? 'Edit diagram' : 'Sisipkan diagram', width: 900,
    body: h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: '16px' } },
      h('div', { style: { display: 'grid', gap: '10px', alignContent: 'start' } }, typeSeg, field('Judul', title), h('div', { style: { maxHeight: '260px', overflow: 'auto' } }, table), ctl),
      prev),
    buttons: [{ label: 'Batal', value: false }, { label: img ? 'Perbarui' : 'Sisipkan', primary: true, value: true }],
  });
  if (!ok) return;
  const svg = chartSVG(spec);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const cid = img?.dataset.chart || 'k' + uid(6);
  E.doc.charts[cid] = spec;
  const aid = E.addAsset(url);
  if (img) { E.hist.before(); img.dataset.asset = aid; img.src = E.assetURL(aid); E.changed(); return; }
  if (saved) { E.body.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
  E.insertHTML(`<img src="${E.assetURL(aid)}" data-asset="${aid}" data-chart="${cid}" alt="${esc(spec.title || 'Diagram')}" style="width:${Math.min(560, E.geo.PW - E.geo.ML - E.geo.MR)}px">`);
}
export { insertImage };
