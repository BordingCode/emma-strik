// Tæller — the heart. Projects, each with multiple counters (incl. repeat-wrap & follow-main).
// Big tap targets, auto-save on every tap (never lose your place), Screen Wake Lock while open.
import { store, uid } from './store.js';
import { openReader } from './reader.js';
import { allUploads, getUpload, putPhoto, getPhoto } from './idb.js';
import { CAT_ICONS, ICON_GROUPS, DEFAULT_ICON } from './caticons.js';

let E, M, node;
let projects = [], activeId = null;
let wakeLock = null;
let statusPeriod = { y: 'cur', m: 'all' }; // y: 'all' | 'cur' | <year>; m: 'all' | 0..11
const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
function selYear() { return statusPeriod.y === 'cur' ? new Date().getFullYear() : statusPeriod.y; }
function matchPeriod(p) {
  if (statusPeriod.y === 'all') return true;
  if (!p.finishedAt) return false;
  const d = new Date(p.finishedAt);
  if (d.getFullYear() !== Number(selYear())) return false;
  if (statusPeriod.m !== 'all' && d.getMonth() !== Number(statusPeriod.m)) return false;
  return true;
}
const finishedInPeriod = () => projects.filter((p) => p.done && matchPeriod(p));
const projMeters = (p) => {
  if (!p.gramsUsed) return 0;
  if (p.mPer50g) return Math.round(p.gramsUsed * p.mPer50g / 50);
  if (p.mPer100g) return Math.round(p.gramsUsed * p.mPer100g / 100); // legacy
  return 0;
};
const needleFmt = (mm) => (mm % 1 === 0 ? String(mm) : mm.toFixed(1).replace('.', ',')) + ' mm';
const fmtDate = (s) => { if (!s) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? `${m[3]}.${m[2]}.${m[1]}` : s; };
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function initCounters(container, helpers) {
  E = helpers.el; M = helpers.modal; node = container;
  projects = store.get('projects', []);
  activeId = store.get('activeProject', null);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && activeId) requestWake(); });
  render();
}

function save() { store.set('projects', projects); store.set('activeProject', activeId); }
const active = () => projects.find((p) => p.id === activeId);

async function requestWake() { try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {} }
function releaseWake() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }

/* ---------------- counter math ---------------- */
function advance(c, dir) {
  c.value = (c.value || 0) + dir;
  if (c.wrapAt) {
    if (c.value > c.wrapAt) { c.value = 1; c.repeats = (c.repeats || 0) + 1; }
    else if (c.value < 1) { c.value = c.wrapAt; c.repeats = Math.max(0, (c.repeats || 0) - 1); }
  } else if (c.value < 0) c.value = 0;
}
function tap(project, counter, dir) {
  advance(counter, dir);
  if (counter.main) project.counters.filter((c) => c.follow).forEach((c) => advance(c, dir));
  save(); renderDetail();
}

/* ---------------- render ---------------- */
function render() { if (active()) renderDetail(); else { releaseWake(); renderList(); } }

function projCard(p) {
  const main = p.counters[0];
  const photo = p.photoId ? `<span class="pc-photo" data-ph="${esc(p.photoId)}"></span>` : '';
  const row = E('button', 'projcard' + (p.done ? ' done' : '') + (p.photoId ? ' hasphoto' : ''), `${photo}<div class="pc-main"><b>${esc(p.name)}${p.done ? ' <span class="donetick">✓</span>' : ''}</b>
    <span class="pc-sub">${[p.yarn, p.needle].filter(Boolean).map(esc).join(' · ') || (p.done ? 'færdigt' : 'tryk for at fortsætte')}</span></div>
    <div class="pc-count"><span class="pc-num">${main ? main.value : 0}</span><span class="pc-lbl">omg.</span></div>`);
  row.onclick = () => { activeId = p.id; save(); if (!p.done) requestWake(); renderDetail(); };
  return row;
}

function statusCard() {
  const curYear = new Date().getFullYear();
  const done = projects.filter((p) => p.done);
  const years = [...new Set(done.map((p) => (p.finishedAt ? new Date(p.finishedAt).getFullYear() : null)).filter(Boolean))].sort((a, b) => b - a);
  if (!years.includes(curYear)) years.unshift(curYear);
  const inP = finishedInPeriod();
  const grams = inP.reduce((s, p) => s + (Number(p.gramsUsed) || 0), 0);
  const meters = inP.reduce((s, p) => s + projMeters(p), 0);
  const ongoing = projects.filter((p) => !p.done).length;

  const yVal = statusPeriod.y === 'all' ? 'all' : (statusPeriod.y === 'cur' ? curYear : statusPeriod.y);
  const yearOpts = `<option value="all"${statusPeriod.y === 'all' ? ' selected' : ''}>Alle år</option>`
    + years.map((y) => `<option value="${y}"${String(yVal) === String(y) ? ' selected' : ''}>${y === curYear ? 'I år (' + y + ')' : y}</option>`).join('');
  const monthOpts = `<option value="all"${statusPeriod.m === 'all' ? ' selected' : ''}>Hele året</option>`
    + MONTHS.map((mn, i) => `<option value="${i}"${String(statusPeriod.m) === String(i) ? ' selected' : ''}>${mn[0].toUpperCase() + mn.slice(1)}</option>`).join('');

  const c = E('div', 'statuscard');
  c.innerHTML = `<div class="sthead">Din statusoversigt</div>
    <div class="stperiod">
      <select class="stsel" id="st-year">${yearOpts}</select>
      <select class="stsel" id="st-month"${statusPeriod.y === 'all' ? ' disabled' : ''}>${monthOpts}</select>
    </div>
    <div class="sttiles">
      <div class="sttile"><b>${inP.length}</b><span>færdige</span></div>
      <div class="sttile"><b>${ongoing}</b><span>i gang</span></div>
      <div class="sttile"><b>${meters}</b><span>meter strikket</span></div>
      <div class="sttile"><b>${grams}</b><span>gram brugt</span></div>
    </div>
    <div class="stphotos"></div>`;
  c.querySelector('#st-year').onchange = (e) => { statusPeriod.y = e.target.value === 'all' ? 'all' : Number(e.target.value); if (statusPeriod.y === 'all') statusPeriod.m = 'all'; renderList(); };
  c.querySelector('#st-month').onchange = (e) => { statusPeriod.m = e.target.value === 'all' ? 'all' : Number(e.target.value); renderList(); };
  return c;
}

// Finished-project photos load from IndexedDB after the list is on screen.
async function fillPhotos() {
  for (const el of node.querySelectorAll('.pc-photo[data-ph]')) {
    try { const ph = await getPhoto(el.dataset.ph); if (ph && ph.blob) { el.style.backgroundImage = `url(${URL.createObjectURL(ph.blob)})`; el.classList.add('on'); } } catch (e) {}
  }
  const strip = node.querySelector('.stphotos');
  if (strip) {
    const inP = finishedInPeriod().filter((p) => p.photoId);
    for (const p of inP) {
      try { const ph = await getPhoto(p.photoId); if (ph && ph.blob) { const img = E('img', 'stphoto'); img.src = URL.createObjectURL(ph.blob); img.alt = esc(p.name); strip.append(img); } } catch (e) {}
    }
    if (!strip.children.length) strip.remove();
  }
}

function renderList() {
  node.innerHTML = '';
  node.append(E('div', 'pagehead', `<h1>Dine projekter</h1><p class="hint">Tæl omgange uden at miste tællingen — skærmen forbliver tændt mens du strikker.</p>`));
  if (projects.length) node.append(statusCard());
  const active = projects.filter((p) => !p.done);
  const done = projects.filter((p) => p.done);
  if (!projects.length) node.append(E('p', 'empty', 'Ingen projekter endnu. Start dit første herunder.'));
  if (active.length) node.append(E('h2', 'sechead', 'Igangværende'));
  else if (projects.length) node.append(E('p', 'empty small', 'Ingen igangværende projekter — alt er færdigt'));
  const list = E('div', 'projlist');
  active.forEach((p) => list.append(projCard(p)));
  node.append(list);
  const add = E('button', 'primary big', '+ Nyt projekt');
  add.onclick = () => projectModal();
  node.append(add);
  if (done.length) {
    node.append(E('h2', 'sechead', `✓ Færdige projekter (${done.length})`));
    const dl = E('div', 'projlist');
    done.forEach((p) => dl.append(projCard(p)));
    node.append(dl);
  }
  fillPhotos();
}

function renderDetail() {
  const p = active(); if (!p) return renderList();
  requestWake();
  node.innerHTML = '';
  const main = p.counters[0];
  const head = E('div', 'detailhead');
  const back = E('button', 'iconbtn back', '‹ Projekter'); back.onclick = () => { activeId = null; save(); releaseWake(); renderList(); };
  const edit = E('button', 'iconbtn', '✎'); edit.onclick = () => projectModal(p);
  head.append(back, E('div', 'dtitle', `<b>${esc(p.name)}</b><small>${[p.yarn, p.needle].filter(Boolean).map(esc).join(' · ')}</small>`), edit);
  node.append(head);

  // main counter — big
  const mc = E('div', 'maincounter');
  mc.innerHTML = `<div class="mc-label">${esc(main.label)}</div>
    <div class="mc-value">${main.value}</div>${main.wrapAt ? `<div class="mc-wrap">i mønster: ${main.value}/${main.wrapAt} · ${main.repeats || 0} rapporter</div>` : ''}`;
  const minus = E('button', 'mc-btn minus', '−'); minus.onclick = () => tap(p, main, -1);
  const plus = E('button', 'mc-btn plus', '+'); plus.onclick = () => tap(p, main, 1);
  const ctrls = E('div', 'mc-ctrls'); ctrls.append(minus, plus);
  node.append(mc, ctrls);

  // open the linked recipe (resumes where she left off) or link one
  const patBtn = E('button', 'ghost wide openpat', p.patternId ? '📖 Åbn opskrift' : '+ Tilknyt opskrift');
  patBtn.textContent = p.patternId ? 'Åbn opskrift' : '+ Tilknyt opskrift';
  patBtn.onclick = () => openPattern(p);
  node.append(patBtn);

  // project details (size / gauge / recipient / dates) — only the ones that are filled
  const rows = [];
  if (p.size) rows.push(['Størrelse', esc(p.size)]);
  if (p.gauge) rows.push(['Strikkefasthed', esc(p.gauge)]);
  if (p.recipient) rows.push(['Modtager', esc(p.recipient)]);
  if (p.startDate) rows.push(['Startet', fmtDate(p.startDate)]);
  if (p.endDate) rows.push(['Afsluttet', fmtDate(p.endDate)]);
  if (rows.length) {
    const info = E('div', 'projinfo');
    info.innerHTML = rows.map(([k, v]) => `<div class="pi-row"><span class="pi-k">${k}</span><span class="pi-v">${v}</span></div>`).join('');
    node.append(info);
  }

  // extra counters
  const extras = p.counters.slice(1);
  if (extras.length) {
    const wrap = E('div', 'subcounters');
    extras.forEach((c) => {
      const row = E('div', 'subcounter' + (c.follow ? ' follow' : ''));
      row.innerHTML = `<div class="sc-info"><b>${esc(c.label)}</b>
        <span class="sc-val">${c.value}${c.wrapAt ? `/${c.wrapAt} · ${c.repeats || 0}×` : ''}</span>
        ${c.follow ? '<span class="sc-tag">følger hovedtæller</span>' : ''}</div>`;
      const ctr = E('div', 'sc-ctrls');
      if (!c.follow) {
        const m = E('button', 'sc-btn', '−'); m.onclick = () => tap(p, c, -1);
        const pl = E('button', 'sc-btn', '+'); pl.onclick = () => tap(p, c, 1);
        ctr.append(m, pl);
      }
      const del = E('button', 'sc-del', '×'); del.onclick = () => { if (confirm('Fjern tælleren "' + c.label + '"?')) { p.counters = p.counters.filter((x) => x !== c); save(); renderDetail(); } };
      ctr.append(del);
      row.append(ctr); wrap.append(row);
    });
    node.append(wrap);
  }

  const addc = E('button', 'ghost wide', '+ Tilføj tæller'); addc.onclick = () => counterModal(p);
  const doneBtn = E('button', 'ghost wide ' + (p.done ? '' : 'finish'), p.done ? 'Genåbn projekt' : '✓ Marker som færdig');
  doneBtn.onclick = () => {
    if (p.done) { p.done = false; delete p.finishedAt; save(); renderDetail(); }
    else finishModal(p);
  };
  const reset = E('button', 'ghost wide subtle', 'Nulstil alle tællere'); reset.onclick = () => { if (confirm('Nulstil alle tællere i dette projekt?')) { p.counters.forEach((c) => { c.value = c.wrapAt ? 1 : 0; c.repeats = 0; }); save(); renderDetail(); } };
  const delp = E('button', 'ghost wide danger', 'Slet projekt'); delp.onclick = () => { if (confirm('Slet projektet "' + p.name + '"?')) { projects = projects.filter((x) => x !== p); activeId = null; save(); releaseWake(); renderList(); } };
  node.append(addc, doneBtn, reset, delp);
}

/* ---------------- modals ---------------- */
function projectModal(existing) {
  const f = E('div', 'form');
  // remember previously used yarns (from projects + stash)
  const knownYarns = [...new Set([...projects.map((p) => p.yarn), ...store.get('stash', []).map((s) => s.name)].filter(Boolean))];
  const yarnOpts = knownYarns.map((y) => `<option value="${esc(y)}">`).join('');
  // needle sizes 2–12 mm in ½-mm steps (+ keep an existing custom value)
  const sizes = []; for (let mm = 2; mm <= 12.0001; mm += 0.5) sizes.push(needleFmt(mm));
  const cur = existing && existing.needle ? existing.needle : '';
  if (cur && !sizes.includes(cur)) sizes.unshift(cur);
  const needleOpts = `<option value="">— vælg —</option>` + sizes.map((s) => `<option${s === cur ? ' selected' : ''}>${esc(s)}</option>`).join('');
  // category (shared with Opskrifter); allows creating a new one inline
  const cats = store.get('collections', []);
  const catOpts = `<option value="">— ingen —</option>` + cats.map((c) => `<option value="${c.id}"${existing && existing.categoryId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('') + `<option value="__new">+ Ny kategori…</option>`;
  f.innerHTML = `<h2>${existing ? 'Rediger projekt' : 'Nyt projekt'}</h2>
    <label>Navn<input id="f-name" type="text" maxlength="40" placeholder="fx Sommerbluse" value="${existing ? esc(existing.name) : ''}"></label>
    <label>Garn<input id="f-yarn" type="text" list="f-yarnlist" maxlength="40" placeholder="fx Drops Air" value="${existing ? esc(existing.yarn || '') : ''}"><datalist id="f-yarnlist">${yarnOpts}</datalist></label>
    <label>Pinde<select id="f-needle">${needleOpts}</select></label>
    <label>Kategori<select id="f-cat">${catOpts}</select></label>
    <div class="formsec">Projektdetaljer (valgfrit)</div>
    <div class="grid2"><label class="nl">Størrelse<input id="f-size" type="text" maxlength="30" placeholder="fx M / 98-104" value="${existing ? esc(existing.size || '') : ''}"></label><label class="nl">Modtager<input id="f-recipient" type="text" maxlength="30" placeholder="fx Til mor" value="${existing ? esc(existing.recipient || '') : ''}"></label></div>
    <label>Strikkefasthed<input id="f-gauge" type="text" maxlength="40" placeholder="fx 22 m × 30 p = 10×10 cm" value="${existing ? esc(existing.gauge || '') : ''}"></label>
    <div class="grid2"><label class="nl">Startdato<input id="f-start" type="date" value="${existing ? esc(existing.startDate || '') : ''}"></label><label class="nl">Slutdato<input id="f-end" type="date" value="${existing ? esc(existing.endDate || '') : ''}"></label></div>
    <label>Noter<textarea id="f-notes" rows="2" maxlength="200" placeholder="evt. noter">${existing ? esc(existing.notes || '') : ''}</textarea></label>
    <div class="formsec">Garnforbrug (til din statusoversigt — valgfrit)</div>
    <div class="grid2"><label class="nl">Garn brugt (g)<input id="f-grams" type="number" inputmode="numeric" min="0" placeholder="fx 350" value="${existing && existing.gramsUsed != null ? existing.gramsUsed : ''}"></label><label class="nl">Løbelængde (m / 50 g)<input id="f-runlen" type="number" inputmode="numeric" min="0" placeholder="fx 150" value="${existing && existing.mPer50g != null ? existing.mPer50g : ''}"></label></div>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  const catSel = f.querySelector('#f-cat');
  catSel.onchange = () => {
    if (catSel.value !== '__new') return;
    catSel.value = existing && existing.categoryId ? existing.categoryId : '';
    createCategoryModal((cat) => { if (cat) { const o = document.createElement('option'); o.value = cat.id; o.textContent = cat.name; catSel.insertBefore(o, catSel.querySelector('option[value="__new"]')); catSel.value = cat.id; } });
  };
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = () => {
    const name = f.querySelector('#f-name').value.trim() || 'Nyt projekt';
    const yarn = f.querySelector('#f-yarn').value.trim(), needle = f.querySelector('#f-needle').value.trim(), notes = f.querySelector('#f-notes').value.trim();
    const categoryId = catSel.value && catSel.value !== '__new' ? catSel.value : null;
    const size = f.querySelector('#f-size').value.trim(), gauge = f.querySelector('#f-gauge').value.trim(), recipient = f.querySelector('#f-recipient').value.trim();
    const startDate = f.querySelector('#f-start').value, endDate = f.querySelector('#f-end').value;
    const gv = parseFloat(f.querySelector('#f-grams').value); const rv = parseFloat(f.querySelector('#f-runlen').value);
    const gramsUsed = Number.isFinite(gv) ? gv : null, mPer50g = Number.isFinite(rv) ? rv : null;
    // a manual end date drives the completion date used in the status overview
    const finishedAt = endDate ? new Date(endDate + 'T12:00').getTime() : (existing ? existing.finishedAt : undefined);
    const fields = { name, yarn, needle, notes, categoryId, size, gauge, recipient, startDate, endDate, gramsUsed, mPer50g };
    if (existing) { Object.assign(existing, fields); if (endDate) existing.finishedAt = finishedAt; delete existing.mPer100g; }
    else { const p = { id: uid(), ...fields, finishedAt, counters: [{ id: uid(), label: 'Omgange', value: 0, wrapAt: 0, repeats: 0, main: true }] }; projects.push(p); activeId = p.id; }
    save(); m.close(); render();
  };
}

function counterModal(project) {
  const f = E('div', 'form');
  f.innerHTML = `<h2>Tilføj tæller</h2>
    <label>Navn<input id="c-name" type="text" maxlength="30" placeholder="fx Mønsterrapport"></label>
    <label>Gentag hver (omgange) — valgfri<input id="c-wrap" type="number" inputmode="numeric" min="0" placeholder="fx 8 (0 = ingen)"></label>
    <label class="check"><input id="c-follow" type="checkbox"> Følg hovedtælleren (tæller automatisk med)</label>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Tilføj</button></div>`;
  const m = M(f);
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = () => {
    const label = f.querySelector('#c-name').value.trim() || 'Tæller';
    const wrapAt = Math.max(0, parseInt(f.querySelector('#c-wrap').value, 10) || 0);
    const follow = f.querySelector('#c-follow').checked;
    project.counters.push({ id: uid(), label, value: wrapAt ? 1 : 0, wrapAt, repeats: 0, follow });
    save(); m.close(); renderDetail();
  };
}

/* shrink a phone photo to a sensible size before storing (keeps backups small) */
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

/* celebrate finishing a project: add a photo + confirm yarn used, then mark done */
function finishModal(p) {
  const f = E('div', 'form finishform');
  const yarnHint = p.yarn ? ` af ${esc(p.yarn)}` : '';
  f.innerHTML = `<h2 class="finishhead"><span class="finishtick"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span> Tillykke — det er færdigt!</h2>
    <p class="hint">Gem et minde om “${esc(p.name)}” — det vises i din statusoversigt.</p>
    <label class="photopick">Billede af det færdige strik (valgfrit)<input id="fin-photo" type="file" accept="image/*"></label>
    <div id="fin-prev" class="finprev" hidden></div>
    <label>Afsluttet dato<input id="fin-date" type="date" value="${p.endDate || todayStr()}"></label>
    <div class="formsec">Garnforbrug${yarnHint} (valgfrit)</div>
    <div class="grid2"><label class="nl">Garn brugt (g)<input id="fin-grams" type="number" inputmode="numeric" min="0" placeholder="fx 350" value="${p.gramsUsed != null ? p.gramsUsed : ''}"></label><label class="nl">Løbelængde (m / 50 g)<input id="fin-runlen" type="number" inputmode="numeric" min="0" placeholder="fx 150" value="${p.mPer50g != null ? p.mPer50g : ''}"></label></div>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Gem som færdigt</button></div>`;
  const m = M(f);
  let photoBlob = null;
  const prev = f.querySelector('#fin-prev');
  f.querySelector('#fin-photo').onchange = async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) { prev.hidden = true; photoBlob = null; return; }
    prev.hidden = false; prev.innerHTML = '<span class="hint">Behandler billede…</span>';
    photoBlob = await downscaleImage(file);
    prev.innerHTML = `<img src="${URL.createObjectURL(photoBlob)}" alt="forhåndsvisning">`;
  };
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = async () => {
    const gv = parseFloat(f.querySelector('#fin-grams').value), rv = parseFloat(f.querySelector('#fin-runlen').value);
    if (Number.isFinite(gv)) p.gramsUsed = gv;
    if (Number.isFinite(rv)) p.mPer50g = rv;
    if (photoBlob) { try { const id = 'ph_' + p.id; await putPhoto({ id, blob: photoBlob, mime: photoBlob.type || 'image/jpeg', addedAt: Date.now() }); p.photoId = id; } catch (err) {} }
    const dstr = f.querySelector('#fin-date').value;
    p.endDate = dstr || todayStr();
    p.done = true; p.finishedAt = new Date(p.endDate + 'T12:00').getTime();
    releaseWake(); activeId = null; save(); m.close(); renderList();
  };
}

/* open the recipe linked to a project (resumes last position) — or pick one to link */
async function openPattern(p) {
  const ctx = { obj: p, save: () => save() };
  if (p.patternId) { try { const u = await getUpload(p.patternId); if (u) return openReader(u, ctx); } catch (e) {} }
  let ups = [];
  try { ups = await allUploads(); } catch (e) {}
  const f = E('div', 'sheet', `<h2>Vælg opskrift til projektet</h2>`);
  const list = E('div', 'sheetacts');
  if (!ups.length) list.append(E('p', 'hint', 'Du har ingen egne opskrifter endnu. Tilføj en under Opskrifter → Mine opskrifter → “+ Egen”.'));
  ups.forEach((u) => { const b = E('button', 'sheetbtn', esc(u.name)); b.onclick = () => { p.patternId = u.id; save(); m.close(); openReader(u, ctx); }; list.append(b); });
  const cancel = E('button', 'sheetbtn subtle', 'Luk'); cancel.onclick = () => m.close();
  list.append(cancel); f.append(list);
  const m = M(f);
}

/* create a category (shared with Opskrifter via store 'collections'); calls back with it */
function createCategoryModal(onCreate) {
  let chosen = DEFAULT_ICON;
  const f = E('div', 'form');
  const grid = ICON_GROUPS.map((g) => `<div class="icogrp">${g.label}</div><div class="icorow">${g.ids.map((id) => `<button type="button" class="icobtn${id === chosen ? ' on' : ''}" data-ic="${id}">${CAT_ICONS[id]}</button>`).join('')}</div>`).join('');
  f.innerHTML = `<h2>Ny kategori</h2><label>Navn<input id="nc-name" type="text" maxlength="30" placeholder="fx Babytøj, Huer"></label>
    <div class="icolabel">Vælg ikon</div><div class="icopick">${grid}</div>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Opret</button></div>`;
  const m = M(f);
  f.querySelectorAll('.icobtn').forEach((b) => b.onclick = () => { chosen = b.dataset.ic; f.querySelectorAll('.icobtn').forEach((x) => x.classList.toggle('on', x === b)); });
  f.querySelector('.cancel').onclick = () => { m.close(); onCreate(null); };
  f.querySelector('.ok').onclick = () => {
    const name = f.querySelector('#nc-name').value.trim(); if (!name) return;
    const cats = store.get('collections', []);
    const cat = { id: uid(), name, icon: chosen, items: [] };
    cats.push(cat); store.set('collections', cats);
    m.close(); onCreate(cat);
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
