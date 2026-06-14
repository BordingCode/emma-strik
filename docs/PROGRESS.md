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

## M3 — Gallery  ✅ DONE
- ✅ data/patterns.js: 23 REAL, web-verified patterns (DROPS/PetiteKnit/Tin Can Knits/Sandnes/Purl Soho/
  Ravelry) across sweater/accessory/baby/home; free+paid mix; DK+EN; og:image URLs where verifiable (5 null)
- ✅ gallery.js: filter chips (category) + "Kun gratis" + "♥ Gemte" + search; cards w/ photo + tags
  (free/paid, difficulty, weight, DA/EN), credit (designer · source), "Se opskrift →" link OUT
- ✅ graceful image fallback (img.onerror → tasteful category placeholder; null images too) — no broken images
- ✅ favourites persisted (localStorage); browser-verified on phone: filter/search/fav/links all work, real
  images load (Ravelry/PetiteKnit/DROPS hotlink OK), 0 console errors. SW→v3.
- NOTE: never fabricated links/images; agent left unverifiable images null on purpose.

## M4 — Polish  ⬜ (OPTIONAL — app is fully usable)
- ⬜ swap nav/top emoji → inline SVG (emoji render on iOS/Android; only boxes on Linux test browser)
- ⬜ optional desktop max-width centering for the gallery; tiny visual touches

## M4 — Polish  ⬜
(cozy visual design, PWA/offline, icon, Bording Hub)

## Key decisions (full detail in DESIGN.md)
Danish mobile-first PWA = knitting companion (multi-counter projects + calculators) + curated link
gallery (DK/EN, credited thumbnails linking out). Don't build a pattern DB. Vanilla JS, no build,
localStorage, Wake Lock, GitHub Pages. Never fabricate pattern links/images.
