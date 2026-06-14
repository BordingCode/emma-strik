# Emmas Strik — Progress Log

> ▶ Resume: read this + DESIGN.md. Location ~/cc/emma-strik · repo BordingCode/emma-strik.
> Status legend: ⬜ todo · 🔧 doing · ✅ done

## M1 — Counter (the heart)  ✅ DONE
- ✅ scaffold + DESIGN/PROGRESS docs
- ✅ app shell: 3-section bottom-nav (Tæller / Beregner / Opskrifter), Danish, mobile-first, 100svh
- ✅ store.js localStorage helpers
- ✅ counters.js: projects + multiple counters (repeat-wrap + follow-main), big +/- taps, auto-save every tap, Wake Lock + re-acquire on visibilitychange
- ✅ browser-verified (phone): create/count/multi-counter/wrap/repeat/follow all correct; persists across reload (restores to active project); 0 console errors
- NOTE: nav/top emoji render as boxes on Linux test browser only — fine on iOS/Android (consider SVG in M4)

## M2 — Calculators  ✅ DONE
- ✅ Fordel ind-/udtagninger jævnt (current→target; even Bresenham grouping; M1 for inc, k2tog for dec; validates)
- ✅ Omregn ved anden strikkefasthed (sts & rows resize by gauge ratio)
- ✅ Garnberegner (balls needed by meterage, +1 spare tip)
- ✅ Garnerstatning guide: accurate general weight→gauge table + VERIFIED DROPS rule + link to DROPS A–F
  (NOTE: DROPS site blocks fetch from here — WebFetch 503 / browser timeout / curl 000; secondary sources
  conflict on per-letter gauges, so did NOT bake DROPS numbers in — linked to source instead, honest.)
- ✅ browser-verified live results all correct; 0 console errors. SW→v2.
- ✅ (later) clarity pass: each calculator has an ⓘ info sheet (goal + "Sådan bruger du den" steps + example),
  clearer grouped labels (Opskriftens/Din strikkefasthed). Browser-verified; SW→v7.

## M3 — Gallery  ✅ DONE
- ✅ data/patterns.js: 64 REAL, web-verified patterns (DROPS/PetiteKnit/Tin Can Knits/Sandnes/Purl Soho/
  Ravelry) across sweater/accessory/baby/home; free+paid mix; DK+EN; og:image URLs where verifiable (5 null)
- ✅ gallery.js: filter chips (category) + "Kun gratis" + "♥ Gemte" + search; cards w/ photo + tags
  (free/paid, difficulty, weight, DA/EN), credit (designer · source), "Se opskrift →" link OUT
- ✅ graceful image fallback (img.onerror → tasteful category placeholder; null images too) — no broken images
- ✅ favourites persisted (localStorage); browser-verified on phone: filter/search/fav/links all work, real
  images load (Ravelry/PetiteKnit/DROPS hotlink OK), 0 console errors. SW→v3.
- NOTE: never fabricated links/images; agent left unverifiable images null on purpose.

## M4 — Polish  ✅ DONE
- ✅ inline SVG icons (brand yarn-ball + nav: tally / calculator / yarn) replacing all emoji — crisp on every device
- ✅ desktop frame: #app capped at 600px, centred, soft shadow on darker wool bg (phone-first; tidy on desktop)
- ✅ browser-verified desktop + icons render; SW→v4

## 🎉 ALL MILESTONES DONE — app complete & live: https://bordingcode.github.io/emma-strik/
Counter + calculators + 64-pattern curated gallery. To grow gallery: add verified entries to data/patterns.js.

## Phase 2 — Emma's personal data  ✅ DONE
- ✅ Upload own patterns from phone (PDF/photo) → stored on-device in IndexedDB (js/idb.js); shown as "Min"
  cards under a "Mine" filter; tap "Åbn" opens the file. Verified: stored, persists across reload, renders.
- ✅ "Ejet" (owned) flag on curated patterns (⋯ → Marker som ejet) → gold badge + "✓ Ejet" filter.
- ✅ Custom collections (samlinger): create your own, add any pattern (curated or own) via ⋯ → Føj til samling;
  collection chips filter the gallery.
- ✅ New "Lager" tab (Garn & grej): yarn stash + tools/needles CRUD (js/stash.js), localStorage.
- ✅ Backup/Restore (gear in top bar, js/backup.js): export ALL on-device data incl. uploaded files (base64)
  to a JSON, and import it back. Verified export downloads; mitigates the on-device-only storage caveat.
- ✅ browser-verified all flows on phone; 0 console errors. SW→v6.
- ⚠️ STORAGE CAVEAT: all user data is on-device only (no backend/sync); could be lost if browser data cleared.
  Backup is the mitigation. True cross-device sync would need a paid backend (future option).

## Phase 3 — refinements  ✅ DONE
- ✅ Shop vs owned made explicit: each pattern shows ONE status — Gratis (green) / ✓ Ejet (gold) / 🛒 Køb (blue);
  new "🛒 Til køb" filter (paid & not owned) alongside Gratis / ✓ Ejet / ♥ Gemte. Verified counts: 38 gratis / 2 ejet / 25 køb.
- ✅ Finished projects: "✓ Marker som færdig" in project detail → moves to a "✓ Færdige projekter (N)" section;
  "↺ Genåbn" reopens. Ongoing shown under a "🧶 Igangværende" heading. Browser-verified mark+reopen.
- ✅ Renamed the counter tab "Tæller" → "Projekter" (nav label; internal id stays 'taeller').
- ✅ Calculators got ⓘ info sheets earlier this phase. Browser-verified all; 0 console errors. SW→v8.

## Phase 4 — Emma's emailed wishlist (5 requests via mathiasjobbot)  ✅ DONE
- ✅ #5 Category icons: js/caticons.js (17 garment line-icons, grouped); icon picker in "Ny kategori"; chips show icon.
- ✅ #4 Category counts: collection chips show pattern count.
- ✅ #2 Hjælpevideoer card in Beregner: verified links (Kimmie Munkholm YouTube, PetiteKnit videos, YouTube search).
- ✅ #3 Statusoversigt: status card on Projekter (færdige/i gang/meter strikket/gram brugt) with "I år / I alt"
  period toggle; projects got optional Garn brugt (g) + Løbelængde (m/100g) → metres computed (verified 350g×300=1050m).
- ✅ #1 In-pattern reader (js/reader.js) for IMAGE **and PDF** uploads: zoom, draggable row-ruler, embedded
  counter, highlighter/pencil/eraser annotation — annotation + counter saved per pattern in IDB.
  PDFs render page-by-page via **vendored pdf.js** (vendor/pdf.mjs + pdf.worker.mjs, offline); one annotation
  layer spans all pages; falls back to external open if a PDF can't render. Browser-verified: image draw+counter
  persist; 2-page PDF renders (1000×2800 anno layer); 0 console errors.
- SW→v12 (incl. vendored pdf.js). All browser-verified on the local server.

## Phase 5 — findability / IA pass (after a usability audit)  ✅ DONE
- ✅ Opskrifter split into two clear views: "🧶 Mine opskrifter" (her uploads + owned + ♥ gemte, sub-filters
  Alle/Egne/Købte/Gemte, organised by HER categories) and "🔎 Find nye" (browse curated lib; fixed category
  chips + Gratis/Til-køb). Removes the old 5-row overlapping-filter overload + the two-category-systems confusion.
- ✅ One-tap "owned" (✓/○) button on each browse card (no longer hidden behind ⋯).
- ✅ Backup surfaced as a labelled section in the Garn tab (was only the cryptic top-bar "gear/sun" icon, which stays too).
- ✅ Wording consistency: "kategori" everywhere (was Samling/kategori mix); tab "Lager" → "Garn"; empty 0-counts hidden.
- ✅ Reader tool icons now labelled (Lineal/Marker/Blyant/Slet/Zoom/Ryd).
- ✅ Reader bugs fixed earlier this phase: ruler toggles off, pinch-zoom, ruler anchored on zoom, rotation (manifest=any).
- Browser-verified: views/switch/owned-toggle/labels/backup all work; 0 console errors. SW→v14.
  (Local-server HTTP cache can serve stale modules during dev — live deploy's SW bump handles it.)

## Key decisions (full detail in DESIGN.md)
Danish mobile-first PWA = knitting companion (multi-counter projects + calculators) + curated link
gallery (DK/EN, credited thumbnails linking out). Don't build a pattern DB. Vanilla JS, no build,
localStorage, Wake Lock, GitHub Pages. Never fabricate pattern links/images.
