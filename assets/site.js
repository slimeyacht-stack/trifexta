/* =========================================================================
   Trifexta.net — shared site logic (cart via Snipcart + audio preview dock)
   Loaded by every page. CONFIG holds the Snipcart key (demo until set).

   SECURITY: the committed key is a PLACEHOLDER. Snipcart's key is PUBLIC by
   design (it MUST live in the front-end; the secret lives in your Snipcart
   dashboard, never in this repo). Optional local override file
   `assets/config.local.js` (gitignored) may hold a REAL key — it is loaded
   only if present, via a SILENT fetch HEAD probe (a 404 there does NOT log a
   console error). No live secret is ever pushed to the repo.
   ========================================================================= */
const CONFIG = {
  snipcartKey: "ZGVmMGYxNzItZDAwNy00ZDgyLTkxMDctMzYzNzdhOWRkZmY4NjM5MjA1NDcyMDMzMzUxNDg2",
  testKey: "ODU2NTE5NGMtZjM4MS00NzZjLWI2NGUtYjQ2YjU2YWZmNjQyNjM5MjA1NDcyMDMzMzUxNDg2",                 // admin: paste the Snipcart TEST key here, then visit ?mode=test to use it
  storeUrl: "https://trifexta.net/"
};
let DEMO = CONFIG.snipcartKey.includes("YOUR_");

/* ======================= DATA ======================= */
/* ----------------------------------------------------------------------------
   LICENSE SYSTEM — single source of truth.

   Each beat carries a `licenses` map: price PER TIER for THAT beat.
   Global tier display/rules live in LICENSE_TIERS below. To change a beat's
   Exclusive price, edit that beat's licenses.exclusive. To disable a tier for
   a beat, set enabled:false. To stop ALL new sales after an exclusive sale,
   set exclusiveSold:true (UI then disables every tier + shows EXCLUSIVE SOLD).

   Product ID convention (Snipcart): `${beat.id}-${tier}`  e.g. beat-midnight-mp3
   ---------------------------------------------------------------------------- */
const LICENSE_TIERS = {
  mp3: {
    key:"mp3", label:"MP3 Lease", defaultPrice:29.99,
    files:["MP3"],
    bullets:["MP3","50K streams","1 music video","Commercial use"],
    agreement:"legal/licenses/trifexta-mp3-license.pdf",
    note:"Content ID restrictions apply."
  },
  wav: {
    key:"wav", label:"WAV Lease", defaultPrice:49.99,
    files:["MP3","WAV"],
    bullets:["MP3 + WAV","250K streams","2 music videos","Commercial use"],
    agreement:"legal/licenses/trifexta-wav-license.pdf",
    note:"Content ID restrictions apply."
  },
  unlimited: {
    key:"unlimited", label:"Unlimited", defaultPrice:99.99,
    files:["MP3","WAV"],
    bullets:["MP3 + WAV","Unlimited streams","Unlimited videos","Commercial use"],
    agreement:"legal/licenses/trifexta-unlimited-license.pdf",
    note:"Content ID restrictions apply."
  },
  exclusive: {
    key:"exclusive", label:"Exclusive", defaultPrice:499,
    files:["MP3","WAV","Stems (when available)"],
    bullets:["MP3 + WAV","Stems when available","Unlimited usage","No future licenses sold"],
    agreement:"legal/licenses/trifexta-exclusive-license.pdf",
    exclusive:true,
    warning:"Previously issued licenses remain valid after an Exclusive License is sold. Exclusive prevents NEW licenses from being issued after the exclusive sale; it does not cancel previous customers' rights.",
    note:"Content ID restrictions apply."
  }
};
/* Delivery GUID per tier: which Snipcart Digital Good GUID to attach.
   mp3 → mp3Guid. wav/unlimited/exclusive → wavGuid if present, else mp3Guid
   (so they still deliver the MP3 until WAV/stems are uploaded + GUIDs set).
   stemsGuid is used by the exclusive tier when present. */
function deliveryGuid(b, tier){
  if(tier==="mp3") return b.mp3Guid || "";
  if(tier==="wav") return b.wavGuid || b.mp3Guid || "";
  if(tier==="unlimited") return b.wavGuid || b.mp3Guid || "";
  if(tier==="exclusive") return b.stemsGuid || b.wavGuid || b.mp3Guid || "";
  return "";
}
/* Resolve a tier's price for a beat (per-beat override → global default). */
function tierPrice(b, tier){ return (b.licenses[tier] && b.licenses[tier].price!=null) ? b.licenses[tier].price : LICENSE_TIERS[tier].defaultPrice; }
function tierEnabled(b, tier){ return !(b.licenses[tier] && b.licenses[tier].enabled===false); }

/* ======================= AUTHORITATIVE EXCLUSIVE STATE ======================= */
/* The static `exclusiveSold` flag in BEATS is a fallback only. The authoritative source
   is the Cloudflare Worker + KV service (see EXCLUSIVE-SYSTEM.md). We fetch it on boot.
   FAIL-CLOSED: if the service is unreachable/errors, we treat EVERY beat as
   exclusively sold *for the Exclusive tier only* (safe default — blocks new exclusive
   sales during an outage; ordinary MP3/WAV/Unlimited licenses stay available, because
   previous/ordinary licenses must never be blocked by an infrastructure hiccup). */
const AVAIL_ENDPOINT = "/api/beats/availability";
let AVAIL = null;            // { beatId: {exclusiveSold, exclusiveStatus, ...} } once loaded
let AVAIL_FAILED = false;    // true => service unreachable => fail-closed for exclusive

async function fetchAvailability(){
  try{
    const r = await fetch(AVAIL_ENDPOINT, { cache:"no-store" });
    if(!r.ok) throw new Error("status "+r.status);
    AVAIL = await r.json();
    AVAIL_FAILED = false;
  }catch(e){
    AVAIL = null;
    AVAIL_FAILED = true;   // fail closed
    console.warn("[availability] service unreachable — failing closed (exclusive disabled):", e.message);
  }
}
/* Authoritative "is this beat's exclusive sold?" — server OR static OR fail-closed. */
function exclusiveSold(b){
  if(b.exclusiveSold) return true;                 // static fallback (e.g. pre-deploy)
  if(AVAIL_FAILED) return true;                  // fail closed
  if(AVAIL && AVAIL[b.id]) return !!AVAIL[b.id].exclusiveSold;
  return false;
}
/* A beat is offline (no new sales at all) only if the SERVER says REVIEW_REQUIRED
   or SOLD *and* there is no static override. We keep ordinary tiers available unless
   the server explicitly flips exclusiveStatus to REVIEW_REQUIRED (manual lock). */
function beatOffline(b){
  if(AVAIL && AVAIL[b.id] && AVAIL[b.id].exclusiveStatus==="REVIEW_REQUIRED") return true;
  return false;
}

const BEATS = [
  {id:"beat-midnight", name:"Midnight Static", meta:"140 BPM · Fm",     cls:"c1", src:"assets/audio/midnight.mp3", cover:"assets/beats/beat-01.png",
    mp3Guid:"2397dbc7-1e7b-4bce-8638-0b5be53e7d4d", wavGuid:"", stemsGuid:"", exclusiveSold:false,
    licenses:{ mp3:{price:29.99}, wav:{price:49.99}, unlimited:{price:99.99}, exclusive:{price:499} }},
  {id:"beat-violet",   name:"Violet Hour",     meta:"92 BPM · C#min",   cls:"c2", src:"assets/audio/violet.mp3", cover:"assets/beats/beat-02.png",
    mp3Guid:"ab8db982-9069-489f-8133-80b2daed469b", wavGuid:"", stemsGuid:"", exclusiveSold:false,
    licenses:{ mp3:{price:24.99}, wav:{price:49.99}, unlimited:{price:99.99}, exclusive:{price:499} }},
  {id:"beat-concrete", name:"Concrete Rose",   meta:"120 BPM · Amin",   cls:"c3", src:"assets/audio/concrete.mp3", cover:"assets/beats/beat-03.png",
    mp3Guid:"10df4432-e7d0-4ad7-8770-886f63e150f8", wavGuid:"", stemsGuid:"", exclusiveSold:false,
    licenses:{ mp3:{price:27.99}, wav:{price:49.99}, unlimited:{price:99.99}, exclusive:{price:499} }},
  {id:"beat-neon",     name:"Neon Noir",       meta:"150 BPM · Emin",   cls:"c1", src:"assets/audio/neon.mp3", cover:"assets/beats/beat-04.png",
    mp3Guid:"e93dcab8-079f-490d-b9ed-df4b2702c154", wavGuid:"", stemsGuid:"", exclusiveSold:false,
    licenses:{ mp3:{price:31.99}, wav:{price:49.99}, unlimited:{price:99.99}, exclusive:{price:499} }},
  {id:"beat-lowtide",  name:"Low Tide",        meta:"85 BPM · Gmaj",    cls:"c2", src:"assets/audio/lowtide.mp3", cover:"assets/beats/beat-05.png",
    mp3Guid:"7027d49c-5f20-48b8-a675-6297dfc1bb44", wavGuid:"", stemsGuid:"", exclusiveSold:false,
    licenses:{ mp3:{price:22.99}, wav:{price:49.99}, unlimited:{price:99.99}, exclusive:{price:499} }},
  {id:"beat-afterglow",name:"Afterglow",       meta:"128 BPM · Dmin",   cls:"c3", src:"assets/audio/afterglow.mp3", cover:"assets/beats/beat-06.png",
    mp3Guid:"3b444eb9-3823-4edb-808d-9c695abedb31", wavGuid:"", stemsGuid:"", exclusiveSold:false,
    licenses:{ mp3:{price:26.99}, wav:{price:49.99}, unlimited:{price:99.99}, exclusive:{price:499} }}
];
const MERCH = [
  {id:"merch-hoodie", name:"Trifexta Logo Hoodie", meta:"heavyweight · black", price:55, cls:"c1", src:"assets/audio/static.mp3"},
  {id:"merch-tee",    name:"“SOUND” Heavy Tee",    meta:"boxy fit · white",   price:30, cls:"c2", src:"assets/audio/static.mp3"},
  {id:"merch-cap",    name:"Tour Cap",             meta:"embroidered",        price:25, cls:"c3", src:"assets/audio/static.mp3"}
];

/* ======================= HELPERS ======================= */
const $ = s=>document.querySelector(s);
const toastEl = $("#toast");
let toastTimer;
function toast(msg){toastEl.textContent=msg;toastEl.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove("show"),3200);}
function money(n){return "$"+n.toFixed(2);}

/* ======================= RENDER ======================= */
function beatCard(b){
  const el=document.createElement("div");
  el.className="card";
  const sold = exclusiveSold(b);
  el.innerHTML=`
    <div class="cover ${b.cls}" data-wave>
      ${b.cover?`<img class="cover-img" src="${b.cover}" alt="${b.name} cover" loading="lazy">`:``}
      <span class="preview-tag">15s preview</span>
      <button class="mini-play" data-track="${b.id}" data-title="${b.name}" data-src="${b.src}" aria-label="Preview ${b.name}">▶</button>
      <div class="wave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
      ${sold?`<span class="sold-badge">EXCLUSIVE SOLD</span>`:``}
    </div>
    <h3>${b.name}</h3>
    <div class="meta">${b.meta}</div>
    <div class="price">${money(tierPrice(b,"mp3"))} <small>MP3 lease</small></div>
    <div class="buy-row">
      ${DEMO
        ? `<button class="btn btn-primary btn-sm" data-buydemo>Add to cart</button>`
        : `<button class="btn btn-primary btn-sm" data-license-trigger data-beat="${b.id}" ${sold?"disabled":""}>${sold?"Unavailable":"Choose license"}</button>`}
    </div>`;
  return el;
}
function merchCard(m){
  const el=document.createElement("div");
  el.className="card";
  el.innerHTML=`
    <div class="cover ${m.cls}"></div>
    <h3>${m.name}</h3>
    <div class="meta">${m.meta}</div>
    <div class="price">${money(m.price)}</div>
    <div class="buy-row">
      ${DEMO
        ? `<button class="btn btn-pink btn-sm" data-buydemo>Add to cart</button>`
        : `<button class="btn btn-pink btn-sm snipcart-add-item"
            data-item-id="${m.id}" data-item-name="${m.name}"
            data-item-price="${m.price}" data-item-url="${CONFIG.storeUrl}merch.html"
            data-item-description="${m.meta}">Add to cart</button>`}
    </div>`;
  return el;
}

/* ======================= AUDIO ENGINE ======================= */
const PREVIEW_SEC=15;   // buyers hear a 15s preview, not the full track
const audio = new Audio();
audio.preload="none";
const dock=$("#dock"), dTitle=$("#dTitle"), dSub=$("#dSub"), dPlay=$("#dPlay"), dSeek=$("#dSeek");
let currentBtn=null, currentWave=null, previewStart=0;

function clearActive(){
  if(currentBtn){currentBtn.textContent="▶";currentBtn.closest(".cover,.track")?.classList.remove("playing");}
  if(currentWave)currentWave.classList.remove("on");
  currentBtn=null;currentWave=null;
}
function loadAndPlay(btn){
  const src=btn.dataset.src, title=btn.dataset.title;
  if(currentBtn===btn && !audio.paused){audio.pause();return;}
  clearActive();
  audio.src=src;
  // pick a random 15s window once we know the track length
  const pickWindow=()=>{
    if(audio.duration&&audio.duration>PREVIEW_SEC){
      const max=audio.duration-PREVIEW_SEC;
      previewStart=Math.random()*max;
      audio.currentTime=previewStart;
    } else {
      previewStart=0;
    }
  };
  audio.play().then(()=>{
    pickWindow();
    dock.classList.add("show");
    dTitle.textContent=title;
    dSub.textContent=(audio.duration&&audio.duration>PREVIEW_SEC)?"15s preview":"now playing";
    dPlay.textContent="⏸";
    btn.textContent="⏸";
    const wrap=btn.closest(".cover,.track");
    if(wrap)wrap.classList.add("playing");
    currentBtn=btn;
    currentWave=wrap?.querySelector(".wave");
    if(currentWave)currentWave.classList.add("on");
  }).catch(()=>{
    toast("Audio file not found — drop your mp3 at "+src);
  });
  audio.onended=()=>{clearActive();dock.classList.remove("show");dPlay.textContent="▶";};
  audio.ontimeupdate=()=>{
    const end=previewStart+PREVIEW_SEC;
    if(audio.duration&&audio.currentTime>=end){
      audio.pause();audio.currentTime=0;          // hard stop at end of the random window
      clearActive();dock.classList.remove("show");dPlay.textContent="▶";
      dSub.textContent="preview ended — buy to hear all";
      return;
    }
    if(audio.duration)dSeek.value=(audio.currentTime/(audio.duration>PREVIEW_SEC?PREVIEW_SEC:audio.duration))*100;
  };
}
dSeek.addEventListener("input",()=>{
  if(audio.duration){
    const cap=audio.duration>PREVIEW_SEC?PREVIEW_SEC:audio.duration;
    // keep the user inside the preview window [previewStart, previewStart+PREVIEW_SEC]
    const lo=previewStart, hi=Math.min(previewStart+PREVIEW_SEC,audio.duration);
    audio.currentTime=Math.min(Math.max((dSeek.value/100)*audio.duration,lo),hi);
    if(audio.currentTime>=hi)audio.currentTime=lo; // wrap to window start if dragged past
  }
});
dPlay.addEventListener("click",()=>{if(audio.paused)audio.play();else audio.pause();});
dPlay.addEventListener("click",()=>{dPlay.textContent=audio.paused?"▶":"⏸";});
$("#dClose").addEventListener("click",()=>{audio.pause();clearActive();dock.classList.remove("show");});

/* ======================= EVENT DELEGATION ======================= */
document.addEventListener("click",e=>{
  const play=e.target.closest("[data-track]");
  if(play){loadAndPlay(play);return;}
  const trigger=e.target.closest("[data-license-trigger]");
  if(trigger){openLicenseModal(trigger.dataset.beat);return;}
  const demoBuy=e.target.closest("[data-buydemo]");
  if(demoBuy){toast("Demo mode — add your Snipcart public API key in site CONFIG to enable the cart");return;}
});

/* ======================= CONTACT FORM ======================= */
function handleContact(e){
  e.preventDefault();
  const f=e.target;
  const name=f.name.value.trim(), email=f.email.value.trim(), type=f.type.value, msg=f.msg.value.trim();
  const note=document.getElementById("formNote");
  const subject="ZxmiiBlikk site — "+type;
  const body=name+" ("+email+")\n\n"+msg;
  note.textContent="Opening your email app…";
  note.classList.add("ok");
  window.location.href="mailto:slime@trifexta.net?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  setTimeout(()=>{note.textContent="If your mail app didn't open, email slime@trifexta.net directly.";},1200);
  return false;
}

/* ======================= COOL LAYER JS ======================= */
(function(){
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Cursor glow (desktop, pointer-fine only)
  if(!reduce && matchMedia("(pointer:fine)").matches){
    const glow=document.createElement("div");
    glow.id="cursorGlow";
    document.body.appendChild(glow);
    let raf;
    addEventListener("mousemove",e=>{
      glow.style.opacity="1";
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{glow.style.left=e.clientX+"px";glow.style.top=e.clientY+"px";});
    });
    addEventListener("mouseleave",()=>glow.style.opacity="0");
  }
  // Scroll reveal + staggered groups
  if(!reduce && "IntersectionObserver" in window){
    const io=new IntersectionObserver((es)=>{
      es.forEach(en=>{
        if(en.isIntersecting){
          en.target.classList.add("in");   // container .in cascades children via .stagger.in > *
          io.unobserve(en.target);
        }
      });
    },{threshold:.12,rootMargin:"0px 0px -8% 0px"});
    document.querySelectorAll(".reveal,.stagger").forEach(el=>io.observe(el));
  } else {
    // No IO / reduced motion: just show everything
    document.querySelectorAll(".reveal,.stagger").forEach(el=>el.classList.add("in"));
  }
  // Scroll progress bar + parallax (motion-aware, throttled with rAF)
  (function(){
    const bar=document.querySelector(".scroll-progress");
    const pars=[...document.querySelectorAll(".parallax")];
    let ticking=false;
    function update(){
      const de=document.documentElement;
      const max=de.scrollHeight-de.clientHeight;
      const p=max>0?Math.min(1,(window.scrollY||de.scrollTop||document.body.scrollTop)/max):0;
      if(bar) bar.style.setProperty("--p",p.toFixed(4));
      if(!reduce){
        const y=window.scrollY||de.scrollTop;
        pars.forEach(el=>{const sp=parseFloat(el.dataset.speed||"0.12");el.style.setProperty("--py",(y*sp).toFixed(1));});
      }
      ticking=false;
    }
    addEventListener("scroll",()=>{if(!ticking){ticking=true;requestAnimationFrame(update);}},{passive:true});
    update();
  })();
  // Card pointer-tracked glow
  document.querySelectorAll(".card").forEach(card=>{
    card.addEventListener("mousemove",e=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty("--mx",(e.clientX-r.left)+"px");
      card.style.setProperty("--my",(e.clientY-r.top)+"px");
    });
  });
})();

/* ======================= LICENSE MODAL ======================= */
/* Opens when a beat's "Choose license" button is clicked. Lets the buyer pick a
   tier (MP3/WAV/Unlimited/Exclusive), accept the applicable agreement (not pre-checked),
   then adds THAT beat+license as a unique Snipcart product (beat-<id>-<tier>). */
let licenseModal, licenseLastFocus, licenseBeat, licenseTier=null;

function buildLicenseModal(){
  if(licenseModal) return;
  licenseModal=document.createElement("div");
  licenseModal.className="license-modal";
  licenseModal.setAttribute("role","dialog");
  licenseModal.setAttribute("aria-modal","true");
  licenseModal.setAttribute("aria-labelledby","lmTitle");
  licenseModal.innerHTML=`
    <div class="lm-backdrop" data-lm-close></div>
    <div class="lm-panel" role="document">
      <button class="lm-close" data-lm-close aria-label="Close license picker">✕</button>
      <div class="lm-head">
        <span class="eyebrow">Choose your license</span>
        <h3 id="lmTitle">—</h3>
      </div>
      <div class="lm-tiers" id="lmTiers"></div>
      <button class="lm-compare" type="button" id="lmCompare">Compare all licenses ↓</button>
      <div class="lm-compare-table" id="lmCompareTable" hidden></div>
      <div class="lm-foot">
        <label class="lm-agree">
          <input type="checkbox" id="lmAgree">
          <span>I have read and agree to the <a id="lmAgreeLink" href="#" target="_blank" rel="noopener">license agreement</a>.</span>
        </label>
        <button class="btn btn-primary lm-add" id="lmAdd" disabled>Add to cart</button>
      </div>
      <p class="lm-footnote">Content ID restrictions apply. Non-exclusive licenses may not be registered with automated fingerprinting systems in a way that claims against TR!FEXTA or other licensees without written authorization.</p>
    </div>`;
  document.body.appendChild(licenseModal);

  licenseModal.querySelectorAll("[data-lm-close]").forEach(el=>el.addEventListener("click",closeLicenseModal));
  licenseModal.querySelector("#lmCompare").addEventListener("click",toggleCompare);
  licenseModal.querySelector("#lmAdd").addEventListener("click",addSelectedLicense);
  licenseModal.querySelector("#lmAgree").addEventListener("change",updateAddState);
  // focus trap
  licenseModal.addEventListener("keydown",e=>{
    if(e.key==="Escape"){closeLicenseModal();return;}
    if(e.key==="Tab"){trapFocus(e);}
  });
}

function trapFocus(e){
  const f=licenseModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if(!f.length) return;
  const first=f[0], last=f[f.length-1];
  if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
}

function openLicenseModal(beatId){
  buildLicenseModal();
  const b=BEATS.find(x=>x.id===beatId); if(!b) return;
  licenseBeat=b; licenseTier=null;
  licenseLastFocus=document.activeElement;
  licenseModal.querySelector("#lmTitle").textContent=b.name;
  licenseModal.querySelector("#lmCompareTable").hidden=true;
  licenseModal.querySelector("#lmCompare").textContent="Compare all licenses ↓";

  const tiers=licenseModal.querySelector("#lmTiers");
  tiers.innerHTML="";
  ["mp3","wav","unlimited","exclusive"].forEach(tier=>{
    const t=LICENSE_TIERS[tier];
    const enabled=tierEnabled(b,tier) && !exclusiveSold(b) && !beatOffline(b);
    const card=document.createElement("div");
    card.className="lm-tier"+(t.exclusive?" exclusive":"")+(enabled?"":" disabled");
    card.setAttribute("role","radio");
    card.setAttribute("aria-checked","false");
    card.setAttribute("tabindex",enabled?"0":"-1");
    card.dataset.tier=tier;
    card.innerHTML=`
      <div class="lm-tier-top">
        <div>
          <div class="lm-tier-name">${t.label}</div>
          <div class="lm-tier-price">${money(tierPrice(b,tier))}${tier==="exclusive"?"+":""}</div>
        </div>
        <div class="lm-tier-files">${t.files.join(" · ")}</div>
      </div>
      <ul class="lm-bullets">${t.bullets.map(x=>`<li>${x}</li>`).join("")}</ul>
      ${t.exclusive?`<p class="lm-warn">${t.warning}</p>`:``}
      <button type="button" class="lm-select btn btn-sm ${enabled?"btn-primary":"btn-ghost"}" ${enabled?"":"disabled"}>${enabled?"Select":"Unavailable"}</button>`;
    if(enabled){
      card.addEventListener("click",()=>selectTier(tier));
      card.querySelector(".lm-select").addEventListener("click",ev=>{ev.stopPropagation();selectTier(tier);});
      card.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();selectTier(tier);}});
    }
    tiers.appendChild(card);
  });

  // reset agreement + add button
  const agree=licenseModal.querySelector("#lmAgree");
  agree.checked=false;
  licenseModal.querySelector("#lmAdd").disabled=true;
  licenseModal.querySelector("#lmAdd").textContent="Add to cart";

  licenseModal.classList.add("open");
  document.body.style.overflow="hidden";
  // focus first enabled tier
  const firstTier=tiers.querySelector('.lm-tier:not(.disabled)');
  if(firstTier) firstTier.focus();
}

function selectTier(tier){
  licenseTier=tier;
  const t=LICENSE_TIERS[tier];
  licenseModal.querySelectorAll(".lm-tier").forEach(c=>{
    const on=c.dataset.tier===tier;
    c.classList.toggle("sel",on);
    c.setAttribute("aria-checked",on?"true":"false");
  });
  // agreement link points to this tier's agreement
  const link=licenseModal.querySelector("#lmAgreeLink");
  link.href=t.agreement;
  link.textContent=t.label+" License Agreement";
  updateAddState();
}

function updateAddState(){
  const agree=licenseModal.querySelector("#lmAgree").checked;
  const btn=licenseModal.querySelector("#lmAdd");
  btn.disabled=!(licenseTier && agree);
}

function closeLicenseModal(){
  if(!licenseModal) return;
  licenseModal.classList.remove("open");
  document.body.style.overflow="";
  if(licenseLastFocus && licenseLastFocus.focus) licenseLastFocus.focus();
}

function toggleCompare(){
  const tbl=licenseModal.querySelector("#lmCompareTable");
  const btn=licenseModal.querySelector("#lmCompare");
  if(tbl.hidden){
    tbl.hidden=false; btn.textContent="Hide comparison ↑";
    const tiers=["mp3","wav","unlimited","exclusive"];
    const rows=tiers.map(t=>{
      const T=LICENSE_TIERS[t];
      return `<tr><th>${T.label}${T.exclusive?"+":""}</th><td>${money(tierPrice(licenseBeat,t))}</td><td>${T.files.join(", ")}</td><td>${T.bullets.join("; ")}</td></tr>`;
    }).join("");
    tbl.innerHTML=`<table class="lm-table"><thead><tr><th>License</th><th>Price</th><th>Files</th><th>Rights</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else { tbl.hidden=true; btn.textContent="Compare all licenses ↓"; }
}

function addSelectedLicense(){
  if(!licenseTier || !licenseBeat) return;
  const b=licenseBeat, tier=licenseTier, T=LICENSE_TIERS[tier];
  if(!tierEnabled(b,tier) || exclusiveSold(b) || beatOffline(b)) return;
  if(!licenseModal.querySelector("#lmAgree").checked){ toast("Please accept the license agreement."); return; }
  const guid=deliveryGuid(b,tier);
  if(!guid){ toast("This file isn't ready yet — contact TR!FEXTA."); return; }
  // Build a native Snipcart add button and click it (same path as the working test checkout).
  const btn=document.createElement("button");
  btn.className="snipcart-add-item";
  btn.style.display="none";
  btn.setAttribute("data-item-id", `${b.id}-${tier}`);
  btn.setAttribute("data-item-name", `${b.name} — ${T.label}`);
  btn.setAttribute("data-item-price", tierPrice(b,tier));
  btn.setAttribute("data-item-description", `${T.label} for ${b.name}. ${T.bullets.join(". ")}. ${T.note}`);
  btn.setAttribute("data-item-url", CONFIG.storeUrl+"beats.html");
  btn.setAttribute("data-item-image", CONFIG.storeUrl+"assets/img/album-cover.jpg");
  btn.setAttribute("data-item-file-guid", guid);
  btn.setAttribute("data-item-max-quantity","1");
  btn.setAttribute("data-item-tangible","false");
  btn.setAttribute("data-item-shippable","false");
  btn.setAttribute("data-item-custom1-name","License");
  btn.setAttribute("data-item-custom1-value", T.label);
  document.body.appendChild(btn);
  btn.click();
  btn.remove();
  closeLicenseModal();
}

/* ======================= BOOT (render store + cart) ======================= */
function boot(){
  // Render product grids if present on this page
  const beatGrid=document.getElementById("beatGrid");
  if(beatGrid) BEATS.forEach(b=>beatGrid.appendChild(beatCard(b)));
  const merchGrid=document.getElementById("merchGrid");
  if(merchGrid) MERCH.forEach(m=>merchGrid.appendChild(merchCard(m)));
  // Authoritative exclusive state — fetch server truth, then re-render beats so the
  // EXCLUSIVE SOLD badge / disabled tiers reflect it without a manual refresh.
  if(beatGrid){
    fetchAvailability().then(()=>{
      if(beatGrid && beatGrid.children.length===BEATS.length){
        BEATS.forEach((b,i)=>{
          const fresh=beatCard(b);
          beatGrid.replaceChild(fresh, beatGrid.children[i]);
        });
      }
    });
  }
  // Hide DEMO badge when a real key is active
  const demoBadge=document.getElementById("demoBadge");
  if(demoBadge && !DEMO) demoBadge.style.display="none";
  // Load Snipcart (v3) only when a real key is set.
  // Use Snipcart's EXACT documented bootstrap (their own cdn.snipcart.com, NOT
  // jsdelivr — that URL 404s). Interpolate the key from CONFIG.
  if(!DEMO){
    // Admin test-mode swap: if a testKey is set AND ?mode=test (or ?test) is in the URL,
    // load the Snipcart TEST key instead of live — no redeploy needed to flip modes.
    const wantTest = /[?&](mode=test|test)(&|$)/.test(location.search);
    const activeKey = (CONFIG.testKey && wantTest) ? CONFIG.testKey : CONFIG.snipcartKey;
    window.SnipcartSettings = {
      publicApiKey: activeKey,
      loadStrategy: "on-user-interaction",
      version: "3.7.1"
    };
    const snip = document.createElement("script");
    snip.id = "snipcart-js";
    snip.textContent = "(function(){var c,d;(d=(c=window.SnipcartSettings).version)!=null||(c.version=\"3.0\");var s,S;(S=(s=window.SnipcartSettings).timeoutDuration)!=null||(s.timeoutDuration=2750);var l,p;(p=(l=window.SnipcartSettings).domain)!=null||(l.domain=\"cdn.snipcart.com\");var w,u;(u=(w=window.SnipcartSettings).protocol)!=null||(w.protocol=\"https\");var m,g;(g=(m=window.SnipcartSettings).loadCSS)!=null||(m.loadCSS=!0);var y=window.SnipcartSettings.version.includes(\"v3.0.0-ci\")||window.SnipcartSettings.version!=\"3.0\"&&window.SnipcartSettings.version.localeCompare(\"3.4.0\",void 0,{numeric:!0,sensitivity:\"base\"})===-1,f=[\"focus\",\"mouseover\",\"touchmove\",\"scroll\",\"keydown\"];window.LoadSnipcart=o;document.readyState==\"loading\"?document.addEventListener(\"DOMContentLoaded\",r):r();function r(){window.SnipcartSettings.loadStrategy?window.SnipcartSettings.loadStrategy==\"on-user-interaction\"&&(f.forEach(function(t){return document.addEventListener(t,o)}),setTimeout(o,window.SnipcartSettings.timeoutDuration)):o()}var a=!1;function o(){if(a)return;a=!0;let t=document.getElementsByTagName(\"head\")[0],n=document.querySelector(\"#snipcart\"),i=document.querySelector('script[src^=\"'+window.SnipcartSettings.protocol+\"://\"+window.SnipcartSettings.domain+'\"][src$=\"snipcart.js\"]'),e=document.querySelector('link[href^=\"'+window.SnipcartSettings.protocol+\"://\"+window.SnipcartSettings.domain+'\"][href$=\"snipcart.css\"]');n||(n=document.createElement(\"div\"),n.id=\"snipcart\",n.setAttribute(\"hidden\",\"true\"),document.body.appendChild(n)),h(n),i||(i=document.createElement(\"script\"),i.src=window.SnipcartSettings.protocol+\"://\"+window.SnipcartSettings.domain+\"/themes/v\"+window.SnipcartSettings.version+\"/default/snipcart.js\",i.async=!0,t.appendChild(i)),!e&&window.SnipcartSettings.loadCSS&&(e=document.createElement(\"link\"),e.rel=\"stylesheet\",e.type=\"text/css\",e.href=window.SnipcartSettings.protocol+\"://\"+window.SnipcartSettings.domain+\"/themes/v\"+window.SnipcartSettings.version+\"/default/snipcart.css\",t.prepend(e)),f.forEach(function(v){return document.removeEventListener(v,o)})}function h(t){!y||(t.dataset.apiKey=window.SnipcartSettings.publicApiKey,window.SnipcartSettings.addProductBehavior&&(t.dataset.configAddProductBehavior=window.SnipcartSettings.addProductBehavior),window.SnipcartSettings.modalStyle&&(t.dataset.configModalStyle=window.SnipcartSettings.modalStyle),window.SnipcartSettings.currency&&(t.dataset.currency=window.SnipcartSettings.currency),window.SnipcartSettings.templatesUrl&&(t.dataset.templatesUrl=window.SnipcartSettings.templatesUrl))}})();";
    document.body.appendChild(snip);
  }
  const yr=document.getElementById("yr");
  if(yr) yr.textContent=new Date().getFullYear();
}

/* Boot runs after the DOM is parsed (site.js is loaded at end of <body>).
   CONFIG stays the committed placeholder unless you paste a real key into
   CONFIG below or set it before this script runs. Optional gitignored
   assets/config.local.js can be included manually if you want a local-only
   key that never reaches git — see assets/config.local.js.example. */
boot();
