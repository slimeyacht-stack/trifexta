# Beats audio folder

Drop your finished beat files here. The site's preview player and Snipcart
checkout both read from this folder using the exact filenames below.

## Required filenames (must match exactly)
- midnight.mp3   ← Midnight Static   ($29.99)
- violet.mp3     ← Violet Hour       ($24.99)
- concrete.mp3   ← Concrete Rose     ($27.99)
- neon.mp3       ← Neon Noir         ($31.99)
- lowtide.mp3    ← Low Tide          ($22.99)
- afterglow.mp3  ← Afterglow         ($26.99)

Formats: .mp3 (or .wav). Keep previews tagged/radio-ready. Files are public
once pushed (served from trifexta.net/assets/audio/...).

## Make beats DELIVERABLE after purchase (2-minute step, do once per beat)
The card already sends `data-item-file-guid=""` (empty). To auto-deliver the
MP3 to buyers after checkout:
1. Open Snipcart dashboard → Digital Goods (or Products) → upload the mp3.
2. Copy the generated File GUID.
3. In assets/site.js, find the beat's line and paste the GUID:
     {id:"beat-midnight", ..., fileGuid:"PASTE_GUID_HERE"}
4. Commit + push. Buyer gets a download link in their order email.

Until you paste the GUIDs, beats are purchasable but Snipcart won't auto-send
the file — you'd deliver manually. Preview playback works regardless.
