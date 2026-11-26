(() => {
  const P = window.PHOTOS || [], PER = P.length <= 9 ? 3 : 4;
  const $ = id => document.getElementById(id), pad = n => String(n).padStart(2, "0");
  const src = p => "./photos/" + p.src, place = p => [p.place, p.year].filter(Boolean).join(", ");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("total").textContent = `${pad(P.length)} photographs`;

  // Contact sheet: strips of PER frames; unfilled slots stay as blank film.
  const sheet = $("sheet");
  for (let s = 0; s < P.length; s += PER) {
    const slots = Array.from({ length: PER }, (_, k) => P[s + k] || null), last = Math.min(s + PER, P.length);
    const row = document.createElement("section"); row.className = "row";
    const edge = pos => `<div class="edge ${pos}" aria-hidden="true">${slots.map((_, k) => pos === "top" ? `<span>LS 400 ▸ ${s + k + 1}</span><span>SAFETY FILM</span>` : `<span>▸ ${s + k + 1}A</span>`).join("")}</div>`;
    row.innerHTML = `<p class="label"><span>Sheet ${pad(s / PER + 1)}</span><span>${pad(s + 1)} — ${pad(last)}</span></p>
      <div class="strip" style="--n:${PER}"><div class="film">${edge("top")}<div class="frames">${slots.map((p, k) => !p ? `<div class="cell"><div class="frame blank"></div></div>` :
        `<div class="cell"><button type="button" class="frame${p.h > p.w ? " portrait" : ""}" data-i="${s + k}" aria-label="${p.title}"><img src="${src(p)}" alt="" loading="lazy"></button></div>`).join("")}</div>${edge("bottom")}</div></div>`;
    sheet.append(row);
  }

  $("list").innerHTML = P.map((p, i) => `<li><button type="button" data-i="${i}"><span class="n">${pad(i + 1)}</span><span class="t">${p.title}</span><span class="w">${place(p)}</span></button></li>`).join("");

  // Full-screen viewer: one photograph at a time, moving sideways.
  const viewer = $("viewer"), reel = $("reel"), count = $("count"), prog = $("prog");
  reel.innerHTML = P.map(p => `<section class="slide"><figure><img data-src="${src(p)}" alt="${p.title}"></figure><div class="cap"><em>${p.title}</em><span>${place(p)}</span></div></section>`).join("");
  const slides = [...reel.children]; let cur = 0, lock = false, opener = null;
  const load = i => [i - 1, i, i + 1].forEach(k => { const im = slides[k] && slides[k].querySelector("img[data-src]"); if (im) { im.src = im.dataset.src; im.removeAttribute("data-src"); } });
  const go = (i, instant) => { cur = Math.max(0, Math.min(slides.length - 1, i)); load(cur); reel.scrollTo({ left: cur * reel.clientWidth, behavior: instant || reduce ? "instant" : "smooth" }); };
  const sync = () => { const i = Math.round(reel.scrollLeft / reel.clientWidth); cur = i; load(i);
    slides.forEach((s, k) => s.classList.toggle("on", k === i));
    count.textContent = `${pad(i + 1)} / ${pad(P.length)}`; prog.style.width = ((i + 1) / slides.length * 100) + "%";
    if (!viewer.hidden) history.replaceState(null, "", "#" + (i + 1)); };
  function open(i, from) { opener = from || document.activeElement; viewer.hidden = false; document.body.classList.add("locked"); go(i, true); sync(); reel.focus({ preventScroll: true }); }
  function close() { viewer.hidden = true; document.body.classList.remove("locked"); history.replaceState(null, "", location.pathname); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  reel.addEventListener("scroll", sync, { passive: true });
  viewer.addEventListener("wheel", e => { if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; e.preventDefault(); if (lock || Math.abs(e.deltaY) < 8) return; lock = true; go(cur + Math.sign(e.deltaY)); setTimeout(() => lock = false, 700); }, { passive: false });
  addEventListener("keydown", e => { if (viewer.hidden) return;
    if (e.key === "Escape") close(); else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(cur + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); } });
  addEventListener("resize", () => { if (!viewer.hidden) go(cur, true); });
  $("close").onclick = close; $("prev").onclick = () => go(cur - 1); $("next").onclick = () => go(cur + 1);
  document.addEventListener("click", e => { const t = e.target.closest("[data-i]"); if (t && !viewer.contains(t)) open(+t.dataset.i, t); });

  // Deep link: #3 opens photograph 3.
  const h = parseInt(location.hash.slice(1), 10); if (h >= 1 && h <= P.length) open(h - 1, document.body);
})();
