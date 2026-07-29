// Strik vs. hækling — ét sted for alt det, der er forskelligt mellem de to håndværk,
// så ord, størrelser og forkortelser er ens i Projekter, Beregner og Garn.
// Projekter uden `craft` er strik (alt det Emma allerede har lavet).

// Pinde: 2–12 mm i halve trin. Hæklenåle har deres EGEN række (bl.a. 2,25 / 2,75 /
// 3,25 / 3,75 / 6,5 mm, som ikke findes som pinde) — derfor to lister.
const NEEDLE_MM = [];
for (let mm = 2; mm <= 12.0001; mm += 0.5) NEEDLE_MM.push(Math.round(mm * 100) / 100);
const HOOK_MM = [1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 12, 15, 20];

export const mmFmt = (mm) => (mm % 1 === 0 ? String(mm) : String(mm).replace('.', ',')) + ' mm';

// Egne SVG-ikoner frem for emoji: 🪝 findes ikke på ældre telefoner, og et manglende
// emoji bliver en tom firkant — så ville mærket på projektkortene være usynligt.
const SVG = (p) => `<svg class="crafticon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON_NEEDLES = SVG('<path d="M6 20 18 6"/><circle cx="18.6" cy="5.4" r="1.6" fill="currentColor"/><path d="M18 20 6 6"/><circle cx="5.4" cy="5.4" r="1.6" fill="currentColor"/>');
const ICON_HOOK = SVG('<path d="M11 21V9.6"/><path d="M11 9.6q0-2.6 2.6-2.6T16.2 9.6q0 1.9-2.1 2.2"/><path d="M11 21h.01"/>');

export const CRAFTS = {
  strik: {
    id: 'strik', label: 'Strik', icon: ICON_NEEDLES, verb: 'strikke', past: 'strikket',
    toolOne: 'pind', toolMany: 'Pinde', addTool: '+ Tilføj pind', rmTool: 'Fjern pind',
    toolPlaceholder: 'fx Rundpind 4 mm',
    gauge: 'Strikkefasthed', gaugeEx: 'fx 22 m × 30 p = 10×10 cm',
    sizes: NEEDLE_MM, metersLabel: 'meter strikket',
    stitchVerb: 'strik',
    // wording brugt i beregnerne
    incStep: (n) => `(strik ${n}, tag 1 ud)`,
    decStep: (n) => `(strik ${n}, strik 2 sm)`,
    rowWord: 'omgange', rowWordOne: 'omgang',
  },
  haekling: {
    id: 'haekling', label: 'Hækling', icon: ICON_HOOK, verb: 'hækle', past: 'hæklet',
    toolOne: 'hæklenål', toolMany: 'Hæklenåle', addTool: '+ Tilføj hæklenål', rmTool: 'Fjern hæklenål',
    toolPlaceholder: 'fx Hæklenål 4 mm',
    gauge: 'Hæklefasthed', gaugeEx: 'fx 16 fm × 18 rk = 10×10 cm',
    sizes: HOOK_MM, metersLabel: 'meter hæklet',
    stitchVerb: 'hækl',
    incStep: (n) => `(hækl ${n}, 2 masker i næste)`,
    decStep: (n) => `(hækl ${n}, hækl 2 sammen)`,
    rowWord: 'omgange', rowWordOne: 'omgang',
  },
};

export const CRAFT_LIST = [CRAFTS.strik, CRAFTS.haekling];
/** Håndværket for et projekt (eller en ren id-streng). Falder tilbage til strik. */
export const craftOf = (x) => CRAFTS[(x && x.craft) || x] || CRAFTS.strik;
export const isCrochet = (x) => craftOf(x).id === 'haekling';

/** Lille mærkat til projektkort o.l. */
export const craftBadge = (x) => {
  const c = craftOf(x);
  return `<span class="craftbadge ${c.id}" title="${c.label}" aria-label="${c.label}">${c.icon}</span>`;
};

/* ---------------------------------------------------------------------------
   Hækle-ordbog: danske forkortelser + den klassiske amerikansk/britisk-fælde.
   Kilder: Hobbii's hækleforkortelser + Craft Yarn Council's standardliste.
   US og UK bruger DE SAMME ord om FORSKELLIGE masker — den fælde ødelægger
   projekter, så den står øverst i ordbogen.
--------------------------------------------------------------------------- */
export const CROCHET_ABBR = [
  { da: 'lm', name: 'luftmaske', desc: 'Kædens byggesten — grundlaget du starter på.', us: 'ch (chain)', uk: 'ch (chain)' },
  { da: 'km', name: 'kædemaske', desc: 'Den flade maske der lukker en omgang eller flytter dig hen.', us: 'sl st (slip stitch)', uk: 'ss (slip stitch)' },
  { da: 'fm', name: 'fastmaske', desc: 'Den lave, tætte maske. Amigurumi er næsten kun fastmasker.', us: 'sc (single crochet)', uk: 'dc (double crochet)' },
  { da: 'hstm', name: 'halvstangmaske', desc: 'Midt imellem fastmaske og stangmaske.', us: 'hdc (half double crochet)', uk: 'htr (half treble)' },
  { da: 'stm', name: 'stangmaske', desc: 'Den høje maske — går hurtigt og bliver luftigt.', us: 'dc (double crochet)', uk: 'tr (treble)' },
  { da: 'dbstm', name: 'dobbeltstangmaske', desc: 'Endnu højere end en stangmaske.', us: 'tr (treble)', uk: 'dtr (double treble)' },
  { da: 'rk', name: 'række', desc: 'Én vej frem og tilbage (fladt arbejde).', us: 'row', uk: 'row' },
  { da: 'omg', name: 'omgang', desc: 'Hele vejen rundt (rundt arbejde, fx amigurumi).', us: 'rnd (round)', uk: 'rnd (round)' },
  { da: 'MR', name: 'magisk ring', desc: 'Startringen til rundt arbejde — den kan strammes helt til.', us: 'MR / magic ring', uk: 'MR / magic ring' },
  { da: 'ind i', name: 'udtagning', desc: '2 masker i samme maske — arbejdet bliver bredere.', us: 'inc (increase)', uk: 'inc (increase)' },
  { da: 'sm', name: 'indtagning', desc: '2 masker hækles sammen — arbejdet bliver smallere.', us: 'dec / sc2tog', uk: 'dec / dc2tog' },
];
