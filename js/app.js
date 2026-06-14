// App shell: Danish bottom-nav router + shared UI helpers (el, modal).
import { initCounters } from './counters.js';
import { initCalculators } from './calculators.js';
import { initGallery } from './gallery.js';
import { initStash } from './stash.js';
import { exportData } from './backup.js';
import { store } from './store.js';

export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// Simple centred modal. content = HTMLElement. Returns { close }.
export function modal(content, { onClose } = {}) {
  const ov = el('div', 'modal-ov');
  const panel = el('div', 'modal-panel');
  panel.append(content);
  ov.append(panel);
  const close = () => { ov.remove(); onClose && onClose(); };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.body.append(ov);
  return { close, panel };
}

const SVG = (p, sw = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const ICONS = {
  counter: SVG('<path d="M6 5v14M10 5v14M14 5v14M18 5v14"/><path d="M4 16.5 20 8.5"/>'),
  calc: SVG('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>'),
  yarn: SVG('<circle cx="12" cy="12" r="9"/><path d="M5 9c4.5 2.2 9.5 2.2 14 0M4 13c5 3 11 3 16 0M9 3.5c-2.2 4.5-2.2 12.5 0 17M15 3.5c2.2 4.5 2.2 12.5 0 17" stroke-width="1.3"/>', 2),
  box: SVG('<path d="M3 8 5.2 4h13.6L21 8M3 8h18M3 8v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8M9.5 12h5"/>'),
  gear: SVG('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>'),
};

const SECTIONS = [
  { id: 'taeller', label: 'Projekter', icon: ICONS.counter, init: initCounters },
  { id: 'beregner', label: 'Beregner', icon: ICONS.calc, init: initCalculators },
  { id: 'opskrifter', label: 'Opskrifter', icon: ICONS.yarn, init: initGallery },
  { id: 'lager', label: 'Garn', icon: ICONS.box, init: initStash },
];

const app = document.getElementById('app');
const views = {};
let current = null;

// Owner name → app title. Triple-tap the title to change it.
const possessive = (name) => name + (/[sxzSXZ]$/.test(name) ? "'" : 's');
function brandTitle() { return possessive(store.get('ownerName', 'Emma')) + ' Strik'; }
function applyBrand() {
  const b = document.querySelector('.brand'); if (b) b.textContent = brandTitle();
  document.title = brandTitle();
}
function renameOwner() {
  const cur = store.get('ownerName', 'Emma');
  const name = (prompt('Hvis strikke-app er det? Skriv et fornavn:', cur) || '').trim();
  if (!name) return;
  store.set('ownerName', name.slice(0, 24));
  applyBrand();
}

function build() {
  const header = el('header', 'topbar', `<span class="brandicon">${ICONS.yarn}</span><span class="brand"></span>`);
  const brandEl = header.querySelector('.brand');
  brandEl.textContent = brandTitle();
  document.title = brandTitle();
  brandEl.title = 'Tryk 3 gange for at skifte navn';
  brandEl.addEventListener('click', () => { brandEl._n = (brandEl._n || 0) + 1; clearTimeout(brandEl._t); if (brandEl._n >= 3) { brandEl._n = 0; renameOwner(); } else brandEl._t = setTimeout(() => { brandEl._n = 0; }, 600); });
  const main = el('main', 'view');
  const nav = el('nav', 'bottomnav');
  app.append(header, main, nav);

  SECTIONS.forEach((s) => {
    const v = el('section', 'page'); v.id = 'page-' + s.id; v.hidden = true;
    main.append(v); views[s.id] = { sec: s, node: v, built: false };
    const btn = el('button', 'navbtn', `<span class="ni">${s.icon}</span><span class="nl">${s.label}</span>`);
    btn.dataset.id = s.id;
    btn.onclick = () => show(s.id);
    nav.append(btn);
  });
  show('taeller');
}

function show(id) {
  if (current === id) return;
  current = id;
  Object.values(views).forEach((v) => { v.node.hidden = v.sec.id !== id; });
  document.querySelectorAll('.navbtn').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  const v = views[id];
  if (!v.built) { v.sec.init(v.node, { el, modal }); v.built = true; }
  else if (v.sec.id !== 'taeller') { /* sections re-render on init only; counters self-manages */ }
  window.__es && (window.__es.current = id);
}

// Ask the browser to keep our data (helps resist iOS eviction). Best-effort.
async function requestPersist() { try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) {} }

// Gentle reminder to back up if there's data and it's been a while / never.
function maybeBackupReminder() {
  const hasData = (store.get('projects', []).length || store.get('collections', []).length || store.get('stash', []).length);
  if (!hasData) return;
  const last = store.get('lastBackupAt', 0);
  const snooze = store.get('backupSnooze', 0);
  const DAY = 86400000;
  if (Date.now() - snooze < 14 * DAY) return;
  if (last && Date.now() - last < 30 * DAY) return;
  const bar = el('div', 'backupbar', `<span>Husk en sikkerhedskopi, så du ikke mister dine ting.</span>`);
  const go = el('button', 'bb-go', 'Gem nu'); go.onclick = async () => { try { await exportData(); } catch (e) {} bar.remove(); };
  const x = el('button', 'bb-x', '✕'); x.onclick = () => { store.set('backupSnooze', Date.now()); bar.remove(); };
  bar.append(go, x); app.insertBefore(bar, app.children[1]); // under the topbar
}

build();
requestPersist();
maybeBackupReminder();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
window.__es = { show, current };
