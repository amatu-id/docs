// Horizontal ruler with draggable page margins and paragraph indent markers (centimetres).
import { E } from './state.js';
import { h } from './ui.js';
import { px2cm, cm2px } from './docmodel.js';
import { blockOf, selBlocks } from './format.js';

const TRI_DOWN = '<svg viewBox="0 0 12 9"><path d="M0 0h12L6 9z"/></svg>';
const TRI_UP = '<svg viewBox="0 0 12 9"><path d="M6 0l6 9H0z"/></svg>';
let cv, mk = {}, guide = null;

export function initRuler() {
  const el = E.ruler;
  cv = h('canvas');
  mk.first = h('div', { class: 'r-mk first', html: TRI_DOWN, 'data-tip': 'Indentasi baris pertama' });
  mk.left = h('div', { class: 'r-mk left', html: TRI_UP, 'data-tip': 'Indentasi kiri' });
  mk.right = h('div', { class: 'r-mk right', html: TRI_UP, 'data-tip': 'Indentasi kanan' });
  mk.ml = h('div', { class: 'r-mg', 'data-tip': 'Margin kiri' });
  mk.mr = h('div', { class: 'r-mg', 'data-tip': 'Margin kanan' });
  el.append(cv, mk.ml, mk.mr, mk.first, mk.left, mk.right);
  for (const k of ['first', 'left', 'right', 'ml', 'mr']) mk[k].addEventListener('pointerdown', e => drag(e, k));
}

export function drawRuler() {
  if (!cv || !E.view.ruler || !E.geo) return;
  const g = E.geo, z = E.zoom;
  const W = g.PW * z, Hh = 26;
  const dpr = devicePixelRatio || 1;
  E.ruler.style.width = W + 'px';
  E.ruler.style.marginLeft = E.zoomer.style.marginLeft;
  cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
  const x = cv.getContext('2d');
  x.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const tx = cs.getPropertyValue('--tx3').trim() || '#666';
  const ml = g.ML * z, mr = (g.PW - g.MR) * z;
  x.fillStyle = cs.getPropertyValue('--hov').trim() || 'rgba(0,0,0,.06)';
  x.fillRect(0, 0, ml, Hh); x.fillRect(mr, 0, W - mr, Hh);
  x.fillStyle = cs.getPropertyValue('--field-h').trim() || '#fff';
  x.fillRect(ml, 0, mr - ml, Hh);
  x.strokeStyle = tx; x.fillStyle = tx;
  x.font = '10px -apple-system, Segoe UI, Roboto, sans-serif';
  x.textAlign = 'center';
  const cm = cm2px(1) * z;
  const startCm = -Math.floor(g.ML / cm2px(1));
  for (let i = startCm * 4; ; i++) {
    const px = ml + i * cm / 4;
    if (px > W) break;
    if (px < 0) continue;
    x.globalAlpha = .55;
    x.beginPath();
    if (i % 4 === 0) {
      if (i !== 0) { x.globalAlpha = .8; x.fillText(String(Math.abs(i / 4)), px, 16.5); }
    } else if (i % 2 === 0) { x.moveTo(px + .5, 10); x.lineTo(px + .5, 16); }
    else { x.moveTo(px + .5, 12); x.lineTo(px + .5, 14); }
    x.stroke();
  }
  x.globalAlpha = 1;
  mk.ml.style.left = ml + 'px';
  mk.mr.style.left = mr + 'px';
  updateMarkers();
}

export function updateMarkers() {
  if (!cv || !E.geo || !E.view.ruler) return;
  const g = E.geo, z = E.zoom;
  const r = E.range();
  const b = r && blockOf(r.startContainer);
  const inBody = b && E.body.contains(b);
  for (const k of ['first', 'left', 'right']) mk[k].style.display = inBody ? '' : 'none';
  if (!inBody) return;
  const br = b.getBoundingClientRect(), pr = E.pages.getBoundingClientRect();
  const left = (br.left - pr.left) / z;
  const right = (br.right - pr.left) / z;
  const ti = parseFloat(getComputedStyle(b).textIndent) || 0;
  mk.left.style.left = left * z + 'px';
  mk.first.style.left = (left + ti) * z + 'px';
  mk.right.style.left = right * z + 'px';
}

function drag(e, k) {
  if (E.mode === 'view') return;
  e.preventDefault();
  const g = E.geo, z = E.zoom;
  const pr = E.pages.getBoundingClientRect();
  const blocks = selBlocks().filter(b => E.body.contains(b));
  const b0 = blocks[0];
  const bl = b0 ? (b0.getBoundingClientRect().left - pr.left) / z : 0;
  const ml0 = b0 ? parseFloat(b0.style.marginLeft) || 0 : 0;
  const ti0 = b0 ? parseFloat(getComputedStyle(b0).textIndent) || 0 : 0;
  const mr0 = b0 ? parseFloat(b0.style.marginRight) || 0 : 0;
  const base = bl - ml0;
  if ((k === 'first' || k === 'left' || k === 'right') && !blocks.length) return;
  E.hist.before();
  guide = h('div', { class: 'r-guide' });
  document.body.append(guide);
  const snap = v => Math.round(v / (cm2px(1) / 4)) * (cm2px(1) / 4);
  const mv = ev => {
    const xpx = (ev.clientX - pr.left) / z;
    guide.style.left = ev.clientX + 'px';
    guide.style.height = innerHeight + 'px';
    if (k === 'ml') { E.doc.page.margins.l = Math.max(0, Math.min(px2cm(g.PW - g.MR - 72), px2cm(snap(xpx)))); E.paginateNow(); drawRuler(); }
    else if (k === 'mr') { E.doc.page.margins.r = Math.max(0, Math.min(px2cm(g.PW - g.ML - 72), px2cm(snap(g.PW - xpx)))); E.paginateNow(); drawRuler(); }
    else if (k === 'left') {
      const v = Math.max(0, snap(xpx - base));
      for (const b of blocks) { b.style.marginLeft = v ? v + 'px' : ''; b.style.textIndent = ti0 + (ml0 - v) ? (ti0 + ml0 - v) + 'px' : ''; }
      updateMarkers();
    } else if (k === 'first') {
      const v = snap(xpx - bl);
      for (const b of blocks) b.style.textIndent = v ? v + 'px' : '';
      updateMarkers();
    } else if (k === 'right') {
      const v = Math.max(0, snap(g.PW - g.MR - xpx + mr0 - mr0));
      for (const b of blocks) b.style.marginRight = v ? v + 'px' : '';
      updateMarkers();
    }
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    guide?.remove(); guide = null;
    blocks.forEach(b => { if (!b.getAttribute('style')) b.removeAttribute('style'); });
    E.changed();
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
