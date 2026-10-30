// HTML → Office Open XML (.docx) writer.
import { loadScript } from './ui.js';
import { resolvedStyle, paperPx, cm2px, STYLE_KEYS } from './docmodel.js';
import { fontNameOf } from './fonts.js';

const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const X = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const TW = px => Math.round(px * 15);
const EMU = px => Math.round(px * 9525);
const BLOCK = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE', 'PRE', 'HR', 'DIV', 'LI']);
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const HDR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function hex(c) {
  if (!c) return null;
  c = c.trim();
  if (c.startsWith('#')) { let v = c.slice(1); if (v.length === 3) v = [...v].map(x => x + x).join(''); return v.slice(0, 6).toUpperCase(); }
  const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!m || (m[4] !== undefined && +m[4] === 0)) return null;
  return [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function toPt(v, base = 11) {
  if (!v) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  if (/pt$/.test(v)) return n;
  if (/px$/.test(v)) return n * .75;
  if (/em$/.test(v)) return n * base;
  if (/cm$/.test(v)) return n * 28.3465;
  if (/mm$/.test(v)) return n * 2.83465;
  if (/in$/.test(v)) return n * 72;
  return n;
}
const toPx = v => (toPt(v) ?? 0) / .75;
const bmName = id => ('b_' + String(id).replace(/[^A-Za-z0-9_]/g, '_')).slice(0, 40);

class Writer {
  constructor(doc) {
    this.doc = doc;
    this.rels = [];
    this.media = [];
    this.imgs = new Map();
    this.abstracts = []; this.nums = [];
    this.footnotes = [];
    this.comments = new Map(); this.cLast = new Map(); this.cStarted = new Set();
    this.bm = 1000; this.pic = 1;
    const p = doc.page, sz = paperPx(p.size);
    let W = sz.w, H = sz.h;
    if (p.orient === 'landscape') [W, H] = [H, W];
    this.W = W; this.H = H;
    this.CW = W - cm2px(p.margins.l) - cm2px(p.margins.r);
  }
  rel(type, target, external) {
    const id = 'rId' + (100 + this.rels.length);
    this.rels.push({ id, type, target, external });
    return id;
  }

  async prepareImages(root) {
    for (const img of root.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      if (!src || this.imgs.has(src)) continue;
      try { this.imgs.set(src, await imageData(src)); } catch { this.imgs.set(src, null); }
    }
  }

  blocks(node, pc = {}) {
    let out = '', buf = [];
    const flush = () => { if (buf.some(n => n.nodeType === 1 || n.data.trim())) out += this.para(buf, null, pc); buf = []; };
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { buf.push(n); continue; }
      if (n.nodeType !== 1) continue;
      if (BLOCK.has(n.tagName)) { flush(); out += this.block(n, pc); }
      else buf.push(n);
    }
    flush();
    return out;
  }
  block(el, pc) {
    const t = el.tagName;
    if (t === 'UL' || t === 'OL') return this.list(el, 0, pc, null);
    if (t === 'TABLE') return this.table(el);
    if (t === 'HR') return el.classList.contains('pb') ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
      : '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="B7BCC2"/></w:pBdr><w:spacing w:before="120" w:after="120"/></w:pPr></w:p>';
    if (t === 'BLOCKQUOTE') return this.blocks(el, { ...pc, quote: true });
    if (t === 'DIV') {
      if (el.classList.contains('toc')) return this.toc(el);
      if (el.classList.contains('biblio')) return [...el.querySelectorAll('p')].map(p => this.para([...p.childNodes], p, { ...pc, hanging: true })).join('');
      return this.blocks(el, pc);
    }
    if (t === 'PRE') {
      const lines = el.textContent.split('\n');
      return lines.map(l => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${this.run(l, { font: 'Courier New' })}</w:p>`).join('');
    }
    if (t === 'LI') return this.para([...el.childNodes], el, pc);
    // P / H*: block children inside (rare) are flattened
    if ([...el.children].some(c => BLOCK.has(c.tagName) && c.tagName !== 'LI')) return this.blocks(el, pc);
    return this.para([...el.childNodes], el, pc);
  }

  para(nodes, el, pc, prefix = '') {
    while (nodes.length && nodes[nodes.length - 1].nodeType === 1 && nodes[nodes.length - 1].tagName === 'BR' && nodes.length > 0) { nodes = nodes.slice(0, -1); break; }
    const pPr = this.pPr(el, pc, nodes);
    const base = pc.bold ? { b: true } : {};
    let runs = prefix;
    for (const n of nodes) runs += this.inline(n, base);
    let bs = '', be = '';
    if (el?.id) { const id = this.bm++; bs = `<w:bookmarkStart w:id="${id}" w:name="${bmName(el.id)}"/>`; be = `<w:bookmarkEnd w:id="${id}"/>`; }
    return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${bs}${runs}${be}</w:p>`;
  }
  pPr(el, pc, nodes = []) {
    let style = null;
    if (el) {
      const t = el.tagName;
      if (/^H\d$/.test(t)) style = 'Heading' + t[1];
      else if (el.classList.contains('title') || el.classList.contains('st-title')) style = 'Title';
      else if (el.classList.contains('subtitle') || el.classList.contains('st-subtitle')) style = 'Subtitle';
      else { const st = [...el.classList].find(c => /^st-h\d$/.test(c)); if (st) style = 'Heading' + st.slice(4); }
    }
    if (!style && pc.quote) style = 'Quote';
    const s = el?.style;
    let x = '';
    if (style) x += `<w:pStyle w:val="${style}"/>`;
    if (pc.numPr) x += `<w:numPr><w:ilvl w:val="${pc.numPr.ilvl}"/><w:numId w:val="${pc.numPr.numId}"/></w:numPr>`;
    if (s) {
      const sides = ['top', 'left', 'bottom', 'right'].map(k => [k, s.getPropertyValue('border-' + k) || s.border]).filter(([, v]) => v && !/none|^0/.test(v));
      if (sides.length) {
        x += '<w:pBdr>' + sides.map(([k, v]) => {
          const w = toPt((v.match(/[\d.]+(pt|px)/) || [])[0]) || .75;
          const st = /double/.test(v) ? 'double' : /dash/.test(v) ? 'dashed' : /dot/.test(v) ? 'dotted' : 'single';
          return `<w:${k} w:val="${st}" w:sz="${Math.max(2, Math.round(w * 8))}" w:space="4" w:color="${hex((v.match(/(#[0-9a-f]{3,6}|rgba?\([^)]+\))/i) || [])[0]) || '000000'}"/>`;
        }).join('') + '</w:pBdr>';
      }
      const bg = hex(s.backgroundColor);
      if (bg) x += `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`;
    }
    const sb = s ? toPt(s.getPropertyValue('--sb')) : null, sa = s ? toPt(s.getPropertyValue('--sa')) : null, lh = s?.lineHeight ? parseFloat(s.lineHeight) : null;
    if (sb != null || sa != null || (lh && !/px|pt/.test(s.lineHeight))) x += `<w:spacing${sb != null ? ` w:before="${Math.round(sb * 20)}"` : ''}${sa != null ? ` w:after="${Math.round(sa * 20)}"` : ''}${lh && !/px|pt/.test(s.lineHeight) ? ` w:line="${Math.round(lh * 240)}" w:lineRule="auto"` : ''}/>`;
    let left = s ? toPx(s.marginLeft) + toPx(s.paddingLeft) : 0;
    const right = s ? toPx(s.marginRight) : 0;
    const ti = s ? toPx(s.textIndent) : 0;
    if (pc.quote) left += 24;
    if (pc.hanging) { x += '<w:ind w:left="720" w:hanging="720"/>'; }
    else if (!pc.numPr && (left || right || ti)) x += `<w:ind${left ? ` w:left="${TW(left)}"` : ''}${right ? ` w:right="${TW(right)}"` : ''}${ti > 0 ? ` w:firstLine="${TW(ti)}"` : ti < 0 ? ` w:hanging="${TW(-ti)}"` : ''}/>`;
    let jc = s?.textAlign;
    if (!jc && nodes.length && nodes.every(n => (n.nodeType === 3 && !n.data.trim()) || (n.nodeType === 1 && n.tagName === 'IMG' && n.classList.contains('break')))) jc = 'center';
    const J = { center: 'center', right: 'right', end: 'right', justify: 'both', left: null, start: null };
    if (jc && J[jc]) x += `<w:jc w:val="${J[jc]}"/>`;
    return x;
  }

  inline(n, rp) {
    if (n.nodeType === 3) return this.run(n.data, rp);
    if (n.nodeType !== 1) return '';
    const t = n.tagName, p = { ...rp };
    const kids = () => [...n.childNodes].map(c => this.inline(c, p)).join('');
    if (t === 'BR') return '<w:r><w:br/></w:r>';
    if (t === 'IMG') return this.image(n);
    if (t === 'SUP' && n.classList.contains('fn')) return this.footnoteRef(n.dataset.fn);
    if (t === 'SPAN' && n.classList.contains('eq')) return this.run(n.dataset.tex || '', { ...p, i: true, font: 'Cambria Math' });
    if (t === 'SPAN' && n.classList.contains('fld')) {
      const instr = { page: 'PAGE', pages: 'NUMPAGES', date: 'DATE \\@ "d MMMM yyyy"', title: 'TITLE' }[n.dataset.f] || 'PAGE';
      return `<w:fldSimple w:instr=" ${instr} ">${this.run(n.textContent || '1', p)}</w:fldSimple>`;
    }
    if (t === 'SPAN' && n.classList.contains('bm')) { const id = this.bm++; return `<w:bookmarkStart w:id="${id}" w:name="${bmName(n.id)}"/><w:bookmarkEnd w:id="${id}"/>`; }
    this.applyCss(n, p);
    if (t === 'B' || t === 'STRONG') p.b = true;
    else if (t === 'I' || t === 'EM') p.i = true;
    else if (t === 'U') p.u = true;
    else if (t === 'S' || t === 'STRIKE') p.s = true;
    else if (t === 'SUP') p.va = 'superscript';
    else if (t === 'SUB') p.va = 'subscript';
    else if (t === 'CODE') p.font = 'Courier New';
    else if (t === 'MARK') p.hl = p.hl || 'FFFF00';
    if (t === 'A') {
      const href = n.getAttribute('href') || '';
      p.link = true;
      if (!href) return kids();
      if (href.startsWith('#')) return `<w:hyperlink w:anchor="${bmName(href.slice(1))}" w:history="1">${kids()}</w:hyperlink>`;
      return `<w:hyperlink r:id="${this.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', href, true)}" w:history="1">${kids()}</w:hyperlink>`;
    }
    if ((t === 'INS' || t === 'DEL') && n.classList.contains('sg')) {
      const iso = new Date(+n.dataset.t || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z');
      const a = X(n.dataset.a || 'Penulis');
      if (t === 'DEL') p.del = true;
      return `<w:${t.toLowerCase()} w:id="${this.bm++}" w:author="${a}" w:date="${iso}">${kids()}</w:${t.toLowerCase()}>`;
    }
    if (t === 'SPAN' && n.classList.contains('cmt') && !n.classList.contains('resolved') && n.dataset.c) {
      const cid = this.commentId(n.dataset.c);
      if (cid == null) return kids();
      let s = '';
      if (!this.cStarted.has(cid)) { this.cStarted.add(cid); s += `<w:commentRangeStart w:id="${cid}"/>`; }
      s += kids();
      if (this.cLast.get(n.dataset.c) === n) s += `<w:commentRangeEnd w:id="${cid}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${cid}"/></w:r>`;
      return s;
    }
    return kids();
  }
  applyCss(n, p) {
    const s = n.style;
    if (!s) return;
    const fw = s.fontWeight; if (fw) p.b = fw === 'bold' || parseInt(fw) >= 600;
    if (s.fontStyle) p.i = s.fontStyle === 'italic';
    const td = s.textDecorationLine || s.textDecoration;
    if (td) { if (/underline/.test(td)) p.u = true; if (/line-through/.test(td)) p.s = true; if (td === 'none') { p.u = false; p.s = false; } }
    const c = hex(s.color); if (c) p.color = c;
    const bg = hex(s.backgroundColor); if (bg) p.hl = bg;
    const fs = toPt(s.fontSize); if (fs) p.sz = fs;
    if (s.fontFamily) p.font = fontNameOf(s.fontFamily);
    if (s.verticalAlign === 'super') p.va = 'superscript'; else if (s.verticalAlign === 'sub') p.va = 'subscript';
  }
  rPr(p) {
    let x = '';
    if (p.link) x += '<w:rStyle w:val="Hyperlink"/>';
    if (p.font) x += `<w:rFonts w:ascii="${X(p.font)}" w:hAnsi="${X(p.font)}" w:cs="${X(p.font)}"/>`;
    if (p.b) x += '<w:b/>';
    if (p.i) x += '<w:i/>';
    if (p.s) x += '<w:strike/>';
    if (p.color) x += `<w:color w:val="${p.color}"/>`;
    if (p.sz) x += `<w:sz w:val="${Math.round(p.sz * 2)}"/><w:szCs w:val="${Math.round(p.sz * 2)}"/>`;
    if (p.u) x += '<w:u w:val="single"/>';
    if (p.hl) x += `<w:shd w:val="clear" w:color="auto" w:fill="${p.hl}"/>`;
    if (p.va) x += `<w:vertAlign w:val="${p.va}"/>`;
    return x;
  }
  run(text, p) {
    if (!text) return '';
    const pr = this.rPr(p);
    const T = p.del ? 'w:delText' : 'w:t';
    const parts = String(text).replace(/ /g, ' ').split(/(\t|\n)/);
    const body = parts.map(s => s === '\t' ? '<w:tab/>' : s === '\n' ? '<w:br/>' : s ? `<${T} xml:space="preserve">${X(s)}</${T}>` : '').join('');
    return body ? `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}${body}</w:r>` : '';
  }

  newNum(ordered, styleType, start) {
    const aid = this.abstracts.length;
    const fmtOf = st => ({ 'lower-alpha': 'lowerLetter', 'lower-latin': 'lowerLetter', 'upper-alpha': 'upperLetter', 'upper-latin': 'upperLetter', 'lower-roman': 'lowerRoman', 'upper-roman': 'upperRoman', 'decimal-leading-zero': 'decimalZero' }[st] || 'decimal');
    const custom = (styleType || '').match(/^["'](.+?)\s*["']$/);
    const BUL = ['•', '◦', '▪'], ORD = ['decimal', 'lowerLetter', 'lowerRoman'];
    let lv = '';
    for (let i = 0; i < 9; i++) {
      const ind = `<w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr>`;
      if (ordered) {
        const f = i === 0 ? fmtOf(styleType) : ORD[i % 3];
        lv += `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${f}"/><w:lvlText w:val="%${i + 1}."/><w:lvlJc w:val="left"/>${ind}</w:lvl>`;
      } else {
        const ch = i === 0 && custom ? custom[1] : i === 0 && styleType === 'circle' ? '◦' : i === 0 && styleType === 'square' ? '▪' : BUL[i % 3];
        lv += `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${X(ch)}"/><w:lvlJc w:val="left"/>${ind}<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl>`;
      }
    }
    this.abstracts.push(`<w:abstractNum w:abstractNumId="${aid}"><w:multiLevelType w:val="hybridMultilevel"/>${lv}</w:abstractNum>`);
    const nid = this.nums.length + 1;
    this.nums.push(`<w:num w:numId="${nid}"><w:abstractNumId w:val="${aid}"/>${start && +start !== 1 ? `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${+start}"/></w:lvlOverride>` : ''}</w:num>`);
    return nid;
  }
  list(el, lvl, pc, numId) {
    const check = el.classList.contains('checklist');
    if (!check && (numId == null || lvl === 0)) numId = this.newNum(el.tagName === 'OL', el.style.listStyleType, el.getAttribute('start'));
    let out = '';
    for (const li of el.children) {
      if (li.tagName === 'UL' || li.tagName === 'OL') { out += this.list(li, lvl + 1, pc, li.tagName === el.tagName ? numId : this.newNum(li.tagName === 'OL', li.style.listStyleType)); continue; }
      const inl = [], nested = [];
      for (const c of li.childNodes) {
        if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) nested.push(c);
        else if (c.nodeType === 1 && c.tagName === 'P') { if (inl.length) inl.push(document.createElement('br')); inl.push(...c.childNodes); }
        else inl.push(c);
      }
      if (check) out += this.para(inl, li, { ...pc, check: true }, this.run(li.dataset.checked === 'true' ? '☒ ' : '☐ ', {}));
      else out += this.para(inl, li, { ...pc, numPr: { numId, ilvl: Math.min(8, lvl) } });
      for (const nl of nested) out += this.list(nl, lvl + 1, pc, nl.tagName === el.tagName && !check ? numId : this.newNum(nl.tagName === 'OL', nl.style.listStyleType));
    }
    return out;
  }

  table(tb) {
    const G = [];
    [...tb.rows].forEach((tr, r) => {
      G[r] ||= [];
      let c = 0;
      for (const td of tr.cells) {
        while (G[r][c]) c++;
        const rs = td.rowSpan || 1, cs = td.colSpan || 1;
        for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) (G[r + i] ||= [])[c + j] = td;
        td._r = r; td._c = c; c += cs;
      }
    });
    const n = Math.max(1, ...G.map(r => r.length));
    const pct = tb.style.width && /%$/.test(tb.style.width) ? parseFloat(tb.style.width) / 100 : 1;
    const total = this.CW * pct;
    const cols = [...(tb.querySelector('colgroup')?.children || [])];
    let widths = [];
    for (let i = 0; i < n; i++) {
      const w = cols[i]?.style.width;
      widths.push(w ? (/%$/.test(w) ? parseFloat(w) / 100 * total : toPx(w)) : 0);
    }
    const known = widths.reduce((a, b) => a + b, 0), unknown = widths.filter(w => !w).length;
    widths = widths.map(w => w || Math.max(30, (total - known) / Math.max(1, unknown)));
    const sum = widths.reduce((a, b) => a + b, 0);
    widths = widths.map(w => w * total / sum);
    const nb = tb.classList.contains('nb');
    const c0 = tb.querySelector('td,th');
    const bw = c0?.style.borderWidth ? toPt(c0.style.borderWidth) : .75;
    const bc = hex(c0?.style.borderColor) || '000000';
    const B = nb || !bw ? 'none" w:sz="0' : `single" w:sz="${Math.max(2, Math.round(bw * 8))}`;
    const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => `<w:${k} w:val="${B}" w:space="0" w:color="${nb ? 'auto' : bc}"/>`).join('');
    const pad = c0?.style.padding ? toPt(c0.style.padding) : 5;
    const jc = tb.style.marginLeft === 'auto' ? (tb.style.marginRight === 'auto' ? 'center' : 'right') : null;
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${TW(total)}" w:type="dxa"/>${jc ? `<w:jc w:val="${jc}"/>` : ''}<w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="${Math.round(pad * 20)}" w:type="dxa"/><w:left w:w="${Math.round(pad * 20)}" w:type="dxa"/><w:bottom w:w="${Math.round(pad * 20)}" w:type="dxa"/><w:right w:w="${Math.round(pad * 20)}" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`;
    x += '<w:tblGrid>' + widths.map(w => `<w:gridCol w:w="${TW(w)}"/>`).join('') + '</w:tblGrid>';
    G.forEach((row, r) => {
      const isHead = tb.rows[r] && [...tb.rows[r].cells].length && [...tb.rows[r].cells].every(c => c.tagName === 'TH');
      x += `<w:tr>${isHead ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
      for (let c = 0; c < n; c++) {
        const cell = row[c];
        if (!cell) { x += `<w:tc><w:tcPr><w:tcW w:w="${TW(widths[c])}" w:type="dxa"/></w:tcPr><w:p/></w:tc>`; continue; }
        const cs = cell.colSpan || 1;
        const w = widths.slice(c, c + cs).reduce((a, b) => a + b, 0);
        const span = cs > 1 ? `<w:gridSpan w:val="${cs}"/>` : '';
        if (cell._c !== c) continue;
        if (cell._r !== r) { x += `<w:tc><w:tcPr><w:tcW w:w="${TW(w)}" w:type="dxa"/>${span}<w:vMerge/></w:tcPr><w:p/></w:tc>`; c += cs - 1; continue; }
        const bg = hex(cell.style.backgroundColor) || (cell.tagName === 'TH' ? 'F3F3F3' : null);
        const va = { middle: 'center', bottom: 'bottom' }[cell.style.verticalAlign];
        let inner = this.blocks(cell, cell.tagName === 'TH' ? { bold: true } : {});
        if (!inner || /<\/w:tbl>$/.test(inner)) inner += '<w:p/>';
        x += `<w:tc><w:tcPr><w:tcW w:w="${TW(w)}" w:type="dxa"/>${span}${cell.rowSpan > 1 ? '<w:vMerge w:val="restart"/>' : ''}${bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : ''}${va ? `<w:vAlign w:val="${va}"/>` : ''}</w:tcPr>${inner}</w:tc>`;
        c += cs - 1;
      }
      x += '</w:tr>';
    });
    return x + '</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
  }

  toc(el) {
    const tabPos = TW(this.CW);
    return [...el.querySelectorAll('p')].map(p => {
      const a = p.querySelector('a');
      const lvl = +((p.className.match(/l(\d)/) || [])[1] || 1);
      const pn = p.querySelector('.pn')?.textContent || '';
      const href = a?.getAttribute('href') || '';
      const text = this.run(a?.textContent || p.textContent, {});
      const link = href.startsWith('#') ? `<w:hyperlink w:anchor="${bmName(href.slice(1))}" w:history="1">${text}</w:hyperlink>` : text;
      return `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${tabPos}"/></w:tabs><w:spacing w:after="60"/><w:ind w:left="${(lvl - 1) * 360}"/></w:pPr>${link}${pn ? `<w:r><w:tab/><w:t>${X(pn)}</w:t></w:r>` : ''}</w:p>`;
    }).join('');
  }

  image(img) {
    const info = this.imgs.get(img.getAttribute('src'));
    if (!info) return '';
    if (!info.rid) {
      const name = `image${this.media.length + 1}.${info.ext}`;
      this.media.push({ name, bytes: info.bytes });
      info.rid = this.rel('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', 'media/' + name);
    }
    let w = img.style.width ? (/%$/.test(img.style.width) ? parseFloat(img.style.width) / 100 * this.CW : toPx(img.style.width)) : (+img.getAttribute('width') || info.w);
    w = Math.min(w || info.w, this.CW);
    const hgt = w * info.h / info.w;
    const id = this.pic++;
    const cx = EMU(w), cy = EMU(hgt);
    const alt = X(img.getAttribute('alt') || '');
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Gambar ${id}" descr="${alt}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Gambar ${id}" descr="${alt}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${info.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  footnoteRef(id) {
    const n = this.footnotes.length + 1;
    const t = document.createElement('div');
    t.innerHTML = this.doc.footnotes?.[id] || '';
    this.footnotes.push({ n, el: t });
    return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${n}"/></w:r>`;
  }
  commentId(cid) {
    if (!this.comments.has(cid)) return null;
    return this.comments.get(cid).n;
  }
}

async function imageData(src) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  let w = img.naturalWidth || 300, hh = img.naturalHeight || 150;
  const m = src.match(/^data:image\/(png|jpeg|jpg);base64,(.*)$/);
  if (m) {
    const bin = atob(m[2]), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return { bytes: u, ext: m[1] === 'png' ? 'png' : 'jpeg', w, h: hh };
  }
  const k = /svg/.test(src) ? 2 : 1;
  const c = document.createElement('canvas');
  c.width = w * k; c.height = hh * k;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: 'png', w, h: hh };
}

function stylesXml(doc) {
  const n = resolvedStyle(doc.styles, 'normal');
  const rp = s => `<w:rFonts w:ascii="${X(s.font)}" w:hAnsi="${X(s.font)}" w:cs="${X(s.font)}"/>${s.bold ? '<w:b/>' : ''}${s.italic ? '<w:i/>' : ''}<w:color w:val="${hex(s.color) || '000000'}"/><w:sz w:val="${Math.round(s.size * 2)}"/><w:szCs w:val="${Math.round(s.size * 2)}"/>`;
  const sp = s => `<w:spacing w:before="${Math.round((s.sb || 0) * 20)}" w:after="${Math.round((s.sa || 0) * 20)}" w:line="${Math.round((s.lh || 1.15) * 240)}" w:lineRule="auto"/>`;
  const para = (id, name, s, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr>${extra.includes('keepNext') ? '<w:keepNext/><w:keepLines/>' : ''}${sp(s)}${extra.replace('keepNext', '')}</w:pPr><w:rPr>${rp(s)}</w:rPr></w:style>`;
  let x = `${HDR}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${rp(n)}<w:lang w:val="${doc.lang === 'en' ? 'en-US' : 'id-ID'}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>${sp(n)}</w:pPr></w:pPrDefault></w:docDefaults>`;
  x += `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr>${sp(n)}</w:pPr><w:rPr>${rp(n)}</w:rPr></w:style>`;
  x += para('Title', 'Title', resolvedStyle(doc.styles, 'title'));
  x += para('Subtitle', 'Subtitle', resolvedStyle(doc.styles, 'subtitle'));
  for (let i = 1; i <= 6; i++) x += para('Heading' + i, 'heading ' + i, resolvedStyle(doc.styles, 'h' + i), `keepNext<w:outlineLvl w:val="${i - 1}"/>`);
  x += `<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="C6CBD1"/></w:pBdr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/><w:color w:val="3C4043"/></w:rPr></w:style>`;
  x += `<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F4F6F8"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr></w:style>`;
  x += `<w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>`;
  x += `<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>`;
  x += `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1155CC"/><w:u w:val="single"/></w:rPr></w:style>`;
  x += `<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>`;
  x += `<w:style w:type="paragraph" w:styleId="CommentText"><w:name w:val="annotation text"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style>`;
  return x + '</w:styles>';
}

export async function buildDocx(doc, html) {
  await loadScript(JSZIP);
  const w = new Writer(doc);
  const root = document.createElement('div');
  root.innerHTML = html;
  root.querySelectorAll('.cmt[data-c]').forEach(s => w.cLast.set(s.dataset.c, s));
  let cn = 0;
  for (const c of doc.comments || []) if (!c.resolved && w.cLast.has(c.id)) w.comments.set(c.id, { n: cn++, c });
  await w.prepareImages(root);
  const body = w.blocks(root) || '<w:p/>';
  const pg = doc.page;
  const hf = [];
  const part = (kind, html, type) => {
    if (!html) return '';
    const t = document.createElement('div');
    t.innerHTML = html;
    t.querySelectorAll('img').forEach(i => i.remove());
    const idx = hf.length + 1;
    const name = `${kind}${idx}.xml`;
    const tag = kind === 'header' ? 'hdr' : 'ftr';
    hf.push({ name, xml: `${HDR}<w:${tag} ${NS}>${w.blocks(t) || '<w:p/>'}</w:${tag}>`, kind });
    const rid = w.rel(`http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}`, name);
    return `<w:${kind}Reference w:type="${type}" r:id="${rid}"/>`;
  };
  let refs = part('header', pg.header.html, 'default') + part('footer', pg.footer.html, 'default');
  if (pg.firstDiff) refs += part('header', pg.header.first || '<p></p>', 'first') + part('footer', pg.footer.first || '<p></p>', 'first');
  const mg = pg.margins;
  const pgBorders = pg.border ? `<w:pgBorders w:offsetFrom="page">${['top', 'left', 'bottom', 'right'].map(k => `<w:${k} w:val="single" w:sz="${Math.round((pg.border.w || 1) * 6)}" w:space="${Math.min(31, Math.round((pg.border.offset ?? 24) * .75))}" w:color="${hex(pg.border.color) || '000000'}"/>`).join('')}</w:pgBorders>` : '';
  const sect = `<w:sectPr>${refs}<w:pgSz w:w="${TW(w.W)}" w:h="${TW(w.H)}"${pg.orient === 'landscape' ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${TW(cm2px(mg.t))}" w:right="${TW(cm2px(mg.r))}" w:bottom="${TW(cm2px(mg.b))}" w:left="${TW(cm2px(mg.l))}" w:header="${TW(cm2px(pg.hfDist ?? 1.27))}" w:footer="${TW(cm2px(pg.hfDist ?? 1.27))}" w:gutter="0"/>${pgBorders}${pg.firstDiff ? '<w:titlePg/>' : ''}</w:sectPr>`;
  const bgc = hex(pg.color);
  const docXml = `${HDR}<w:document ${NS}>${bgc && bgc !== 'FFFFFF' ? `<w:background w:color="${bgc}"/>` : ''}<w:body>${body}${sect}</w:body></w:document>`;

  const fnXml = `${HDR}<w:footnotes ${NS}><w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>` +
    w.footnotes.map(f => `<w:footnote w:id="${f.n}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>${[...f.el.childNodes].map(n => w.inline(n, {})).join('')}</w:p></w:footnote>`).join('') + '</w:footnotes>';
  const cmXml = `${HDR}<w:comments ${NS}>` + [...w.comments.values()].map(({ n, c }) => {
    const iso = new Date(c.time).toISOString().replace(/\.\d+Z$/, 'Z');
    const ini = X(String(c.author).split(/\s+/).map(s => s[0]).join('').slice(0, 3).toUpperCase());
    const paras = [`<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>${w.run(c.text, {})}</w:p>`, ...(c.replies || []).map(r => `<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr>${w.run(`${r.author}: ${r.text}`, {})}</w:p>`)];
    return `<w:comment w:id="${n}" w:author="${X(c.author)}" w:date="${iso}" w:initials="${ini}">${paras.join('')}</w:comment>`;
  }).join('') + '</w:comments>';
  const numXml = `${HDR}<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${w.abstracts.join('')}${w.nums.join('')}</w:numbering>`;
  const settings = `${HDR}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${bgc && bgc !== 'FFFFFF' ? '<w:displayBackgroundShape/>' : ''}<w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const docRels = [
    { id: 'rId1', type: R + 'styles', target: 'styles.xml' },
    { id: 'rId2', type: R + 'numbering', target: 'numbering.xml' },
    { id: 'rId3', type: R + 'settings', target: 'settings.xml' },
    { id: 'rId4', type: R + 'footnotes', target: 'footnotes.xml' },
    ...(w.comments.size ? [{ id: 'rId5', type: R + 'comments', target: 'comments.xml' }] : []),
    ...w.rels,
  ];
  const relsXml = `${HDR}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${docRels.map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${X(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const ct = `${HDR}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>` +
    (w.comments.size ? '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' : '') +
    hf.map(p => `<Override PartName="/word/${p.name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${p.kind}+xml"/>`).join('') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';

  const zip = new window.JSZip();
  const _file = zip.file.bind(zip);
  zip.file = (n, d) => _file(n, d, { createFolders: false });
  zip.file('[Content_Types].xml', ct);
  zip.file('_rels/.rels', `${HDR}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${R}extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file('docProps/core.xml', `${HDR}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(doc.title)}</dc:title><dc:creator>${X(doc.author || 'Amatu Docs')}</dc:creator><cp:lastModifiedBy>${X(doc.author || 'Amatu Docs')}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date(doc.created || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  zip.file('docProps/app.xml', `${HDR}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Amatu Docs</Application></Properties>`);
  zip.file('word/document.xml', docXml);
  zip.file('word/styles.xml', stylesXml(doc));
  zip.file('word/numbering.xml', numXml);
  zip.file('word/settings.xml', settings);
  zip.file('word/footnotes.xml', fnXml);
  if (w.comments.size) zip.file('word/comments.xml', cmXml);
  zip.file('word/_rels/document.xml.rels', relsXml);
  for (const p of hf) zip.file('word/' + p.name, p.xml);
  for (const m of w.media) zip.file('word/media/' + m.name, m.bytes);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}
export { STYLE_KEYS };
