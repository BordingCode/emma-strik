// Indstillinger — app-wide settings reached from the gear in the top bar:
// appearance (theme), device sync, and backup. (Moved out of the Garn tab.)
import { store } from './store.js';
import { exportData, importData } from './backup.js';
import { THEMES, applyTheme, currentTheme } from './theme.js';
import { isLinked, getCode, lastUpdated, linkNew, linkJoin, unlink, pushNow, pullIfNewer, normalizeCode } from './sync.js';

let node, M, backFn;

export function initSettings(container, helpers) {
  node = container; M = helpers.modal; backFn = helpers.back || (() => {});
  render();
}

const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render() {
  node.innerHTML = '';
  const head = E('div', 'detailhead');
  const back = E('button', 'iconbtn back', '‹ Tilbage'); back.onclick = () => backFn();
  head.append(back, E('div', 'dtitle', '<b>Indstillinger</b>'), E('span', 'iconbtn-spacer'));
  node.append(head);

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

  // ---- features: to-do list on the Projekter page ----
  node.append(E('h2', 'sechead', 'Projekter'));
  node.append(E('p', 'hint', 'Vis en lille to-do liste på Projekter-siden med idéer til kommende projekter — navn, garn-idé og antal nøgler.'));
  const todoOn = store.get('showTodo', true);
  const swrow = E('div', 'switchrow');
  swrow.append(E('span', 'sw-label', 'To-do liste på Projekter'));
  const sw = E('button', 'switch' + (todoOn ? ' on' : ''), '<span class="sw-knob"></span>');
  sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(todoOn));
  sw.onclick = () => { store.set('showTodo', !store.get('showTodo', true)); if (window.__esCounters) window.__esCounters.refresh(); render(); };
  swrow.append(sw);
  node.append(swrow);

  // ---- device sync ----
  node.append(E('h2', 'sechead', 'Synkronisering'));
  node.append(E('p', 'hint', 'Hav den samme profil på flere enheder (fx telefon og tablet). Det er gratis.'));
  if (!isLinked()) {
    const make = E('button', 'ghost wide', 'Forbind enheder'); make.onclick = createLinkModal;
    const join = E('button', 'ghost wide', 'Jeg har en kode'); join.onclick = joinLinkModal;
    node.append(make, join);
  } else {
    const code = getCode();
    const box = E('div', 'syncbox', `<span class="sync-dot"></span><div class="sync-info"><b>Forbundet</b>
      <span class="sync-sub">Kode: <code>${esc(code)}</code></span>
      <span class="sync-sub">${lastUpdated() ? 'Sidst opdateret ' + relTime(lastUpdated()) : 'Endnu ikke synkroniseret'}</span></div>`);
    node.append(box);
    const now = E('button', 'ghost wide', 'Synk nu');
    now.onclick = async () => { now.textContent = 'Synkroniserer…'; now.disabled = true; const pulled = await pullIfNewer(); if (pulled) return location.reload(); await pushNow(); render(); };
    const showc = E('button', 'ghost wide', 'Vis kode (til en ny enhed)'); showc.onclick = () => showCodeModal(code);
    const un = E('button', 'ghost wide subtle', 'Afbryd forbindelse på denne enhed');
    un.onclick = () => { if (confirm('Afbryd synkronisering på denne enhed? Dine data bliver liggende lokalt, men holdes ikke længere opdateret med dine andre enheder.')) { unlink(); render(); } };
    node.append(now, showc, un);
  }

  // ---- backup ----
  node.append(E('h2', 'sechead', 'Sikkerhedskopi'));
  node.append(E('p', 'hint', 'Alt du tilføjer gemmes kun på denne enhed. Lav en sikkerhedskopi, så du ikke mister det — og kan flytte det til en anden enhed.'));
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

/* ---------------- device sync helpers ---------------- */
function relTime(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'lige nu';
  const m = Math.round(s / 60); if (m < 60) return `for ${m} min siden`;
  const h = Math.round(m / 60); if (h < 24) return `for ${h} ${h === 1 ? 'time' : 'timer'} siden`;
  const d = Math.round(h / 24); return `for ${d} ${d === 1 ? 'dag' : 'dage'} siden`;
}
function codeDisplay(code) {
  return `<div class="codebig">${esc(code)}</div>
    <button class="ghost wide" id="copycode">Kopiér kode</button>
    <p class="hint">Skriv koden på din anden enhed under <b>⚙️ Indstillinger ▸ Synkronisering ▸ “Jeg har en kode”</b>. Gem den et sikkert sted — alle med koden kan se dine data.</p>`;
}
function wireCopy(f, code) {
  const b = f.querySelector('#copycode'); if (!b) return;
  b.onclick = () => { try { navigator.clipboard.writeText(code); b.textContent = 'Kopieret ✓'; } catch (e) {} };
}
function createLinkModal() {
  const f = E('div', 'form');
  f.innerHTML = `<h2>Forbind enheder</h2><p class="hint">Laver en kode og lægger din profil i skyen…</p>`;
  const m = M(f);
  linkNew().then((code) => {
    f.innerHTML = `<h2>Din synk-kode</h2>${codeDisplay(code)}<div class="form-actions"><button class="primary ok">Færdig</button></div>`;
    wireCopy(f, code);
    f.querySelector('.ok').onclick = () => { m.close(); render(); };
  }).catch((err) => {
    f.innerHTML = `<h2>Kunne ikke forbinde</h2><p class="hint">${esc(err.message || 'Prøv igen senere.')}</p><div class="form-actions"><button class="primary ok">Luk</button></div>`;
    f.querySelector('.ok').onclick = () => m.close();
  });
}
function showCodeModal(code) {
  const f = E('div', 'form');
  f.innerHTML = `<h2>Din synk-kode</h2>${codeDisplay(code)}<div class="form-actions"><button class="primary ok">Luk</button></div>`;
  const m = M(f);
  wireCopy(f, code);
  f.querySelector('.ok').onclick = () => m.close();
}
function joinLinkModal() {
  const f = E('div', 'form');
  f.innerHTML = `<h2>Hent profil fra en kode</h2>
    <p class="hint">Skriv koden fra din anden enhed, så hentes profilen ned hertil.</p>
    <label>Kode<input id="join-code" type="text" autocapitalize="characters" autocomplete="off" placeholder="fx ES-K7M2-Q4XP"></label>
    <p class="hint warn">Bemærk: det <b>erstatter</b> det, der ligger på denne enhed nu. Har du allerede projekter her, gemmer jeg først en sikkerhedskopi som fil.</p>
    <div class="form-actions"><button class="ghost cancel">Annuller</button><button class="primary ok">Hent profil</button></div>`;
  const m = M(f);
  f.querySelector('.cancel').onclick = () => m.close();
  f.querySelector('.ok').onclick = async () => {
    const raw = f.querySelector('#join-code').value;
    if (!normalizeCode(raw)) { f.querySelector('#join-code').focus(); return; }
    const hasLocal = !!(store.get('projects', []).length || store.get('collections', []).length || store.get('stash', []).length);
    if (hasLocal && !confirm('Dette erstatter dine nuværende data på denne enhed med profilen fra koden. Jeg gemmer først en sikkerhedskopi som fil. Fortsæt?')) return;
    const ok = f.querySelector('.ok'); ok.textContent = 'Henter…'; ok.disabled = true;
    try {
      if (hasLocal) { try { await exportData(); } catch (e) {} }
      await linkJoin(raw);
      m.close();
      alert('Profil hentet ✓ Appen genindlæses.');
      location.reload();
    } catch (e) { ok.textContent = 'Hent profil'; ok.disabled = false; alert('Kunne ikke hente: ' + (e.message || '')); }
  };
}
