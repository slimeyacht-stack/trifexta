# TR!FEXTA License Agreements

The store links to four agreement pages from the license-selection modal:

| Tier        | File                         | Status      |
|-------------|------------------------------|-------------|
| MP3 Lease   | `licenses/mp3-lease.html`    | PLACEHOLDER |
| WAV Lease   | `licenses/wav-lease.html`    | PLACEHOLDER |
| Unlimited   | `licenses/unlimited.html`    | PLACEHOLDER |
| Exclusive   | `licenses/exclusive.html`    | PLACEHOLDER |

## IMPORTANT — these are placeholders, not legal text

The four HTML files currently contain a **structural placeholder**. They explicitly state they
are NOT the binding agreement. **The real, finalized TR!FEXTA license terms must be supplied by
TR!FEXTA and pasted into these files** (replacing the placeholder `<div class="note">` block with
the actual terms). Do NOT ship the store to live customers with placeholder agreements.

## How the link works

`assets/site.js` → `LICENSE_TIERS` has an `agreement` path per tier
(`licenses/mp3-lease.html`, etc.). The modal's acceptance checkbox links to that file in a new
tab. The acceptance checkbox is intentionally **not pre-checked**, and the link is viewable
before purchase.

## To add the real terms

1. Open the relevant `licenses/<tier>.html`.
2. Replace the placeholder `<div class="note">…</div>` with the finalized agreement text
   (copy/pasted from the document TR!FEXTA supplies). Keep the "Back to beats" link.
3. Commit + push. No code change needed — the path already matches.

The legal language itself is intentionally **not** generated here; only TR!FEXTA's supplied text
belongs in these files.
