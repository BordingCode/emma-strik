// App shell: Danish bottom-nav router + shared UI helpers (el, modal).
import { initCounters } from './counters.js';
import { initCalculators } from './calculators.js';
import { initGallery } from './gallery.js';
import { initStash } from './stash.js';
import { exportData, importData } from './backup.js';

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

function build() {
  const header = el('header', 'topbar', `<span class="brandicon">${ICONS.yarn}</span><span class="brand">Emmas&nbsp;Strik</span>`);
  const gear = el('button', 'gearbtn', ICONS.gear); gear.onclick = backupSheet; header.append(gear);
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

function backupSheet() {
  const f = el('div', 'sheet', `<h2>Sikkerhedskopi</h2>
    <p class="hint" style="margin-bottom:12px">Alt du tilføjer (egne opskrifter, samlinger, lager, projekter) gemmes kun på denne telefon. Lav en sikkerhedskopi, så du ikke mister det — og kan flytte det til en anden enhed.</p>`);
  const acts = el('div', 'sheetacts');
  const exp = el('button', 'sheetbtn', '⬇ Gem sikkerhedskopi');
  exp.onclick = async () => { exp.textContent = 'Gemmer…'; try { await exportData(); } catch (e) { alert('Kunne ikke eksportere.'); } exp.textContent = '⬇ Gem sikkerhedskopi'; };
  const imp = el('label', 'sheetbtn', '⬆ Gendan fra fil');
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json'; inp.style.display = 'none';
  inp.onchange = async () => { if (!inp.files[0]) return; try { await importData(inp.files[0]); alert('Gendannet! Appen genindlæses.'); location.reload(); } catch (e) { alert('Kunne ikke gendanne: ' + e.message); } };
  imp.append(inp);
  const cancel = el('button', 'sheetbtn subtle', 'Luk'); cancel.onclick = () => m.close();
  acts.append(exp, imp, cancel); f.append(acts);
  const m = modal(f);
}

build();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
window.__es = { show, current };
