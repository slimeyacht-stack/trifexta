# Cloudflare Rate Limiting — setup path (OPTIONAL)

`trifexta.net` is currently on **Squarespace DNS** (`nsd*.squarespacedns.com`),
pointing at GitHub Pages (`185.199.108–111.153`). A static GitHub Pages site
**cannot rate-limit on its own** — there is no server in the request path.
To add rate limiting / bot protection, put Cloudflare in front as a proxy.

## Why this needs a manual step
Moving DNS to Cloudflare means changing the domain's **nameservers** at your
registrar (Squarespace). That is a domain-control action only you can take —
it is not something automatable from the repo.

## Steps (when you're ready)
1. **Sign up** at cloudflare.com → **Add a Site** → `trifexta.net`.
2. Cloudflare scans existing DNS. **Re-create the GitHub Pages records:**
   - `trifexta.net` → A record → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - `www.trifexta.net` → CNAME → `slimeyacht-stack.github.io`
   - Keep the existing `CNAME` file in this repo (`trifexta.net`) — GitHub Pages
     still needs it to serve the custom domain.
3. **Set the GitHub Pages records to "Proxied" (orange cloud)** so traffic flows
   through Cloudflare.
4. Cloudflare gives you **4 nameservers** (e.g. `arya.ns.cloudflare.com`).
   Copy them.
5. At **Squarespace → Domains → trifexta.net → DNS / Nameservers**, replace the
   Squarespace nameservers with the Cloudflare ones. Save.
6. Wait for propagation (minutes to 48h; usually fast). Cloudflare shows
   "Active" when it detects the NS change.
7. **Enable rate limiting** in Cloudflare:
   - **Security → WAF → Rate limiting rules** → *Create rule*
   - Rule: `hostname equals trifexta.net` → *Block* after e.g. 100 requests /
     10 minutes per IP (tune to traffic).
   - Optional: **Security → Bots → Bot Fight Mode** (free) to challenge scrapers.
   - Optional: **Security → WAF → Custom rules** to challenge or JS-challenge
     suspicious paths.

## Notes
- Free Cloudflare tier includes rate-limiting rules + Bot Fight Mode.
- SSL: Cloudflare default "Full" is fine; GitHub Pages serves valid certs.
- This site has **no backend/form POST**, so abuse surface is low even without
  CF — rate limiting is defense-in-depth, not required for function.
- Contact form is `mailto:` (client-side), so it is unaffected by CF.
