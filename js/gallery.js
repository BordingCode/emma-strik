// Opskrifter — curated gallery + Emma's own uploads, owned flag, custom collections.
import { PATTERNS, CATEGORIES, CAT_ICON } from '../data/patterns.js';
import { store, uid } from './store.js';
import { allUploads, putUpload, delUpload } from './idb.js';
import { CAT_ICONS, ICON_GROUPS, DEFAULT_ICON } from './caticons.js';
import { openReader } from './reader.js';

const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const DIFF = { 'begynder': '● Begynder', 'let øvet': '●● Let øvet', 'øvet': '●●● Øvet' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let node, M, filters, favs, owned, collections, uploads;
const urlCache = new Map();

export async function initGallery(container, helpers) {
  node = container; M = helpers.modal;
  filters = { cat: 'all', freeOnly: false, favOnly: false, ownedOnly: false, buyOnly: false, collection: null, q: '' };
  favs = new Set(store.get('favorites', []));
  owned = new Set(store.get('owned', []));
  collections = store.get('collections', []);
  uploads = [];
  try { uploads = await allUploads(); } catch (e) {}
  render();
}

const saveFavs = () => store.set('favorites', [...favs]);
const saveOwned = () => store.set('owned', [...owned]);
const saveCollections = () => store.set('collections', collections);

function uploadCard(u) {
  const isImg = (u.mime || '').startsWith('image/');
  let img = null;
  if (isImg) { if (!urlCache.has(u.id)) urlCache.set(u.id, URL.createObjectURL(u.blob)); img = urlCache.get(u.id); }
  return { id: 'up:' + u.id, name: u.name, designer: u.designer || 'Egen opskrift', source: 'Min',
    url: null, image: img, category: u.category || 'sweater', yarnWeight: null, difficulty: null,
    free: true, lang: 'da', own: true, upload: u };
}
const allCards = () => PATTERNS.concat(uploads.map(uploadCard));
const isOwned = (p) => p.own || owned.has(p.id);

function render() {
  node.innerHTML = '';
  node.append(E('div', 'pagehead', `<h1>Opskrifter</h1>
    <p class="hint">Håndplukkede opskrifter + dine egne. Tryk for at åbne.</p>`));

  // controls
  const ctr = E('div', 'gctrls');
  const top = E('div', 'gtoprow');
  const search = E('input', 'gsearch'); search.type = 'search'; search.placeholder = '🔍 Søg…'; search.value = filters.q;
  search.oninput = () => { filters.q = search.value.trim().toLowerCase(); regrid(); };
  const addBtn = E('button', 'addown', '+ Egen'); addBtn.onclick = uploadModal;
  top.append(search, addBtn);

  const chips = E('div', 'chips');
  CATEGORIES.concat([{ id: 'mine', label: 'Mine' }]).forEach((c) => {
    const b = E('button', 'chip' + (filters.cat === c.id ? ' on' : ''), c.label); b.dataset.cat = c.id;
    b.onclick = () => { filters.cat = c.id; render(); }; chips.append(b);
  });

  const colRow = E('div', 'chips colrow');
  const cards = allCards();
  collections.forEach((col) => {
    const cnt = cards.filter((p) => (col.items || []).includes(p.id)).length;
    const b = E('button', 'chip col' + (filters.collection === col.id ? ' on' : ''));
    b.innerHTML = `<span class="cicon">${CAT_ICONS[col.icon] || CAT_ICONS[DEFAULT_ICON]}</span>${esc(col.name)}<span class="ccount">${cnt}</span>`;
    b.onclick = () => { filters.collection = filters.collection === col.id ? null : col.id; render(); };
    colRow.append(b);
  });
  const newCol = E('button', 'chip newcol', '+ Samling'); newCol.onclick = () => newCollection();
  colRow.append(newCol);

  const toggles = E('div', 'gtoggles');
  const mk = (label, key) => { const b = E('button', 'toggle' + (filters[key] ? ' on' : ''), label); b.onclick = () => { filters[key] = !filters[key]; render(); }; return b; };
  toggles.append(mk('Gratis', 'freeOnly'), mk('✓ Ejet', 'ownedOnly'), mk('🛒 Til køb', 'buyOnly'), mk('♥ Gemte', 'favOnly'));

  ctr.append(top, chips, colRow, toggles);
  node.append(ctr);

  const gridWrap = E('div', 'pgrid'); gridWrap.id = 'pgrid'; node.append(gridWrap);
  regrid();
}

function regrid() {
  const grid = node.querySelector('#pgrid'); if (!grid) return;
  const col = filters.collection ? collections.find((c) => c.id === filters.collection) : null;
  const list = allCards().filter((p) =>
    (filters.cat === 'all' || (filters.cat === 'mine' ? !!p.own : p.category === filters.cat)) &&
    (!filters.freeOnly || (p.free && !isOwned(p))) &&
    (!filters.favOnly || favs.has(p.id)) &&
    (!filters.ownedOnly || isOwned(p)) &&
    (!filters.buyOnly || (!p.free && !isOwned(p))) &&
    (!col || (col.items || []).includes(p.id)) &&
    (!filters.q || (p.name + ' ' + p.designer + ' ' + p.source).toLowerCase().includes(filters.q)));
  grid.innerHTML = '';
  if (!list.length) { grid.append(E('p', 'empty', emptyMsg())); return; }
  list.forEach((p) => grid.append(card(p)));
}
function emptyMsg() {
  if (filters.cat === 'mine') return 'Ingen egne opskrifter endnu — tryk “+ Egen”.';
  if (filters.favOnly) return 'Ingen gemte endnu — tryk ♥ på en opskrift.';
  if (filters.collection) return 'Samlingen er tom. Tryk ⋯ på en opskrift for at føje den til.';
  return 'Ingen opskrifter matcher.';
}

function card(p) {
  const a = E('article', 'pcard');
  const thumb = E('div', 'thumb t-' + p.category, `<span class="ph">${p.own ? '📄' : (CAT_ICON[p.category] || '🧶')}</span>`);
  if (p.image) { const img = E('img'); img.loading = 'lazy'; img.alt = p.name; img.src = p.image; img.onerror = () => img.remove(); thumb.append(img); }
  if (p.own) thumb.append(E('span', 'mybadge', 'Min'));
  const fav = E('button', 'favbtn' + (favs.has(p.id) ? ' on' : ''), favs.has(p.id) ? '♥' : '♡');
  fav.onclick = () => { favs.has(p.id) ? favs.delete(p.id) : favs.add(p.id); saveFavs(); fav.classList.toggle('on'); fav.textContent = favs.has(p.id) ? '♥' : '♡'; if (filters.favOnly) regrid(); };
  thumb.append(fav);

  const status = isOwned(p) ? '<span class="tag ejet">✓ Ejet</span>'
    : p.free ? '<span class="tag free">Gratis</span>'
    : '<span class="tag kob">🛒 Køb</span>';
  const tags = E('div', 'ptags');
  tags.innerHTML = `${status}
    ${p.difficulty ? `<span class="tag">${DIFF[p.difficulty] || p.difficulty}</span>` : ''}
    ${p.yarnWeight ? `<span class="tag">${p.yarnWeight}</span>` : ''}
    <span class="tag lang">${p.lang === 'da' ? 'DA' : 'EN'}</span>`;
  const body = E('div', 'pbody');
  body.append(E('b', 'pname', esc(p.name)), E('div', 'pmeta', `${esc(p.designer)} · ${esc(p.source)}`), tags);

  const foot = E('div', 'pfoot');
  const open = E('a', 'plink', p.own ? 'Åbn →' : 'Se opskrift →');
  if (p.own) {
    open.href = '#';
    open.onclick = (e) => {
      e.preventDefault();
      if ((p.upload.mime || '').startsWith('image/')) openReader(p.upload);
      else window.open(URL.createObjectURL(p.upload.blob), '_blank'); // PDF opens externally
    };
  }
  else { open.href = p.url; open.target = '_blank'; open.rel = 'noopener noreferrer'; }
  const more = E('button', 'morebtn', '⋯'); more.onclick = () => actionSheet(p);
  foot.append(open, more);
  body.append(foot);
  a.append(thumb, body);
  return a;
}

/* ---------------- actions ---------------- */
function actionSheet(p) {
  const f = E('div', 'sheet');
  f.innerHTML = `<h2>${esc(p.name)}</h2>`;
  const list = E('div', 'sheetacts');
  if (!p.own) {
    const ob = E('button', 'sheetbtn', isOwned(p) ? '✓ Fjern “Ejet”' : '✓ Marker som ejet');
    ob.onclick = () => { owned.has(p.id) ? owned.delete(p.id) : owned.add(p.id); saveOwned(); m.close(); render(); };
    list.append(ob);
  }
  const cb = E('button', 'sheetbtn', '📁 Føj til samling…'); cb.onclick = () => { m.close(); collectionPicker(p); };
  list.append(cb);
  if (p.own) {
    const del = E('button', 'sheetbtn danger', '🗑 Slet egen opskrift');
    del.onclick = async () => { if (confirm('Slet din opskrift “' + p.name + '”?')) { await delUpload(p.upload.id); urlCache.delete(p.upload.id); uploads = uploads.filter((u) => u.id !== p.upload.id); m.close(); render(); } };
    list.append(del);
  }
  const cancel = E('button', 'sheetbtn subtle', 'Luk'); cancel.onclick = () => m.close();
  list.append(cancel);
  f.append(list);
  const m = M(f);
}

function collectionPicker(p) {
  const f = E('div', 'sheet');
  f.innerHTML = `<h2>Føj til samling</h2>`;
  const list = E('div', 'sheetacts');
  if (!collections.length) list.append(E('p', 'hint', 'Ingen samlinger endnu.'));
  collections.forEach((col) => {
    const inIt = (col.items || []).includes(p.id);
    const b = E('button', 'sheetbtn' + (inIt ? ' on' : ''), `${inIt ? '✓ ' : ''}${esc(col.name)}`);
    b.onclick = () => { col.items = col.items || []; if (inIt) col.items = col.items.filter((x) => x !== p.id); else col.items.push(p.id); saveCollections(); m.close(); collectionPicker(p); };
    list.append(b);
  });
  const nb = E('button', 'sheetbtn newc', '+ Ny samling'); nb.onclick = () => { m.close(); newCollection(p); };
  const cancel = E('button', 'sheetbtn subtle', 'Luk'); cancel.onclick = () => m.close();
  list.append(nb, cancel);
  f.append(list);
  const m = M(f);
}

function newCollection(addPattern) {
  let chosen = DEFAULT_ICON;
  const f = E('div', 'form');
  const grid = ICON_GROUPS.map((g) => `<div class="icogrp">${g.label}</div><div class="icorow">${g.ids.map((id) => `<button type="button" class="icobtn${id === chosen ? ' on' : ''}" data-ic="${id}">${CAT_ICONS[id]}</button>`).join('')}</div>`).join('');
  f.innerHTML = `<h2>Ny kategori</h2>
    <label>Navn<input id="nc-name" type="text" maxlength="30" placeholder="fx Babytøj, Huer, Til mor"></label>
    <div class="icolabel">Vælg ikon</div><div class="icopick">${grid}</div>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Opret</button></div>`;
  const m = M(f);
  f.querySelectorAll('.icobtn').forEach((b) => b.onclick = () => { chosen = b.dataset.ic; f.querySelectorAll('.icobtn').forEach((x) => x.classList.toggle('on', x === b)); });
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = () => {
    const name = f.querySelector('#nc-name').value.trim(); if (!name) return;
    collections.push({ id: uid(), name, icon: chosen, items: addPattern ? [addPattern.id] : [] });
    saveCollections(); m.close(); render();
  };
}

function uploadModal() {
  const f = E('div', 'form');
  f.innerHTML = `<h2>Tilføj egen opskrift</h2>
    <p class="hint" style="margin-bottom:10px">Vælg en PDF eller et billede fra din telefon. Den gemmes på din enhed.</p>
    <label>Fil<input id="up-file" type="file" accept="application/pdf,image/*"></label>
    <label>Navn<input id="up-name" type="text" maxlength="50" placeholder="fx Mormors trøje"></label>
    <label>Designer (valgfri)<input id="up-designer" type="text" maxlength="40"></label>
    <label>Kategori<select id="up-cat">${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}</select></label>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = async () => {
    const file = f.querySelector('#up-file').files[0];
    if (!file) { alert('Vælg en fil først.'); return; }
    const name = f.querySelector('#up-name').value.trim() || file.name.replace(/\.[^.]+$/, '');
    const rec = { id: uid(), name, designer: f.querySelector('#up-designer').value.trim(), category: f.querySelector('#up-cat').value, mime: file.type || 'application/octet-stream', blob: file, addedAt: Date.now() };
    try { await putUpload(rec); uploads.push(rec); m.close(); filters.cat = 'mine'; render(); }
    catch (e) { alert('Kunne ikke gemme filen (måske er den for stor til din browsers lager).'); }
  };
}
