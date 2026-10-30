// Voice typing via the Web Speech API.
import { E } from './state.js';
import { h, icon, toast, select } from './ui.js';

let panel = null, rec = null, on = false;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function toggleVoice() {
  if (panel) { stop(); panel.remove(); panel = null; return; }
  if (!SR) { toast('Browser ini belum mendukung pengetikan suara. Gunakan Chrome atau Safari terbaru.'); return; }
  if (!E.canEdit()) return;
  const mic = h('button', { class: 'mic', 'aria-label': 'Mulai atau berhenti merekam', onclick: () => on ? stop() : start() }, icon('mic'));
  const interim = h('div', { class: 'interim' }, 'Klik mikrofon untuk mulai berbicara');
  const lang = select([['id-ID', 'Bahasa Indonesia'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['jv-ID', 'Basa Jawa'], ['su-ID', 'Basa Sunda'], ['ms-MY', 'Bahasa Melayu']], E.doc.lang === 'en' ? 'en-US' : 'id-ID');
  lang.style.width = '170px'; lang.style.height = '34px';
  panel = h('div', { class: 'voice glass-strong refract' }, mic, interim, lang, h('button', { class: 'ib sm', 'aria-label': 'Tutup', onclick: toggleVoice }, icon('close')));
  E.root.append(panel);
  function start() {
    E.restoreSel();
    rec = new SR();
    rec.lang = lang.value; rec.continuous = true; rec.interimResults = true;
    rec.onresult = ev => {
      let fin = '', tmp = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) fin += r[0].transcript; else tmp += r[0].transcript; }
      interim.textContent = tmp || 'Mendengarkan…';
      if (fin) {
        E.restoreSel();
        const r = E.range();
        const prev = r && r.startContainer.nodeType === 3 ? r.startContainer.data.slice(0, r.startOffset) : '';
        let t = fin.trim();
        t = t.replace(/\s*\b(titik koma)\b/gi, ';').replace(/\s*\b(titik dua)\b/gi, ':').replace(/\s*\b(titik)\b/gi, '.').replace(/\s*\b(koma)\b/gi, ',').replace(/\s*\b(tanda tanya)\b/gi, '?').replace(/\s*\b(tanda seru)\b/gi, '!');
        if (/[.!?]\s*$/.test(prev) || !prev.trim()) t = t.charAt(0).toUpperCase() + t.slice(1);
        if (prev && !/\s$/.test(prev)) t = ' ' + t;
        if (/\b(baris baru|new line)\b/i.test(t)) { E.insertText(t.replace(/\s*\b(baris baru|new line)\b\s*/i, '')); document.execCommand('insertParagraph'); return; }
        E.insertText(t);
      }
    };
    rec.onerror = ev => { if (ev.error === 'not-allowed') toast('Izin mikrofon ditolak'); stop(); };
    rec.onend = () => { if (on) { try { rec.start(); } catch { stop(); } } };
    try { rec.start(); on = true; mic.classList.add('on'); interim.textContent = 'Mendengarkan…'; } catch { toast('Mikrofon tidak dapat digunakan'); }
  }
  function stop() { on = false; mic.classList.remove('on'); try { rec?.stop(); } catch {} rec = null; interim.textContent = 'Klik mikrofon untuk mulai berbicara'; }
  panel._stop = stop;
  start();
}
function stop() { panel?._stop?.(); }
