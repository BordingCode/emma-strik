// Garn & grej — Emma's yarn stash + tools/needles. Stored on-device (localStorage).
// Yarn photos live in IndexedDB (the shared 'photos' store) so they don't bloat localStorage.
// (Theme, device sync and backup live under the gear ⚙️ → Indstillinger, see settings.js.)
import { store, uid } from './store.js';
import { putPhoto, getPhoto, delPhoto } from './idb.js';

let node, M;
let stash, tools;

export function initStash(container, helpers) {
  node = container; M = helpers.modal;
  stash = store.get('stash', []);
  tools = store.get('tools', []);
  render();
}
const saveStash = () => store.set('stash', stash);
const saveTools = () => store.set('tools', tools);
const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Yarn photos load from IndexedDB after the list is on screen.
async function fillPhotos() {
  for (const el of node.querySelectorAll('.inv-thumb[data-ph]')) {
    try { const ph = await getPhoto(el.dataset.ph); if (ph && ph.blob) { el.style.backgroundImage = `url(${URL.createObjectURL(ph.blob)})`; el.classList.add('on'); } } catch (e) {}
  }
}

// shrink a phone photo before storing (keeps device storage + backups small)
function downscaleImage(file, max = 1280, q = 0.82) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => res(b || file), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}

function render() {
  node.innerHTML = '';
  node.append(E('div', 'pagehead', `<h1>Garn &amp; grej</h1><p class="hint">Hold styr på dit garnlager og dine pinde.</p>`));

  // ---- garn ----
  node.append(E('h2', 'sechead', 'Garnlager'));
  if (!stash.length) node.append(E('p', 'empty small', 'Intet garn noteret endnu.'));
  const sl = E('div', 'invlist');
  stash.forEach((g) => {
    const sub = [g.color, g.weight, g.skeins ? g.skeins + ' nøgler' : '', g.meters ? g.meters + ' m/nøgle' : ''].filter(Boolean).map(esc).join(' · ');
    const thumb = g.photoId
      ? `<span class="inv-thumb" data-ph="${esc(g.photoId)}"></span>`
      : `<span class="inv-thumb noimg">🧶</span>`;
    const row = E('div', 'invrow', `${thumb}<div class="inv-main"><b>${esc(g.name)}</b><span class="inv-sub">${sub || '—'}</span>${g.notes ? `<span class="inv-note">${esc(g.notes)}</span>` : ''}</div>`);
    const ed = E('button', 'iconbtn', '✎'); ed.onclick = () => yarnModal(g);
    row.append(ed); sl.append(row);
  });
  node.append(sl);
  const addY = E('button', 'ghost wide', '+ Tilføj garn'); addY.onclick = () => yarnModal(); node.append(addY);
  fillPhotos();

  // ---- grej ----
  node.append(E('h2', 'sechead', 'Pinde & grej'));
  if (!tools.length) node.append(E('p', 'empty small', 'Intet grej noteret endnu.'));
  const tl = E('div', 'invlist');
  tools.forEach((t) => {
    const sub = [t.size ? t.size + ' mm' : '', t.length ? t.length + ' cm' : '', t.notes].filter(Boolean).map(esc).join(' · ');
    const row = E('div', 'invrow', `<div class="inv-main"><b>${esc(t.kind)}</b><span class="inv-sub">${sub || '—'}</span></div>`);
    const ed = E('button', 'iconbtn', '✎'); ed.onclick = () => toolModal(t);
    row.append(ed); tl.append(row);
  });
  node.append(tl);
  const addT = E('button', 'ghost wide', '+ Tilføj grej'); addT.onclick = () => toolModal(); node.append(addT);
}

function field(id, label, val, ph, type) { return `<label>${label}<input id="${id}" type="${type || 'text'}" ${type === 'number' ? 'inputmode="numeric"' : ''} maxlength="40" value="${val ? esc(val) : ''}" placeholder="${ph || ''}"></label>`; }

function yarnModal(g) {
  const f = E('div', 'form');
  f.innerHTML = `<h2>${g ? 'Rediger garn' : 'Tilføj garn'}</h2>
    ${field('y-name', 'Navn', g && g.name, 'fx Drops Air')}
    ${field('y-color', 'Farve', g && g.color, 'fx lys grå')}
    ${field('y-weight', 'Tykkelse', g && g.weight, 'fx DK / gruppe C')}
    <div class="grid2">${field('y-skeins', 'Antal nøgler', g && g.skeins, '', 'number')}${field('y-meters', 'Meter pr. nøgle', g && g.meters, '', 'number')}</div>
    ${field('y-notes', 'Noter', g && g.notes, 'evt. noter')}
    <label class="photopick">Billede af garnet (valgfrit)<input id="y-photo" type="file" accept="image/*"></label>
    <div id="y-prev" class="finprev" hidden></div>
    <div class="form-actions">${g ? '<button class="ghost del">Slet</button>' : ''}<button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  // photo: 'keep' existing, 'replace' with newly picked, or 'remove'
  let photoBlob = null;
  let photoState = g && g.photoId ? 'keep' : 'none';
  const prev = f.querySelector('#y-prev');
  const showPreview = (src) => {
    prev.hidden = false;
    prev.innerHTML = `<img src="${src}" alt="forhåndsvisning"><button type="button" class="ghost small rmphoto">Fjern billede</button>`;
    prev.querySelector('.rmphoto').onclick = () => { photoState = 'remove'; photoBlob = null; prev.hidden = true; prev.innerHTML = ''; f.querySelector('#y-photo').value = ''; };
  };
  if (g && g.photoId) { getPhoto(g.photoId).then((ph) => { if (ph && ph.blob && photoState === 'keep') showPreview(URL.createObjectURL(ph.blob)); }).catch(() => {}); }
  f.querySelector('#y-photo').onchange = async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    prev.hidden = false; prev.innerHTML = '<span class="hint">Behandler billede…</span>';
    photoBlob = await downscaleImage(file); photoState = 'replace';
    showPreview(URL.createObjectURL(photoBlob));
  };
  f.querySelector('.cancel').onclick = () => m.close();
  if (g) f.querySelector('.del').onclick = () => { if (confirm('Slet garnet?')) { if (g.photoId) delPhoto(g.photoId).catch(() => {}); stash = stash.filter((x) => x !== g); saveStash(); m.close(); render(); } };
  f.querySelector('.ok').onclick = async () => {
    const v = (id) => f.querySelector('#' + id).value.trim();
    const data = { name: v('y-name') || 'Garn', color: v('y-color'), weight: v('y-weight'), skeins: v('y-skeins'), meters: v('y-meters'), notes: v('y-notes') };
    const id = g ? g.id : uid();
    const photoId = 'yph_' + id;
    try {
      if (photoState === 'replace' && photoBlob) { await putPhoto({ id: photoId, blob: photoBlob, mime: photoBlob.type || 'image/jpeg', addedAt: Date.now() }); data.photoId = photoId; }
      else if (photoState === 'remove') { await delPhoto(photoId).catch(() => {}); data.photoId = undefined; }
      else if (photoState === 'keep') { data.photoId = g.photoId; }
    } catch (err) {}
    if (g) Object.assign(g, data); else stash.push({ id, ...data });
    saveStash(); m.close(); render();
  };
}

function toolModal(t) {
  const f = E('div', 'form');
  f.innerHTML = `<h2>${t ? 'Rediger grej' : 'Tilføj grej'}</h2>
    ${field('t-kind', 'Type', t && t.kind, 'fx Rundpind / Strømpepinde')}
    <div class="grid2">${field('t-size', 'Størrelse (mm)', t && t.size, '', 'number')}${field('t-length', 'Længde (cm)', t && t.length, '', 'number')}</div>
    ${field('t-notes', 'Noter', t && t.notes, '')}
    <div class="form-actions">${t ? '<button class="ghost del">Slet</button>' : ''}<button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  f.querySelector('.cancel').onclick = () => m.close();
  if (t) f.querySelector('.del').onclick = () => { if (confirm('Slet grejet?')) { tools = tools.filter((x) => x !== t); saveTools(); m.close(); render(); } };
  f.querySelector('.ok').onclick = () => {
    const v = (id) => f.querySelector('#' + id).value.trim();
    const data = { kind: v('t-kind') || 'Pind', size: v('t-size'), length: v('t-length'), notes: v('t-notes') };
    if (t) Object.assign(t, data); else tools.push({ id: uid(), ...data });
    saveTools(); m.close(); render();
  };
}
