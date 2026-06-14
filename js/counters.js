// Tæller — the heart. Projects, each with multiple counters (incl. repeat-wrap & follow-main).
// Big tap targets, auto-save on every tap (never lose your place), Screen Wake Lock while open.
import { store, uid } from './store.js';

let E, M, node;
let projects = [], activeId = null;
let wakeLock = null;

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
  const row = E('button', 'projcard' + (p.done ? ' done' : ''), `<div class="pc-main"><b>${esc(p.name)}${p.done ? ' <span class="donetick">✓</span>' : ''}</b>
    <span class="pc-sub">${[p.yarn, p.needle].filter(Boolean).map(esc).join(' · ') || (p.done ? 'færdigt' : 'tryk for at fortsætte')}</span></div>
    <div class="pc-count"><span class="pc-num">${main ? main.value : 0}</span><span class="pc-lbl">omg.</span></div>`);
  row.onclick = () => { activeId = p.id; save(); if (!p.done) requestWake(); renderDetail(); };
  return row;
}

function renderList() {
  node.innerHTML = '';
  node.append(E('div', 'pagehead', `<h1>Dine projekter</h1><p class="hint">Tæl omgange uden at miste tællingen — skærmen forbliver tændt mens du strikker.</p>`));
  const active = projects.filter((p) => !p.done);
  const done = projects.filter((p) => p.done);
  if (!projects.length) node.append(E('p', 'empty', 'Ingen projekter endnu. Start dit første herunder. 🧶'));
  if (active.length) node.append(E('h2', 'sechead', '🧶 Igangværende'));
  else if (projects.length) node.append(E('p', 'empty small', 'Ingen igangværende projekter — alt er færdigt! 🎉'));
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
  const doneBtn = E('button', 'ghost wide ' + (p.done ? '' : 'finish'), p.done ? '↺ Genåbn projekt' : '✓ Marker som færdig');
  doneBtn.onclick = () => {
    p.done = !p.done;
    if (p.done) { p.finishedAt = Date.now(); releaseWake(); save(); activeId = null; renderList(); }
    else { delete p.finishedAt; save(); renderDetail(); }
  };
  const reset = E('button', 'ghost wide subtle', '↺ Nulstil alle tællere'); reset.onclick = () => { if (confirm('Nulstil alle tællere i dette projekt?')) { p.counters.forEach((c) => { c.value = c.wrapAt ? 1 : 0; c.repeats = 0; }); save(); renderDetail(); } };
  const delp = E('button', 'ghost wide danger', '🗑 Slet projekt'); delp.onclick = () => { if (confirm('Slet projektet "' + p.name + '"?')) { projects = projects.filter((x) => x !== p); activeId = null; save(); releaseWake(); renderList(); } };
  node.append(addc, doneBtn, reset, delp);
}

/* ---------------- modals ---------------- */
function projectModal(existing) {
  const f = E('div', 'form');
  f.innerHTML = `<h2>${existing ? 'Rediger projekt' : 'Nyt projekt'}</h2>
    <label>Navn<input id="f-name" type="text" maxlength="40" placeholder="fx Scommer­bluse" value="${existing ? esc(existing.name) : ''}"></label>
    <label>Garn<input id="f-yarn" type="text" maxlength="40" placeholder="fx Drops Air" value="${existing ? esc(existing.yarn || '') : ''}"></label>
    <label>Pinde<input id="f-needle" type="text" maxlength="20" placeholder="fx 4 mm" value="${existing ? esc(existing.needle || '') : ''}"></label>
    <label>Noter<textarea id="f-notes" rows="2" maxlength="200" placeholder="evt. noter">${existing ? esc(existing.notes || '') : ''}</textarea></label>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = () => {
    const name = f.querySelector('#f-name').value.trim() || 'Nyt projekt';
    const yarn = f.querySelector('#f-yarn').value.trim(), needle = f.querySelector('#f-needle').value.trim(), notes = f.querySelector('#f-notes').value.trim();
    if (existing) { Object.assign(existing, { name, yarn, needle, notes }); }
    else { const p = { id: uid(), name, yarn, needle, notes, counters: [{ id: uid(), label: 'Omgange', value: 0, wrapAt: 0, repeats: 0, main: true }] }; projects.push(p); activeId = p.id; }
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

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
