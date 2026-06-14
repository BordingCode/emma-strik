// Beregner — knitting calculators, Danish, live results. Each has an ⓘ info sheet
// explaining its goal + how to use it (with an example), so it's easy to understand.
let M;
export function initCalculators(node, helpers) {
  M = helpers.modal;
  node.innerHTML = `<div class="pagehead"><h1>Beregner</h1>
    <p class="hint">De små regnestykker, der altid driller — løst for dig. Tryk på ⓘ hvis du er i tvivl.</p></div>
    <div class="calcs"></div>`;
  node.querySelector('.calcs').append(evenCalc(), gaugeCalc(), yarnCalc(), substGuide(), videoCard());
}

function videoCard() {
  const c = card('Hjælpevideoer',
    'Se teknikkerne gjort — trin for trin, af dygtige strikkere.',
    `<p><b>Hvad er det?</b> Links til gode video-guides. Sidder du fast i en teknik (fx en snoning eller en italiensk opslagning), så er der næsten altid en video, der viser præcis hvordan.</p>
     <p>Tryk på et link for at åbne videoen i en ny fane.</p>`);
  const links = [
    ['Kimmie Munkholm', 'Dansk — alt fra slå-op til snoninger og flerfarvet strik', 'https://www.youtube.com/channel/UC3vgNeiHiliP8q9fVwjnA5w'],
    ['PetiteKnit · videoer', 'Teknik-videoer til PetiteKnits opskrifter', 'https://www.petiteknit.com/en/pages/video'],
    ['Søg på YouTube', 'Find en video til lige det, du sidder med', 'https://www.youtube.com/results?search_query=strikketeknik+dansk'],
  ];
  const list = E('div', 'vidlist');
  links.forEach(([t, d, u]) => {
    const a = E('a', 'vidlink'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.innerHTML = `<span class="vi">▶</span><span class="vmeta"><b>${t}</b><small>${d}</small></span><span class="varr">→</span>`;
    list.append(a);
  });
  c.append(list);
  return c;
}

const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const v = (root, id) => parseFloat(root.querySelector('#' + id).value);
const ok = (x) => Number.isFinite(x) && x > 0;

// card with a title row + ⓘ info button
function card(title, sub, infoHtml) {
  const c = E('section', 'calc');
  const head = E('div', 'calchead');
  head.append(E('h2', null, title));
  const info = E('button', 'infobtn', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg>');
  info.setAttribute('aria-label', 'Sådan virker den');
  info.onclick = () => openInfo(title, infoHtml);
  head.append(info);
  c.append(head);
  if (sub) c.append(E('p', 'csub', sub));
  return c;
}
function openInfo(title, html) {
  const f = E('div', 'sheet infosheet', `<h2>${title}</h2><div class="infobody">${html}</div>`);
  const close = E('button', 'sheetbtn subtle', 'Luk'); close.onclick = () => m.close();
  f.append(close);
  const m = M(f);
}
function groups(total, n) {
  const q = Math.floor(total / n), r = total % n, out = []; let acc = 0;
  for (let i = 0; i < n; i++) { acc += r; if (acc >= n) { acc -= n; out.push(q + 1); } else out.push(q); }
  return out;
}
function summarize(sizes) { const m = {}; sizes.forEach((s) => m[s] = (m[s] || 0) + 1); return Object.keys(m).map(Number).sort((a, b) => a - b).map((s) => `${m[s]}× ${s} m`).join(' og '); }

/* 1) distribute increases / decreases evenly */
function evenCalc() {
  const c = card('Fordel ind-/udtagninger jævnt',
    'Skriv hvor mange masker du har nu, og hvor mange du vil ende med.',
    `<p><b>Hvad er den til?</b> Når en opskrift siger “tag X masker ind/ud, jævnt fordelt”, fortæller den her dig <b>præcis hvor</b> du skal gøre det, så det sidder pænt jævnt på pinden.</p>
     <p><b>Sådan bruger du den:</b></p>
     <ol><li>Tæl maskerne du har på pinden nu → skriv i <b>“Masker nu”</b>.</li>
     <li>Se i opskriften hvor mange du skal ende med → skriv i <b>“Ønsket antal masker”</b>.</li>
     <li>Flere end nu = <b>udtagninger</b> (tag ud). Færre = <b>indtagninger</b> (strik 2 sammen).</li></ol>
     <p>Så får du en lille “opskrift”, fx <i>(strik 7, tag 1 ud), (strik 8, tag 1 ud)…</i> — bare følg den hele pinden igennem.</p>
     <p class="ex"><b>Eksempel:</b> Du har 60 masker og skal op på 68. Den fordeler de 8 udtagninger jævnt ud over de 60 masker.</p>`);
  c.append(E('label', 'nl', 'Masker nu')); c.lastChild.innerHTML += '<input id="e-cur" type="number" inputmode="numeric" min="1" placeholder="fx 60">';
  c.append(E('label', 'nl', 'Ønsket antal masker')); c.lastChild.innerHTML += '<input id="e-tgt" type="number" inputmode="numeric" min="1" placeholder="fx 68">';
  const out = E('div', 'result'); out.id = 'e-out'; c.append(out);
  c.addEventListener('input', () => {
    const S = v(c, 'e-cur'), T = v(c, 'e-tgt');
    if (!ok(S) || !Number.isFinite(T)) { out.innerHTML = ''; return; }
    const n = Math.abs(Math.round(T) - Math.round(S));
    if (n === 0) { out.innerHTML = 'Ingen ændring nødvendig 🙂'; return; }
    if (T > S) {
      const sizes = groups(Math.round(S), n);
      out.innerHTML = `<b>Tag ${n} masker ud</b> (slut: ${Math.round(S) + n} m):<br>Strik i grupper og <b>tag 1 ud</b> efter hver gruppe:<br>
        <span class="seq">${sizes.map((s) => `(strik ${s}, tag 1 ud)`).join(', ')}</span><br><small>Grupper: ${summarize(sizes)}.</small>`;
    } else {
      const plain = Math.round(S) - 2 * n;
      if (plain < 0) { out.innerHTML = `Du kan ikke tage ${n} ind på kun ${Math.round(S)} masker.`; return; }
      const sizes = groups(plain, n);
      out.innerHTML = `<b>Tag ${n} masker ind</b> (slut: ${Math.round(S) - n} m):<br>Strik i grupper og <b>strik 2 sammen</b> efter hver gruppe:<br>
        <span class="seq">${sizes.map((s) => `(strik ${s}, strik 2 sm)`).join(', ')}</span><br><small>Grupper før hver indtagning: ${summarize(sizes)}.</small>`;
    }
  });
  return c;
}

/* 2) gauge resize */
function gaugeCalc() {
  const c = card('Omregn ved anden strikkefasthed',
    'Passer din strikkefasthed ikke med opskriftens? Få DIT antal masker/omgange.',
    `<p><b>Hvad er den til?</b> Hvis du strikker løsere eller fastere end opskriften, bliver din trøje for stor eller for lille. Den her regner opskriftens tal om, så det passer til <b>din</b> strikkefasthed.</p>
     <p><b>Strikkefasthed</b> = hvor mange masker (og omgange) der er på <b>10 cm</b>. Find den ved at strikke en prøvelap (ca. 12×12 cm), måle 10 cm og tælle maskerne.</p>
     <p><b>Sådan bruger du den:</b></p>
     <ol><li>Skriv opskriftens strikkefasthed (står på opskriften, fx “20 masker = 10 cm”).</li>
     <li>Skriv din egen strikkefasthed fra prøvelappen.</li>
     <li>Skriv det tal opskriften nævner (fx “slå 100 masker op”).</li></ol>
     <p>Så får du tallet du skal bruge i stedet. Omgange er valgfrit — udfyld kun hvis du vil omregne dem også.</p>
     <p class="ex"><b>Eksempel:</b> Opskrift = 20 m/10 cm, du strikker 22 m/10 cm, opskrift siger slå 100 op → du skal slå <b>110</b> op.</p>`);
  c.append(E('p', 'mini', 'Opskriftens strikkefasthed'));
  const g1 = E('div', 'grid2'); g1.innerHTML = '<label class="nl">masker / 10 cm<input id="g-pm" type="number" inputmode="numeric" min="1" placeholder="fx 20"></label><label class="nl">omgange / 10 cm<input id="g-pr" type="number" inputmode="numeric" placeholder="valgfri"></label>'; c.append(g1);
  c.append(E('p', 'mini', 'Din strikkefasthed'));
  const g2 = E('div', 'grid2'); g2.innerHTML = '<label class="nl">masker / 10 cm<input id="g-ym" type="number" inputmode="numeric" min="1" placeholder="fx 22"></label><label class="nl">omgange / 10 cm<input id="g-yr" type="number" inputmode="numeric" placeholder="valgfri"></label>'; c.append(g2);
  c.append(E('p', 'mini', 'Opskriften siger'));
  const g3 = E('div', 'grid2'); g3.innerHTML = '<label class="nl">… masker<input id="g-cm" type="number" inputmode="numeric" placeholder="fx 100"></label><label class="nl">… omgange<input id="g-cr" type="number" inputmode="numeric" placeholder="valgfri"></label>'; c.append(g3);
  const out = E('div', 'result'); out.id = 'g-out'; c.append(out);
  c.addEventListener('input', () => {
    let html = '';
    const pm = v(c, 'g-pm'), ym = v(c, 'g-ym'), cm = v(c, 'g-cm');
    if (ok(pm) && ok(ym) && ok(cm)) html += `Masker: slå <b>${Math.round(cm * ym / pm)}</b> op i stedet for ${Math.round(cm)}.<br>`;
    const pr = v(c, 'g-pr'), yr = v(c, 'g-yr'), cr = v(c, 'g-cr');
    if (ok(pr) && ok(yr) && ok(cr)) html += `Omgange: strik <b>${Math.round(cr * yr / pr)}</b> i stedet for ${Math.round(cr)}.`;
    out.innerHTML = html;
  });
  return c;
}

/* 3) yarn needed */
function yarnCalc() {
  const c = card('Garnberegner',
    'Skifter du garn? Se hvor mange nøgler du skal bruge.',
    `<p><b>Hvad er den til?</b> Vil du strikke en opskrift i et <b>andet garn</b> end det, der står? Den regner ud hvor mange nøgler du skal købe, så du har garn nok.</p>
     <p><b>Sådan bruger du den:</b></p>
     <ol><li>Se i opskriften hvor meget af det <b>originale</b> garn der skal bruges: antal nøgler og hvor mange meter der er på én nøgle (står på banderolen).</li>
     <li>Find ud af hvor mange meter der er på én nøgle af <b>dit</b> garn (står på din banderole).</li></ol>
     <p>Så ganger den sammen og fortæller dig antal nøgler.</p>
     <p class="ex"><b>Eksempel:</b> Opskrift = 8 nøgler à 50 m (= 400 m). Dit garn har 100 m pr. nøgle → du skal bruge <b>4 nøgler</b>.</p>`);
  c.append(E('p', 'mini', 'Opskriften kræver (originalt garn)'));
  const g = E('div', 'grid2'); g.innerHTML = '<label class="nl">antal nøgler<input id="y-balls" type="number" inputmode="numeric" min="1" placeholder="fx 8"></label><label class="nl">meter pr. nøgle<input id="y-len" type="number" inputmode="numeric" min="1" placeholder="fx 50"></label>'; c.append(g);
  c.append(E('p', 'mini', 'Dit garn'));
  c.append(E('label', 'nl', 'meter pr. nøgle')); c.lastChild.innerHTML += '<input id="y-mine" type="number" inputmode="numeric" min="1" placeholder="fx 100">';
  const out = E('div', 'result'); out.id = 'y-out'; c.append(out);
  c.addEventListener('input', () => {
    const b = v(c, 'y-balls'), l = v(c, 'y-len'), mine = v(c, 'y-mine');
    if (!ok(b) || !ok(l) || !ok(mine)) { out.innerHTML = ''; return; }
    out.innerHTML = `Du skal bruge ca. <b>${Math.ceil(b * l / mine)} nøgler</b> af dit garn (i alt ${Math.round(b * l)} m).<br><small>Køb gerne 1 ekstra for en sikkerheds skyld.</small>`;
  });
  return c;
}

/* yarn-weight / substitution guide */
function substGuide() {
  const c = card('Garnerstatning',
    'Skift garn trygt: match strikkefastheden (masker pr. 10 cm).',
    `<p><b>Hvad er den til?</b> En oversigt der hjælper dig med at vælge et garn, der opfører sig som det i opskriften — så størrelsen passer.</p>
     <p><b>Tommelfingerregel:</b> Vælg et garn med <b>samme strikkefasthed</b> (samme antal masker pr. 10 cm) og nogenlunde samme pindestørrelse som opskriftens. Så er du på sikker grund.</p>
     <p>DROPS sorterer garn i 6 tykkelsesgrupper <b>A–F</b> (A tyndest, F tykkest). Garn i samme gruppe kan erstatte hinanden. Tryk på linket for DROPS’ præcise tal.</p>`);
  const rows = [['Tyndt / Lace', 'ca. 33–40', '2–3'], ['Fingering / Sokkegarn', 'ca. 27–32', '2,25–3,25'], ['Sport', 'ca. 24–26', '3–3,5'], ['DK', 'ca. 22–24', '3,5–4,5'], ['Aran / Worsted', 'ca. 18–20', '4,5–5,5'], ['Tykt / Chunky', 'ca. 12–15', '5,5–8'], ['Ekstra tykt', 'ca. 7–11', '8–12']];
  c.append(E('div', null, `<table class="wtbl"><thead><tr><th>Type</th><th>M/10 cm</th><th>Pind (mm)</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`));
  c.append(E('a', 'srclink', 'DROPS garngrupper A–F →')); c.lastChild.href = 'https://www.garnstudio.com/yarn-groups.php?cid=17'; c.lastChild.target = '_blank'; c.lastChild.rel = 'noopener';
  return c;
}
