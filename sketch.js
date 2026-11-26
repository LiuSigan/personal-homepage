// Hero drawing: line models of two cameras and a film cassette, sketched stroke by stroke,
// turned once in space, then erased. Pure canvas; no assets.
(() => {
  const cv = document.getElementById("sketch"); if (!cv) return;
  const ctx = cv.getContext("2d"), plate = document.getElementById("plate");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, TAU = Math.PI * 2;
  let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, jit = a => (rnd() - .5) * 2 * a;
  const clamp = v => Math.max(0, Math.min(1, v)), inout = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, out = t => 1 - Math.pow(1 - t, 3);

  // ---- geometry helpers (model space: x right, y up, z toward the viewer)
  const seg = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 8)), o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); } return o; };
  const path = (pts, closed) => { const P = closed ? [...pts, pts[0]] : pts; let o = []; for (let i = 0; i < P.length - 1; i++) { const s = seg(P[i], P[i + 1]); if (i) s.shift(); o = o.concat(s); } return o; };
  const ring = (c, r, ax, n = 44) => { const o = []; for (let i = 0; i <= n; i++) { const a = i / n * TAU, u = Math.cos(a) * r, v = Math.sin(a) * r; o.push(ax === "z" ? [c[0] + u, c[1] + v, c[2]] : [c[0] + u, c[1], c[2] + v]); } return o; };
  const rrect = (w, d, r, y) => { const o = [], hw = w / 2 - r, hd = d / 2 - r;
    [[hw, hd], [-hw, hd], [-hw, -hd], [hw, -hd]].forEach(([x, z], q) => { for (let i = 0; i <= 5; i++) { const a = (q + i / 5) * Math.PI / 2; o.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); } }); return path(o, true); };
  const plen = P => { let l = 0; for (let i = 1; i < P.length; i++) l += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); return l; };
  // A second, slightly wandering pass of the same stroke, like a pencil going over a line twice.
  const wander = (P, closed, len) => { const m = Math.min(.95, len * .035), v = () => [jit(m), jit(m), jit(m)], A = v(), B = closed ? A : v(), N = v(), k = 1 + Math.floor(rnd() * 2), n = P.length - 1;
    const o = P.map((p, i) => { const t = i / n, s = Math.sin(t * Math.PI * k); return [p[0] + A[0] * (1 - t) + B[0] * t + N[0] * s, p[1] + A[1] * (1 - t) + B[1] * t + N[1] * s, p[2] + A[2] * (1 - t) + B[2] * t + N[2] * s]; });
    if (!closed && n > 0 && len > 10) { const e = (a, b) => { const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) || 1, f = 2.4 / d; return [a[0] + (a[0] - b[0]) * f, a[1] + (a[1] - b[1]) * f, a[2] + (a[2] - b[2]) * f]; }; o.unshift(e(o[0], o[1])); o.push(e(o[o.length - 1], o[o.length - 2])); }
    return o; };

  function model(name, note, drawMs, build) {
    const S = [], add = (pts, closed) => S.push({ pts, closed: !!closed });
    const g = {
      line: (...p) => add(path(p)), loop: (...p) => add(path(p, true), true),
      ring: (c, r, ax) => add(ring(c, r, ax), true), rrect: (w, d, r, y) => add(rrect(w, d, r, y), true),
      rect: (x0, y0, x1, y1, z) => add(path([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], true), true),
      // Cylinder along z or y: two end rings plus two outline edges found per frame, so it always reads as a solid.
      cyl: (c, len, r, ax) => { const e = ax === "z" ? [c[0], c[1], c[2] + len] : [c[0], c[1] + len, c[2]]; add(ring(c, r, ax), true); add(ring(e, r, ax), true); S.push({ sil: [c, e, r, 1] }, { sil: [c, e, r, -1] }); },
      shell: (w, d, r, top, base, seams) => { g.rrect(w, d, r, top); g.rrect(w, d, r, base);
        [[w / 2, d / 2 - r], [w / 2 - r, d / 2], [r - w / 2, d / 2], [-w / 2, d / 2 - r], [-w / 2, r - d / 2], [r - w / 2, -d / 2], [w / 2 - r, -d / 2], [w / 2, r - d / 2]].forEach(([x, z]) => g.line([x, top, z], [x, base, z]));
        seams.forEach(y => g.rrect(w, d, r, y)); }
    };
    build(g); let total = 0;
    S.forEach(s => { s.len = s.sil ? Math.abs(plen([s.sil[0], s.sil[1]])) : plen(s.pts); s.at = total; total += s.len + 8; });
    S.forEach(s => { s.t0 = s.at / total * .76; if (!s.sil) s.alt = wander(s.pts, s.closed, s.len); });
    return { name, note, drawMs, S };
  }

  const fm2 = model("Nikon FM2", "35mm SLR — 1982", 4800, g => {
    const T = 22, B = -42;
    g.shell(142, 34, 9, T, B, [9, -35]);
    const pb = [[-25, T, 19], [25, T, 19], [25, T, -15], [-25, T, -15]], pt = [[-11, 47, 8], [11, 47, 8], [11, 47, -9], [-11, 47, -9]];   // pentaprism
    g.loop(...pb); g.loop(...pt); pb.forEach((p, i) => g.line(p, pt[i]));
    const q = (u, v) => { const a = pb[0], b = pb[1], c = pt[0], d = pt[1], lo = [a[0] + (b[0] - a[0]) * u, a[1], a[2]], hi = [c[0] + (d[0] - c[0]) * u, c[1], c[2]]; return [lo[0] + (hi[0] - lo[0]) * v, lo[1] + (hi[1] - lo[1]) * v, lo[2] + (hi[2] - lo[2]) * v + .3]; };
    g.loop(q(.16, .12), q(.84, .12), q(.8, .58), q(.2, .58));                                    // nameplate
    g.loop([-7, 47.6, 4], [7, 47.6, 4], [7, 47.6, -8], [-7, 47.6, -8]);                          // accessory shoe
    g.rect(-9, 25, 9, 37, -19); [[-9, 25], [9, 25], [9, 37], [-9, 37]].forEach(([x, y]) => g.line([x, y, -19], [x, y, -13]));   // eyepiece
    g.cyl([-37, T, -3], 8, 9.5, "y"); g.ring([-37, 30, -3], 6, "y");                             // shutter speed dial
    g.cyl([-51, T, 9], 2.5, 5.5, "y"); g.cyl([-51, 24.5, 9], 3, 3, "y");                         // shutter release
    g.cyl([-60, T, -5], 4, 7, "y");                                                              // advance lever
    g.line([-60, 26.6, -5], [-50, 26.6, -17], [-38, 26.6, -20], [-36, 26.6, -17], [-48, 26.6, -13], [-56, 26.6, -3]);
    g.cyl([50, T, -1], 5, 10, "y"); g.ring([50, 27, -1], 6, "y"); g.line([50, 27.6, -1], [58, 27.6, 5]); g.cyl([58, 27.6, 5], 4, 2.2, "y");   // rewind crank
    g.line([-71, 16, 4], [-77, 12, 4], [-71, 8, 4]); g.line([71, 16, 4], [77, 12, 4], [71, 8, 4]);   // strap lugs
    g.ring([-33, 3, 17.4], 3.2, "z"); g.line([-35, -1, 17.7], [-35, -21, 17.7], [-31, -21, 17.7], [-31, -1, 17.7]);   // self-timer
    g.ring([36, -2, 17.4], 3.6, "z");                                                            // lens release
    g.rect(-60, -37, 60, 6, -17.3); g.rect(-18, -24, 18, -6, -17.5);                             // film door, memo holder
    g.ring([0, B - .2, 0], 4, "y");
    g.cyl([0, -9, 17], 5, 28, "z"); g.cyl([0, -9, 22], 9, 31, "z"); g.cyl([0, -9, 31], 20, 32.5, "z");   // mount, aperture ring, focus ring
    [36, 41, 46].forEach(z => g.ring([0, -9, z], 32.5, "z"));
    g.cyl([0, -9, 51], 6, 30, "z"); g.ring([0, -9, 57], 25, "z"); g.ring([0, -9, 55], 18, "z"); g.ring([0, -9, 53], 10, "z");
  });

  const x100 = model("Fujifilm X100VI", "23mm fixed lens — 2024", 4600, g => {
    const T = 30, B = -37;
    g.shell(128, 32, 6, T, B, [14, -31]);
    g.rect(34, 13, 58, 27, 16.3); g.rect(36.5, 15.5, 55.5, 24.5, 16.3);                          // viewfinder window
    g.ring([22, 21, 16.3], 2.4, "z");
    g.ring([-24, 9, 16.3], 4.5, "z"); g.line([-24, 5, 16.6], [-24, -7, 16.6]);                    // viewfinder lever
    g.rect(-60, -31, -49, 12, 19.5); [[-60, -31], [-49, -31], [-49, 12], [-60, 12]].forEach(([x, y]) => g.line([x, y, 16], [x, y, 19.5]));   // grip
    g.cyl([-20, T, -1], 8, 12, "y"); g.ring([-20, 38, -1], 8, "y");                              // shutter speed dial
    g.cyl([-42, T, 6], 3, 7, "y"); g.cyl([-42, 33, 6], 3, 3.6, "y");                             // shutter release
    g.cyl([-54, T, -9], 6, 8, "y");                                                              // exposure compensation
    g.loop([-3, 30.6, 4], [17, 30.6, 4], [17, 30.6, -12], [-3, 30.6, -12]); g.line([1, 30.6, -12], [1, 30.6, 1], [13, 30.6, 1], [13, 30.6, -12]);   // hot shoe
    g.line([-64, 20, 3], [-70, 17, 3], [-64, 14, 3]); g.line([64, 20, 3], [70, 17, 3], [64, 14, 3]);
    g.rect(-28, -29, 44, 10, -16.3); g.rect(36, 13, 58, 27, -16.3); g.ring([47, 20, -16.4], 5, "z");   // screen, eyepiece
    [[-44, 10, 3], [-44, -2, 2.5], [-44, -13, 2.5]].forEach(([x, y, r]) => g.ring([x, y, -16.3], r, "z"));
    g.ring([8, B - .2, 0], 4, "y");
    g.cyl([8, -7, 16], 4, 27, "z"); g.cyl([8, -7, 20], 8, 25.5, "z"); g.cyl([8, -7, 28], 8, 24.5, "z"); g.ring([8, -7, 32], 24.5, "z");   // lens
    g.cyl([8, -7, 36], 3.5, 22.5, "z"); g.ring([8, -7, 39.5], 17, "z"); g.ring([8, -7, 38], 11, "z"); g.ring([8, -7, 37], 6, "z");
  });

  const FX = -88;
  const roll = model("35mm film", "36 exposures", 2600, g => {
    g.cyl([FX, -22, 0], 44, 12.5, "y"); g.ring([FX, 22, 0], 10.5, "y"); g.ring([FX, -22, 0], 10.5, "y");
    g.ring([FX, 14, 0], 12.5, "y"); g.ring([FX, -14, 0], 12.5, "y");
    g.cyl([FX, 22, 0], 5, 4.5, "y"); g.line([FX - 3, 27, 0], [FX + 3, 27, 0]); g.line([FX, 27, -3], [FX, 27, 3]);
    g.cyl([FX, -25, 0], 3, 4.5, "y");
    const a = FX + 2, b = FX + 19; g.rect(a, -22, b, 22, 13); g.rect(a, -22, b, 22, 9.5); [[a, -22], [b, -22], [b, 22], [a, 22]].forEach(([x, y]) => g.line([x, y, 9.5], [x, y, 13]));   // light trap
  });
  roll.film = true;
  // The film itself is rebuilt every frame from how far it has been pulled out.
  const film = L => { const o = [], X0 = FX + 19, P = (s, y) => [X0 + s, y, 11.2 + 11 * Math.sin(s / 48) * clamp(s / 50)], run = (s0, s1, y) => { const r = []; for (let s = s0; s < s1; s += 6) r.push(P(s, y)); r.push(P(s1, y)); return r; };
    if (L < 2) return o;
    if (L < 46) { o.push([...run(0, L, 17.5), ...run(0, L, -17.5).reverse()]); }
    else o.push([...run(0, L - 28, 17.5), P(L - 20, 1), P(L - 5, 1), P(L, -5), P(L, -12), P(L - 5, -17.5), ...run(0, L - 5, -17.5).reverse()]);
    for (let s = 5; s < L - 6; s += 6) { o.push([P(s, -16), P(s + 3.2, -16), P(s + 3.2, -13.2), P(s, -13.2), P(s, -16)]); if (s < L - 32) o.push([P(s, 16), P(s + 3.2, 16), P(s + 3.2, 13.2), P(s, 13.2), P(s, 16)]); }
    for (let s = 12; s + 36 < L - 32; s += 38) o.push([...run(s, s + 36, 11.5), ...run(s, s + 36, -11.5).reverse(), P(s, 11.5)]);
    return o; };

  // ---- drawing
  const M = [fm2, x100, roll], Y0 = -.56, P0 = .24, F = 520;
  let W = 0, H = 0, K = 1, dpr = 1;
  const size = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); K = Math.min(W / 205, H / 128); };
  function render(m, p, yaw, pitch, L) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.strokeStyle = "#ededed"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), ox = W / 2, oy = H / 2 + 3 * K;
    const tf = q => { const x = q[0] * cy + q[2] * sy, z = -q[0] * sy + q[2] * cy; return [x, q[1] * cp - z * sp, q[1] * sp + z * cp]; };
    const pj = v => { const s = F / (F - v[2]) * K; return [ox + v[0] * s, oy - v[1] * s, v[2]]; };
    const run = (Q, f, a, w) => { const n = Q.length - 1, m = f * n; ctx.lineWidth = w;
      for (let i = 0; i < n && i < m; i++) { const t = Math.min(1, m - i), A = Q[i], B = Q[i + 1];
        ctx.globalAlpha = a * (.2 + .8 * clamp(((A[2] + B[2]) / 2 + 75) / 150)); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t); ctx.stroke(); } };
    m.S.forEach(s => { const f = inout(clamp((p - s.t0) / .24)); if (f <= 0) return;
      if (s.sil) { const a = tf(s.sil[0]), b = tf(s.sil[1]), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), full = Math.hypot(dx, dy, b[2] - a[2]) || 1; if (l / full < .1) return;
        const nx = dy / l * s.sil[2] * s.sil[3], ny = -dx / l * s.sil[2] * s.sil[3]; run([pj([a[0] + nx, a[1] + ny, a[2]]), pj([b[0] + nx, b[1] + ny, b[2]])], f, .9, 1); return; }
      run(s.pts.map(q => pj(tf(q))), f, .88, 1); run(s.alt.map(q => pj(tf(q))), inout(clamp((p - s.t0 - .05) / .24)), .3, .7); });
    if (L) film(L).forEach(Q => run(Q.map(q => pj(tf(q))), 1, .8, .9));
    ctx.globalAlpha = 1;
  }

  // ---- timeline: draw, pause, one full turn, erase
  const HOLD = 450, SPIN = 10500, ERASE = 1500, GAP = 550;
  const $ = id => document.getElementById(id);
  let mi = 0, clock = 0, t0 = 0, last = 0, started = false, seen = true, label = -1;
  const caption = i => { label = i; $("plateNum").textContent = `0${i + 1} / 0${M.length}`; $("plateName").textContent = M[i].name; $("plateNote").textContent = M[i].note; };
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(64, now - last); last = now;
    if (!started || !seen || document.hidden || document.body.classList.contains("locked")) return;
    clock += dt; let m = M[mi], e = clock - t0; const total = m.drawMs + HOLD + SPIN + ERASE + GAP;
    if (e >= total) { mi = (mi + 1) % M.length; m = M[mi]; t0 = clock; e = 0; }
    if (label !== mi) caption(mi);
    let p = 1, yaw = Y0, L = 0; const a = m.drawMs, b = a + HOLD, c = b + SPIN, d = c + ERASE;
    if (e < a) { p = e / a; yaw = Y0 - .2 * (1 - out(p)); }
    else if (e >= b && e < c) { const u = (e - b) / SPIN; yaw = Y0 + TAU * inout(u); if (m.film) L = 168 * inout(clamp(u / .6)); }
    else if (e >= c && e < d) { const u = (e - c) / ERASE; p = 1 - u * u; if (m.film) L = 168 * (1 - inout(u)); }
    else if (e >= d) p = 0;
    plate.classList.toggle("on", e > 500 && e < c + 300);
    render(m, p, yaw, P0 + .035 * Math.sin(clock / 2400), L);
  }
  size(); addEventListener("resize", () => { size(); if (reduce) render(M[0], 1, Y0, P0, 0); });
  if (reduce) { caption(0); plate.classList.add("on"); render(M[0], 1, Y0, P0, 0); return; }
  new IntersectionObserver(es => { seen = es[0].isIntersecting; }).observe(cv);
  const begin = () => setTimeout(() => { size(); started = true; t0 = clock; }, 1700);
  if (document.body.classList.contains("ready")) begin(); else { const mo = new MutationObserver(() => { if (document.body.classList.contains("ready")) { mo.disconnect(); begin(); } }); mo.observe(document.body, { attributes: true, attributeFilter: ["class"] }); }
  requestAnimationFrame(t => { last = t; frame(t); });
})();
