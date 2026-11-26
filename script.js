(() => {
  // Flatten the series into one list; every photograph knows its series (s), its place in it (k) and overall (g).
  const S = window.SERIES || [], P = [];
  S.forEach((se, s) => { se.first = P.length; se.photos.forEach((p, k) => P.push(Object.assign({}, p, { src: se.folder + "/" + p.src, s, k, g: P.length }))); });
  window.PHOTOS = P;   // the darkroom drawing prints from this list
  const $ = id => document.getElementById(id), pad = n => String(n).padStart(2, "0");
  const src = p => "./photos/" + p.src, place = p => [p.place, p.year].filter(Boolean).join(", "), no = s => `Sheet ${pad(s + 1)}`, of = s => S[s].photos.map((_, k) => P[S[s].first + k]);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INOUT = "cubic-bezier(.76,0,.24,1)", OUT = "cubic-bezier(.16,1,.3,1)";

  // Hero name: one span per letter so each can rise in turn.
  let n = 0;
  document.querySelectorAll(".hero .w").forEach(w => { w.innerHTML = [...w.textContent].map(c => `<span class="ch" style="--i:${n++}">${c}</span>`).join(""); });
  $("series").textContent = S.length > 1 ? `${pad(S.length)} sheets — ${pad(P.length)} photographs` : S[0] ? `${no(0)} — ${S[0].name}` : "";

  // A length of film holding the given photographs; empty slots stay as blank film.
  const film = (list, k0, eager) => { const edge = pos => `<div class="edge ${pos}" aria-hidden="true">${list.map((_, i) => `<span class="eg">${pos === "top" ? `<i>LS 400 ▸ ${k0 + i + 1}</i><i>SAFETY FILM</i>` : `<i>▸ ${k0 + i + 1}A</i>`}</span>`).join("")}</div>`;
    return `<div class="film">${edge("top")}<div class="frames">${list.map((p, i) => !p ? `<div class="cell"><div class="frame blank"></div></div>` :
      `<div class="cell"><button type="button" class="frame${p.h > p.w ? " tall" : ""}" style="--k:${i}" data-g="${p.g}" aria-label="${p.title}"><img src="${src(p)}" alt="" ${eager ? "" : 'loading="lazy"'}></button></div>`).join("")}</div>${edge("bottom")}</div>`; };

  // ---- Home: one strip that shows one series at a time
  const sheet = $("sheet");
  sheet.innerHTML = `<section class="row"><p class="label"><button type="button" class="name" id="sName"></button><span class="tools"><span class="switch" id="sSwitch" hidden><button type="button" id="sPrev" aria-label="Previous sheet">←</button><span id="sCount"></span><button type="button" id="sNext" aria-label="Next sheet">→</button></span><button type="button" id="sView">View sheet</button><span class="where" id="where"></span></span></p>
    <div class="glide" id="glide"><div class="strip" id="strip"></div></div></section>`;
  const strip = $("strip"), glide = $("glide"), where = $("where"); let cs = 0, range = "", pos = 0, dwell = 0, wait = 3200, swapping = false;
  const say = t => { if (where.textContent === t) return; where.textContent = t; if (!reduce) where.animate({ opacity: [0, 1] }, { duration: 600, easing: "ease" }); };
  // Changing rolls: the strip runs off one side and the next series is pulled in from the other.
  function mount(s, dir) {
    const put = () => { cs = s; strip.innerHTML = film(of(s), 0, dir === undefined); strip.scrollLeft = pos = 0; dwell = 0; wait = 1500;
      $("sName").textContent = `${no(s)} — ${S[s].name}`; $("sCount").textContent = `${pad(s + 1)} / ${pad(S.length)}`; range = `01 — ${pad(S[s].photos.length)}`; where.textContent = range; };
    if (dir === undefined || reduce) return put();
    if (swapping) return; swapping = true;
    glide.animate({ transform: ["none", `translateX(${-104 * dir}vw)`] }, { duration: 750, easing: INOUT }).onfinish = () => { put(); glide.animate({ transform: [`translateX(${104 * dir}vw)`, "none"] }, { duration: 1100, easing: OUT }).onfinish = () => { swapping = false; }; };
  }
  if (S.length) mount(0);
  $("sSwitch").hidden = S.length < 2; $("sPrev").onclick = () => mount((cs - 1 + S.length) % S.length, -1); $("sNext").onclick = () => mount((cs + 1) % S.length, 1);
  strip.addEventListener("pointerover", e => { const f = e.target.closest(".frame[data-g]"); if (f && e.pointerType === "mouse") { const p = P[+f.dataset.g]; say(`${pad(p.k + 1)} — ${p.title}`); } });
  strip.addEventListener("pointerleave", () => say(range));
  // The strip plays by itself: it runs through the series once, then changes to the next. It waits while the
  // pointer is on it, while a finger has just moved it, while something is open over the page, and off screen.
  let hover = false, seen = false, touchAt = 0, lastT = 0;
  new IntersectionObserver(es => { seen = es[0].isIntersecting; }, { threshold: .2 }).observe(strip);
  strip.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") hover = true; }); strip.addEventListener("pointerleave", () => { hover = false; });
  strip.addEventListener("touchstart", () => { touchAt = Infinity; }, { passive: true }); strip.addEventListener("touchend", () => { touchAt = performance.now(); }, { passive: true });
  function play(now) { requestAnimationFrame(play); const dt = Math.min(64, now - lastT); lastT = now, B = document.body.classList;
    if (reduce || swapping || hover || !seen || document.hidden || B.contains("locked") || !B.contains("ready") || now - touchAt < 3500) return;
    if (wait > 0) { wait -= dt; return; }
    const max = strip.scrollWidth - strip.clientWidth, runs = max > 8;
    if (Math.abs(strip.scrollLeft - pos) > 3) pos = strip.scrollLeft;   // the visitor moved it
    if (runs && pos < max) { pos = Math.min(max, pos + max / Math.max(13000, Math.min(48000, S[cs].photos.length * 2200)) * dt); strip.scrollLeft = pos; return; }
    dwell += dt; if (dwell > (runs ? 1100 : 6500) && (S.length > 1 || runs)) mount((cs + 1) % S.length, 1);
  }
  requestAnimationFrame(t => { lastT = t; play(t); });

  // ---- Index: one row per series; a row opens to list its photographs
  $("total").textContent = S.length > 1 ? `${pad(S.length)} sheets — ${pad(P.length)} photographs` : `${pad(P.length)} photographs`;
  const list = $("list");
  list.innerHTML = S.map((se, s) => `<li class="ser${s ? "" : " open"}" style="--i:${s}"><button type="button" class="head" aria-expanded="${!s}"><span class="n">${pad(s + 1)}</span><span class="t">${se.name}</span><span class="w">${pad(se.photos.length)} photographs</span></button>
    <div class="body"><div><ol>${of(s).map(p => `<li><button type="button" data-g="${p.g}"><span class="n">${pad(p.k + 1)}</span><span class="t">${p.title}</span><span class="w">${place(p)}</span></button></li>`).join("")}</ol><button type="button" class="view" data-view="${s}">View sheet →</button></div></div></li>`).join("");
  list.addEventListener("click", e => { const h = e.target.closest(".head"); if (!h) return; const li = h.parentElement, on = !li.classList.contains("open");
    list.querySelectorAll(".ser").forEach(x => { x.classList.remove("open"); x.firstElementChild.setAttribute("aria-expanded", "false"); }); if (on) { li.classList.add("open"); h.setAttribute("aria-expanded", "true"); } });
  // The darkroom drawing beside the index prints whichever title the pointer rests on.
  list.addEventListener("pointerover", e => { const b = e.target.closest("button[data-g]"); if (b && e.pointerType === "mouse") window.SHEET_HOVER = +b.dataset.g; });
  list.addEventListener("pointerleave", () => { window.SHEET_HOVER = null; });

  // Opening sequence starts once the type and the first strip are ready, then sections reveal as they enter.
  const first = [...strip.querySelectorAll("img")].slice(0, 4).map(im => im.decode ? im.decode().catch(() => {}) : 0);
  Promise.race([Promise.all([document.fonts ? document.fonts.ready : 0, ...first]), new Promise(r => setTimeout(r, 2500))]).then(() => requestAnimationFrame(() => {
    document.body.classList.add("ready");
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .15 });
    document.querySelectorAll(".row, .index").forEach(el => io.observe(el));
    const lamp = new IntersectionObserver(es => { if (es[0].isIntersecting) { setTimeout(() => sheet.classList.add("lit"), 500); lamp.disconnect(); } }, { threshold: .02 }); lamp.observe(sheet);
  }));

  // ---- Whole sheet: every photograph of one series, four frames to a row
  const viewer = $("viewer"), sv = $("sheetview"), svInner = $("svInner"); let svOpen = -1, svFrom = null;
  const lock = () => document.body.classList.toggle("locked", !viewer.hidden || !sv.hidden);
  function openSheet(s, from) {
    if (svOpen >= 0 || !viewer.hidden || !S[s]) return; const all = of(s), per = innerWidth <= 760 ? 2 : 4, rows = [];
    for (let k = 0; k < all.length; k += per) { const r = all.slice(k, k + per); while (r.length < per) r.push(null); rows.push(`<div class="svrow" style="--r:${rows.length}">${film(r, k, rows.length < 2)}</div>`); }
    $("svName").textContent = `${no(s)} — ${S[s].name}`; $("svCount").textContent = `${pad(all.length)} photographs`; svInner.innerHTML = rows.join("");
    svOpen = s; svFrom = from || document.activeElement; sv.hidden = false; lock(); $("svScroll").scrollTop = 0; void sv.offsetWidth; sv.classList.add("show");
    history.replaceState(null, "", "#" + S[s].folder); $("svClose").focus({ preventScroll: true });
  }
  function closeSheet() {
    if (svOpen < 0) return; svOpen = -1; sv.classList.remove("show"); history.replaceState(null, "", location.pathname);
    setTimeout(() => { sv.hidden = true; svInner.innerHTML = ""; lock(); if (svFrom && svFrom.focus) svFrom.focus({ preventScroll: true }); }, reduce ? 0 : 700);
  }
  $("svClose").onclick = closeSheet; $("sName").onclick = $("sView").onclick = e => openSheet(cs, e.currentTarget);

  // ---- Viewer: one photograph at a time, across all series in order
  const stage = $("stage"), num = $("num"), prog = $("prog");
  stage.innerHTML = P.map(p => `<section class="slide"><div class="print"><i class="paper"></i><figure><img data-src="${src(p)}" alt="${p.title}"></figure></div><div class="cap"><span class="clip"><em>${p.title}</em></span><span class="clip"><span>${place(p) || "&nbsp;"}</span></span></div></section>`).join("");
  const slides = [...stage.children], rects = []; let cur = 0, busy = false, opener = null;
  const frameOf = g => (svOpen >= 0 ? svInner : strip).querySelector(`.frame[data-g="${g}"]`), unhide = () => document.querySelectorAll(".frame.away").forEach(x => x.classList.remove("away"));
  const address = g => "#" + S[P[g].s].folder + "/" + (P[g].k + 1);
  const load = i => [i - 1, i, i + 1].forEach(k => { const im = slides[k] && slides[k].querySelector("img[data-src]"); if (im) { im.src = im.dataset.src; delete im.dataset.src; } });
  const layout = () => { const W = innerWidth, H = innerHeight, small = W <= 760, px = small ? 16 : Math.max(18, Math.min(150, W * .09)), top = H * .09, bw = W - px * 2, bh = H * (small ? .69 : .72);
    const m = Math.round(Math.max(12, Math.min(26, Math.min(W, H) * .024)));   // paper margin around each print
    P.forEach((p, i) => { const s = Math.min((bw - 2 * m) / p.w, (bh - 2 * m) / p.h), w = p.w * s, h = p.h * s, r = rects[i] = { left: px + (bw - w) / 2, top: top + (bh - h) / 2, width: w, height: h }, st = slides[i].querySelector(".print").style;
      Object.assign(st, { left: r.left - m + "px", top: r.top - m + "px", width: r.width + 2 * m + "px", height: r.height + 2 * m + "px" }); st.setProperty("--m", m + "px"); }); };
  const px = r => ({ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  const visible = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  // The counter and bar run within the photograph's own series; the line at top left names that series.
  const meter = (i, roll) => { const p = P[i], len = S[p.s].photos.length, t = pad(p.k + 1); prog.style.transform = `scaleX(${(p.k + 1) / len})`; $("tot").textContent = pad(len); $("vName").textContent = `${no(p.s)} — ${S[p.s].name}`;
    if (!roll || reduce) { num.textContent = t; return; }
    num.animate({ transform: ["none", "translateY(-110%)"] }, { duration: 420, easing: INOUT }).onfinish = () => { num.textContent = t; num.animate({ transform: ["translateY(110%)", "none"] }, { duration: 700, easing: OUT }); }; };
  const clone = (i, r) => { const d = document.createElement("div"); d.className = "flip"; d.innerHTML = `<img src="${src(P[i])}" alt="">`; Object.assign(d.style, px(r)); document.body.append(d); return d; };
  const flips = f => !reduce && f && !f.classList.contains("tall") && visible(f);   // the frame can grow into the viewer

  function open(i, from) {
    if (busy || !viewer.hidden || !P[i]) return; opener = from || document.activeElement; cur = i; load(i); layout();
    slides.forEach((s, k) => { s.classList.toggle("on", k === i); s.classList.remove("capin"); }); meter(i);
    viewer.hidden = false; lock(); history.replaceState(null, "", address(i));
    const f = frameOf(i), settle = () => { viewer.classList.remove("flipping"); viewer.classList.add("live"); slides[cur].classList.add("capin"); busy = false; $("close").focus({ preventScroll: true }); };
    if (!flips(f)) { void viewer.offsetWidth; viewer.classList.add("show"); settle(); return; }
    busy = true; const r0 = f.getBoundingClientRect(), c = clone(i, r0), im = slides[i].querySelector("img");
    viewer.classList.add("flipping"); void viewer.offsetWidth; viewer.classList.add("show"); f.classList.add("away");
    const a = c.animate([px(r0), px(rects[i])], { duration: 1250, easing: INOUT, fill: "forwards" });
    Promise.all([a.finished, im.decode ? im.decode().catch(() => {}) : 0]).then(() => { viewer.classList.remove("flipping"); requestAnimationFrame(() => { c.remove(); settle(); }); });
  }
  function close() {
    if (busy || viewer.hidden) return; const f = frameOf(cur);
    const done = () => { viewer.hidden = true; viewer.classList.remove("flipping"); unhide(); lock(); busy = false; if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    history.replaceState(null, "", svOpen >= 0 ? "#" + S[svOpen].folder : location.pathname); viewer.classList.remove("live"); slides[cur].classList.remove("capin"); unhide(); busy = true;
    if (!flips(f)) { viewer.classList.remove("show"); setTimeout(done, reduce ? 0 : 900); return; }
    const c = clone(cur, rects[cur]); f.classList.add("away"); viewer.classList.add("flipping"); viewer.classList.remove("show");
    c.animate([px(rects[cur]), px(f.getBoundingClientRect())], { duration: 1150, easing: INOUT, fill: "forwards" }).onfinish = () => { done(); requestAnimationFrame(() => c.remove()); };
  }
  function show(i) {
    if (busy || i === cur || i < 0 || i >= P.length) return; const dir = i > cur ? 1 : -1, a = slides[cur], b = slides[i]; load(i); meter(i, true);
    history.replaceState(null, "", address(i));
    if (reduce) { a.classList.remove("on", "capin"); b.classList.add("on", "capin"); cur = i; return; }
    busy = true; const fa = a.querySelector(".print"), fb = b.querySelector(".print"), ia = a.querySelector("img"), ib = b.querySelector("img"), o = { duration: 1400, easing: INOUT, fill: "both" };
    const gone = dir > 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)", come = dir > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
    a.classList.remove("capin"); b.classList.add("on"); setTimeout(() => b.classList.add("capin"), 650);
    const anims = [fa.animate({ clipPath: ["inset(0)", gone] }, o), ia.animate({ transform: ["none", `translateX(${-14 * dir}%)`] }, o),
      fb.animate({ clipPath: [come, "inset(0)"] }, o), ib.animate({ transform: [`translateX(${16 * dir}%) scale(1.1)`, "none"] }, o)];
    anims[2].onfinish = () => { a.classList.remove("on"); anims.forEach(x => x.cancel()); cur = i; busy = false; };
  }
  let wheelAt = 0, touchX = null;
  viewer.addEventListener("wheel", e => { e.preventDefault(); const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX, now = Date.now(); if (Math.abs(d) < 8 || now - wheelAt < 900) return; wheelAt = now; show(cur + Math.sign(d)); }, { passive: false });
  stage.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", e => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); }, { passive: true });
  addEventListener("keydown", e => { if (viewer.hidden) { if (e.key === "Escape") closeSheet(); return; }
    if (e.key === "Escape") close(); else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); show(cur + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); show(cur - 1); } });
  addEventListener("resize", () => { if (!viewer.hidden) layout(); });
  $("close").onclick = close; $("prev").onclick = () => show(cur - 1); $("next").onclick = () => show(cur + 1);
  document.addEventListener("click", e => { if (viewer.contains(e.target)) return; const f = e.target.closest("[data-g]"); if (f) return open(+f.dataset.g, f); const v = e.target.closest("[data-view]"); if (v) openSheet(+v.dataset.view, v); });

  // Addresses: #folder opens that series' sheet, #folder/3 its third photograph.
  const [folder, k] = decodeURIComponent(location.hash.slice(1)).split("/"), s = S.findIndex(se => se.folder === folder);
  if (s >= 0) { if (k && S[s].photos[k - 1]) open(S[s].first + (k - 1), document.body); else openSheet(s, document.body); }
})();
