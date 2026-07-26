# TR!FEXTA Legal / License Contracts

The license-selection modal links each tier's "I agree to the license agreement" checkbox to a
**finalized PDF contract** stored here:

| Tier        | PDF file                              |
|-------------|--------------------------------------|
| MP3 Lease   | `trifexta-mp3-license.pdf`      |
| WAV Lease   | `trifexta-wav-license.pdf`      |
| Unlimited   | `trifexta-unlimited-license.pdf`  |
| Exclusive   | `trifexta-exclusive-license.pdf`  |

## Where the links point

`assets/site.js` → `LICENSE_TIERS[...].agreement` resolves to:
- `legal/licenses/trifexta-mp3-license.pdf`
- `legal/licenses/trifexta-wav-license.pdf`
- `legal/licenses/trifexta-unlimited-license.pdf`
- `legal/licenses/trifexta-exclusive-license.pdf`

## Action required (you — TR!FEXTA)

1. Drop the four **finalized** PDFs into this folder (`legal/licenses/`) with exactly the
   filenames above.
2. Commit + push. They are served statically by GitHub Pages, so the modal link opens
   the real contract (no code change needed — the paths already match).

Until the PDFs are present, the modal link will 404. This folder is the single, organized
home for the binding agreements. Do NOT paste legal terms into the site JS/HTML — the
contracts live here as the source of truth.
