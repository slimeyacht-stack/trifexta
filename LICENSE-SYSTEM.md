# TR!FEXTA Beat License System

Implements four beat-license tiers (MP3 Lease, WAV Lease, Unlimited, Exclusive) with a
license-selection modal, per-tier Snipcart products, agreement acceptance, and an Exclusive-Sold
state. Built on top of the existing static site + Snipcart (TEST mode). No redesign, no framework
change — same design language, animations, audio previews, and Snipcart integration preserved.

## Where license prices are configured

All beat/license data lives in **`assets/site.js`** in one place:

- `LICENSE_TIERS` — global tier display + rules (label, default price, files, bullets, agreement
  link, warnings). Edit `defaultPrice` here to change a tier's price across ALL beats at once.
- `BEATS[]` — per-beat `licenses` map holds the price for each tier **for that beat**:
  ```js
  { id:"beat-midnight", ...,
    licenses:{ mp3:{price:29.99}, wav:{price:49.99}, unlimited:{price:99.99}, exclusive:{price:499} } }
  ```
  Resolution: `tierPrice(beat, tier)` uses the per-beat override if present, else
  `LICENSE_TIERS[tier].defaultPrice`.

The current MP3 prices preserve the pre-existing per-beat prices (midnight $29.99, violet $24.99,
etc.). WAV/Unlimited/Exclusive use the brief's stated defaults ($49.99 / $99.99 / $499) unless a
beat overrides them.

## How to change a beat's Exclusive price

Edit that beat's `licenses.exclusive.price`. Example — make Midnight Static exclusive $750:
```js
{ id:"beat-midnight", ..., licenses:{ ..., exclusive:{price:750} } }
```
No need to touch any other file.

## How to disable a license tier for a beat

Add `enabled:false` to that tier in the beat's `licenses` map:
```js
licenses:{ mp3:{price:29.99}, wav:{enabled:false}, unlimited:{price:99.99}, exclusive:{price:499} }
```
Disabled tiers render as "Unavailable" and can't be selected. To disable a tier for ALL beats,
set `enabled:false` at the `LICENSE_TIERS` level (not currently used but supported).

## How to mark a beat as Exclusive Sold

Set `exclusiveSold:true` on the beat object:
```js
{ id:"beat-midnight", ..., exclusiveSold:true, licenses:{...} }
```
Effect:
- The beat card shows an **EXCLUSIVE SOLD** badge and the "Choose license" button becomes
  disabled ("Unavailable").
- The modal won't offer any tier for that beat.
- This is a UI/client-side lock. See "Static-site limitations" — it is NOT a secure server-side
  inventory lock.

**Important legal behavior preserved in code/UI:** selling Exclusive does NOT transfer beat
copyright, publishing, songwriter interests, or producer royalties. Previously issued licenses
remain valid. The exclusive warning is shown in the modal before purchase.

## How product IDs are generated

Snipcart product ID = `${beat.id}-${tier}`:
```
beat-midnight-mp3
beat-midnight-wav
beat-midnight-unlimited
beat-midnight-exclusive
... (24 total: 6 beats × 4 tiers)
```
The cart shows both beat and license via the item name ("Midnight Static — WAV Lease") plus a
custom field "License: WAV Lease". Quantity is capped at 1 (`data-item-max-quantity="1"`).
Beats are marked `data-item-tangible="false"` + `data-item-shippable="false"` (digital).

## Which Snipcart digital goods must be associated with each tier

In the Snipcart dashboard, each beat-tier product must be linked to the matching Digital Good
FILE GUID. The mapping used by the site (`deliveryGuid`):

| Tier       | Delivers (GUID field)                                 | Current state              |
|------------|-------------------------------------------------------|----------------------------|
| MP3 Lease  | `mp3Guid`                                              | ✅ all 6 uploaded + wired  |
| WAV Lease  | `wavGuid` if set, else falls back to `mp3Guid`        | ⏳ WAV not uploaded yet    |
| Unlimited  | `wavGuid` if set, else falls back to `mp3Guid`        | ⏳ WAV not uploaded yet    |
| Exclusive  | `stemsGuid` → `wavGuid` → `mp3Guid` (first present)   | ⏳ WAV/stems not uploaded  |

So today every tier delivers the **MP3** (because only MP3 digital goods exist). When you upload
WAV/stems and paste their GUIDs into the beat's `wavGuid`/`stemsGuid`, those tiers automatically
upgrade delivery — no code change needed.

**CRITICAL for multi-file delivery:** Snipcart's `data-item-file-guid` accepts ONE GUID. To deliver
MP3 **and** WAV together, the Snipcart Digital Good for that tier should contain BOTH files (e.g. a
ZIP, or a multi-file digital good). Paste that bundle's GUID into `wavGuid`. The same applies to
stems (`stemsGuid`).

## How to add WAV files

1. Snipcart dashboard → Digital Goods → upload the WAV (and optionally a ZIP of MP3+WAV).
2. Copy the new File GUID.
3. Paste it into the beat's `wavGuid:"..."` in `assets/site.js`.
4. Commit + push. WAV/Unlimited/Exclusive tiers now deliver it (fallback to MP3 removed).

## How to add stems

Same as WAV, but paste the stems bundle GUID into `stemsGuid:"..."`. The Exclusive tier uses
`stemsGuid` first.

## How agreement files/links are managed

The modal links to `licenses/<tier>.html` (paths defined in `LICENSE_TIERS[...].agreement`):
- `licenses/mp3-lease.html`
- `licenses/wav-lease.html`
- `licenses/unlimited.html`
- `licenses/exclusive.html`

**These are currently PLACEHOLDERS** (clearly marked "not legal advice"). The real TR!FEXTA legal
terms must be pasted into each file by TR!FEXTA. The acceptance checkbox is intentionally
**not pre-checked** and the link opens in a new tab before purchase. No AI-generated legal text
was written.

## What remains manual (dashboard)

- Uploading WAV/stem digital goods and pasting their GUIDs (code is ready; files aren't).
- Pasting the real license-agreement text into `licenses/*.html`.
- Marking `exclusiveSold:true` when an exclusive sale closes (code-ready; you flip the flag).
- Re-running Snipcart FETCH (`Products → FETCH` → `https://trifexta.net/beats.html`) so the 24 new
  beat-tier products are imported (old single `BEAT-MIDNIGHT` style products are now outdated).
- Associating each new product with its Digital Good GUID in the dashboard.

## What would require a backend/serverless function

- **Secure Exclusive inventory locking.** The `exclusiveSold` flag is enforced only in the
  front-end. A determined user could edit the DOM to re-enable purchase. For legally enforceable
  exclusive locking you need a server/webhook: on exclusive purchase, a serverless function flips
  `exclusiveSold` server-side and Snipcart's order-validation/webhook rejects new license sales
  for that beat. GitHub Pages alone cannot do this securely. Documented, not faked.
- **Per-order agreement acceptance records.** We record acceptance client-side (checkbox + link)
  but do not store a signed record. A backend (or Snipcart custom field persisted to the order) is
  the minimal secure solution — the `data-item-custom1` "License" field already rides along on the
  order, but true acceptance attestation needs server persistence.
- **Enforcing price/server-side.** Prices come from the front-end `data-item-price`. Snipcart
  re-validates against the crawled product page, but the crawled page is also client-rendered; a
  backend product source is the robust fix. Acceptable for a TEST-stage store; revisit before LIVE.

## How to test purchases safely

1. Keep Snipcart in **TEST mode** (dashboard toggle = TEST, and/or append `?mode=test` to the URL
   which loads the test API key from `CONFIG.testKey`).
2. Hard-refresh `trifexta.net/beats.html?mode=test`.
3. Click **Choose license** → pick a tier → check the agreement → **Add to cart** → checkout with
   test card `4242 4242 4242 4242`, `12/30`, `123`.
4. Confirm the order completes and the download email arrives (check spam — Gmail may file it
   there, as seen in earlier testing). This was already proven working for MP3; WAV/stems delivery
   can only be tested after those files are uploaded + GUIDs wired.

## How to move from TEST to LIVE (without exposing secrets)

1. Upload WAV/stems + paste GUIDs (if not already).
2. Paste the real license text into `licenses/*.html`.
3. Re-FETCH products in the **LIVE** Snipcart environment.
4. In `assets/site.js`, the LIVE key is already in `CONFIG.snipcartKey`. To go live, simply stop
   using `?mode=test` (which loads `CONFIG.testKey`). Optionally clear `CONFIG.testKey` — but
   leaving it is fine; it's only used when `?mode=test` is present.
5. **Never commit the Snipcart SECRET** (it lives only in the Snipcart dashboard). The public keys
   in `CONFIG` are meant to be public. `assets/config.local.js` is gitignored for local overrides.
6. Do NOT touch Cloudflare DNS / Google Workspace DNS / domain registration.

Secrets status: no Stripe/Snipcart secrets are in the repo. Only public API keys (by design).
