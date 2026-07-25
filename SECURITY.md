# Security Notes — Trifexta.net

This is a **static site** (plain HTML/CSS/JS, no server, no backend). Security
posture follows from that.

## 1. API keys & secrets — current status: SAFE
- A front-end secret scan (`grep` for `sk_live`, `sk_test`, `Bearer`,
  `client_secret`, `password`, private keys, etc.) across all `.html/.js/.css/.json`
  returns **no live secrets**.
- The only key in the code is `snipcartKey: "YOUR_SNIPCART_PUBLIC_API_KEY"` — a
  **placeholder**.
- **Snipcart's key is PUBLIC by design.** It must live in the front-end for the
  cart to work; the *secret* stays in your Snipcart dashboard, never in this repo.
  Exposing the public key is expected and not a leak.
- **Local key override (so a real key is never committed):**
  - `assets/config.local.js` is gitignored.
  - Copy `assets/config.local.js.example` → `assets/config.local.js`, paste your
    real key, and the site picks it up automatically (`window.__TRIFEXTA_CONFIG__`).
  - The placeholder remains in `site.js`, so the repo stays key-free and the cart
    stays in DEMO MODE until a local override is present.
- **Rule:** never paste a real key directly into `site.js` or any committed file.

## 2. The "unsupported command-line flag" browser banner
- That warning (`--unsafely-treat-insecure-origin-as-secure=http://localhost:8080`)
  comes from a **local browser launch** (Brave/Chromium dev or automation tooling)
  treating your local preview server as secure. It is **local-only** and does NOT
  affect the deployed `trifexta.net` (which is real HTTPS via GitHub Pages).
- It is not a vulnerability in the site code. To remove it: relaunch the browser
  normally (without that flag).

## 3. Rate limiting — requires infrastructure (NOT possible on static Pages)
A pure static site cannot rate-limit requests; there is no server in the request
path. Options if you need it:
- **Cloudflare in front of `trifexta.net`** (free tier): rate limiting rules +
  Bot Fight Mode + WAF. Requires moving the domain's DNS to Cloudflare
  (keep the GitHub Pages CNAME record inside CF).
- **GitHub Pages alone:** no rate limiting. Acceptable because there is no
  unauthenticated backend or form endpoint to abuse — the contact form is a
  `mailto:` link, not a server POST.

## 4. Other notes
- Contact form uses `mailto:` (opens the visitor's mail app) — no data is sent to
  or stored by this site.
- No third-party trackers beyond Snipcart's required CDN (only loaded when a real
  key is set; DEMO MODE skips it).
- Font `JackboaDemo` is **non-commercial** — swap before selling merch
  (see ASSET-PLAN.md).
