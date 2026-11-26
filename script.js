(() => {
  const P = window.PHOTOS || [], PER = P.length <= 9 ? 3 : 4;
  const $ = id => document.getElementById(id), pad = n => String(n).padStart(2, "0");
  const src = p => "./photos/" + p.src;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // White china-marker shapes for photos flagged with `pick` in photos.js.
  const marks = {
    circle: ["M12,52 C6,18 60,6 96,10 C140,14 150,44 142,70 C132,98 60,104 28,90 C6,80 4,50 22,30", "M10,50 C10,14 70,2 110,12 C150,24 146,76 110,92 C70,106 14,96 8,56 C6,40 16,24 34,18"],
    cross: ["M20,20 L130,92 M128,18 L24,94"]
  };
  const place = p => [p.place, p.year].filter(Boolean).join(" — ");

  $("total").textContent = `${pad(P.length)} frames ↓`;

  // Contact sheet
  const sheet = $("sheet"), strips = [];
  for (let s = 0; s < P.length; s += PER) {
    const group = P.slice(s, s + PER), n = s / PER, slots = Array.from({ length: PER }, (_, k) => group[k] || null);
    const row = document.createElement("section"); row.className = "row";
    row.innerHTML = `<p class="label"><span>Strip <b>${pad(n + 1)}</b></span><span>Frames ${pad(s + 1)}—${pad(s + group.length)}</span></p>`;
    const strip = document.createElement("div"); strip.className = "strip"; strip.style.setProperty("--n", PER); strip.style.setProperty("--r", [-.25, .2, -.12][n % 3] + "deg");
    const edge = pos => `<div class="edge ${pos}" aria-hidden="true">${slots.map((_, k) => pos === "top" ? `<span>LS 400 ▸ ${s + k + 1}</span><span>SAFETY FILM</span>` : `<span>▸ ${s + k + 1}A</span>`).join("")}</div>`;
    strip.innerHTML = `<div class="film">` + edge("top") + `<div class="frames">${slots.map((p, k) => { const i = s + k; if (!p) return `<div class="cell"><div class="frame blank"></div></div>`; const m = marks[p.pick]; return `<div class="cell">
      <button type="button" class="frame${p.h > p.w ? " portrait" : ""}" data-i="${i}" aria-label="Frame ${i + 1}: ${p.title}"><img src="${src(p)}" alt="" loading="lazy"></button>
      ${m ? `<svg class="mark" viewBox="0 0 150 110" preserveAspectRatio="none" aria-hidden="true"><path d="${m[i % m.length]}"/></svg>` : ""}
      ${p.note ? `<span class="note" aria-hidden="true">${p.note}</span>` : ""}</div>`; }).join("")}</div>` + edge("bottom") + `</div>`;
    row.append(strip); sheet.append(row); strips.push(strip);
  }

  // Index
  $("list").innerHTML = P.map((p, i) => `<li><button type="button" data-i="${i}"><span class="n">${pad(i + 1)}</span><span class="t">${p.title}</span><span class="w">${place(p)}</span></button></li>`).join("");

  // Reel
  const viewer = $("viewer"), reel = $("reel"), count = $("count"), prog = $("prog");
  reel.innerHTML = P.map((p, i) => `<section class="slide ${p.w === p.h ? "center" : i % 2 ? "even" : "odd"}"><div class="big" aria-hidden="true">${pad(i + 1)}</div>
    <figure><img data-src="${src(p)}" alt="${p.title}"></figure><div class="cap"><strong>${p.title}</strong><span>${place(p)}</span></div></section>`).join("")
    + `<section class="slide end"><div><h2>End of<br>reel</h2><button type="button" id="back">← Back to sheet</button></div></section>`;
  const slides = [...reel.children]; let cur = 0, lock = false, opener = null;
  const load = i => [i - 1, i, i + 1].forEach(k => { const im = slides[k] && slides[k].querySelector("img[data-src]"); if (im) { im.src = im.dataset.src; im.removeAttribute("data-src"); } });
  const go = (i, instant) => { cur = Math.max(0, Math.min(slides.length - 1, i)); load(cur); reel.scrollTo({ left: cur * reel.clientWidth, behavior: instant || reduce ? "instant" : "smooth" }); };
  const sync = () => { const i = Math.round(reel.scrollLeft / reel.clientWidth); cur = i; load(i);
    slides.forEach((s, k) => s.classList.toggle("on", k === i));
    count.textContent = `${pad(Math.min(i + 1, P.length))} / ${pad(P.length)}`; prog.style.width = ((i + 1) / slides.length * 100) + "%";
    if (!viewer.hidden) history.replaceState(null, "", i < P.length ? "#" + (i + 1) : "#end"); };
  function open(i, from) { opener = from || document.activeElement; viewer.hidden = false; document.body.classList.add("locked");
    viewer.classList.remove("opening"); void viewer.offsetWidth; viewer.classList.add("opening"); go(i, true); sync(); reel.focus({ preventScroll: true }); cursor.classList.remove("on"); peek.classList.remove("on"); }
  function close() { viewer.hidden = true; document.body.classList.remove("locked"); history.replaceState(null, "", location.pathname); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  reel.addEventListener("scroll", sync, { passive: true });
  viewer.addEventListener("wheel", e => { if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; e.preventDefault(); if (lock || Math.abs(e.deltaY) < 8) return; lock = true; go(cur + Math.sign(e.deltaY)); setTimeout(() => lock = false, 650); }, { passive: false });
  addEventListener("keydown", e => { if (viewer.hidden) return;
    if (e.key === "Escape") close(); else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(cur + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); } });
  addEventListener("resize", () => { if (!viewer.hidden) go(cur, true); });
  $("close").onclick = $("back").onclick = close;
  document.addEventListener("click", e => { const t = e.target.closest("[data-i],[data-play]"); if (!t || viewer.contains(t)) return; open(t.dataset.i ? +t.dataset.i : 0, t); });

  // Strips drift sideways as the page scrolls.
  let tick = false;
  const drift = () => { tick = false; if (reduce || innerWidth <= 760) return;
    strips.forEach((s, n) => { const r = s.parentElement.getBoundingClientRect(), t = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight)); s.style.setProperty("--x", (t * (n % 2 ? 4 : -4)).toFixed(2) + "vw"); }); };
  addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(drift); } }, { passive: true }); drift();

  // Loupe cursor over frames, floating preview over index titles.
  const cursor = $("cursor"), peek = $("peek"), peekImg = peek.querySelector("img");
  addEventListener("pointermove", e => { if (e.pointerType !== "mouse") return;
    cursor.style.translate = peek.style.translate = `${e.clientX}px ${e.clientY}px`;
    const f = e.target.closest && e.target.closest(".frame"), row = e.target.closest && e.target.closest("#list button");
    cursor.classList.toggle("on", !!f && viewer.hidden);
    if (row && viewer.hidden) { const p = P[+row.dataset.i]; if (!peekImg.src.endsWith(p.src)) peekImg.src = src(p); peek.classList.add("on"); } else peek.classList.remove("on"); }, { passive: true });
  document.addEventListener("pointerleave", () => { cursor.classList.remove("on"); peek.classList.remove("on"); });

  // Deep link: #3 opens the reel on frame 3.
  const h = parseInt(location.hash.slice(1), 10); if (h >= 1 && h <= P.length) open(h - 1, document.body);
})();
