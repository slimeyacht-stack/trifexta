# Trifexta.net — Asset Plan

Generated during the post-AETHER visual-QA pass. Per the web-dev system's
Asset Plan rule (web-dev-design-brief §9): do NOT silently design around
missing imagery. Every asset the design needs is listed and classified.

Classification key:
- AVAILABLE      — exists, ready to use
- GENERATABLE    — can be produced (image gen / render / SVG / code)
- PLACEHOLDER    — temporary stand-in, swap path documented
- OWNER REQUIRED — only you can supply (real photos, brand files, audio)
- LICENSE REQUIRED — needs a paid/licensed asset; note cost + source

## Assets

| Asset | Used for | Status | Notes / action |
|-------|----------|--------|----------------|
| Album cover `assets/img/album-cover.jpg` | Hero art, ZxmiiBlikk section | AVAILABLE | Real artwork, loads fine. |
| Logo font `assets/fonts/LostTumbler.otf/.ttf` | "TRIFEXTA" wordmark | OK | "Lost Tumbler" by Khurasan — free for personal + commercial use (More Info.txt: "100% free for personal use & commercial use"). Commercial-safe; committed to repo. |
| Beat card covers (c1/c2/c3 gradients) | Beat grid | PLACEHOLDER | CSS gradients stand in for real cover art. GENERATABLE (album-art image gen) or OWNER REQUIRED (real artwork). Swap `div.cover` background for `<img>`. |
| Merch card covers (c1/c2/c3 gradients) | Merch grid | PLACEHOLDER | Same as beats — needs real product/lifestyle photography (OWNER REQUIRED) or GENERATED mockups. |
| Audio previews `assets/audio/*.mp3` | Beat/merch preview player | OWNER REQUIRED | Referenced (midnight/violet/concrete/neon/lowtide/afterglow + static.mp3) but files absent — only `assets/audio/README.txt` present. Player shows "Audio file not found" until you drop the mp3s. |
| Merch product photography (hoodie/tee/cap) | Merch storytelling | OWNER REQUIRED | No flat-lays or lifestyle shots exist. Strongly recommended for commercial UX (lesson 5). |
| Lifestyle / product-in-use imagery | Brand storytelling | OWNER REQUIRED / GENERATABLE | Would raise product storytelling (lesson 3) — currently absent. |
| favicon | Browser tab | AVAILABLE (fixed) | Inline SVG "T" badge added; 404 resolved. |
| Snipcart key (`CONFIG.snipcartKey`) | Cart / checkout | OWNER REQUIRED | Demo until you paste your real public API key; then cart goes live. |

## What was fixed in this pass (code only, no asset fabrication)
- Jackboa font removed (non-commercial) → logo uses Fraunces (OFL). See line 19.
- Favicon 404 resolved (inline SVG).
- 320px horizontal overflow resolved (`.wrap` padding + form `min-width:0`).
- Mobile nav reachability: Beats/Merch/ZxmiiBlikk links now surface in the
  action cluster ≤760px (lesson 2: mobile is a distinct composition).
- Floating dock no longer permanently hides content (body padding 120px).

## Open items for the owner (not fabricated)
1. ~~Swap Jackboa for a commercial-license font before sales go live.~~ DONE — removed, logo uses Fraunces.
2. Drop real beat/merch mp3 previews into `assets/audio/`.
3. Replace gradient placeholders with real cover art / product photography.
4. Set the real Snipcart public API key in `assets/site.js`.
