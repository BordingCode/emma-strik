# Emmas Strik — Design Document

A cozy, **mobile-first, Danish, offline PWA** for Emma: a knitting **companion tool** + a curated
**pattern gallery**. Personal/hobby project (~/cc, BordingCode, GitHub Pages). Built after deep
research into what knitters actually use.

## Why this shape (research-backed)
- The most-used knitting tool is a **row counter** — specifically **multiple linked counters per
  project** (rows + pattern-repeat that auto-resets + increases/decreases). This is the heart.
- Two non-negotiable UX wins: **never lose your place** (auto-save every tap, even if app closes)
  and **screen stays awake while knitting** (Screen Wake Lock API — works on GitHub Pages HTTPS).
- **Calculators are a real gap** (DROPS/Ravelry don't offer them in-browser): distribute
  increases/decreases evenly, gauge resize, yarn needed / substitution (mirror DROPS A–F groups).
- **Don't build a pattern database** (DROPS has 12,298 free patterns; Ravelry owns the catalogue).
  Instead, a **curated gallery that links OUT** to genuinely well-recommended patterns.
- Edge for Emma: Danish + free + offline + no account + everything bundled in one home-screen app.

## Decisions (from Q&A with Mathias)
- Private/personal. Mobile-first. **UI in Danish.**
- Content model: **companion tool + curated link gallery** (both).
- Gallery: hand-picked **high-quality** patterns, **Danish OR English** (well-recommended only),
  shown as cards with the pattern's own photo + **credit + "Se opskrift" link** to the source
  (source-thumbnail approach Mathias chose; minor copyright grey area, fine for personal use; some
  hotlinked images may not load — acceptable, can swap to Emma's photos later).
- Tech: vanilla HTML/CSS/JS, no build step, offline PWA, localStorage. Repo BordingCode/emma-strik.

## App structure (3 sections, bottom-nav, phone)
1. **Tæller** (Counters/Projects) — the heart.
   - Projects list (name, yarn, needle size, notes). Tap into a project.
   - Each project has **multiple counters**: a main "Omgange" (rows), plus addable counters like
     "Mønsterrapport" (repeat: auto-resets every N, ticks a repeat count), "Indtagninger" etc.
   - Big +/- tap targets; **auto-save on every tap** (localStorage); **Wake Lock** keeps screen on
     while a project is open (re-acquire on visibilitychange); link counters (repeat → main) option.
2. **Beregner** (Calculators):
   - Fordel indtagninger/udtagninger jævnt (distribute inc/dec evenly across N stitches).
   - Strikkefasthed/omregning (resize stitch/row counts when gauge differs).
   - Garnberegner / garnsubstitution (yarn needed; substitution incl. DROPS A–F thickness groups).
3. **Opskrifter** (Gallery):
   - Curated cards: title, designer, source, category, difficulty, yarn weight, free/paid tag,
     language tag (DK/EN), photo (credited) + "Se opskrift" link out.
   - Filter by category + difficulty + free/paid + search; "Gemte" (favourites, localStorage).
   - Patterns are REAL & verified (no inventing links/images). Start with a solid set, grow easily.

## Build milestones
- **M1 — Counter (the heart):** projects + multi linked counters, big taps, auto-save, wake-lock, Danish. Verify on phone.
- **M2 — Calculators:** the three calculators above (Danish), with clear results.
- **M3 — Gallery:** curated, verified real patterns (DK+EN), filter/search/favourites, credited thumbnails + links.
- **M4 — Polish:** bottom-nav, cozy woolly visual design, PWA/offline, icon, add to Bording Hub.

## Notes / gotchas
- Mobile: use `height:100svh` (not 100vh/inset:0) to avoid address-bar twitch.
- Wake Lock: HTTPS only (GitHub Pages OK); auto-releases when tab hidden → re-acquire on visibilitychange; may be refused on very low battery.
- SW cache version bump on every deploy.
- Patterns: never fabricate links/images — research & verify each.
