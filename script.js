(() => {
  const P = window.PHOTOS || [], PER = P.length <= 9 ? 3 : 4;
  const $ = id => document.getElementById(id), pad = n => String(n).padStart(2, "0");
  const src = p => "./photos/" + p.src, place = p => [p.place, p.year].filter(Boolean).join(", ");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INOUT = "cubic-bezier(.76,0,.24,1)";

  // Hero name: one span per letter so each can rise in turn.
  let n = 0;
  document.querySelectorAll(".hero .w").forEach(w => { w.innerHTML = [...w.textContent].map(c => `<span class="ch" style="--i:${n++}">${c}</span>`).join(""); });

  // Contact sheet: strips of PER frames; unfilled slots stay as blank film.
  const sheet = $("sheet");
  for (let s = 0; s < P.length; s += PER) {
    const slots = Array.from({ length: PER }, (_, k) => P[s + k] || null), range = `${pad(s + 1)} — ${pad(Math.min(s + PER, P.length))}`;
    const row = document.createElement("section"); row.className = "row";
    const edge = pos => `<div class="edge ${pos}" aria-hidden="true">${slots.map((_, k) => pos === "top" ? `<span>LS 400 ▸ ${s + k + 1}</span><span>SAFETY FILM</span>` : `<span>▸ ${s + k + 1}A</span>`).join("")}</div>`;
    row.innerHTML = `<p class="label"><span>Sheet ${pad(s / PER + 1)}</span><span class="where" data-range="${range}">${range}</span></p>
      <div class="glide"><div class="strip" style="--n:${PER}"><div class="film">${edge("top")}<div class="frames">${slots.map((p, k) => !p ? `<div class="cell"><div class="frame blank"></div></div>` :
        `<div class="cell"><button type="button" class="frame${p.h > p.w ? " portrait" : ""}" style="--k:${k}" data-i="${s + k}" aria-label="${p.title}"><img src="${src(p)}" alt="" ${s ? 'loading="lazy"' : ""}></button></div>`).join("")}</div>${edge("bottom")}</div></div></div>`;
    sheet.append(row);
  }
  const frames = [...document.querySelectorAll(".frame[data-i]")], strips = [...document.querySelectorAll(".strip")];
  const frameOf = i => frames.find(f => +f.dataset.i === i);

  // Hovering a frame names it in the line above its strip.
  frames.forEach(f => { const where = f.closest(".row").querySelector(".where"), p = P[+f.dataset.i];
    const say = t => { if (where.textContent === t) return; where.textContent = t; if (!reduce) where.animate({ opacity: [0, 1] }, { duration: 600, easing: "ease" }); };
    f.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") say(`${pad(+f.dataset.i + 1)} — ${p.title}`); });
    f.addEventListener("pointerleave", () => say(where.dataset.range)); });

  // Index.
  $("total").textContent = `${pad(P.length)} photographs`;
  $("list").innerHTML = P.map((p, i) => `<li style="--i:${i}"><button type="button" data-i="${i}"><span class="n">${pad(i + 1)}</span><span class="t">${p.title}</span><span class="w">${place(p)}</span></button></li>`).join("");
  // The darkroom drawing beside the index prints whichever title the pointer rests on.
  $("list").addEventListener("pointerover", e => { const b = e.target.closest("button"); if (b && e.pointerType === "mouse") window.SHEET_HOVER = +b.dataset.i; });
  $("list").addEventListener("pointerleave", () => { window.SHEET_HOVER = null; });

  // Opening sequence starts once the type and the first strip are ready, then sections reveal as they enter.
  const first = frames.slice(0, PER).map(f => f.firstElementChild.decode ? f.firstElementChild.decode().catch(() => {}) : 0);
  Promise.race([Promise.all([document.fonts ? document.fonts.ready : 0, ...first]), new Promise(r => setTimeout(r, 2500))]).then(() => requestAnimationFrame(() => {
    document.body.classList.add("ready");
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .15 });
    document.querySelectorAll(".row, .index").forEach(el => io.observe(el));
    const lamp = new IntersectionObserver(es => { if (es[0].isIntersecting) { setTimeout(() => sheet.classList.add("lit"), 500); lamp.disconnect(); } }, { threshold: .02 }); lamp.observe(sheet);
  }));

  // Strips ease sideways with the scroll.
  const pos = strips.map(() => 0); let raf = 0;
  const drift = () => { raf = 0; if (reduce || innerWidth <= 760) return; let moving = false;
    strips.forEach((s, k) => { const r = s.parentElement.getBoundingClientRect(), t = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight)) * (k % 2 ? 2.4 : -2.4);
      pos[k] += (t - pos[k]) * .07; if (Math.abs(t - pos[k]) > .004) moving = true; s.style.setProperty("--x", pos[k].toFixed(3) + "vw"); });
    if (moving) raf = requestAnimationFrame(drift); };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(drift); }, { passive: true });

  // Viewer
  const viewer = $("viewer"), stage = $("stage"), num = $("num"), prog = $("prog");
  $("tot").textContent = pad(P.length);
  stage.innerHTML = P.map(p => `<section class="slide"><div class="print"><i class="paper"></i><figure><img data-src="${src(p)}" alt="${p.title}"></figure></div><div class="cap"><span class="clip"><em>${p.title}</em></span><span class="clip"><span>${place(p) || "&nbsp;"}</span></span></div></section>`).join("");
  const slides = [...stage.children], rects = []; let cur = 0, busy = false, opener = null;
  const load = i => [i - 1, i, i + 1].forEach(k => { const im = slides[k] && slides[k].querySelector("img[data-src]"); if (im) { im.src = im.dataset.src; delete im.dataset.src; } });
  const layout = () => { const W = innerWidth, H = innerHeight, small = W <= 760, px = small ? 16 : Math.max(18, Math.min(150, W * .09)), top = H * .09, bw = W - px * 2, bh = H * (small ? .69 : .72);
    const m = Math.round(Math.max(12, Math.min(26, Math.min(W, H) * .024)));   // paper margin around each print
    P.forEach((p, i) => { const s = Math.min((bw - 2 * m) / p.w, (bh - 2 * m) / p.h), w = p.w * s, h = p.h * s, r = rects[i] = { left: px + (bw - w) / 2, top: top + (bh - h) / 2, width: w, height: h }, st = slides[i].querySelector(".print").style;
      Object.assign(st, { left: r.left - m + "px", top: r.top - m + "px", width: r.width + 2 * m + "px", height: r.height + 2 * m + "px" }); st.setProperty("--m", m + "px"); }); };
  const px = r => ({ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  const visible = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const meter = (i, roll) => { prog.style.transform = `scaleX(${(i + 1) / P.length})`; const t = pad(i + 1);
    if (!roll || reduce) { num.textContent = t; return; }
    num.animate({ transform: ["none", "translateY(-110%)"] }, { duration: 420, easing: INOUT }).onfinish = () => { num.textContent = t; num.animate({ transform: ["translateY(110%)", "none"] }, { duration: 700, easing: "cubic-bezier(.16,1,.3,1)" }); }; };
  const clone = (i, r) => { const d = document.createElement("div"); d.className = "flip"; d.innerHTML = `<img src="${src(P[i])}" alt="">`; Object.assign(d.style, px(r)); document.body.append(d); return d; };

  function open(i, from) {
    if (busy || !viewer.hidden) return; opener = from || document.activeElement; cur = i; load(i); layout();
    slides.forEach((s, k) => { s.classList.toggle("on", k === i); s.classList.remove("capin"); }); meter(i);
    viewer.hidden = false; document.body.classList.add("locked"); history.replaceState(null, "", "#" + (i + 1));
    const f = frameOf(i), settle = () => { viewer.classList.remove("flipping"); viewer.classList.add("live"); slides[cur].classList.add("capin"); busy = false; $("close").focus({ preventScroll: true }); };
    if (reduce || !f || f.classList.contains("portrait") || !visible(f)) { void viewer.offsetWidth; viewer.classList.add("show"); settle(); return; }
    busy = true; const r0 = f.getBoundingClientRect(), c = clone(i, r0), im = slides[i].querySelector("img");
    viewer.classList.add("flipping"); void viewer.offsetWidth; viewer.classList.add("show"); f.classList.add("away");
    const a = c.animate([px(r0), px(rects[i])], { duration: 1250, easing: INOUT, fill: "forwards" });
    Promise.all([a.finished, im.decode ? im.decode().catch(() => {}) : 0]).then(() => { viewer.classList.remove("flipping"); requestAnimationFrame(() => { c.remove(); settle(); }); });
  }
  function close() {
    if (busy || viewer.hidden) return; const f = frameOf(cur);
    const done = () => { viewer.hidden = true; viewer.classList.remove("flipping"); frames.forEach(x => x.classList.remove("away")); document.body.classList.remove("locked"); busy = false; if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    history.replaceState(null, "", location.pathname); viewer.classList.remove("live"); slides[cur].classList.remove("capin"); frames.forEach(x => x.classList.remove("away")); busy = true;
    if (reduce || !f || f.classList.contains("portrait") || !visible(f)) { viewer.classList.remove("show"); setTimeout(done, reduce ? 0 : 900); return; }
    const c = clone(cur, rects[cur]); f.classList.add("away"); viewer.classList.add("flipping"); viewer.classList.remove("show");
    c.animate([px(rects[cur]), px(f.getBoundingClientRect())], { duration: 1150, easing: INOUT, fill: "forwards" }).onfinish = () => { done(); requestAnimationFrame(() => c.remove()); };
  }
  function show(i) {
    if (busy || i === cur || i < 0 || i >= P.length) return; const dir = i > cur ? 1 : -1, a = slides[cur], b = slides[i]; load(i); meter(i, true);
    history.replaceState(null, "", "#" + (i + 1));
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
  addEventListener("keydown", e => { if (viewer.hidden) return;
    if (e.key === "Escape") close(); else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); show(cur + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); show(cur - 1); } });
  addEventListener("resize", () => { if (!viewer.hidden) layout(); });
  $("close").onclick = close; $("prev").onclick = () => show(cur - 1); $("next").onclick = () => show(cur + 1);
  document.addEventListener("click", e => { const t = e.target.closest("[data-i]"); if (t && !viewer.contains(t)) open(+t.dataset.i, t); });

  // Deep link: #3 opens photograph 3.
  const h = parseInt(location.hash.slice(1), 10); if (h >= 1 && h <= P.length) open(h - 1, document.body);
})();
