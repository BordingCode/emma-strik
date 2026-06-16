// Opskrifter — two clear views: "Mine opskrifter" (her own + owned + saved, in her categories)
// and "Find nye" (browse the curated library). Removes the old overlapping-filters confusion.
import { PATTERNS, CATEGORIES, CAT_ICON } from '../data/patterns.js';
import { store, uid } from './store.js';
import { allUploads, putUpload, delUpload } from './idb.js';
import { CAT_ICONS, ICON_GROUPS, DEFAULT_ICON, catThumb } from './caticons.js';
import { openReader } from './reader.js';
import { pdfThumb } from './pdfthumb.js';
import { getVideos, saveVideos, videosForPattern, categoryIdsForPattern } from './videos.js';

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
  [['mine', 'Mine opskrifter'], ['browse', 'Find nye'], ['videos', 'Videoer']].forEach(([v, lbl]) => {
    const b = E('button', 'segbtn' + (filters.view === v ? ' on' : ''), lbl);
    b.onclick = () => { filters.view = v; filters.collection = null; filters.cat = 'all'; render(); };
    seg.append(b);
  });
  node.append(seg);

  if (filters.view === 'videos') { renderVideos(); return; }

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
  const vids = videosForPattern(p.id, categoryIdsForPattern(p.id));
  if (vids.length) { const vb = E('button', 'vidbadge', `▶ ${vids.length}`); vb.title = 'Videoer til denne opskrift'; vb.onclick = () => videoSheet(p, vids); foot.append(vb); }
  const more = E('button', 'morebtn', '⋯'); more.onclick = () => actionSheet(p); foot.append(more);
  body.append(foot);
  a.append(thumb, body);
  return a;
}

// quick sheet listing the videos attached to a pattern (read-only)
function videoSheet(p, vids) {
  const f = E('div', 'sheet', `<h2>Videoer · ${esc(p.name)}</h2>`);
  const list = E('div', 'sheetacts');
  (vids || videosForPattern(p.id, categoryIdsForPattern(p.id))).forEach((v) => {
    const a = E('a', 'sheetbtn vidrow'); a.href = v.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.innerHTML = `<span class="vi">▶</span> ${esc(v.title)}`;
    list.append(a);
  });
  const add = E('button', 'sheetbtn newc', '+ Tilføj video til denne opskrift'); add.onclick = () => { m.close(); videoModal(null, p.id); };
  const cancel = E('button', 'sheetbtn subtle', 'Luk'); cancel.onclick = () => m.close();
  list.append(add, cancel); f.append(list);
  const m = M(f);
}

/* ---------------- videos ---------------- */
function patternName(id) { const c = allCards().find((p) => p.id === id); return c ? c.name : null; }
function categoryName(id) { const c = collections.find((x) => x.id === id); return c ? c.name : null; }

function renderVideos() {
  const ctr = E('div', 'gctrls');
  ctr.append(E('p', 'hint', 'Gem links til gode video-guides. Du kan knytte en video til en bestemt opskrift eller kategori, så den dukker op netop dér.'));
  const add = E('button', 'addown wide', '+ Tilføj video'); add.onclick = () => videoModal(); ctr.append(add);
  node.append(ctr);

  const vids = getVideos();
  if (!vids.length) { node.append(E('p', 'empty', 'Ingen videoer endnu. Tryk “+ Tilføj video”.')); return; }
  const list = E('div', 'vidmanage');
  vids.forEach((v) => {
    const row = E('div', 'vidcard');
    const tags = [];
    const pn = v.patternId ? patternName(v.patternId) : null;
    const cn = v.categoryId ? categoryName(v.categoryId) : null;
    if (pn) tags.push(`<span class="vtag op">${esc(pn)}</span>`);
    if (cn) tags.push(`<span class="vtag ka">${esc(cn)}</span>`);
    if (!pn && !cn) tags.push(`<span class="vtag gen">Generel</span>`);
    row.innerHTML = `<a class="vidmain" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer"><span class="vi">▶</span><span class="vmeta"><b>${esc(v.title)}</b><span class="vtags">${tags.join('')}</span></span></a>`;
    const edit = E('button', 'videdit', '✎'); edit.title = 'Rediger'; edit.onclick = () => videoModal(v);
    const del = E('button', 'viddel', '×'); del.title = 'Fjern'; del.onclick = () => { if (confirm('Fjern videoen “' + v.title + '”?')) { saveVideos(getVideos().filter((x) => x.id !== v.id)); render(); } };
    row.append(edit, del); list.append(row);
  });
  node.append(list);
}

function videoModal(existing, defaultPatternId) {
  const f = E('div', 'form');
  const owns = uploads.map(uploadCard);
  const curUrl = existing ? existing.url : '';
  const pid = existing ? existing.patternId : (defaultPatternId || '');
  const cid = existing ? existing.categoryId : '';
  const opt = (id, label, sel) => `<option value="${esc(id)}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
  const patOpts = `<option value="">— ingen —</option>`
    + (owns.length ? `<optgroup label="Mine opskrifter">${owns.map((p) => opt(p.id, p.name, p.id === pid)).join('')}</optgroup>` : '')
    + `<optgroup label="Find nye (bibliotek)">${PATTERNS.map((p) => opt(p.id, p.name, p.id === pid)).join('')}</optgroup>`;
  const catOpts = `<option value="">— ingen —</option>` + collections.map((c) => opt(c.id, c.name, c.id === cid)).join('');
  f.innerHTML = `<h2>${existing ? 'Rediger video' : 'Tilføj video'}</h2>
    <label>Titel<input id="v-title" type="text" maxlength="60" placeholder="fx Italiensk opslagning" value="${existing ? esc(existing.title) : ''}"></label>
    <label>Link (URL)<input id="v-url" type="url" inputmode="url" placeholder="https://…" value="${esc(curUrl)}"></label>
    <label>Tilknyt opskrift (valgfri)<select id="v-pat">${patOpts}</select></label>
    <label>Tilknyt kategori (valgfri)<select id="v-cat">${catOpts}</select></label>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = () => {
    const title = f.querySelector('#v-title').value.trim();
    let url = f.querySelector('#v-url').value.trim();
    if (!title || !url) { alert('Skriv både en titel og et link.'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const patternId = f.querySelector('#v-pat').value || null;
    const categoryId = f.querySelector('#v-cat').value || null;
    const vids = getVideos();
    if (existing) { Object.assign(existing, { title, url, patternId, categoryId }); saveVideos(vids); }
    else { vids.push({ id: uid(), title, url, patternId, categoryId }); saveVideos(vids); }
    m.close(); render();
  };
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
  f.innerHTML = `<h2>Tilføj egne opskrifter</h2>
    <p class="hint" style="margin-bottom:10px">Vælg en eller flere PDF-filer eller billeder fra din telefon. De gemmes på din enhed.</p>
    <label>Filer<input id="up-file" type="file" accept="application/pdf,image/*" multiple></label>
    <div id="up-list" class="up-list" hidden></div>
    <label>Designer (valgfri, fælles for alle)<input id="up-designer" type="text" maxlength="40"></label>
    <label>Kategori (fælles for alle)<select id="up-cat">${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select></label>
    <div id="up-status" class="hint" hidden style="margin-bottom:8px"></div>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  const fileInp = f.querySelector('#up-file');
  const list = f.querySelector('#up-list');
  const okBtn = f.querySelector('.ok');
  const cancelBtn = f.querySelector('.cancel');
  const status = f.querySelector('#up-status');
  const baseName = (fn) => fn.replace(/\.[^.]+$/, '');

  // After picking file(s), show one editable name per file (default = filename).
  fileInp.onchange = () => {
    const files = [...fileInp.files];
    if (!files.length) { list.hidden = true; list.innerHTML = ''; okBtn.textContent = 'Gem'; return; }
    list.hidden = false;
    const head = files.length > 1 ? `<div class="up-count">${files.length} filer valgt — ret gerne navnene:</div>` : '';
    list.innerHTML = head + files.map((file, i) =>
      `<label class="up-name-row">${files.length > 1 ? `<span class="up-fn">${esc(file.name)}</span>` : 'Navn'}` +
      `<input type="text" maxlength="50" data-i="${i}" value="${esc(baseName(file.name))}" placeholder="fx Mormors trøje"></label>`
    ).join('');
    okBtn.textContent = files.length > 1 ? `Gem ${files.length} opskrifter` : 'Gem';
  };

  cancelBtn.onclick = () => m.close();
  okBtn.onclick = async () => {
    const files = [...fileInp.files];
    if (!files.length) { alert('Vælg mindst én fil først.'); return; }
    const nameInputs = [...list.querySelectorAll('input[data-i]')];
    const designer = f.querySelector('#up-designer').value.trim();
    const category = f.querySelector('#up-cat').value;
    okBtn.disabled = true; cancelBtn.disabled = true; fileInp.disabled = true;
    status.hidden = false;
    let saved = 0; const failed = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (files.length > 1) status.textContent = `Gemmer ${i + 1} af ${files.length}…`;
      const inp = nameInputs.find((n) => +n.dataset.i === i);
      const name = (inp && inp.value.trim()) || baseName(file.name);
      const rec = { id: uid(), name, designer, category, mime: file.type || 'application/octet-stream', blob: file, addedAt: Date.now() + i };
      if ((rec.mime || '').includes('pdf')) { try { rec.thumb = await pdfThumb(file); } catch (e) {} }
      try { await putUpload(rec); uploads.push(rec); saved++; }
      catch (e) { failed.push(file.name); }
    }
    m.close(); filters.view = 'mine'; filters.mine = 'all'; render();
    if (failed.length) {
      alert(`${saved} opskrift${saved === 1 ? '' : 'er'} gemt.\n${failed.length} kunne ikke gemmes (måske for store til lageret):\n` + failed.join('\n'));
    }
  };
}
