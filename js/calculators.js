// Beregner — de små regnestykker, der driller. Dansk, live resultater.
// Øverst vælger man Strik eller Hækling: ordene skifter, og hækling får sine egne
// værktøjer (amigurumi-runder, tæppeplanlægger, garn-tillæg, hækle-ordbog).
// Hver beregner har en ⓘ der forklarer formålet + brugen med et eksempel.
import { store } from './store.js';
import { CRAFT_LIST, craftOf, CROCHET_ABBR } from './craft.js';

let M, node, craft;

export function initCalculators(container, helpers) {
  M = helpers.modal; node = container;
  craft = craftOf(store.get('calcCraft', 'strik'));
  render();
}

function render() {
  node.innerHTML = `<div class="pagehead"><h1>Beregner</h1>
    <p class="hint">De små regnestykker, der altid driller — løst for dig. Tryk på ⓘ hvis du er i tvivl.</p></div>
    <div class="unittoggle craftseg">${CRAFT_LIST.map((c) => `<button type="button" class="ut-btn${c.id === craft.id ? ' on' : ''}" data-c="${c.id}">${c.icon} ${c.label}</button>`).join('')}</div>
    <div class="calcs"></div>`;
  node.querySelectorAll('.craftseg .ut-btn').forEach((b) => b.onclick = () => {
    craft = craftOf(b.dataset.c); store.set('calcCraft', craft.id); render();
  });
  const box = node.querySelector('.calcs');
  const cards = craft.id === 'haekling'
    ? [abbrCard(), amigurumiCalc(), evenCalc(), gaugeCalc(), yarnCalc(), squaresCalc(), convertCalc(), substGuide()]
    : [evenCalc(), gaugeCalc(), yarnCalc(), substGuide()];
  box.append(...cards);
}

const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const v = (root, id) => parseFloat(root.querySelector('#' + id).value);
const ok = (x) => Number.isFinite(x) && x > 0;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// card with a title row + ⓘ info button
function card(title, sub, infoHtml) {
  const c = E('section', 'calc');
  const head = E('div', 'calchead');
  head.append(E('h2', null, title));
  if (infoHtml) {
    const info = E('button', 'infobtn', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/></svg>');
    info.setAttribute('aria-label', 'Sådan virker den');
    info.onclick = () => openInfo(title, infoHtml);
    head.append(info);
  }
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
// Don't write the whole pattern out — group identical steps and say how many times to repeat.
function compactSeq(sizes, unit) {
  const m = {}; sizes.forEach((s) => m[s] = (m[s] || 0) + 1);
  const keys = Object.keys(m).map(Number).sort((a, b) => a - b);
  const part = (s) => { const n = m[s]; return n === 1 ? `<b>${unit(s)}</b>` : `gentag <b>${unit(s)}</b> ${n} gange`; };
  if (keys.length === 1) return part(keys[0]);
  // Even distribution always lands on just two group sizes — list each with its repeat count.
  return keys.map(part).join(', derefter ');
}

/* 1) distribute increases / decreases evenly */
function evenCalc() {
  const K = craft;
  const c = card('Fordel ind-/udtagninger jævnt',
    'Skriv hvor mange masker du har nu, og hvor mange du vil ende med.',
    `<p><b>Hvad er den til?</b> Når en opskrift siger “tag X masker ind/ud, jævnt fordelt”, fortæller den her dig <b>præcis hvor</b> du skal gøre det, så det sidder pænt jævnt hele vejen rundt.</p>
     <p><b>Sådan bruger du den:</b></p>
     <ol><li>Tæl maskerne du har nu → skriv i <b>“Masker nu”</b>.</li>
     <li>Se i opskriften hvor mange du skal ende med → skriv i <b>“Ønsket antal masker”</b>.</li>
     <li>Flere end nu = <b>udtagninger</b>. Færre = <b>indtagninger</b>.</li></ol>
     <p>Så får du en lille “opskrift”, du bare følger hele omgangen igennem.</p>
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
      out.innerHTML = `<b>Tag ${n} masker ud</b> (slut: ${Math.round(S) + n} m):<br>Arbejd i grupper og <b>tag 1 ud</b> efter hver gruppe:<br>
        <span class="seq">${compactSeq(sizes, K.incStep)}</span><br><small>I alt ${n} udtagninger, jævnt fordelt.</small>`;
    } else {
      const plain = Math.round(S) - 2 * n;
      if (plain < 0) { out.innerHTML = `Du kan ikke tage ${n} ind på kun ${Math.round(S)} masker.`; return; }
      const sizes = groups(plain, n);
      out.innerHTML = `<b>Tag ${n} masker ind</b> (slut: ${Math.round(S) - n} m):<br>Arbejd i grupper og tag <b>2 masker sammen</b> efter hver gruppe:<br>
        <span class="seq">${compactSeq(sizes, K.decStep)}</span><br><small>I alt ${n} indtagninger, jævnt fordelt.</small>`;
    }
  });
  return c;
}

/* 2) gauge resize */
function gaugeCalc() {
  const K = craft;
  const rowWord = K.id === 'haekling' ? 'rækker' : 'omgange';
  const c = card(`Omregn ved anden ${K.gauge.toLowerCase()}`,
    `Passer din ${K.gauge.toLowerCase()} ikke med opskriftens? Få DIT antal masker/${rowWord}.`,
    `<p><b>Hvad er den til?</b> Hvis du ${K.verb}r løsere eller fastere end opskriften, bliver dit arbejde for stort eller for lille. Den her regner opskriftens tal om, så det passer til <b>din</b> ${K.gauge.toLowerCase()}.</p>
     <p><b>${K.gauge}</b> = hvor mange masker (og ${rowWord}) der er på <b>10 cm</b>. Find den ved at ${K.verb} en prøvelap (ca. 12×12 cm), måle 10 cm og tælle maskerne.</p>
     <p><b>Sådan bruger du den:</b></p>
     <ol><li>Skriv opskriftens ${K.gauge.toLowerCase()} (står på opskriften, fx “${K.id === 'haekling' ? '16 fm = 10 cm' : '20 masker = 10 cm'}”).</li>
     <li>Skriv din egen ${K.gauge.toLowerCase()} fra prøvelappen.</li>
     <li>Skriv det tal opskriften nævner.</li></ol>
     <p>Så får du tallet du skal bruge i stedet. ${rowWord[0].toUpperCase() + rowWord.slice(1)} er valgfrit — udfyld kun hvis du vil omregne dem også.</p>
     <p class="ex"><b>Eksempel:</b> Opskrift = 20 m/10 cm, du får 22 m/10 cm, opskriften siger 100 masker → du skal bruge <b>110</b>.</p>`);
  c.append(E('p', 'mini', `Opskriftens ${K.gauge.toLowerCase()}`));
  const g1 = E('div', 'grid2'); g1.innerHTML = `<label class="nl">masker / 10 cm<input id="g-pm" type="number" inputmode="numeric" min="1" placeholder="fx 20"></label><label class="nl">${rowWord} / 10 cm<input id="g-pr" type="number" inputmode="numeric" placeholder="valgfri"></label>`; c.append(g1);
  c.append(E('p', 'mini', `Din ${K.gauge.toLowerCase()}`));
  const g2 = E('div', 'grid2'); g2.innerHTML = `<label class="nl">masker / 10 cm<input id="g-ym" type="number" inputmode="numeric" min="1" placeholder="fx 22"></label><label class="nl">${rowWord} / 10 cm<input id="g-yr" type="number" inputmode="numeric" placeholder="valgfri"></label>`; c.append(g2);
  c.append(E('p', 'mini', 'Opskriften siger'));
  const g3 = E('div', 'grid2'); g3.innerHTML = `<label class="nl">… masker<input id="g-cm" type="number" inputmode="numeric" placeholder="fx 100"></label><label class="nl">… ${rowWord}<input id="g-cr" type="number" inputmode="numeric" placeholder="valgfri"></label>`; c.append(g3);
  const out = E('div', 'result'); out.id = 'g-out'; c.append(out);
  c.addEventListener('input', () => {
    let html = '';
    const pm = v(c, 'g-pm'), ym = v(c, 'g-ym'), cm = v(c, 'g-cm');
    if (ok(pm) && ok(ym) && ok(cm)) html += `Masker: brug <b>${Math.round(cm * ym / pm)}</b> i stedet for ${Math.round(cm)}.<br>`;
    const pr = v(c, 'g-pr'), yr = v(c, 'g-yr'), cr = v(c, 'g-cr');
    if (ok(pr) && ok(yr) && ok(cr)) html += `${rowWord[0].toUpperCase() + rowWord.slice(1)}: ${K.stitchVerb} <b>${Math.round(cr * yr / pr)}</b> i stedet for ${Math.round(cr)}.`;
    out.innerHTML = html;
  });
  return c;
}

/* 3) yarn needed — calculate by length (metres) OR by weight (grams) */
function yarnCalc() {
  const K = craft;
  const c = card('Garnberegner',
    'Skifter du garn? Se hvor mange nøgler du skal bruge — regn efter meter eller efter vægt.',
    `<p><b>Hvad er den til?</b> Vil du ${K.verb} en opskrift i et <b>andet garn</b> end det, der står? Den regner ud hvor mange nøgler du skal købe, så du har garn nok.</p>
     <p><b>Meter eller vægt?</b> Tryk øverst for at vælge. Det sikreste er at regne <b>efter meter</b> (det er den samlede længde garn, der afgør om du har nok). Men kender du kun vægten, kan du regne <b>efter vægt</b> i stedet.</p>
     <p><b>Sådan bruger du den:</b></p>
     <ol><li>Se i opskriften hvor meget af det <b>originale</b> garn der skal bruges: antal nøgler og hvor mange meter (eller gram) der er på én nøgle — står på banderolen.</li>
     <li>Find ud af hvor mange meter (eller gram) der er på én nøgle af <b>dit</b> garn.</li></ol>
     <p>Så ganger den sammen og fortæller dig antal nøgler + den samlede mængde.</p>
     <p class="ex"><b>Eksempel:</b> Opskrift = 8 nøgler à 50 m (= 400 m). Dit garn har 100 m pr. nøgle → du skal bruge <b>4 nøgler</b>.</p>`);
  let unit = 'm';
  const unitWord = () => unit === 'm' ? 'meter' : 'gram';
  const toggle = E('div', 'unittoggle');
  toggle.innerHTML = `<button type="button" class="ut-btn on" data-u="m">Efter meter</button><button type="button" class="ut-btn" data-u="g">Efter vægt</button>`;
  c.append(toggle);
  c.append(E('p', 'mini', 'Opskriften kræver (originalt garn)'));
  const g = E('div', 'grid2'); g.innerHTML = '<label class="nl">antal nøgler<input id="y-balls" type="number" inputmode="numeric" min="1" placeholder="fx 8"></label><label class="nl"><span class="y-unit">meter</span> pr. nøgle<input id="y-len" type="number" inputmode="numeric" min="1" placeholder="fx 50"></label>'; c.append(g);
  c.append(E('p', 'mini', 'Dit garn'));
  const ml = E('label', 'nl', '<span class="y-unit">meter</span> pr. nøgle<input id="y-mine" type="number" inputmode="numeric" min="1" placeholder="fx 100">'); c.append(ml);
  const out = E('div', 'result'); out.id = 'y-out'; c.append(out);
  const recompute = () => {
    const b = v(c, 'y-balls'), l = v(c, 'y-len'), mine = v(c, 'y-mine');
    if (!ok(b) || !ok(l) || !ok(mine)) { out.innerHTML = ''; return; }
    out.innerHTML = `Du skal bruge ca. <b>${Math.ceil(b * l / mine)} nøgler</b> af dit garn (i alt ${Math.round(b * l)} ${unitWord()}).<br><small>Køb gerne 1 ekstra for en sikkerheds skyld.</small>`;
  };
  toggle.querySelectorAll('.ut-btn').forEach((btn) => btn.onclick = () => {
    unit = btn.dataset.u;
    toggle.querySelectorAll('.ut-btn').forEach((b) => b.classList.toggle('on', b === btn));
    c.querySelectorAll('.y-unit').forEach((s) => s.textContent = unitWord());
    recompute();
  });
  c.addEventListener('input', recompute);
  return c;
}

/* ======================= kun hækling ======================= */

/* Amigurumi: udtagningsrunder fra en magisk ring.
   Runde k har k × N masker, og mønsteret er "(k−2 fm, 2 fm i næste) × N". */
function amigurumiCalc() {
  const c = card('Amigurumi-runder (magisk ring)',
    'Den flade cirkel du starter bamser og bolde med — se hver runde regnet ud.',
    `<p><b>Hvad er den til?</b> Næsten alle amigurumi (små hæklede figurer) starter med en <b>magisk ring</b> og en flad cirkel, hvor du tager ud i hver runde. Den her skriver runderne ud for dig, så du ikke skal tælle i hovedet.</p>
     <p><b>6 eller 8 masker i ringen?</b> 6 er det almindeligste og giver en tættere cirkel. 8 giver en lidt fladere, større start. Følg din opskrift — ellers vælg 6.</p>
     <p><b>Sådan læser du det:</b> “(2 fm, 2 fm i næste) × 6” betyder: hækl 2 fastmasker, hækl så 2 fastmasker i den <i>samme</i> maske (det er udtagningen) — og gentag det hele 6 gange rundt.</p>
     <p class="ex"><b>Godt at vide:</b> antallet af masker vokser med startantallet for hver runde: 6 → 12 → 18 → 24 … Bliver cirklen buet i stedet for flad, hækler du for stramt; bliver den bølget, hækler du for løst.</p>`);
  const g = E('div', 'grid2');
  g.innerHTML = `<label class="nl">Masker i ringen<select id="a-start"><option value="6">6 (almindeligst)</option><option value="8">8</option></select></label>
    <label class="nl">Antal runder<input id="a-rounds" type="number" inputmode="numeric" min="1" max="30" value="6"></label>`;
  c.append(g);
  const out = E('div', 'result'); c.append(out);
  const recompute = () => {
    const N = parseInt(c.querySelector('#a-start').value, 10) || 6;
    let R = parseInt(c.querySelector('#a-rounds').value, 10);
    if (!Number.isFinite(R) || R < 1) { out.innerHTML = ''; return; }
    R = Math.min(R, 30);
    const rows = [];
    for (let k = 1; k <= R; k++) {
      let how;
      if (k === 1) how = `${N} fm i magisk ring`;
      else if (k === 2) how = `2 fm i hver maske hele vejen rundt`;
      else how = `(${k - 2} fm, 2 fm i næste) × ${N}`;
      rows.push(`<tr><td>${k}</td><td>${how}</td><td><b>${k * N}</b></td></tr>`);
    }
    out.innerHTML = `<table class="wtbl amitbl"><thead><tr><th>Omg.</th><th>Sådan</th><th>Masker</th></tr></thead><tbody>${rows.join('')}</tbody></table>
      <small>Slut: <b>${R * N} masker</b> efter ${R} omgange. Sæt en maskemarkør i første maske i hver omgang — ellers mister man tællingen.</small>`;
  };
  c.addEventListener('input', recompute);
  c.addEventListener('change', recompute);
  recompute();
  return c;
}

/* Tæppe af firkanter (granny squares o.l.) */
function squaresCalc() {
  const c = card('Tæppe af firkanter',
    'Hvor mange granny squares skal du bruge — og hvor meget garn?',
    `<p><b>Hvad er den til?</b> Skal du hækle et tæppe af små firkanter (granny squares, bedstemorfirkanter), fortæller den her hvor mange du skal lave, og hvor meget garn det cirka tager.</p>
     <p><b>Sådan bruger du den:</b></p>
     <ol><li>Hækl <b>én</b> firkant færdig og mål den → skriv målet i <b>“Firkantens størrelse”</b>.</li>
     <li>Vej gerne firkanten på en køkkenvægt → skriv vægten, så regner den garnet ud. (Kan du ikke veje den, så spring feltet over.)</li>
     <li>Skriv hvor stort tæppet skal være.</li></ol>
     <p>Den runder altid <b>op</b> — et halvt granny square kan man ikke bruge.</p>
     <p class="ex"><b>Almindelige mål:</b> babytæppe ca. 70×90 cm · sofatæppe ca. 130×170 cm · dobbeltseng ca. 200×220 cm.</p>`);
  const g1 = E('div', 'grid2');
  g1.innerHTML = `<label class="nl">Firkantens størrelse (cm)<input id="sq-size" type="number" inputmode="decimal" min="1" placeholder="fx 10"></label>
    <label class="nl">Vægt pr. firkant (g)<input id="sq-w" type="number" inputmode="decimal" min="0" placeholder="valgfri"></label>`;
  c.append(g1);
  c.append(E('p', 'mini', 'Tæppet skal være'));
  const g2 = E('div', 'grid2');
  g2.innerHTML = `<label class="nl">bredde (cm)<input id="sq-bw" type="number" inputmode="numeric" min="1" placeholder="fx 130"></label>
    <label class="nl">højde (cm)<input id="sq-bh" type="number" inputmode="numeric" min="1" placeholder="fx 170"></label>`;
  c.append(g2);
  const out = E('div', 'result'); c.append(out);
  c.addEventListener('input', () => {
    const s = v(c, 'sq-size'), bw = v(c, 'sq-bw'), bh = v(c, 'sq-bh'), w = v(c, 'sq-w');
    if (!ok(s) || !ok(bw) || !ok(bh)) { out.innerHTML = ''; return; }
    const across = Math.ceil(bw / s), down = Math.ceil(bh / s), total = across * down;
    const realW = Math.round(across * s), realH = Math.round(down * s);
    let extra = '';
    if (ok(w)) {
      const grams = Math.round(total * w);
      extra = `<br>Garn: ca. <b>${grams} g</b> (${(grams / 1000).toFixed(2).replace('.', ',')} kg) — læg 10 % til samling og kant.`;
    }
    out.innerHTML = `<b>${total} firkanter</b> — ${across} på tværs × ${down} ned.<br>
      Det giver et tæppe på ca. <b>${realW} × ${realH} cm</b> (uden kant).${extra}
      <br><small>Sammenhækling gør tæppet en anelse større — mål efter de første par rækker.</small>`;
  });
  return c;
}

/* Strik → hækling: garnet rækker ikke lige langt */
function convertCalc() {
  // Kilde: Flagel Knitting Files' måleforsøg — fire ens 6,25"-lapper i samme garn:
  // glatstrik 13,8 g · retstrik 17,1 g · fastmasker 19,5 g · stangmasker 16,4 g.
  const STITCH = [
    { id: 'fm', label: 'Fastmasker (fm)', lo: 1.30, hi: 1.45, note: 'Fastmasker giver et tæt, fast stof og bruger allermest garn.' },
    { id: 'hstm', label: 'Halvstangmasker (hstm)', lo: 1.20, hi: 1.35, note: 'Halvstangmasker ligger midt imellem de to andre.' },
    { id: 'stm', label: 'Stangmasker (stm)', lo: 1.10, hi: 1.25, note: 'Stangmasker er høje og luftige og bruger mindst garn.' },
  ];
  const c = card('Fra strik til hækling — garn-tillæg',
    'Hækling bruger mere garn end strik. Se hvor meget du skal købe ekstra.',
    `<p><b>Hvad er den til?</b> Vil du hækle noget, der er beregnet til strik (eller sammenligne to opskrifter), rækker garnet <b>ikke</b> lige så langt. Hækling snor garnet mere, så der skal mere til det samme stykke stof.</p>
     <p><b>Hvor meget mere?</b> Det afhænger af masken. I et måleforsøg med fire lige store lapper i samme garn vejede glatstrik 13,8 g, mens fastmasker vejede 19,5 g og stangmasker 16,4 g. Altså: jo <b>lavere</b> maske, jo mere garn.</p>
     <p><b>Sådan bruger du den:</b> skriv hvor meget garn strikkeopskriften kræver, og vælg den maske du vil hækle i. Du får et interval — køb efter det <b>højeste</b> tal, så du ikke løber tør midt i.</p>
     <p class="ex"><b>Vigtigt:</b> det er et tommelfingertal, ikke en garanti. Din fasthed betyder meget. Køb altid alt garnet i samme partinummer på én gang — farven kan skifte mellem partier.</p>`);
  const g = E('div', 'grid2');
  g.innerHTML = `<label class="nl">Strikkeopskriften kræver<input id="cv-amt" type="number" inputmode="decimal" min="1" placeholder="fx 500"></label>
    <label class="nl">Enhed<select id="cv-unit"><option value="g">gram</option><option value="m">meter</option><option value="n">nøgler</option></select></label>`;
  c.append(g);
  c.append(E('label', 'nl', 'Du vil hækle i')); c.lastChild.innerHTML += `<select id="cv-st">${STITCH.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select>`;
  const out = E('div', 'result'); c.append(out);
  const recompute = () => {
    const a = v(c, 'cv-amt');
    if (!ok(a)) { out.innerHTML = ''; return; }
    const unit = c.querySelector('#cv-unit').value;
    const st = STITCH.find((s) => s.id === c.querySelector('#cv-st').value);
    const uw = unit === 'g' ? 'gram' : unit === 'm' ? 'meter' : 'nøgler';
    const round = (x) => unit === 'n' ? Math.ceil(x) : Math.round(x / 5) * 5;
    const lo = round(a * st.lo), hi = round(a * st.hi);
    out.innerHTML = `Regn med ca. <b>${lo}–${hi} ${uw}</b> i stedet for ${Math.round(a)} — det er <b>+${Math.round((st.lo - 1) * 100)}–${Math.round((st.hi - 1) * 100)} %</b>.<br>
      ${st.note}<br>
      <small>Køb efter det højeste tal. Tommelfingertal, ikke en garanti.</small>`;
  };
  c.addEventListener('input', recompute);
  c.addEventListener('change', recompute);
  return c;
}

/* Hækle-ordbog: danske forkortelser + US/UK-fælden */
function abbrCard() {
  const c = card('Hækle-ordbog', 'Danske forkortelser — og fælden med amerikanske opskrifter.', null);
  const warn = E('div', 'warnbox');
  warn.innerHTML = `<b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.6h.01"/></svg>Pas på amerikanske og engelske opskrifter</b>
    <p>De bruger <b>de samme ord om forskellige masker</b>. Amerikansk “double crochet” er en <b>stangmaske</b> — britisk “double crochet” er en <b>fastmaske</b>. Følger du den forkerte, bliver arbejdet helt forkert i højden.</p>
    <p class="wtip">Kig efter <b>“US terms”</b> eller <b>“UK terms”</b> øverst i opskriften. Står der intet, men opskriften nævner <i>“sc”</i>, er den amerikansk (britiske opskrifter bruger ikke sc).</p>`;
  c.append(warn);

  const showSym = store.get('abbrSymbols', true);
  const seg = E('div', 'unittoggle abbrseg', `
    <button type="button" class="ut-btn${showSym ? '' : ' on'}" data-sym="0">Tekst</button>
    <button type="button" class="ut-btn${showSym ? ' on' : ''}" data-sym="1">Tekst + symboler</button>`);
  seg.querySelectorAll('.ut-btn').forEach((b) => b.onclick = () => { store.set('abbrSymbols', b.dataset.sym === '1'); render(); });
  c.append(seg);

  const rows = CROCHET_ABBR.map((a) => `<tr><td>${showSym ? `<span class="ab-sym" aria-hidden="true">${a.sym}</span>` : ''}<b>${esc(a.da)}</b><span class="ab-name">${esc(a.name)}</span></td><td>${esc(a.us)}</td><td>${esc(a.uk)}</td></tr>`).join('');
  const tbl = E('div', 'tblwrap', `<table class="wtbl abbrtbl"><thead><tr><th>Dansk</th><th>Amerikansk (US)</th><th>Britisk (UK)</th></tr></thead><tbody>${rows}</tbody></table>`);
  c.append(tbl);
  const more = E('button', 'ghost wide', 'Hvad betyder maskerne?');
  more.onclick = () => openInfo('Maskerne, forklaret', CROCHET_ABBR.map((a) =>
    `<p>${showSym ? `<span class="ab-sym ab-sym-lg" aria-hidden="true">${a.sym}</span>` : ''}<b>${esc(a.da)}</b> — ${esc(a.name)}<br>${esc(a.desc)}</p>`).join(''));
  c.append(more);
  return c;
}

/* yarn-weight / substitution guide — knit and crochet have DIFFERENT recommendations */
function substGuide() {
  const K = craft;
  const isC = K.id === 'haekling';
  const c = card('Garnerstatning',
    `Skift garn trygt: match ${K.gauge.toLowerCase()}en (masker pr. 10 cm).`,
    `<p><b>Hvad er den til?</b> En oversigt der hjælper dig med at vælge et garn, der opfører sig som det i opskriften — så størrelsen passer.</p>
     <p><b>Tommelfingerregel:</b> Vælg et garn med <b>samme ${K.gauge.toLowerCase()}</b> (samme antal masker pr. 10 cm) og nogenlunde samme ${K.toolOne}størrelse som opskriftens. Så er du på sikker grund.</p>
     ${isC ? `<p><b>Bemærk:</b> hæklenåle er som regel <b>større</b> end pindene til samme garn — og hæklefastheden er et helt andet tal end strikkefastheden. Tallene herunder er målt i <b>fastmasker</b>.</p>` : ''}
     <p>DROPS sorterer garn i 6 tykkelsesgrupper <b>A–F</b> (A tyndest, F tykkest). Garn i samme gruppe kan erstatte hinanden. Tryk på linket for DROPS’ præcise tal.</p>`);
  // Strikketallene er appens egne (uændrede). Hækletallene kommer fra Craft Yarn Councils
  // "Standard Yarn Weight System" (masker i fastmaske pr. 4 tommer ≈ 10 cm + nålestørrelse).
  const knitRows = [['Tyndt / Lace', 'ca. 33–40', '2–3'], ['Fingering / Sokkegarn', 'ca. 27–32', '2,25–3,25'], ['Sport', 'ca. 24–26', '3–3,5'], ['DK', 'ca. 22–24', '3,5–4,5'], ['Aran / Worsted', 'ca. 18–20', '4,5–5,5'], ['Tykt / Chunky', 'ca. 12–15', '5,5–8'], ['Ekstra tykt', 'ca. 7–11', '8–12']];
  const croRows = [['Tyndt / Lace', 'ca. 32–42*', '1,4–1,6'], ['Fingering / Sokkegarn', 'ca. 21–32', '2,25–3,5'], ['Sport', 'ca. 16–20', '3,5–4,5'], ['DK', 'ca. 12–17', '4,5–5,5'], ['Aran / Worsted', 'ca. 11–14', '5,5–6,5'], ['Tykt / Chunky', 'ca. 8–11', '6,5–9'], ['Ekstra tykt', 'ca. 5–9', '9 og op']];
  const rows = isC ? croRows : knitRows;
  c.append(E('div', 'tblwrap', `<table class="wtbl"><thead><tr><th>Type</th><th>M/10 cm</th><th>${isC ? 'Hæklenål' : 'Pind'} (mm)</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`));
  if (isC) {
    c.append(E('p', 'srcnote', '* Lace måles i stangmasker. Kilde: Craft Yarn Council, Standard Yarn Weight System. Vejledende — følg altid opskriftens egen fasthed.'));
  }
  c.append(E('a', 'srclink', 'DROPS garngrupper A–F →')); c.lastChild.href = 'https://www.garnstudio.com/yarn-groups.php?cid=17'; c.lastChild.target = '_blank'; c.lastChild.rel = 'noopener';
  return c;
}
