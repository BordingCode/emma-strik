// Opskrifter — two clear views: "Mine opskrifter" (her own + owned + saved, in her categories)
// and "Find nye" (browse the curated library). Removes the old overlapping-filters confusion.
import { PATTERNS, CATEGORIES, CAT_ICON } from '../data/patterns.js';
import { store, uid } from './store.js';
import { allUploads, putUpload, delUpload } from './idb.js';
import { CAT_ICONS, ICON_GROUPS, DEFAULT_ICON, catThumb } from './caticons.js';
import { openReader } from './reader.js';
import { pdfThumb } from './pdfthumb.js';

const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const DIFF = { 'begynder': '● Begynder', 'let øvet': '●● Let øvet', 'øvet': '●●● Øvet' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let node, M, filters, favs, owned, collections, uploads;
const urlCache = new Map();

export async function initGallery(container, helpers) {
  node = container; M = helpers.modal;
  filters = { view: 'mine', cat: 'all', freeOnly: false, buyOnly: false, mine: 'all', collection: null, q: '' };
  favs = new Set(store.get('favorites', []));
  owned = new Set(store.get('owned', []));
  collections = store.get('collections', []);
  uploads = [];
  try { uploads = await allUploads(); } catch (e) {}
  render();
  // backfill PDF first-page thumbnails for older uploads that don't have one yet
  uploads.filter((u) => !u.thumb && (u.mime || '').includes('pdf')).forEach(async (u) => {
    try { u.thumb = await pdfThumb(u.blob); await putUpload(u); render(); } catch (e) {}
  });
}

const saveFavs = () => store.set('favorites', [...favs]);
const saveOwned = () => store.set('owned', [...owned]);
const saveCollections = () => store.set('collections', collections);

function uploadCard(u) {
  const isImg = (u.mime || '').startsWith('image/');
  let img = null;
  if (isImg) { if (!urlCache.has(u.id)) urlCache.set(u.id, URL.createObjectURL(u.blob)); img = urlCache.get(u.id); }
  else if (u.thumb) img = u.thumb; // PDF first-page thumbnail
  return { id: 'up:' + u.id, name: u.name, designer: u.designer || 'Egen opskrift', source: 'Min',
    url: null, image: img, category: u.category || 'sweater', yarnWeight: null, difficulty: null,
    free: true, lang: 'da', own: true, upload: u };
}
const allCards = () => PATTERNS.concat(uploads.map(uploadCard));
const isOwned = (p) => p.own || owned.has(p.id);

function render() {
  node.innerHTML = '';
  node.append(E('div', 'pagehead', `<h1>Opskrifter</h1>`));

  // view switch
  const seg = E('div', 'viewseg');
  ['mine', 'browse'].forEach((v) => {
    const b = E('button', 'segbtn' + (filters.view === v ? ' on' : ''), v === 'mine' ? 'Mine opskrifter' : 'Find nye');
    b.onclick = () => { filters.view = v; filters.collection = null; filters.cat = 'all'; render(); };
    seg.append(b);
  });
  node.append(seg);

  const ctr = E('div', 'gctrls');
  const search = E('input', 'gsearch'); search.type = 'search'; search.placeholder = 'Søg…'; search.value = filters.q;
  search.oninput = () => { filters.q = search.value.trim().toLowerCase(); regrid(); };

  if (filters.view === 'mine') {
    const top = E('div', 'gtoprow');
    top.append(search);
    const addBtn = E('button', 'addown', '+ Egen'); addBtn.onclick = uploadModal; top.append(addBtn);
    ctr.append(top);
    // sub-filter: alle / egne / ejede / gemte
    const sub = E('div', 'chips');
    [['all', 'Alle'], ['egne', 'Egne (uploadet)'], ['ejede', 'Købte'], ['gemte', '♥ Gemte']].forEach(([k, lbl]) => {
      const b = E('button', 'chip' + (filters.mine === k ? ' on' : ''), lbl);
      b.onclick = () => { filters.mine = k; render(); }; sub.append(b);
    });
    ctr.append(sub);
    // her categories
    ctr.append(E('div', 'rowlabel', 'Dine kategorier'));
    const colRow = E('div', 'chips colrow');
    const cards = allCards();
    collections.forEach((col) => {
      const cnt = cards.filter((p) => (col.items || []).includes(p.id)).length;
      const b = E('button', 'chip col' + (filters.collection === col.id ? ' on' : ''));
      b.innerHTML = `<span class="cicon">${CAT_ICONS[col.icon] || CAT_ICONS[DEFAULT_ICON]}</span>${esc(col.name)}${cnt ? `<span class="ccount">${cnt}</span>` : ''}`;
      b.onclick = () => { filters.collection = filters.collection === col.id ? null : col.id; render(); };
      colRow.append(b);
    });
    const newC = E('button', 'chip newcol', '+ Kategori'); newC.onclick = () => newCollection(); colRow.append(newC);
    ctr.append(colRow);
  } else {
    ctr.append(search);
    ctr.append(E('div', 'rowlabel', 'Kategorier'));
    const chips = E('div', 'chips');
    CATEGORIES.forEach((c) => {
      const b = E('button', 'chip' + (filters.cat === c.id ? ' on' : ''), c.label); b.dataset.cat = c.id;
      b.onclick = () => { filters.cat = c.id; render(); }; chips.append(b);
    });
    ctr.append(chips);
    const toggles = E('div', 'gtoggles');
    const mk = (label, key) => { const b = E('button', 'toggle' + (filters[key] ? ' on' : ''), label); b.onclick = () => { filters[key] = !filters[key]; render(); }; return b; };
    toggles.append(mk('Gratis', 'freeOnly'), mk('Til køb', 'buyOnly'));
    ctr.append(toggles);
  }
  node.append(ctr);

  const grid = E('div', 'pgrid'); grid.id = 'pgrid'; node.append(grid);
  regrid();
}

function regrid() {
  const grid = node.querySelector('#pgrid'); if (!grid) return;
  let list;
  if (filters.view === 'mine') {
    const col = filters.collection ? collections.find((c) => c.id === filters.collection) : null;
    list = allCards().filter((p) => (p.own || isOwned(p) || favs.has(p.id))
      && (filters.mine === 'all'
        || (filters.mine === 'egne' && p.own)
        || (filters.mine === 'ejede' && isOwned(p) && !p.own)
        || (filters.mine === 'gemte' && favs.has(p.id)))
      && (!col || (col.items || []).includes(p.id))
      && (!filters.q || (p.name + ' ' + p.designer).toLowerCase().includes(filters.q)));
  } else {
    list = PATTERNS.filter((p) =>
      (filters.cat === 'all' || p.category === filters.cat)
      && (!filters.freeOnly || (p.free && !isOwned(p)))
      && (!filters.buyOnly || (!p.free && !isOwned(p)))
      && (!filters.q || (p.name + ' ' + p.designer + ' ' + p.source).toLowerCase().includes(filters.q)));
  }
  grid.innerHTML = '';
  if (!list.length) { grid.append(emptyMsg()); return; }
  list.forEach((p) => grid.append(card(p)));
}

function emptyMsg() {
  if (filters.view === 'mine') {
    const wrap = E('div', 'emptymine');
    wrap.innerHTML = `<p class="empty">${filters.collection ? 'Kategorien er tom endnu.' : filters.mine === 'gemte' ? 'Ingen gemte endnu — tryk ♥ på en opskrift.' : 'Du har ingen opskrifter her endnu.'}</p>`;
    const b1 = E('button', 'primary', '+ Tilføj egen opskrift'); b1.onclick = uploadModal;
    const b2 = E('button', 'ghost', 'Find nye opskrifter'); b2.onclick = () => { filters.view = 'browse'; render(); };
    wrap.append(b1, b2);
    return wrap;
  }
  return E('p', 'empty', 'Ingen opskrifter matcher.');
}

function statusTag(p) {
  if (isOwned(p)) return '<span class="tag ejet">✓ Ejet</span>';
  return p.free ? '<span class="tag free">Gratis</span>' : '<span class="tag kob">Køb</span>';
}

function card(p) {
  const a = E('article', 'pcard');
  const thumb = E('div', 'thumb t-' + p.category, `<span class="ph">${p.own ? CAT_ICONS.doc : catThumb(p.category)}</span>`);
  if (p.image) { const img = E('img'); img.loading = 'lazy'; img.alt = p.name; img.src = p.image; img.onerror = () => img.remove(); thumb.append(img); }
  if (p.own) thumb.append(E('span', 'mybadge', 'Min'));
  const fav = E('button', 'favbtn' + (favs.has(p.id) ? ' on' : ''), favs.has(p.id) ? '♥' : '♡');
  fav.onclick = () => { favs.has(p.id) ? favs.delete(p.id) : favs.add(p.id); saveFavs(); fav.classList.toggle('on'); fav.textContent = favs.has(p.id) ? '♥' : '♡'; if (filters.view === 'mine') regrid(); };
  thumb.append(fav);

  const tags = E('div', 'ptags');
  tags.innerHTML = `${statusTag(p)}
    ${p.difficulty ? `<span class="tag">${DIFF[p.difficulty] || p.difficulty}</span>` : ''}
    ${p.yarnWeight ? `<span class="tag">${p.yarnWeight}</span>` : ''}`;
  const body = E('div', 'pbody');
  body.append(E('b', 'pname', esc(p.name)), E('div', 'pmeta', `${esc(p.designer)} · ${esc(p.source)}`), tags);

  const foot = E('div', 'pfoot');
  const open = E('a', 'plink', p.own ? 'Åbn →' : 'Se opskrift →');
  if (p.own) { open.href = '#'; open.onclick = (e) => { e.preventDefault(); openReader(p.upload); }; }
  else { open.href = p.url; open.target = '_blank'; open.rel = 'noopener noreferrer'; }
  foot.append(open);
  if (!p.own) { // one-tap owned toggle
    const ob = E('button', 'ownbtn' + (owned.has(p.id) ? ' on' : ''), owned.has(p.id) ? '✓' : '○');
    ob.title = 'Jeg ejer denne';
    ob.onclick = () => { owned.has(p.id) ? owned.delete(p.id) : owned.add(p.id); saveOwned(); render(); };
    foot.append(ob);
  }
  const more = E('button', 'morebtn', '⋯'); more.onclick = () => actionSheet(p); foot.append(more);
  body.append(foot);
  a.append(thumb, body);
  return a;
}

/* ---------------- actions ---------------- */
function actionSheet(p) {
  const f = E('div', 'sheet', `<h2>${esc(p.name)}</h2>`);
  const list = E('div', 'sheetacts');
  const cb = E('button', 'sheetbtn', 'Føj til kategori…'); cb.onclick = () => { m.close(); collectionPicker(p); };
  list.append(cb);
  if (p.own) {
    const del = E('button', 'sheetbtn danger', '🗑 Slet egen opskrift');
    del.onclick = async () => { if (confirm('Slet din opskrift “' + p.name + '”?')) { await delUpload(p.upload.id); const cu = urlCache.get(p.upload.id); if (cu) URL.revokeObjectURL(cu); urlCache.delete(p.upload.id); uploads = uploads.filter((u) => u.id !== p.upload.id); m.close(); render(); } };
    list.append(del);
  }
  const cancel = E('button', 'sheetbtn subtle', 'Luk'); cancel.onclick = () => m.close();
  list.append(cancel); f.append(list);
  const m = M(f);
}

function collectionPicker(p) {
  const f = E('div', 'sheet', `<h2>Føj til kategori</h2>`);
  const list = E('div', 'sheetacts');
  if (!collections.length) list.append(E('p', 'hint', 'Ingen kategorier endnu.'));
  collections.forEach((col) => {
    const inIt = (col.items || []).includes(p.id);
    const b = E('button', 'sheetbtn' + (inIt ? ' on' : ''), `${inIt ? '✓ ' : ''}${esc(col.name)}`);
    b.onclick = () => { col.items = col.items || []; col.items = inIt ? col.items.filter((x) => x !== p.id) : col.items.concat(p.id); saveCollections(); m.close(); collectionPicker(p); };
    list.append(b);
  });
  const nb = E('button', 'sheetbtn newc', '+ Ny kategori'); nb.onclick = () => { m.close(); newCollection(p); };
  const cancel = E('button', 'sheetbtn subtle', 'Luk'); cancel.onclick = () => m.close();
  list.append(nb, cancel); f.append(list);
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
    saveCollections(); m.close(); filters.view = 'mine'; render();
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
    if ((rec.mime || '').includes('pdf')) { try { rec.thumb = await pdfThumb(file); } catch (e) {} }
    try { await putUpload(rec); uploads.push(rec); m.close(); filters.view = 'mine'; filters.mine = 'all'; render(); }
    catch (e) { alert('Kunne ikke gemme filen (måske er den for stor til din browsers lager).'); }
  };
}
