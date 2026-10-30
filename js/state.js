// Shared editor state. Feature modules attach behaviour to E at runtime to avoid import cycles.

export const E = {
  doc: null, root: null, body: null, canvas: null, inner: null, zoomer: null, pages: null, bg: null, fg: null, cmtCol: null,
  geo: null, zoom: 1, zoomFit: false, mode: 'edit', pageCount: 1, pageOf: new Map(), pageNotes: [[]], fnOrder: [],
  lastRange: null, lastEd: null, assets: new Map(), printing: false, dead: true,
  view: { ruler: true, outline: false, np: false, panel: null },
};

const PKEY = 'adocs.prefs';
const PDEF = {
  name: '', smartQuotes: true, autoLink: true, autoList: true, autoCorrect: true, spell: true,
  wordCount: false, pageDefault: null, styleDefault: null, recentFonts: [], recentChars: [],
  ruler: true, outline: false, homeView: 'grid', homeSort: 'modified',
};
export const Prefs = (() => { try { return { ...PDEF, ...JSON.parse(localStorage.getItem(PKEY) || '{}') }; } catch { return { ...PDEF }; } })();
export function savePrefs() { try { localStorage.setItem(PKEY, JSON.stringify(Prefs)); } catch {} }
export const me = () => Prefs.name || 'Saya';
