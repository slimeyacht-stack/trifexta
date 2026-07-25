DROP YOUR SONGS HERE
===================

For the player to work, put your .mp3 files in THIS folder (assets/audio/).

The page currently references these filenames (see index.html → TRACKS / BEATS arrays):
  afterglow.mp3   violet.mp3   concrete.mp3
  midnight.mp3    neon.mp3     lowtide.mp3

HOW TO USE YOUR REAL SONGS:
1. Put your mp3s in this folder.
2. Open index.html, find the TRACKS / BEATS / MERCH arrays near the bottom.
3. Change each item's:
     name:  the display name (e.g. "Midnight Static" → your real song title)
     src:   the filename here (e.g. "assets/audio/afterglow.mp3" → "assets/audio/your-song.mp3")
     meta:  the small text under the title (BPM/key, or "snippet · 0:30")
4. Commit + push. GitHub Pages redeploys automatically.

TIPS:
- Snippets/previews can be shortened mp3s (30–45s) — keeps the page fast.
- Filenames with no spaces work best (use dashes: my-song.mp3).
- Cover art goes in ../img/ (optional — page uses gradients if missing).
