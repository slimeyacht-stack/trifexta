/**
 * TR!FEXTA — Authoritative Exclusive-Sold service
 * ------------------------------------------------------------------
 * Single Cloudflare Worker + KV namespace `EXCLUSIVE_KV`.
 *
 * ROUTES
 *   GET  /api/beats/availability        -> full map { beatId: {exclusiveSold,exclusiveStatus,exclusiveOrderId,soldAt} }
 *   GET  /api/beats/:id                 -> { beatId, exclusiveSold, exclusiveStatus, exclusiveOrderId, soldAt }
 *   POST /api/webhook/snipcart          -> Snipcart webhook receiver (verified via X-Snipcart-RequestToken)
 *   GET  /api/admin/exclusive          -> REQUIRES header `x-admin-token` (ADMIN_TOKEN secret). Lists all states.
 *   POST /api/admin/exclusive         -> REQUIRES x-admin-token. Body {beatId, action, note}
 *                                                 action: mark_sold | mark_review | clear
 *
 * SECURITY
 *   - Webhook verified with Snipcart's official method (X-Snipcart-RequestToken -> GET /api/requestvalidation/{token}).
 *     No Snipcart secret required to VERIFY inbound webhooks.
 *   - ADMIN_TOKEN is a Cloudflare secret (wrangler secret put). Never in repo/HTML/JS.
 *   - No Stripe/Snipcart secret keys in this file.
 *
 * FAIL-CLOSED
 *   If KV is unreachable, /api/beats/* returns 503 + exclusiveSold=true so the frontend
 *   disables Exclusive (safe default). Non-exclusive tiers are allowed by the frontend
 *   regardless, because previous/ordinary licenses must stay purchasable even during an outage.
 */

const SNIPCART_VALIDATE = "https://app.snipcart.com/api/requestvalidation/";

// Beat id (slug) parsed from a Snipcart product id like "beat-midnight-exclusive".
// Slug may contain letters/digits/hyphens but must end with "-exclusive" preceded by a real slug.
function beatIdFromProductId(productId) {
  const m = /^beat-([a-z0-9]+(?:-[a-z0-9]+)*)-exclusive$/i.exec(productId || "");
  return m ? m[1].toLowerCase() : null;
}
const KNOWN_BEATS = ["midnight", "violet", "concrete", "neon", "lowtide", "afterglow"];

function defaultState() {
  return { exclusiveSold: false, exclusiveStatus: "AVAILABLE", exclusiveOrderId: null, soldAt: null, updatedAt: null, note: null };
}

async function readState(beatId) {
  try {
    const raw = await EXCLUSIVE_KV.get(beatId);
    if (!raw) return { ...defaultState(), beatId };
    const obj = JSON.parse(raw);
    return { ...defaultState(), beatId, ...obj };
  } catch (e) {
    // KV unreachable — signal failure so caller can fail closed.
    throw e;
  }
}

async function writeState(beatId, state) {
  state.updatedAt = new Date().toISOString();
  await EXCLUSIVE_KV.put(beatId, JSON.stringify(state));
}

async function verifySnipcartToken(request) {
  const token = request.headers.get("X-Snipcart-RequestToken");
  if (!token) return false;
  try {
    const r = await fetch(SNIPCART_VALIDATE + encodeURIComponent(token), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return false;
    const body = await r.json();
    return body && body.isValid === true;
  } catch (e) {
    return false; // network/validation error -> reject, never trust
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// ---------- Webhook processing (idempotent) ----------
async function handleWebhook(request) {
  const ok = await verifySnipcartToken(request);
  if (!ok) {
    console.warn("[webhook] rejected: token verification failed");
    return json({ error: "unauthorized" }, 401);
  }
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: "bad json" }, 400);
  }

  const event = payload.eventName || payload.event || "unknown";
  const mode = payload.mode || (payload.content && payload.content.mode) || "unknown";
  const order = payload.content || {};
  const orderToken = order.token || payload.token || null;
  const invoice = order.invoiceNumber || null;
  const items = Array.isArray(order.items) ? order.items : [];

  console.log("[webhook] received", { event, mode, orderToken, invoice, itemCount: items.length });

  // Only act on completed orders.
  if (event !== "order.completed") {
    return json({ ok: true, ignored: event });
  }

  // Idempotency: record processed order tokens so retries are no-ops.
  if (orderToken) {
    const seen = await EXCLUSIVE_KV.get("order:" + orderToken);
    if (seen) {
      console.log("[webhook] duplicate order token ignored", orderToken);
      return json({ ok: true, duplicate: true });
    }
  }

  // Find an Exclusive item in this order.
  let affected = null;
  for (const it of items) {
    const pid = it.id || it.uniqueId || "";
    const slug = beatIdFromProductId(pid);
    if (slug && KNOWN_BEATS.includes(slug)) {
      affected = { beatId: slug, productId: pid, name: it.name, price: it.price, quantity: it.quantity };
      break;
    }
  }

  if (!affected) {
    // Persist the order token so a later retry still no-ops even if nothing matched.
    if (orderToken) await EXCLUSIVE_KV.put("order:" + orderToken, JSON.stringify({ at: new Date().toISOString() }));
    console.log("[webhook] no exclusive item in order");
    return json({ ok: true, exclusive: false });
  }

  // Apply state transition (idempotent at the beat level too).
  const st = await readState(affected.beatId);
  if (st.exclusiveSold && st.exclusiveStatus === "SOLD") {
    console.log("[webhook] beat already SOLD; ignoring", affected.beatId);
  } else {
    st.exclusiveSold = true;
    st.exclusiveStatus = "SOLD";
    st.exclusiveOrderId = orderToken || invoice || null;
    st.soldAt = new Date().toISOString();
    st.note = `Set SOLD via Snipcart webhook (${mode}) order ${invoice || orderToken || "?"}`;
    await writeState(affected.beatId, st);
    console.log("[webhook] beat marked SOLD", affected.beatId, { mode, invoice });
  }
  if (orderToken) await EXCLUSIVE_KV.put("order:" + orderToken, JSON.stringify({ at: new Date().toISOString(), beatId: affected.beatId }));

  return json({ ok: true, exclusive: true, beatId: affected.beatId });
}

// ---------- Admin ----------
function adminAuthorized(request) {
  const t = request.headers.get("x-admin-token");
  return !!t && t === ADMIN_TOKEN;
}

async function handleAdminGet() {
  const out = {};
  for (const b of KNOWN_BEATS) out[b] = await readState(b);
  return json(out);
}

async function handleAdminPost(request) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad json" }, 400); }
  const beatId = (body.beatId || "").toLowerCase();
  const action = body.action;
  if (!KNOWN_BEATS.includes(beatId)) return json({ error: "unknown beat" }, 400);
  if (!["mark_sold", "mark_review", "clear"].includes(action)) return json({ error: "unknown action" }, 400);

  const st = await readState(beatId);
  if (action === "mark_sold") {
    st.exclusiveSold = true; st.exclusiveStatus = "SOLD";
    st.exclusiveOrderId = body.orderId || st.exclusiveOrderId;
    st.soldAt = st.soldAt || new Date().toISOString();
    st.note = "Manually marked SOLD by admin. " + (body.note || "");
  } else if (action === "mark_review") {
    st.exclusiveStatus = "REVIEW_REQUIRED";
    st.note = "Marked REVIEW_REQUIRED by admin (refund/chargeback/dispute). " + (body.note || "");
    // Do NOT auto-clear exclusiveSold — beat stays off-sale pending manual decision.
  } else if (action === "clear") {
    st.exclusiveSold = false; st.exclusiveStatus = "AVAILABLE";
    st.exclusiveOrderId = null; st.soldAt = null;
    st.note = "Cleared by admin. " + (body.note || "");
  }
  await writeState(beatId, st);
  return json({ ok: true, beatId, state: st });
}

// ---------- Availability (fail-closed) ----------
async function handleAvailability() {
  const out = {};
  for (const b of KNOWN_BEATS) {
    try {
      out[b] = await readState(b);
    } catch (e) {
      // KV down -> fail closed for Exclusive only.
      out[b] = { ...defaultState(), beatId: b, exclusiveSold: true, _kvError: true };
    }
  }
  return json(out);
}

async function handleAvailabilityOne(beatId) {
  beatId = (beatId || "").toLowerCase();
  if (!KNOWN_BEATS.includes(beatId)) return json({ error: "unknown beat" }, 404);
  try {
    return json(await readState(beatId));
  } catch (e) {
    return json({ beatId, exclusiveSold: true, exclusiveStatus: "REVIEW_REQUIRED", _kvError: true }, 503);
  }
}

// ---------- Router ----------
export default {
  async fetch(request, env, ctx) {
    // Bindings injected by wrangler.toml
    const EXCLUSIVE_KV = env.EXCLUSIVE_KV;
    const ADMIN_TOKEN = env.ADMIN_TOKEN;
    const url = new URL(request.url);
    const p = url.pathname;

    if (request.method === "POST" && p === "/api/webhook/snipcart") {
      return handleWebhook(request);
    }
    if (request.method === "GET" && p === "/api/beats/availability") {
      return handleAvailability();
    }
    if (request.method === "GET" && p.startsWith("/api/beats/")) {
      return handleAvailabilityOne(p.slice("/api/beats/".length));
    }
    if (p === "/api/admin/exclusive") {
      if (!adminAuthorized(request)) return json({ error: "unauthorized" }, 401);
      if (request.method === "GET") return handleAdminGet();
      if (request.method === "POST") return handleAdminPost(request);
      return json({ error: "method" }, 405);
    }
    return json({ error: "not found" }, 404);
  },
};
