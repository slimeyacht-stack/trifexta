# TR!FEXTA — Authoritative Exclusive-Sold System

Makes an Exclusive sale **authoritative and server-side**, so it can't be defeated by
editing frontend JavaScript or crafting a manual Snipcart request. Built on a
**Cloudflare Worker + KV** behind `trifexta.net`, with a **Snipcart webhook**.

This is infrastructure only. The 4-tier licensing UI, modal, 15s previews, merch, and
pricing are untouched (see `LICENSE-SYSTEM.md`).

---

## 1. Architecture

```
Customer buys Exclusive (Snipcart, TEST or LIVE)
        │  order.completed webhook (POST)
        ▼
Cloudflare Worker  /api/webhook/snipcart
        │  1. Verify X-Snipcart-RequestToken (official Snipcart method)
        │  2. Idempotent: skip if order token already recorded
        │  3. Extract beat slug from product id "beat-<slug>-exclusive"
        │  4. Write KV:  { exclusiveSold:true, exclusiveStatus:"SOLD",
        │                 exclusiveOrderId, soldAt }
        ▼
   KV namespace EXCLUSIVE_KV   (per-beat state, survives deploys/sessions)
        ▲
        │  GET /api/beats/availability  (frontend calls this on boot)
        ▼
   TR!FEXTA frontend  → shows EXCLUSIVE SOLD, disables all tiers
```

**Components**
- `cloudflare/worker.js` — the Worker (routes, webhook verification, KV reads/writes, admin).
- `cloudflare/wrangler.toml` — binding for `EXCLUSIVE_KV`; **no secrets in this file**.
- `cloudflare/package.json` — pins `wrangler` for local dev/deploy.
- `assets/site.js` — fetches `/api/beats/availability` on boot, **fails closed**, merges with the
  static `exclusiveSold` fallback, and gates the UI.

---

## 2. Why frontend-only `exclusiveSold` was insecure

The old flag lived in `assets/site.js` (static, client-side). Anyone could:
- Open DevTools and flip `b.exclusiveSold=false`, or
- Edit the DOM to re-enable the "Choose license" button, or
- POST a Snipcart cart with `beat-midnight-exclusive` directly (the product still exists in Snipcart).

None of those are stopped by hiding a button. The **server (Worker + KV)** is the
source of truth; the frontend merely reflects it. The webhook is what *sets* it, and the
availability API is what *enforces* it on every page load.

---

## 3. Cloudflare components used

- **Cloudflare Worker** (one script, `trifexta-exclusive`).
- **Cloudflare KV** (one namespace, `EXCLUSIVE_KV`). Free-tier eligible.
- **No D1, no Durable Objects, no R2.** See §9 for why KV was chosen over them.

---

## 4. Datastore schema (KV)

Key = beat slug (`midnight`, `violet`, `concrete`, `neon`, `lowtide`, `afterglow`).
Value = JSON:

```json
{
  "exclusiveSold": true,
  "exclusiveStatus": "SOLD" | "REVIEW_REQUIRED" | "AVAILABLE",
  "exclusiveOrderId": "<Snipcart order token or invoice>",
  "soldAt": "2026-07-26T17:00:00.000Z",
  "updatedAt": "2026-07-26T17:00:00.000Z",
  "note": "Set SOLD via Snipcart webhook (Test) order SNIP-1005"
}
```

Plus a synthetic idempotency key per order: `order:<snipcartOrderToken>` → `{at, beatId}`.

**Why this shape:** the frontend only needs `exclusiveSold` + `exclusiveStatus`. The
extra fields are audit/troubleshooting (see §13 logging). `REVIEW_REQUIRED` is the
refund/chargeback state (§8). A beat with no KV key defaults to `AVAILABLE`.

---

## 5. Availability API

- `GET /api/beats/availability` → `{ "midnight": {...}, "violet": {...}, ... }`
  (all known beats; absent key = available).
- `GET /api/beats/<id>` → single beat state, or `404` for unknown id.

The frontend calls `/api/beats/availability` once on boot. **Fail-closed:** if the Worker
returns non-200 or the fetch throws, the frontend treats **Exclusive as sold for every
beat** (safe default — blocks new exclusive sales during an outage). Ordinary
MP3/WAV/Unlimited licenses are **never** blocked by an availability failure, because
previous/ordinary licenses must stay purchasable even when infra is down.

---

## 6. Snipcart webhook flow

1. Snipcart sends `POST /api/webhook/snipcart` on `order.completed` (and other events).
2. Worker extracts the `X-Snipcart-RequestToken` header.
3. Worker calls `GET https://app.snipcart.com/api/requestvalidation/<token>`.
4. If Snipcart answers `{"isValid":true}` → request is authentic. Else → `401`.
5. Worker parses the order, finds any item whose `id` matches `beat-<slug>-exclusive`,
   and (idempotently) writes the SOLD state for that beat.

---

## 7. Webhook verification (official Snipcart method — not invented)

Per Snipcart's current docs, each outbound webhook carries an
**`X-Snipcart-RequestToken`** header containing a token valid for **one hour**. You verify
it by making an authenticated `GET` to:

```
https://app.snipcart.com/api/requestvalidation/<token>
```

A `200` with body `{"isValid":true}` means the request genuinely came from Snipcart.
This is **not** an HMAC/SHA256 scheme (that's Stripe/Shopify/etc. — Snipcart does
**not** use it). We follow Snipcart's documented handshake exactly.

**No Snipcart secret is required to *verify* an inbound webhook.** The secret would only
be needed if we called Snipcart's REST API (e.g. to zero inventory). We deliberately
avoid that call (see §10/§18), so no Snipcart secret lives in the Worker.

---

## 8. Idempotency

Snipcart may retry a webhook (it has a "Send this hook again" button + automatic
retries). The Worker records every processed order token under `order:<token>`.
On a repeat delivery it detects the token and returns `{ok:true, duplicate:true}` **without**
re-writing state. Beat-level writes are also guarded: if the beat is already `SOLD`,
the transition is skipped (logged, not re-applied). Duplicate deliveries cannot corrupt
state.

---

## 9. Race-condition protection (and its honest limit)

**Scenario:** Customer A and Customer B both reach Snipcart checkout for
`beat-midnight-exclusive` at the same instant. Snipcart itself enforces one
successful Exclusive purchase — once A's order completes, B's competing checkout is
rejected by Snipcart (the product is single-quantity / the order can't double-sell the
same exclusive). Snipcart's order pipeline is the primary guard; our webhook is the
*recorder* of the winner.

**What we add on top:**
- The webhook writes KV **atomically per beat** (KV `put` is a single-key atomic op).
- Idempotent order-token dedup prevents a retry from re-marking.
- The frontend re-fetches availability after boot and reflects SOLD immediately.

**Honest remaining risk:** A true *atomic reservation* (lock the beat the instant a
checkout *starts*, not when it *completes*) cannot be guaranteed by a post-payment
webhook + KV alone. Two near-simultaneous checkouts could both be accepted by
Snipcart and both webhooks could fire before either KV write lands — a classic
last-writer-wins race. In practice Snipcart's single-unit sale + our order-token
dedup make this vanishingly unlikely, and the worst case is "beat marked sold" (the
correct business outcome), not "sold twice to two people with two payouts." If you
need hard atomic reservation, the smallest correct upgrade is a **server-authoritative
product/inventory endpoint** Snipcart validates against, or **Snipcart's inventory
feature** set to quantity 1 with server-side inventory — see §18.

---

## 10. Server-side purchase validation

We do **not** rely on hiding buttons. Two layers:
1. **Webhook sets state** on a real exclusive sale (§6).
2. **Availability API enforces** on every page load: if `exclusiveSold` is true
   (server), the modal disables **all** tiers (MP3/WAV/Unlimited/Exclusive) for
   that beat, and the card shows EXCLUSIVE SOLD. The `addSelectedLicense()` function
   also re-checks `exclusiveSold(b)` server-side before adding to cart, so even a
   hand-crafted `snipcart-add-item` click is rejected (the product still exists in
   Snipcart, but our code won't add it).

**Known limitation:** the *Snipcart checkout itself* is not server-validated by us — if a
user bypasses our frontend entirely and POSTs to Snipcart with a pre-existing product
id, Snipcart would still sell it (we don't zero Snipcart inventory). Mitigation:
set the Snipcart product inventory to 1 / use Snipcart's stock control, or add a
server-side product endpoint. Documented, not silently claimed as solved.

---

## 11. Refund / cancellation / chargeback behavior

We do **NOT** automatically put a beat back on sale when an exclusive order is refunded,
disputed, or charged back. That could illegally re-sell an exclusive.

Instead, when such an event is detected (wire the relevant Snipcart webhook event, or
manually), the Worker flips `exclusiveStatus` to **`REVIEW_REQUIRED`** and keeps
`exclusiveSold:true`. The beat stays off-sale. TR!FEXTA then decides (manually,
via admin) whether to relist. No automatic resale.

Note: the current Worker handles `order.completed` for marking SOLD. Refund/chargeback
handling requires also listening to Snipcart's order-status/refund events and adding a
`mark_review` transition — the `handleAdminPost` `mark_review` action already exists
for the manual path; the automatic refund→REVIEW wiring is a small addition once you
confirm which Snipcart event fires for refunds in your account.

---

## 12. Manual admin procedure (secure, no public endpoint)

`/api/admin/exclusive` is **protected by a secret `x-admin-token` header**
(`ADMIN_TOKEN` Cloudflare secret). It is NOT publicly callable.

- **View all states:** `GET /api/admin/exclusive` with the header.
- **Mark a beat sold (correction):** `POST` `{beatId, action:"mark_sold"}`.
- **Mark REVIEW_REQUIRED (refund/dispute):** `POST` `{beatId, action:"mark_review"}`.
- **Clear (relist after manual approval):** `POST` `{beatId, action:"clear"}`.

There is **no GUI** — intentionally (security > convenience, per brief). Use `curl`
from a trusted machine, or the Cloudflare dashboard → Workers → the script → "Preview"
/Logs for inspection. Example (run locally, token from `wrangler secret`):

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" https://<worker-subdomain>.workers.dev/api/admin/exclusive
curl -X POST -H "x-admin-token: $ADMIN_TOKEN" -H "content-type: application/json" \
  -d '{"beatId":"midnight","action":"mark_review"}' \
  https://<worker-subdomain>.workers.dev/api/admin/exclusive
```

---

## 13. Logging

The Worker logs (to Cloudflare Workers logs / `wrangler tail`):
- webhook received (event, mode, order token, invoice, item count)
- verification success/failure
- beat slug extracted + product id
- exclusive state transition (SOLD set, or duplicate skipped)
- duplicate webhook detection
- errors (KV failure, bad JSON, unauthorized)

**Never logged:** full card data, API secrets, unnecessary customer PII. Only the
order token/invoice, beat id, tier, and timestamps.

---

## 14. Required secrets

| Secret | Where | How set |
|---|---|---|
| `ADMIN_TOKEN` | Cloudflare Worker secret (`env.ADMIN_TOKEN`) | `npx wrangler secret put ADMIN_TOKEN` (prompts for value) |
| `EXCLUSIVE_KV` | KV namespace binding | created via `npx wrangler kv namespace create`; id pasted into `wrangler.toml` |
| Snipcart public API key | already in `assets/site.js` CONFIG (public by design) | — |
| Snipcart **secret** / Stripe **secret** | **never** in repo/Worker/HTML/JS | stays in Snipcart/Stripe dashboards only |

No secret is committed. `wrangler.toml` contains a placeholder KV id and explicit
comments telling you to `wrangler secret put ADMIN_TOKEN` — it does **not** contain the
value.

---

## 15. Cloudflare setup

```bash
cd cloudflare
npm install -D wrangler          # or: npx wrangler ...
npx wrangler kv namespace create EXCLUSIVE_KV     # copy the printed id=...
# paste that id into cloudflare/wrangler.toml  [[kv_namespaces]] id = "..."
npx wrangler secret put ADMIN_TOKEN            # enter a long random token; this is your admin key
npx wrangler deploy                         # deploys the Worker
```

The Worker needs a route so `trifexta.net/api/*` hits it. Options:
- **Route the whole `/api/*` path** to the Worker in the Cloudflare dashboard
  (DNS must already be proxied through Cloudflare — see `CLOUDFLARE-SETUP.md`).
  This serves `/api/beats/availability` etc. from the Worker while the rest of the
  site stays on GitHub Pages.
- Or give the Worker its own `*.workers.dev` subdomain for testing, then add the
  `trifexta.net/api/*` route for production.

**DNS note:** `trifexta.net` is currently on **Squarespace DNS → GitHub Pages**
(no Cloudflare proxy). To put a Worker in front of `/api/*`, the domain must be
**proxied through Cloudflare** (change nameservers at Squarespace per
`CLOUDFLARE-SETUP.md`). That is a domain-control action **only you can take** — I
have not done it. The Worker can be tested today on its `*.workers.dev` subdomain;
the `trifexta.net/api/*` route requires your DNS change (see §16–17).

---

## 16. Snipcart dashboard setup

1. Snipcart dashboard → **Store Configurations → Webhooks**.
2. Add URL: `https://<worker-host>/api/webhook/snipcart`
   (use the `*.workers.dev` subdomain for TEST, or the `trifexta.net/api/webhook/snipcart`
   route once DNS is proxied).
3. Ensure `order.completed` is enabled (and later, the refund/status event for §11).
4. **Test mode:** keep Snipcart in TEST; the webhook fires for test orders too. Use
   `?mode=test` on the site so the test key loads.

---

## 17. TEST deployment procedure (no live payments)

1. Deploy Worker to `*.workers.dev` (§15). Set `ADMIN_TOKEN` secret.
2. In Snipcart (TEST mode), point the webhook at `https://<sub>.workers.dev/api/webhook/snipcart`.
3. On `trifexta.net/beats.html?mode=test`, buy **Midnight Static → Exclusive** with test
   card `4242 4242 4242 4242`.
4. Webhook fires → Worker verifies token → KV marks `midnight` SOLD.
5. Hard-refresh the page → card shows **EXCLUSIVE SOLD**, all tiers disabled.
6. Attempt another Exclusive (or any tier) purchase → blocked by `exclusiveSold(b)`.
7. Existing historical licenses are untouched (we never modify old orders).
8. Re-send the webhook (Snipcart "send again") → duplicate detected, no corruption.
9. Simulate refund → `POST /api/admin/exclusive` action `mark_review` → status
   REVIEW_REQUIRED (beat stays off-sale; no auto-resale).

---

## 18. Known limitations / what can't be perfectly solved here

- **Atomic reservation race (§9):** post-payment webhook + KV can't guarantee a
  hard lock the instant checkout *starts*. Mitigated by Snipcart single-unit sale +
  order-token dedup. For hard guarantees: server-authoritative product endpoint or
  Snipcart stock=1 inventory validated server-side.
- **Snipcart-side checkout not server-validated by us (§10):** a user bypassing our
  frontend and POSTing to Snipcart with a pre-existing product id could still sell it,
  because we don't zero Snipcart inventory. Mitigate with Snipcart inventory control.
- **Refund auto→REVIEW (§11):** the manual `mark_review` admin action exists;
  the automatic refund-event→REVIEW wiring is a small follow-up once you confirm
  Snipcart's refund webhook event name for your account.
- **Fail-closed scope (§5):** an availability outage blocks *new Exclusive* sales
  (safe) but never blocks ordinary licenses (by design).

---

## 19. Cost considerations (no paid plan assumed required)

- **Cloudflare Workers + KV:** free tier covers this low-traffic store comfortably
  (Workers free = 100k requests/day; KV free = generous read/write quota). No
  paid plan needed unless traffic spikes dramatically.
- **No D1 / Durable Objects / R2** used → no extra cost surface.
- **Snipcart + Stripe** costs are unchanged (per-transaction fees; test mode is free).
- The only "cost" is your time + the `ADMIN_TOKEN` you generate. No monthly
  infrastructure bill is introduced by this design at current scale.

---

## Files

- **Created:** `cloudflare/worker.js`, `cloudflare/wrangler.toml`,
  `cloudflare/package.json`, `EXCLUSIVE-SYSTEM.md`.
- **Modified:** `assets/site.js` (availability fetch + `exclusiveSold(b)` /
  `beatOffline(b)` gate; static `exclusiveSold` retained as fallback only).
- **Untouched:** licensing UI/modal, 15s previews, merch, pricing config, navigation,
  animations, existing `LICENSE-SYSTEM.md` data model.
