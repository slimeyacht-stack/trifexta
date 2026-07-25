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
  storeUrl: "https://trifexta.net/"
};
let DEMO = CONFIG.snipcartKey.includes("YOUR_");

/* ======================= DATA ======================= */
const BEATS = [
  {id:"beat-midnight", name:"Midnight Static", meta:"140 BPM · Fm",     price:29.99, cls:"c1", src:"assets/audio/midnight.mp3"},
  {id:"beat-violet",   name:"Violet Hour",     meta:"92 BPM · C#min",   price:24.99, cls:"c2", src:"assets/audio/violet.mp3"},
  {id:"beat-concrete", name:"Concrete Rose",   meta:"120 BPM · Amin",   price:27.99, cls:"c3", src:"assets/audio/concrete.mp3"},
  {id:"beat-neon",     name:"Neon Noir",       meta:"150 BPM · Emin",   price:31.99, cls:"c1", src:"assets/audio/neon.mp3"},
  {id:"beat-lowtide",  name:"Low Tide",        meta:"85 BPM · Gmaj",    price:22.99, cls:"c2", src:"assets/audio/lowtide.mp3"},
  {id:"beat-afterglow",name:"Afterglow",       meta:"128 BPM · Dmin",   price:26.99, cls:"c3", src:"assets/audio/afterglow.mp3"}
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
  el.innerHTML=`
    <div class="cover ${b.cls}" data-wave>
      <button class="mini-play" data-track="${b.id}" data-title="${b.name}" data-src="${b.src}" aria-label="Preview ${b.name}">▶</button>
      <div class="wave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
    </div>
    <h3>${b.name}</h3>
    <div class="meta">${b.meta}</div>
    <div class="price">${money(b.price)}</div>
    <div class="buy-row">
      ${DEMO
        ? `<button class="btn btn-primary btn-sm" data-buydemo>Add to cart</button>`
        : `<button class="btn btn-primary btn-sm snipcart-add-item"
              data-item-id="${b.id}" data-item-name="${b.name}"
              data-item-price="${b.price}" data-item-url="${CONFIG.storeUrl}"
              data-item-description="${b.meta}">Add to cart</button>`}
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
              data-item-price="${m.price}" data-item-url="${CONFIG.storeUrl}"
              data-item-description="${m.meta}">Add to cart</button>`}
    </div>`;
  return el;
}

/* ======================= AUDIO ENGINE ======================= */
const audio = new Audio();
audio.preload="none";
const dock=$("#dock"), dTitle=$("#dTitle"), dSub=$("#dSub"), dPlay=$("#dPlay"), dSeek=$("#dSeek");
let currentBtn=null, currentWave=null;

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
  audio.play().then(()=>{
    dock.classList.add("show");
    dTitle.textContent=title; dSub.textContent="now playing";
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
  audio.ontimeupdate=()=>{if(audio.duration)dSeek.value=(audio.currentTime/audio.duration)*100;};
}
dSeek.addEventListener("input",()=>{if(audio.duration)audio.currentTime=(dSeek.value/100)*audio.duration;});
dPlay.addEventListener("click",()=>{if(audio.paused)audio.play();else audio.pause();});
dPlay.addEventListener("click",()=>{dPlay.textContent=audio.paused?"▶":"⏸";});
$("#dClose").addEventListener("click",()=>{audio.pause();clearActive();dock.classList.remove("show");});

/* ======================= EVENT DELEGATION ======================= */
document.addEventListener("click",e=>{
  const play=e.target.closest("[data-track]");
  if(play){loadAndPlay(play);return;}
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

/* ======================= SNIPCART (cart) ======================= */
(function(){
  if(DEMO) return; // don't load Snipcart until a real key is set
  const s=document.createElement("script");
  s.async=true;
  s.src="https://cdn.jsdelivr.net/npm/snipcart@3/dist/snipcart.min.js";
  s.dataset.apiKey=CONFIG.snipcartKey;
  document.body.appendChild(s);
  const d=document.createElement("div");
  d.hidden=true; d.id="snipcart"; d.dataset.apiKey=CONFIG.snipcartKey;
  document.body.appendChild(d);
})();

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
  // Scroll reveal
  if(!reduce && "IntersectionObserver" in window){
    const io=new IntersectionObserver((es)=>{
      es.forEach(en=>{if(en.isIntersecting){en.target.classList.add("in");io.unobserve(en.target);}});
    },{threshold:.12,rootMargin:"0px 0px -8% 0px"});
    document.querySelectorAll(".reveal").forEach(el=>io.observe(el));
  }
  // Card pointer-tracked glow
  document.querySelectorAll(".card").forEach(card=>{
    card.addEventListener("mousemove",e=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty("--mx",(e.clientX-r.left)+"px");
      card.style.setProperty("--my",(e.clientY-r.top)+"px");
    });
  });
})();

/* ======================= BOOT (render store + cart) ======================= */
function boot(){
  // Render product grids if present on this page
  const beatGrid=document.getElementById("beatGrid");
  if(beatGrid) BEATS.forEach(b=>beatGrid.appendChild(beatCard(b)));
  const merchGrid=document.getElementById("merchGrid");
  if(merchGrid) MERCH.forEach(m=>merchGrid.appendChild(merchCard(m)));
  // Hide DEMO badge when a real key is active
  const demoBadge=document.getElementById("demoBadge");
  if(demoBadge && !DEMO) demoBadge.style.display="none";
  // Load Snipcart only when a real key is set
  if(!DEMO){
    const s=document.createElement("script");
    s.async=true;
    s.src="https://cdn.jsdelivr.net/npm/snipcart@3/dist/snipcart.min.js";
    s.dataset.apiKey=CONFIG.snipcartKey;
    document.body.appendChild(s);
    const d=document.createElement("div");
    d.hidden=true; d.id="snipcart"; d.dataset.apiKey=CONFIG.snipcartKey;
    document.body.appendChild(d);
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
