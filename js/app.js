// App shell: Danish bottom-nav router + shared UI helpers (el, modal).
import { initCounters } from './counters.js';
import { initCalculators } from './calculators.js';
import { initGallery } from './gallery.js';

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

const SECTIONS = [
  { id: 'taeller', label: 'Tæller', icon: '🔢', init: initCounters },
  { id: 'beregner', label: 'Beregner', icon: '🧮', init: initCalculators },
  { id: 'opskrifter', label: 'Opskrifter', icon: '🧶', init: initGallery },
];

const app = document.getElementById('app');
const views = {};
let current = null;

function build() {
  const header = el('header', 'topbar', `<span class="brand">Emmas&nbsp;Strik</span>`);
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

build();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
window.__es = { show, current };
