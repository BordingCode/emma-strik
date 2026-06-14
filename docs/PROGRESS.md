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

## M3 — Gallery  ⬜
(curated REAL patterns DK+EN, filter/search/favourites, credited thumbnails + "Se opskrift" links — research & verify, never invent)

## M4 — Polish  ⬜
(cozy visual design, PWA/offline, icon, Bording Hub)

## Key decisions (full detail in DESIGN.md)
Danish mobile-first PWA = knitting companion (multi-counter projects + calculators) + curated link
gallery (DK/EN, credited thumbnails linking out). Don't build a pattern DB. Vanilla JS, no build,
localStorage, Wake Lock, GitHub Pages. Never fabricate pattern links/images.
