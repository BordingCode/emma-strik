// Garn & grej — Emma's yarn stash + tools/needles. Stored on-device (localStorage).
import { store, uid } from './store.js';
import { exportData, importData } from './backup.js';
import { THEMES, applyTheme, currentTheme } from './theme.js';

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

function render() {
  node.innerHTML = '';
  node.append(E('div', 'pagehead', `<h1>Garn &amp; grej</h1><p class="hint">Hold styr på dit garnlager og dine pinde.</p>`));

  // ---- garn ----
  node.append(E('h2', 'sechead', 'Garnlager'));
  if (!stash.length) node.append(E('p', 'empty small', 'Intet garn noteret endnu.'));
  const sl = E('div', 'invlist');
  stash.forEach((g) => {
    const sub = [g.color, g.weight, g.skeins ? g.skeins + ' nøgler' : '', g.meters ? g.meters + ' m/nøgle' : ''].filter(Boolean).map(esc).join(' · ');
    const row = E('div', 'invrow', `<div class="inv-main"><b>${esc(g.name)}</b><span class="inv-sub">${sub || '—'}</span>${g.notes ? `<span class="inv-note">${esc(g.notes)}</span>` : ''}</div>`);
    const ed = E('button', 'iconbtn', '✎'); ed.onclick = () => yarnModal(g);
    row.append(ed); sl.append(row);
  });
  node.append(sl);
  const addY = E('button', 'ghost wide', '+ Tilføj garn'); addY.onclick = () => yarnModal(); node.append(addY);

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

  // ---- appearance / theme picker ----
  node.append(E('h2', 'sechead', 'Udseende'));
  node.append(E('p', 'hint', 'Vælg et tema. Det skifter med det samme og huskes på denne enhed.'));
  const grid = E('div', 'themegrid');
  const cur = currentTheme();
  THEMES.forEach((t) => {
    const card = E('button', 'themecard' + (t.id === cur ? ' on' : ''),
      `<span class="tc-swatch">${t.dots.map((d) => `<span class="tc-dot" style="background:${d}"></span>`).join('')}</span>
       <span class="tc-name">${esc(t.name)}</span><span class="tc-check">${t.id === cur ? '✓ valgt' : ''}</span>`);
    card.onclick = () => { applyTheme(t.id); render(); };
    grid.append(card);
  });
  node.append(grid);

  // ---- backup (was hidden behind the gear icon; now clearly here too) ----
  node.append(E('h2', 'sechead', 'Sikkerhedskopi'));
  node.append(E('p', 'hint', 'Alt du tilføjer gemmes kun på denne telefon. Lav en sikkerhedskopi, så du ikke mister det — og kan flytte det til en anden enhed.'));
  const exp = E('button', 'ghost wide', 'Gem sikkerhedskopi');
  exp.onclick = async () => { exp.textContent = 'Gemmer…'; try { await exportData(); } catch (e) { alert('Kunne ikke gemme.'); } exp.textContent = 'Gem sikkerhedskopi'; };
  const imp = E('label', 'ghost wide', 'Gendan fra fil');
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json'; inp.style.display = 'none';
  inp.onchange = async () => {
    if (!inp.files[0]) return;
    if (!confirm('Dette ERSTATTER dine nuværende projekter, kategorier og lager med indholdet fra filen. Fortsæt?')) { inp.value = ''; return; }
    try { const r = await importData(inp.files[0]); alert('Gendannet ✓' + (r.failed ? ` (${r.restored} opskrifter gendannet, ${r.failed} kunne ikke)` : '') + '. Appen genindlæses.'); location.reload(); }
    catch (e) { alert('Kunne ikke gendanne: ' + e.message); }
  };
  imp.append(inp);
  node.append(exp, imp);
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
    <div class="form-actions">${g ? '<button class="ghost del">Slet</button>' : ''}<button class="ghost cancel">Annuller</button><button class="primary ok">Gem</button></div>`;
  const m = M(f);
  f.querySelector('.cancel').onclick = () => m.close();
  if (g) f.querySelector('.del').onclick = () => { if (confirm('Slet garnet?')) { stash = stash.filter((x) => x !== g); saveStash(); m.close(); render(); } };
  f.querySelector('.ok').onclick = () => {
    const v = (id) => f.querySelector('#' + id).value.trim();
    const data = { name: v('y-name') || 'Garn', color: v('y-color'), weight: v('y-weight'), skeins: v('y-skeins'), meters: v('y-meters'), notes: v('y-notes') };
    if (g) Object.assign(g, data); else stash.push({ id: uid(), ...data });
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
