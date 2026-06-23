// Tæller — the heart. Projects, each with multiple counters (incl. repeat-wrap & follow-main).
// Big tap targets, auto-save on every tap (never lose your place), Screen Wake Lock while open.
import { store, uid } from './store.js';
import { openReader } from './reader.js';
import { allUploads, getUpload, putPhoto, getPhoto } from './idb.js';
import { CAT_ICONS, ICON_GROUPS, DEFAULT_ICON } from './caticons.js';
import { dateBtnHtml, wireDateButtons } from './datepicker.js';

let E, M, node;
let projects = [], activeId = null, todos = [];
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
  if (p.runM && p.runG) return Math.round(p.gramsUsed * p.runM / p.runG);
  if (p.mPer50g) return Math.round(p.gramsUsed * p.mPer50g / 50); // legacy
  if (p.mPer100g) return Math.round(p.gramsUsed * p.mPer100g / 100); // legacy
  return 0;
};
// A project can use several yarns and several needle sizes. These read the
// list form, falling back to the old single-value fields for older projects.
const yarnsOf = (p) => (p.yarns && p.yarns.length) ? p.yarns : (p.yarn ? [p.yarn] : []);
const needlesOf = (p) => (p.needles && p.needles.length) ? p.needles : (p.needle ? [p.needle] : []);
const projTags = (p) => [...yarnsOf(p), ...needlesOf(p)];
const needleFmt = (mm) => (mm % 1 === 0 ? String(mm) : mm.toFixed(1).replace('.', ',')) + ' mm';
const fmtDate = (s) => { if (!s) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? `${m[3]}.${m[2]}.${m[1]}` : s; };
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function initCounters(container, helpers) {
  E = helpers.el; M = helpers.modal; node = container;
  projects = store.get('projects', []);
  activeId = store.get('activeProject', null);
  todos = store.get('todos', []);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && activeId) requestWake(); });
  // let Indstillinger re-draw this page when the to-do toggle changes
  window.__esCounters = { refresh: () => { projects = store.get('projects', []); todos = store.get('todos', []); render(); } };
  render();
}

function save() { store.set('projects', projects); store.set('activeProject', activeId); }
function saveTodos() { store.set('todos', todos); }

/* ---------------- to-do / wishlist of upcoming projects ---------------- */
const todoEnabled = () => store.get('showTodo', true);
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
    <span class="pc-sub">${projTags(p).map(esc).join(' · ') || (p.done ? 'færdigt' : 'tryk for at fortsætte')}</span></div>
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
  const active = projects.filter((p) => !p.done);
  const done = projects.filter((p) => p.done);
  if (!projects.length) node.append(E('p', 'empty', 'Ingen projekter endnu. Start dit første herunder.'));
  // The projects ARE the task — lead with them.
  if (active.length) node.append(E('h2', 'sechead', 'Igangværende'));
  else if (projects.length) node.append(E('p', 'empty small', 'Ingen igangværende projekter — alt er færdigt'));
  const list = E('div', 'projlist');
  active.forEach((p) => list.append(projCard(p)));
  node.append(list);
  const add = E('button', 'primary big', '+ Nyt projekt');
  add.onclick = () => projectModal();
  node.append(add);
  // optional wishlist of upcoming projects (toggle in Indstillinger)
  if (todoEnabled()) renderTodo();
  // Stats are a summary, not the headline — show them below the projects.
  if (projects.length) node.append(statusCard());
  if (done.length) {
    node.append(E('h2', 'sechead', `✓ Færdige projekter (${done.length})`));
    const dl = E('div', 'projlist');
    done.forEach((p) => dl.append(projCard(p)));
    node.append(dl);
  }
  fillPhotos();
}

/* ---- to-do list: ideas for upcoming projects (name + yarn idea + #nøgler) ---- */
function renderTodo() {
  node.append(E('h2', 'sechead', '📋 Vil jeg strikke'));
  node.append(E('p', 'hint', 'Idéer til kommende projekter — navn, garn og hvor mange nøgler du regner med.'));
  const list = E('div', 'todolist');
  if (!todos.length) list.append(E('p', 'empty small', 'Ingen idéer endnu. Skriv dit næste projekt op herunder.'));
  todos.forEach((t) => list.append(todoCard(t)));
  node.append(list);
  const add = E('button', 'ghost wide', '+ Tilføj idé');
  add.onclick = () => todoModal();
  node.append(add);
}

function todoCard(t) {
  const card = E('div', 'todocard' + (t.done ? ' done' : ''));
  const chk = E('button', 'todo-check' + (t.done ? ' on' : ''), t.done ? '✓' : '');
  chk.setAttribute('aria-label', t.done ? 'Fjern flueben' : 'Marker som klar/lavet');
  chk.onclick = () => { t.done = !t.done; saveTodos(); renderList(); };
  const sub = t.yarn ? `<span class="todo-sub">${esc(t.yarn)}</span>` : '';
  const note = t.notes ? `<span class="todo-note">${esc(t.notes)}</span>` : '';
  const dots = (t.colors && t.colors.length)
    ? `<span class="todo-dots">${t.colors.map((c) => `<span class="todo-dot" style="background:${esc(c)}"></span>`).join('')}</span>` : '';
  const mid = E('button', 'todo-main', `<b>${esc(t.name)}</b>${sub}${note}${dots}`);
  mid.onclick = () => todoModal(t);
  const balls = t.balls ? `<span class="todo-balls">${esc(String(t.balls))} ${Number(t.balls) === 1 ? 'nøgle' : 'nøgler'}</span>` : '';
  card.append(chk, mid, E('div', 'todo-right', balls));
  return card;
}

function todoModal(existing) {
  const f = E('div', 'form');
  // suggest yarns she has used or has in her stash
  const knownYarns = [...new Set([...projects.flatMap(yarnsOf), ...store.get('stash', []).map((s) => s.name)].filter(Boolean))];
  const yarnOpts = knownYarns.map((y) => `<option value="${esc(y)}">`).join('');
  f.innerHTML = `<h2>${existing ? 'Rediger idé' : 'Ny projekt-idé'}</h2>
    <label>Projekt<input id="t-name" type="text" maxlength="40" placeholder="fx Stribet sweater" value="${existing ? esc(existing.name) : ''}"></label>
    <label>Garn-idé<input id="t-yarn" type="text" list="t-yarnlist" maxlength="60" placeholder="fx Drops Air, lyseblå" value="${existing ? esc(existing.yarn || '') : ''}"></label>
    <datalist id="t-yarnlist">${yarnOpts}</datalist>
    <label>Antal nøgler (ca.)<input id="t-balls" type="number" inputmode="numeric" min="0" placeholder="fx 8" value="${existing && existing.balls != null ? esc(String(existing.balls)) : ''}"></label>
    <label>Noter<textarea id="t-notes" rows="2" maxlength="300" placeholder="fri tekst — fx link til mønster, mål, idéer">${existing ? esc(existing.notes || '') : ''}</textarea></label>
    <div class="formsec-min">Farver <span class="fm-hint">(vælg de farver du vil bruge)</span></div>
    <div id="t-colors" class="colorrow"></div>
    <label class="addcolor">+ Tilføj farve<input id="t-colorin" type="color" value="#c87a5b"></label>
    ${existing ? '<button type="button" class="ghost wide start">Start som projekt →</button>' : ''}
    <div class="form-actions">${existing ? '<button class="minor danger del">Slet</button>' : ''}<button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  // colour swatches she can add/remove (the colour input is the wheel/picker)
  let colors = existing && Array.isArray(existing.colors) ? [...existing.colors] : [];
  const colorsBox = f.querySelector('#t-colors');
  const drawColors = () => {
    colorsBox.innerHTML = '';
    if (!colors.length) { colorsBox.append(E('span', 'colorhint', 'Ingen farver valgt endnu')); return; }
    colors.forEach((c, i) => {
      const sw = E('button', 'colorchip', `<span class="cc-dot" style="background:${esc(c)}"></span><span class="cc-x">×</span>`);
      sw.type = 'button'; sw.title = c;
      sw.onclick = () => { colors.splice(i, 1); drawColors(); };
      colorsBox.append(sw);
    });
  };
  drawColors();
  f.querySelector('#t-colorin').onchange = (e) => { const v = e.target.value; if (v && !colors.includes(v)) { colors.push(v); drawColors(); } };
  f.querySelector('.cancel').onclick = () => m.close();
  const del = f.querySelector('.del');
  if (del) del.onclick = () => { if (confirm('Slet idéen "' + existing.name + '"?')) { todos = todos.filter((x) => x !== existing); saveTodos(); m.close(); renderList(); } };
  const start = f.querySelector('.start');
  if (start) start.onclick = () => { m.close(); startTodoAsProject(existing); };
  f.querySelector('.ok').onclick = () => {
    const name = f.querySelector('#t-name').value.trim() || 'Ny idé';
    const yarn = f.querySelector('#t-yarn').value.trim();
    const notes = f.querySelector('#t-notes').value.trim();
    const bv = parseInt(f.querySelector('#t-balls').value, 10);
    const balls = Number.isFinite(bv) && bv > 0 ? bv : null;
    if (existing) Object.assign(existing, { name, yarn, balls, notes, colors });
    else todos.push({ id: uid(), name, yarn, balls, notes, colors, done: false });
    saveTodos(); m.close(); renderList();
  };
}

// turn a wishlist idea into a real project (prefills name + yarn), then opens it
function startTodoAsProject(t) {
  // carry the idea's notes, colour list and nøgle-estimate into the project notes
  const bits = [];
  if (t.notes) bits.push(t.notes);
  if (t.balls) bits.push('Ca. ' + t.balls + ' nøgler');
  if (t.colors && t.colors.length) bits.push('Farver: ' + t.colors.join(', '));
  const p = {
    id: uid(), name: t.name, yarns: t.yarn ? [t.yarn] : [], needles: [],
    notes: bits.join(' · '), categoryId: null,
    size: '', gauge: '', recipient: '', startDate: todayStr(), endDate: '',
    gramsUsed: null, runM: null, runG: 50,
    counters: [{ id: uid(), label: 'Omgange', value: 0, wrapAt: 0, repeats: 0, main: true }],
  };
  projects.push(p);
  todos = todos.filter((x) => x !== t);
  activeId = p.id; save(); saveTodos(); requestWake(); renderDetail();
}

function renderDetail() {
  const p = active(); if (!p) return renderList();
  requestWake();
  node.innerHTML = '';
  const main = p.counters[0];
  const head = E('div', 'detailhead');
  const back = E('button', 'iconbtn back', '‹ Projekter'); back.onclick = () => { activeId = null; save(); releaseWake(); renderList(); };
  const edit = E('button', 'iconbtn', '✎'); edit.onclick = () => projectModal(p);
  head.append(back, E('div', 'dtitle', `<b>${esc(p.name)}</b><small>${projTags(p).map(esc).join(' · ')}</small>`), edit);
  node.append(head);

  // main counter — big
  const mc = E('div', 'maincounter');
  mc.innerHTML = `<div class="mc-label">${esc(main.label)}</div>
    <div class="mc-value">${main.value}</div>${main.wrapAt ? `<div class="mc-wrap">i mønster: ${main.value}/${main.wrapAt} · ${main.repeats || 0} rapporter</div>` : ''}`;
  const minus = E('button', 'mc-btn minus', '−'); minus.onclick = () => tap(p, main, -1);
  const plus = E('button', 'mc-btn plus', '+'); plus.onclick = () => tap(p, main, 1);
  const ctrls = E('div', 'mc-ctrls'); ctrls.append(minus, plus);
  // reset just the round counter (not the whole project)
  const mcReset = E('button', 'mc-resetbtn', '↺ Nulstil omgangstæller');
  mcReset.onclick = () => { if (confirm('Nulstil omgangstælleren til ' + (main.wrapAt ? 1 : 0) + '?')) { main.value = main.wrapAt ? 1 : 0; main.repeats = 0; save(); renderDetail(); } };
  node.append(mc, ctrls, mcReset);

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
        <span class="sc-sub"><b class="sc-num">${c.value}</b>${c.wrapAt ? ` / ${c.wrapAt} · ${c.repeats || 0} rapport${(c.repeats || 0) === 1 ? '' : 'er'}` : ''}${c.follow ? ' · følger hovedtæller' : ''}</span></div>`;
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
  node.append(addc, doneBtn);
  // destructive actions, de-emphasised and set apart so they don't read as primary
  const reset = E('button', 'minor', 'Nulstil tællere'); reset.onclick = () => { if (confirm('Nulstil alle tællere i dette projekt?')) { p.counters.forEach((c) => { c.value = c.wrapAt ? 1 : 0; c.repeats = 0; }); save(); renderDetail(); } };
  const delp = E('button', 'minor danger', 'Slet projekt'); delp.onclick = () => { if (confirm('Slet projektet "' + p.name + '"?')) { projects = projects.filter((x) => x !== p); activeId = null; save(); releaseWake(); renderList(); } };
  const dz = E('div', 'danger-row'); dz.append(reset, delp); node.append(dz);
}

/* ---------------- modals ---------------- */
function projectModal(existing) {
  const f = E('div', 'form');
  // remember previously used yarns (from projects + stash)
  const knownYarns = [...new Set([...projects.flatMap(yarnsOf), ...store.get('stash', []).map((s) => s.name)].filter(Boolean))];
  const yarnOpts = knownYarns.map((y) => `<option value="${esc(y)}">`).join('');
  // needle sizes 2–12 mm in ½-mm steps (+ keep any existing custom values)
  const sizes = []; for (let mm = 2; mm <= 12.0001; mm += 0.5) sizes.push(needleFmt(mm));
  const exYarns = existing ? yarnsOf(existing) : [];
  const exNeedles = existing ? needlesOf(existing) : [];
  exNeedles.forEach((nd) => { if (nd && !sizes.includes(nd)) sizes.unshift(nd); });
  const needleOptsHtml = (sel) => `<option value="">— vælg —</option>` + sizes.map((s) => `<option${s === sel ? ' selected' : ''}>${esc(s)}</option>`).join('');
  // run length (from the yarn band): metres per N grams (N defaults to 50, editable)
  const exRunM = existing ? (existing.runM != null ? existing.runM : (existing.mPer50g != null ? existing.mPer50g : '')) : '';
  const exRunG = existing && existing.runG != null ? existing.runG : 50;
  // category (shared with Opskrifter); allows creating a new one inline
  const cats = store.get('collections', []);
  const catOpts = `<option value="">— ingen —</option>` + cats.map((c) => `<option value="${c.id}"${existing && existing.categoryId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('') + `<option value="__new">+ Ny kategori…</option>`;
  f.innerHTML = `<h2>${existing ? 'Rediger projekt' : 'Nyt projekt'}</h2>
    <label>Navn<input id="f-name" type="text" maxlength="40" placeholder="fx Sommerbluse" value="${existing ? esc(existing.name) : ''}"></label>
    <div class="formsec-min">Garn <span class="fm-hint">(du kan tilføje flere)</span></div>
    <div id="f-yarns" class="repeat-list"></div>
    <datalist id="f-yarnlist">${yarnOpts}</datalist>
    <button type="button" class="addrow" id="f-addyarn">+ Tilføj garn</button>
    <div class="formsec-min">Pinde <span class="fm-hint">(du kan tilføje flere)</span></div>
    <div id="f-needles" class="repeat-list"></div>
    <button type="button" class="addrow" id="f-addneedle">+ Tilføj pind</button>
    <label>Kategori<select id="f-cat">${catOpts}</select></label>
    <div class="formsec">Projektdetaljer (valgfrit)</div>
    <div class="grid2"><label class="nl">Størrelse<input id="f-size" type="text" maxlength="30" placeholder="fx M / 98-104" value="${existing ? esc(existing.size || '') : ''}"></label><label class="nl">Modtager<input id="f-recipient" type="text" maxlength="30" placeholder="fx Til mor" value="${existing ? esc(existing.recipient || '') : ''}"></label></div>
    <label>Strikkefasthed<input id="f-gauge" type="text" maxlength="40" placeholder="fx 22 m × 30 p = 10×10 cm" value="${existing ? esc(existing.gauge || '') : ''}"></label>
    <div class="grid2"><label class="nl">Startdato${dateBtnHtml('f-start', existing ? existing.startDate : '')}</label><label class="nl">Slutdato${dateBtnHtml('f-end', existing ? existing.endDate : '')}</label></div>
    <label>Noter<textarea id="f-notes" rows="2" maxlength="200" placeholder="evt. noter">${existing ? esc(existing.notes || '') : ''}</textarea></label>
    <div class="formsec">Garnforbrug (til din statusoversigt — valgfrit)</div>
    <div class="grid2"><label class="nl">Garn brugt (g)<input id="f-grams" type="number" inputmode="numeric" min="0" placeholder="fx 350" value="${existing && existing.gramsUsed != null ? existing.gramsUsed : ''}"></label><label class="nl">Løbelængde (m)<input id="f-runm" type="number" inputmode="numeric" min="0" placeholder="fx 150" value="${exRunM}"></label></div>
    <label class="nl">… pr. antal gram <span class="fm-hint">(står på banderolen — typisk 50)</span><input id="f-rung" type="number" inputmode="numeric" min="1" placeholder="50" value="${exRunG}"></label>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  // repeatable yarn + needle rows (a project can use more than one of each)
  const yarnsBox = f.querySelector('#f-yarns'), needlesBox = f.querySelector('#f-needles');
  const addYarnRow = (val = '') => {
    const row = E('div', 'reprow');
    row.innerHTML = `<input type="text" class="ry" list="f-yarnlist" maxlength="40" placeholder="fx Drops Air" value="${esc(val)}"><button type="button" class="reprm" aria-label="Fjern garn">×</button>`;
    row.querySelector('.reprm').onclick = () => row.remove();
    yarnsBox.append(row);
  };
  const addNeedleRow = (val = '') => {
    const row = E('div', 'reprow');
    row.innerHTML = `<select class="rn">${needleOptsHtml(val)}</select><button type="button" class="reprm" aria-label="Fjern pind">×</button>`;
    row.querySelector('.reprm').onclick = () => row.remove();
    needlesBox.append(row);
  };
  (exYarns.length ? exYarns : ['']).forEach(addYarnRow);
  (exNeedles.length ? exNeedles : ['']).forEach(addNeedleRow);
  f.querySelector('#f-addyarn').onclick = () => addYarnRow('');
  f.querySelector('#f-addneedle').onclick = () => addNeedleRow('');
  wireDateButtons(f);
  const catSel = f.querySelector('#f-cat');
  catSel.onchange = () => {
    if (catSel.value !== '__new') return;
    catSel.value = existing && existing.categoryId ? existing.categoryId : '';
    createCategoryModal((cat) => { if (cat) { const o = document.createElement('option'); o.value = cat.id; o.textContent = cat.name; catSel.insertBefore(o, catSel.querySelector('option[value="__new"]')); catSel.value = cat.id; } });
  };
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = () => {
    const name = f.querySelector('#f-name').value.trim() || 'Nyt projekt';
    const yarns = [...yarnsBox.querySelectorAll('.ry')].map((i) => i.value.trim()).filter(Boolean);
    const needles = [...needlesBox.querySelectorAll('.rn')].map((s) => s.value.trim()).filter(Boolean);
    const notes = f.querySelector('#f-notes').value.trim();
    const categoryId = catSel.value && catSel.value !== '__new' ? catSel.value : null;
    const size = f.querySelector('#f-size').value.trim(), gauge = f.querySelector('#f-gauge').value.trim(), recipient = f.querySelector('#f-recipient').value.trim();
    const startDate = f.querySelector('#f-start').dataset.val || '', endDate = f.querySelector('#f-end').dataset.val || '';
    const gv = parseFloat(f.querySelector('#f-grams').value);
    const rm = parseFloat(f.querySelector('#f-runm').value), rg = parseFloat(f.querySelector('#f-rung').value);
    const gramsUsed = Number.isFinite(gv) ? gv : null;
    const runM = Number.isFinite(rm) && rm > 0 ? rm : null, runG = Number.isFinite(rg) && rg > 0 ? rg : 50;
    // a manual end date drives the completion date used in the status overview
    const finishedAt = endDate ? new Date(endDate + 'T12:00').getTime() : (existing ? existing.finishedAt : undefined);
    const fields = { name, yarns, needles, notes, categoryId, size, gauge, recipient, startDate, endDate, gramsUsed, runM, runG };
    if (existing) { Object.assign(existing, fields); if (endDate) existing.finishedAt = finishedAt; delete existing.yarn; delete existing.needle; delete existing.mPer50g; delete existing.mPer100g; }
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
  const yarnHint = yarnsOf(p).length ? ` af ${esc(yarnsOf(p).join(', '))}` : '';
  f.innerHTML = `<h2 class="finishhead"><span class="finishtick"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span> Tillykke — det er færdigt!</h2>
    <p class="hint">Gem et minde om “${esc(p.name)}” — det vises i din statusoversigt.</p>
    <label class="photopick">Billede af det færdige strik (valgfrit)<input id="fin-photo" type="file" accept="image/*"></label>
    <div id="fin-prev" class="finprev" hidden></div>
    <label>Afsluttet dato${dateBtnHtml('fin-date', p.endDate || todayStr())}</label>
    <div class="formsec">Garnforbrug${yarnHint} (valgfrit)</div>
    <div class="grid2"><label class="nl">Garn brugt (g)<input id="fin-grams" type="number" inputmode="numeric" min="0" placeholder="fx 350" value="${p.gramsUsed != null ? p.gramsUsed : ''}"></label><label class="nl">Løbelængde (m)<input id="fin-runm" type="number" inputmode="numeric" min="0" placeholder="fx 150" value="${p.runM != null ? p.runM : (p.mPer50g != null ? p.mPer50g : '')}"></label></div>
    <label class="nl">… pr. antal gram <span class="fm-hint">(typisk 50)</span><input id="fin-rung" type="number" inputmode="numeric" min="1" placeholder="50" value="${p.runG != null ? p.runG : 50}"></label>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Gem som færdigt</button></div>`;
  const m = M(f);
  wireDateButtons(f);
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
    const gv = parseFloat(f.querySelector('#fin-grams').value);
    const rm = parseFloat(f.querySelector('#fin-runm').value), rg = parseFloat(f.querySelector('#fin-rung').value);
    if (Number.isFinite(gv)) p.gramsUsed = gv;
    if (Number.isFinite(rm) && rm > 0) { p.runM = rm; p.runG = (Number.isFinite(rg) && rg > 0) ? rg : 50; delete p.mPer50g; delete p.mPer100g; }
    if (photoBlob) { try { const id = 'ph_' + p.id; await putPhoto({ id, blob: photoBlob, mime: photoBlob.type || 'image/jpeg', addedAt: Date.now() }); p.photoId = id; } catch (err) {} }
    const dstr = f.querySelector('#fin-date').dataset.val;
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
