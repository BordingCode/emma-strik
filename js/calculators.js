// Beregner — the calculators knitters can't easily find in-browser. Danish, live results.
export function initCalculators(node) {
  node.innerHTML = `<div class="pagehead"><h1>Beregner</h1>
    <p class="hint">De små regnestykker, der altid driller — løst for dig.</p></div>
    <div class="calcs"></div>`;
  const wrap = node.querySelector('.calcs');
  wrap.append(evenCalc(), gaugeCalc(), yarnCalc(), substGuide());
}

/* helpers */
const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
function card(title, sub) { const c = E('section', 'calc'); c.innerHTML = `<h2>${title}</h2>${sub ? `<p class="csub">${sub}</p>` : ''}`; return c; }
function num(id, label, ph) { return `<label class="nl">${label}<input id="${id}" type="number" inputmode="numeric" min="0" placeholder="${ph || ''}"></label>`; }
const v = (root, id) => parseFloat(root.querySelector('#' + id).value);
const ok = (x) => Number.isFinite(x) && x > 0;
function groups(total, n) { // split `total` into n as-even-as-possible group sizes, big ones spread out
  const q = Math.floor(total / n), r = total % n, out = [];
  let acc = 0; for (let i = 0; i < n; i++) { acc += r; if (acc >= n) { acc -= n; out.push(q + 1); } else out.push(q); }
  return out;
}
function summarize(sizes) { // "8,7,8,7" -> "7 ×6 og 8 ×2" style compact
  const m = {}; sizes.forEach((s) => m[s] = (m[s] || 0) + 1);
  return Object.keys(m).map(Number).sort((a, b) => a - b).map((s) => `${m[s]}× ${s} m`).join(' og ');
}

/* 1) distribute increases / decreases evenly */
function evenCalc() {
  const c = card('Fordel ind-/udtagninger jævnt', 'Skriv hvor mange masker du har nu, og hvor mange du vil ende med.');
  c.innerHTML += num('e-cur', 'Masker nu') + num('e-tgt', 'Ønsket antal masker') + `<div class="result" id="e-out"></div>`;
  const run = () => {
    const S = v(c, 'e-cur'), T = v(c, 'e-tgt'), out = c.querySelector('#e-out');
    if (!ok(S) || !Number.isFinite(T)) { out.textContent = ''; return; }
    const n = Math.abs(Math.round(T) - Math.round(S));
    if (n === 0) { out.innerHTML = 'Ingen ændring nødvendig 🙂'; return; }
    if (T > S) { // increases: knit groups of existing sts, M1 after each
      const sizes = groups(Math.round(S), n);
      out.innerHTML = `<b>Tag ${n} masker ud</b> (slut: ${Math.round(S) + n} m):<br>
        Strik i grupper og <b>tag 1 ud</b> efter hver gruppe.<br>
        <span class="seq">${sizes.map((s) => `(strik ${s}, tag 1 ud)`).join(', ')}</span><br>
        <small>Grupper: ${summarize(sizes)}. Tip: ryk evt. første gruppe til halv størrelse for pænere kant.</small>`;
    } else { // decreases: k2tog consumes 2 sts
      const plain = Math.round(S) - 2 * n;
      if (plain < 0) { out.innerHTML = `Du kan ikke tage ${n} ind på kun ${Math.round(S)} masker.`; return; }
      const sizes = groups(plain, n);
      out.innerHTML = `<b>Tag ${n} masker ind</b> (slut: ${Math.round(S) - n} m):<br>
        Strik i grupper og <b>strik 2 sammen</b> efter hver gruppe.<br>
        <span class="seq">${sizes.map((s) => `(strik ${s}, strik 2 sm)`).join(', ')}</span><br>
        <small>Grupper før hver indtagning: ${summarize(sizes)}.</small>`;
    }
  };
  c.addEventListener('input', run);
  return c;
}

/* 2) gauge resize */
function gaugeCalc() {
  const c = card('Omregn ved anden strikkefasthed', 'Tilpas opskriftens masker/omgange til DIN fasthed (pr. 10 cm).');
  c.innerHTML += `<div class="grid2">
    ${num('g-pm', 'Opskrift: masker/10 cm')}${num('g-ym', 'Din: masker/10 cm')}
    ${num('g-pr', 'Opskrift: omg./10 cm')}${num('g-yr', 'Din: omg./10 cm')}</div>
    ${num('g-cm', 'Opskriften siger (masker)')}${num('g-cr', 'Opskriften siger (omgange)')}
    <div class="result" id="g-out"></div>`;
  const run = () => {
    const out = c.querySelector('#g-out'); let html = '';
    const pm = v(c, 'g-pm'), ym = v(c, 'g-ym'), cm = v(c, 'g-cm');
    if (ok(pm) && ok(ym) && ok(cm)) html += `Masker: strik <b>${Math.round(cm * ym / pm)}</b> i stedet for ${Math.round(cm)}.<br>`;
    const pr = v(c, 'g-pr'), yr = v(c, 'g-yr'), cr = v(c, 'g-cr');
    if (ok(pr) && ok(yr) && ok(cr)) html += `Omgange: strik <b>${Math.round(cr * yr / pr)}</b> i stedet for ${Math.round(cr)}.`;
    out.innerHTML = html || '';
  };
  c.addEventListener('input', run);
  return c;
}

/* 3) yarn needed */
function yarnCalc() {
  const c = card('Garnberegner', 'Hvor mange nøgler skal du bruge, hvis du skifter garn?');
  c.innerHTML += `<p class="mini">Opskriften kræver:</p>
    <div class="grid2">${num('y-balls', 'antal nøgler')}${num('y-len', 'meter pr. nøgle')}</div>
    <p class="mini">Dit garn:</p>${num('y-mine', 'meter pr. nøgle')}
    <div class="result" id="y-out"></div>`;
  const run = () => {
    const b = v(c, 'y-balls'), l = v(c, 'y-len'), mine = v(c, 'y-mine'), out = c.querySelector('#y-out');
    if (!ok(b) || !ok(l) || !ok(mine)) { out.textContent = ''; return; }
    const total = b * l, need = Math.ceil(total / mine);
    out.innerHTML = `Du skal bruge ca. <b>${need} nøgler</b> af dit garn (i alt ${Math.round(total)} m).<br>
      <small>Køb gerne 1 ekstra for en sikkerheds skyld.</small>`;
  };
  c.addEventListener('input', run);
  return c;
}

/* yarn-weight / substitution guide (general weights + DROPS rule + link, no invented DROPS numbers) */
function substGuide() {
  const c = card('Garnerstatning', 'Skift garn trygt: match strikkefastheden (masker pr. 10 cm).');
  const rows = [
    ['Tyndt / Lace', 'ca. 30–34', '2–3'],
    ['Fingering / Sokkegarn', 'ca. 26–30', '2,5–3,5'],
    ['Sport', 'ca. 24–26', '3–3,5'],
    ['DK', 'ca. 22–24', '3,5–4,5'],
    ['Aran / Worsted', 'ca. 18–20', '4,5–5,5'],
    ['Tykt / Chunky', 'ca. 14–17', '5,5–7'],
    ['Ekstra tykt', 'ca. 8–12', '7–12'],
  ];
  c.innerHTML += `<table class="wtbl"><thead><tr><th>Type</th><th>M/10 cm</th><th>Pind (mm)</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>
    <p class="mini note">DROPS inddeler garn i 6 grupper <b>A–F</b> (A tyndest, F tykkest). Garn i samme gruppe
    kan erstatte hinanden, og <b>2 tråde gruppe A ≈ 1 tråd gruppe C</b>. Se DROPS' præcise oversigt:</p>
    <a class="srclink" href="https://www.garnstudio.com/yarn-groups.php?cid=17" target="_blank" rel="noopener">DROPS garngrupper A–F →</a>`;
  return c;
}
