// Opskrifter — curated gallery. Filter/search/favourites; cards link OUT with credit.
// Images use the source photo when it loads, else a tasteful placeholder (never a broken image).
import { PATTERNS, CATEGORIES, CAT_ICON } from '../data/patterns.js';
import { store } from './store.js';

const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const DIFF = { 'begynder': '● Begynder', 'let øvet': '●● Let øvet', 'øvet': '●●● Øvet' };
let node, grid, filters, favs;

export function initGallery(container) {
  node = container;
  filters = { cat: 'all', freeOnly: false, favOnly: false, q: '' };
  favs = new Set(store.get('favorites', []));
  node.innerHTML = `<div class="pagehead"><h1>Opskrifter</h1>
    <p class="hint">Håndplukkede, anbefalede strikkeopskrifter. Tryk for at åbne originalen.</p></div>`;

  const controls = E('div', 'gctrls');
  const search = E('input', 'gsearch'); search.type = 'search'; search.placeholder = '🔍 Søg navn eller designer…';
  search.oninput = () => { filters.q = search.value.trim().toLowerCase(); renderGrid(); };
  const chips = E('div', 'chips');
  CATEGORIES.forEach((c) => { const b = E('button', 'chip' + (c.id === 'all' ? ' on' : ''), c.label); b.dataset.cat = c.id;
    b.onclick = () => { filters.cat = c.id; chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x.dataset.cat === c.id)); renderGrid(); }; chips.append(b); });
  const toggles = E('div', 'gtoggles');
  const tFree = E('button', 'toggle', 'Kun gratis'); tFree.onclick = () => { filters.freeOnly = !filters.freeOnly; tFree.classList.toggle('on', filters.freeOnly); renderGrid(); };
  const tFav = E('button', 'toggle', '♥ Gemte'); tFav.onclick = () => { filters.favOnly = !filters.favOnly; tFav.classList.toggle('on', filters.favOnly); renderGrid(); };
  toggles.append(tFree, tFav);
  controls.append(search, chips, toggles);
  node.append(controls);

  grid = E('div', 'pgrid'); node.append(grid);
  renderGrid();
}

function renderGrid() {
  const list = PATTERNS.filter((p) =>
    (filters.cat === 'all' || p.category === filters.cat) &&
    (!filters.freeOnly || p.free) &&
    (!filters.favOnly || favs.has(p.id)) &&
    (!filters.q || (p.name + ' ' + p.designer + ' ' + p.source).toLowerCase().includes(filters.q)));
  grid.innerHTML = '';
  if (!list.length) { grid.append(E('p', 'empty', filters.favOnly ? 'Ingen gemte endnu — tryk ♥ på en opskrift.' : 'Ingen opskrifter matcher.')); return; }
  list.forEach((p) => grid.append(card(p)));
}

function card(p) {
  const a = E('article', 'pcard');
  const thumb = E('div', 'thumb t-' + p.category, `<span class="ph">${CAT_ICON[p.category] || '🧶'}</span>`);
  if (p.image) {
    const img = E('img'); img.loading = 'lazy'; img.alt = p.name; img.src = p.image;
    img.onerror = () => img.remove(); // fall back to placeholder
    thumb.append(img);
  }
  const fav = E('button', 'favbtn' + (favs.has(p.id) ? ' on' : ''), favs.has(p.id) ? '♥' : '♡');
  fav.onclick = () => { if (favs.has(p.id)) favs.delete(p.id); else favs.add(p.id); store.set('favorites', [...favs]);
    fav.classList.toggle('on'); fav.textContent = favs.has(p.id) ? '♥' : '♡'; if (filters.favOnly) renderGrid(); };
  thumb.append(fav);

  const tags = E('div', 'ptags');
  tags.innerHTML = `${p.free ? '<span class="tag free">Gratis</span>' : '<span class="tag paid">Betalt</span>'}
    <span class="tag">${DIFF[p.difficulty] || p.difficulty}</span>
    ${p.yarnWeight ? `<span class="tag">${p.yarnWeight}</span>` : ''}
    <span class="tag lang">${p.lang === 'da' ? 'DA' : 'EN'}</span>`;
  const body = E('div', 'pbody');
  body.append(E('b', 'pname', esc(p.name)), E('div', 'pmeta', `${esc(p.designer)} · ${esc(p.source)}`), tags);
  const link = E('a', 'plink', 'Se opskrift →'); link.href = p.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  body.append(link);

  a.append(thumb, body);
  return a;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
