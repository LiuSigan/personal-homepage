// Line drawings for the page: objects are modelled in three dimensions as strokes, sketched in
// stroke by stroke on a canvas, moved, then erased. No image assets apart from the photographs.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, TAU = Math.PI * 2;
  let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, jit = a => (rnd() - .5) * 2 * a;
  const clamp = v => Math.max(0, Math.min(1, v)), inout = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, out = t => 1 - Math.pow(1 - t, 3);
  const $ = id => document.getElementById(id);

  // ---- geometry (model space: x right, y up, z toward the viewer)
  const seg = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 8)), o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); } return o; };
  const path = (pts, closed) => { const P = closed ? [...pts, pts[0]] : pts; let o = []; for (let i = 0; i < P.length - 1; i++) { const s = seg(P[i], P[i + 1]); if (i) s.shift(); o = o.concat(s); } return o; };
  const ring = (c, r, ax, n = 44) => { const o = []; for (let i = 0; i <= n; i++) { const a = i / n * TAU, u = Math.cos(a) * r, v = Math.sin(a) * r; o.push(ax === "z" ? [c[0] + u, c[1] + v, c[2]] : ax === "x" ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1], c[2] + v]); } return o; };
  const rrect = (w, d, r, y) => { const o = [], hw = w / 2 - r, hd = d / 2 - r;
    [[hw, hd], [-hw, hd], [-hw, -hd], [hw, -hd]].forEach(([x, z], q) => { for (let i = 0; i <= 5; i++) { const a = (q + i / 5) * Math.PI / 2; o.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); } }); return path(o, true); };
  const plen = P => { let l = 0; for (let i = 1; i < P.length; i++) l += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); return l; };
  // A second, slightly wandering pass of the same stroke, like a pencil going over a line twice.
  const wander = (P, closed, len) => { const m = Math.min(.95, len * .035), v = () => [jit(m), jit(m), jit(m)], A = v(), B = closed ? A : v(), N = v(), k = 1 + Math.floor(rnd() * 2), n = P.length - 1;
    const o = P.map((p, i) => { const t = i / n, s = Math.sin(t * Math.PI * k); return [p[0] + A[0] * (1 - t) + B[0] * t + N[0] * s, p[1] + A[1] * (1 - t) + B[1] * t + N[1] * s, p[2] + A[2] * (1 - t) + B[2] * t + N[2] * s]; });
    if (!closed && n > 0 && len > 10) { const e = (a, b) => { const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) || 1, f = 2.4 / d; return [a[0] + (a[0] - b[0]) * f, a[1] + (a[1] - b[1]) * f, a[2] + (a[2] - b[2]) * f]; }; o.unshift(e(o[0], o[1])); o.push(e(o[o.length - 1], o[o.length - 2])); }
    return o; };

  function model(build) {
    const S = [], add = (pts, closed) => S.push({ pts, closed: !!closed });
    const g = {
      line: (...p) => add(path(p)), loop: (...p) => add(path(p, true), true),
      ring: (c, r, ax) => add(ring(c, r, ax), true), rrect: (w, d, r, y) => add(rrect(w, d, r, y), true),
      rect: (x0, y0, x1, y1, z) => g.loop([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]),
      flat: (x0, z0, x1, z1, y) => g.loop([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]),
      box: (x0, y0, z0, x1, y1, z1) => { g.flat(x0, z0, x1, z1, y0); g.flat(x0, z0, x1, z1, y1); [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => g.line([x, y0, z], [x, y1, z])); },
      // Cylinder: two end rings plus two outline edges found per frame, so it always reads as a solid.
      cyl: (c, len, r, ax) => { const e = ax === "z" ? [c[0], c[1], c[2] + len] : ax === "x" ? [c[0] + len, c[1], c[2]] : [c[0], c[1] + len, c[2]]; add(ring(c, r, ax), true); add(ring(e, r, ax), true); S.push({ sil: [c, e, r, 1] }, { sil: [c, e, r, -1] }); },
      shell: (w, d, r, top, base, seams) => { g.rrect(w, d, r, top); g.rrect(w, d, r, base);
        [[w / 2, d / 2 - r], [w / 2 - r, d / 2], [r - w / 2, d / 2], [-w / 2, d / 2 - r], [-w / 2, r - d / 2], [r - w / 2, -d / 2], [w / 2 - r, -d / 2], [w / 2, r - d / 2]].forEach(([x, z]) => g.line([x, top, z], [x, base, z]));
        seams.forEach(y => g.rrect(w, d, r, y)); }
    };
    build(g); let total = 0;
    S.forEach(s => { s.len = s.sil ? plen([s.sil[0], s.sil[1]]) : plen(s.pts); s.at = total; total += s.len + 8; });
    S.forEach(s => { s.t0 = s.at / total * .76; if (!s.sil) s.alt = wander(s.pts, s.closed, s.len); });
    return { S };
  }
  // Rigid moves for parts of a scene.
  const rotZ = (a, cx = 0, cy = 0) => { const c = Math.cos(a), s = Math.sin(a); return q => [cx + (q[0] - cx) * c - (q[1] - cy) * s, cy + (q[0] - cx) * s + (q[1] - cy) * c, q[2]]; };
  const rotY = (a, cx = 0, cz = 0) => { const c = Math.cos(a), s = Math.sin(a); return q => [cx + (q[0] - cx) * c + (q[2] - cz) * s, q[1], cz - (q[0] - cx) * s + (q[2] - cz) * c]; };
  const rotX = (a, cy = 0, cz = 0) => { const c = Math.cos(a), s = Math.sin(a); return q => [q[0], cy + (q[1] - cy) * c - (q[2] - cz) * s, cz + (q[1] - cy) * s + (q[2] - cz) * c]; };
  const shift = (dx, dy, dz) => q => [q[0] + dx, q[1] + dy, q[2] + dz], chain = (...f) => q => f.reduce((v, g) => g(v), q);

  // A length of 35mm film laid along P(s, v): s runs along the strip, v across it.
  const filmStrip = (L, P, tongue) => { const o = [], run = (s0, s1, v) => { const r = []; for (let s = s0; s < s1; s += 6) r.push(P(s, v)); r.push(P(s1, v)); return r; };
    if (L < 2) return o; const cut = tongue && L >= 46, end = cut ? 32 : 4;
    if (cut) o.push([...run(0, L - 28, 17.5), P(L - 20, 1), P(L - 5, 1), P(L, -5), P(L, -12), P(L - 5, -17.5), ...run(0, L - 5, -17.5).reverse()]);
    else o.push([...run(0, L, 17.5), ...run(0, L, -17.5).reverse(), P(0, 17.5)]);
    for (let s = 5; s < L - 6; s += 6) { o.push([P(s, -16), P(s + 3.2, -16), P(s + 3.2, -13.2), P(s, -13.2), P(s, -16)]); if (s < L - end) o.push([P(s, 16), P(s + 3.2, 16), P(s + 3.2, 13.2), P(s, 13.2), P(s, 16)]); }
    for (let s = 12; s + 36 < L - end; s += 38) o.push([...run(s, s + 36, 11.5), ...run(s, s + 36, -11.5).reverse(), P(s, 11.5)]);
    return o; };

  // ---- a canvas to draw scenes on; dw x dh is the model-space size that should fit
  function stage(cv, dw, dh) {
    const ctx = cv.getContext("2d"), F = 520; let W = 0, H = 0, K0 = 1, K = 1, dpr = 1, cy = 1, sy = 0, cp = 1, sp = 0, lift = 0;
    const tf = q => { const x = q[0] * cy + q[2] * sy, z = -q[0] * sy + q[2] * cy, y = q[1] + lift; return [x, y * cp - z * sp, y * sp + z * cp]; };
    const pj = v => { const s = F / (F - v[2]) * K; return [W / 2 + v[0] * s, H / 2 + K - v[1] * s, v[2]]; };
    const map = (pts, xf) => pts.map(q => pj(tf(xf ? xf(q) : q)));
    const run = (Q, f, a, w) => { const n = Q.length - 1, m = f * n; ctx.lineWidth = w;
      for (let i = 0; i < n && i < m; i++) { const t = Math.min(1, m - i), A = Q[i], B = Q[i + 1];
        ctx.globalAlpha = a * (.34 + .66 * clamp(((A[2] + B[2]) / 2 + 75) / 150)); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t); ctx.stroke(); } };
    return {
      size() { const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); K0 = K = Math.min(W / dw, H / dh); },
      begin(yaw, pitch, dy = 0, zoom = 1) { K = K0 * zoom; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.strokeStyle = "#f0f0f0"; ctx.fillStyle = "#f1f1ef"; ctx.lineCap = ctx.lineJoin = "round"; cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch); lift = dy; },
      model(m, p, xf) { if (p <= 0) return; m.S.forEach(s => { const f = inout(clamp((p - s.t0) / .24)); if (f <= 0) return;
        if (s.sil) { const e = xf ? [xf(s.sil[0]), xf(s.sil[1])] : s.sil, a = tf(e[0]), b = tf(e[1]), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), full = Math.hypot(dx, dy, b[2] - a[2]) || 1; if (l / full < .1) return;
          const nx = dy / l * s.sil[2] * s.sil[3], ny = -dx / l * s.sil[2] * s.sil[3]; run([pj([a[0] + nx, a[1] + ny, a[2]]), pj([b[0] + nx, b[1] + ny, b[2]])], f, .9, 1); return; }
        run(map(s.pts, xf), f, .95, 1.1); run(map(s.alt, xf), inout(clamp((p - s.t0 - .05) / .24)), .36, .8); }); ctx.globalAlpha = 1; },
      poly(pts, a = .8, w = .9, xf, f = 1) { if (a > 0 && pts.length > 1) run(map(pts, xf), f, a, w); ctx.globalAlpha = 1; },
      fill(pts, a, xf) { if (a <= 0) return; const Q = map(pts, xf); ctx.globalAlpha = a; ctx.beginPath(); Q.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; },
      // Photograph mapped onto the parallelogram tl, tr, bl, cropped to that shape's proportions.
      image(img, tl, tr, bl, a, xf) { if (!img || !img.complete || !img.naturalWidth || a <= 0) return; const [A, B, C] = map([tl, tr, bl], xf), ar = plen([tl, tr]) / plen([tl, bl]);
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy0 = 0; if (sw / sh > ar) { const w = sh * ar; sx = (sw - w) / 2; sw = w; } else { const h = sw / ar; sy0 = (sh - h) / 2; sh = h; }
        ctx.save(); ctx.globalAlpha = a; ctx.setTransform(dpr * (B[0] - A[0]) / sw, dpr * (B[1] - A[1]) / sw, dpr * (C[0] - A[0]) / sh, dpr * (C[1] - A[1]) / sh, dpr * A[0], dpr * A[1]); ctx.drawImage(img, sx, sy0, sw, sh, 0, 0, sw, sh); ctx.restore(); }
    };
  }
  const watch = (cv, set) => new IntersectionObserver(es => set(es[0].isIntersecting)).observe(cv);
  const paused = () => document.hidden || document.body.classList.contains("locked");

  // ---- objects
  const cassette = (g, X) => { g.cyl([X, -22, 0], 44, 12.5, "y"); g.ring([X, 22, 0], 10.5, "y"); g.ring([X, -22, 0], 10.5, "y"); g.ring([X, 14, 0], 12.5, "y"); g.ring([X, -14, 0], 12.5, "y");
    g.cyl([X, 22, 0], 5, 4.5, "y"); g.line([X - 3, 27, 0], [X + 3, 27, 0]); g.line([X, 27, -3], [X, 27, 3]); g.cyl([X, -25, 0], 3, 4.5, "y");
    const a = X + 2, b = X + 19; g.rect(a, -22, b, 22, 13); g.rect(a, -22, b, 22, 9.5); [[a, -22], [b, -22], [b, 22], [a, 22]].forEach(([x, y]) => g.line([x, y, 9.5], [x, y, 13])); };

  const fm2 = model(g => {
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
  const x100 = model(g => {
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
  const FX = -88, roll = model(g => cassette(g, FX));

  // ---- hero: two cameras and a roll of film, each drawn, turned once, erased
  (() => {
    const cv = $("sketch"); if (!cv) return; const st = stage(cv, 195, 124), plate = $("plate"), Y0 = -.56, P0 = .24;
    const M = [{ m: fm2, name: "Nikon FM2", note: "35mm SLR — 1982", draw: 4800 }, { m: x100, name: "Fujifilm X100VI", note: "23mm fixed lens — 2024", draw: 4600 }, { m: roll, name: "35mm film", note: "36 exposures", draw: 2600, film: true }];
    const HOLD = 450, SPIN = 10500, ERASE = 1500, GAP = 550, lead = (s, v) => [FX + 19 + s, v, 11.2 + 11 * Math.sin(s / 48) * clamp(s / 50)];
    const show = (o, p, yaw, pitch, L) => { st.begin(yaw, pitch); st.model(o.m, p); if (L) filmStrip(L, lead, true).forEach(Q => st.poly(Q, .8)); };
    let mi = 0, clock = 0, t0 = 0, last = 0, started = false, seen = true, label = -1;
    const caption = i => { label = i; $("plateNum").textContent = `0${i + 1} / 0${M.length}`; $("plateName").textContent = M[i].name; $("plateNote").textContent = M[i].note; };
    function frame(now) {
      requestAnimationFrame(frame); const dt = Math.min(64, now - last); last = now; if (!started || !seen || paused()) return;
      clock += dt; let o = M[mi], e = clock - t0; if (e >= o.draw + HOLD + SPIN + ERASE + GAP) { mi = (mi + 1) % M.length; o = M[mi]; t0 = clock; e = 0; }
      if (label !== mi) caption(mi);
      let p = 1, yaw = Y0, L = 0; const a = o.draw, b = a + HOLD, c = b + SPIN, d = c + ERASE;
      if (e < a) { p = e / a; yaw = Y0 - .2 * (1 - out(p)); }
      else if (e >= b && e < c) { const u = (e - b) / SPIN; yaw = Y0 + TAU * inout(u); if (o.film) L = 168 * inout(clamp(u / .6)); }
      else if (e >= c && e < d) { const u = (e - c) / ERASE; p = 1 - u * u; if (o.film) L = 168 * (1 - inout(u)); }
      else if (e >= d) p = 0;
      plate.classList.toggle("on", e > 500 && e < c + 300); show(o, p, yaw, P0 + .035 * Math.sin(clock / 2400), L);
    }
    st.size(); addEventListener("resize", () => { st.size(); if (reduce) show(M[0], 1, Y0, P0, 0); });
    if (reduce) { caption(0); plate.classList.add("on"); show(M[0], 1, Y0, P0, 0); return; }
    watch(cv, v => { seen = v; });
    const begin = () => setTimeout(() => { st.size(); started = true; t0 = clock; }, 1700);
    if (document.body.classList.contains("ready")) begin(); else { const mo = new MutationObserver(() => { if (document.body.classList.contains("ready")) { mo.disconnect(); begin(); } }); mo.observe(document.body, { attributes: true, attributeFilter: ["class"] }); }
    requestAnimationFrame(t => { last = t; frame(t); });
  })();

  // ---- darkroom: from the roll to the print, six scenes beside the index
  (() => {
    const cv = $("process"); if (!cv) return; const st = stage(cv, 236, 158), plate = $("plate2");
    const line = g => g.line([-114, 60, 0], [0, 57, 0], [114, 60, 0]);
    const scenes = [
      (() => { const RX = 36, cas = model(g => cassette(g, -74)), reel = model(g => { [19, -19].forEach(y => { g.ring([RX, y, 0], 33, "y"); g.ring([RX, y, 0], 9, "y"); }); g.cyl([RX, -19, 0], 38, 6, "y"); }),
          spokes = model(g => [19, -19].forEach(y => { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.line([RX + 9 * Math.cos(a), y, 9 * Math.sin(a)], [RX + 33 * Math.cos(a), y, 33 * Math.sin(a)]); } }));
        return { name: "Load the reel", draw: 2600, act: 5200, pitch: .6, yaw: -.3, lift: 0, frame(p, t) { const turns = 5 * inout(t), th = turns * TAU;
          st.model(cas, p); st.model(reel, p); st.model(spokes, p, rotY(-th * .4, RX, 0));
          [17.5, -17.5].forEach(y => { st.poly(path([[-55, y, 11.2], [RX, y, 31]]), .8 * p, .9, null, clamp(p * 1.6));
            const sp = []; for (let a = 0; a <= th; a += .12) { const r = 31 - 4.2 * a / TAU, b = Math.PI / 2 - a; sp.push([RX + r * Math.cos(b), y, r * Math.sin(b)]); } st.poly(sp, .75 * p); });
          if (t > 0 && t < 1) for (let k = 0; k < 5; k++) { const f = (turns * 2.2 + k / 5) % 1, x = -55 + (RX + 55) * f, z = 11.2 + 19.8 * f; st.poly([[x, 17.5, z], [x, -17.5, z]], .45 * Math.sin(Math.PI * f)); } } }; })(),
      (() => { const tank = model(g => { g.cyl([0, -34, 0], 62, 36, "y"); g.ring([0, -34, 0], 31, "y"); g.ring([0, 24, 0], 36, "y"); }), lid = model(g => { g.cyl([0, 28, 0], 8, 23, "y"); g.cyl([0, 36, 0], 6, 26, "y"); g.ring([0, 42, 0], 10, "y"); }),
          reel = model(g => { g.ring([0, -28, 0], 31, "y"); g.ring([0, 8, 0], 31, "y"); g.cyl([0, -28, 0], 36, 7, "y"); [25, 19, 13].forEach(r => g.ring([0, -10, 0], r, "y")); });
        return { name: "Develop", draw: 2400, act: 7600, pitch: .3, yaw: -.4, lift: -12, zoom: .92, frame(p, t, clock) {
          const k = clamp((t - .64) / .33), rock = k > 0 && k < 1 ? .42 * Math.sin(k * TAU * 2) * Math.sin(k * Math.PI) : 0, R = rotZ(rock, 0, -4), lv = inout(clamp((t - .4) / .2));
          st.model(tank, p, R); st.model(reel, p, chain(shift(0, 54 * (1 - inout(clamp(t / .2))), 0), R)); st.model(lid, Math.min(p, clamp((t - .2) / .16)), R);
          if (lv > 0) { const Y = -32 + 46 * lv, c = Math.cos(rock), s = Math.sin(rock), Q = [];
            for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, x = 35 * Math.cos(a); Q.push([x, (Y + 4 - x * s) / c - 4 + (lv < 1 ? .5 * Math.sin(a * 3 + clock / 180) : 0), 35 * Math.sin(a)]); } st.poly(Q, .75 * p, .9, R);
            if (lv < 1) { const S = []; for (let y = 80; y > Y; y -= 5) S.push([3 + .9 * Math.sin(y / 7 + clock / 90), y, 0]); S.push([3, Y, 0]); st.poly(S, .6); } } } }; })(),
      (() => { const rig = model(g => { line(g); g.box(-7, 47, -2.5, 7, 59, 2.5); g.ring([0, 53, 2.6], 2.2, "z"); }), weight = model(g => { g.box(-8, -63, -2.5, 8, -52, 2.5); g.ring([0, -57.5, 2.6], 2.2, "z"); });
        return { name: "Wash and dry", draw: 2600, act: 4600, pitch: .1, yaw: -.3, lift: 0, frame(p, t, clock) { const L = 100 * inout(clamp(p * 1.15)), sway = .5 * Math.sin(clock / 1100);
          st.model(rig, p); filmStrip(L, (s, v) => { const a = sway * s / 100; return [v * Math.cos(a), 48 - s, v * Math.sin(a)]; }, false).forEach(Q => st.poly(Q, .8));
          st.model(weight, clamp((p - .8) / .2), rotY(-sway));
          if (t > 0) for (let k = 0; k < 3; k++) { const f = (clock / 1800 + k / 3) % 1; st.poly(ring([0, -65 - 44 * f * f, 0], 1.5, "z", 10), (1 - f) * p); } } }; })(),
      (() => { const base = model(g => { g.box(-58, -58, -44, 58, -52, 44); g.flat(-33, -22, 33, 24, -51.6); g.flat(-27, -17, 27, 19, -51.5); g.box(-4, -52, -42, 4, 68, -35); }),
          head = model(g => { g.box(-5, 31, -35, 5, 39, -16); g.box(-19, 24, -16, 19, 50, 20); g.cyl([0, 50, 2], 13, 12, "y");
            const a = [[-12, 24, -9], [12, 24, -9], [12, 24, 13], [-12, 24, 13]], b = [[-7, 9, -5], [7, 9, -5], [7, 9, 9], [-7, 9, 9]];
            a.forEach((q, i) => g.line(q, b[i])); [.33, .66, 1].forEach(f => g.loop(...a.map((q, i) => [q[0] + (b[i][0] - q[0]) * f, q[1] + (b[i][1] - q[1]) * f, q[2] + (b[i][2] - q[2]) * f]))); g.cyl([0, 3, 2], 6, 6.5, "y"); });
        return { name: "Enlarge", draw: 2800, act: 5600, pitch: .3, yaw: -.5, lift: -8, zoom: .8, frame(p, t) { const dy = 12 * (1 - inout(clamp(t / .25))), on = clamp((t - .34) / .1) * (1 - clamp((t - .86) / .08)) * p, src = [0, 3 + dy, 2],
            paper = [[-27, -51.5, -17], [27, -51.5, -17], [27, -51.5, 19], [-27, -51.5, 19]];
          if (on > 0) { st.fill(paper, .5 * on); paper.forEach((c, i) => st.fill([src, c, paper[(i + 1) % 4]], .045 * on)); }
          st.model(base, p); st.model(head, p, shift(0, dy, 0)); if (on > 0) paper.forEach(c => st.poly(path([src, c]), .5 * on, .8)); } }; })(),
      (() => { const tray = model(g => { const a = [[-47, -7, -34], [47, -7, -34], [47, -7, 34], [-47, -7, 34]], b = [[-52, 5, -39], [52, 5, -39], [52, 5, 39], [-52, 5, 39]]; g.loop(...a); g.loop(...b); a.forEach((q, i) => g.line(q, b[i])); g.flat(-55, -42, 55, 42, 5.6); g.line([36, 6, -41], [74, 16, -30], [40, 6, -37]); });
        return { name: "Print", draw: 2400, act: 7400, pitch: .78, yaw: -.24, lift: 2, zoom: 1.12, frame(p, t, clock, img) { const R = rotX(.05 * Math.sin(clock / 650)), y = -3 + .4 * Math.sin(clock / 500), up = inout(clamp((t - .1) / .55));
          const pa = [[-31, y, -21], [31, y, -21], [31, y, 21], [-31, y, 21]];
          st.fill(pa, (.16 + .5 * up) * p, R); st.image(img, [-27.5, y, -17.3], [27.5, y, -17.3], [-27.5, y, 17.3], up * p, R); st.poly(path(pa, true), .7 * p, .9, R);
          st.model(tray, p, R); st.poly(path([[-50.3, 1, -37.3], [50.3, 1, -37.3], [50.3, 1, 37.3], [-50.3, 1, 37.3]], true), .32 * p, .8, R);
          for (let k = 0; k < 3; k++) { const z = (clock / 1000 * 9 + k * 25) % 74 - 37, Q = []; for (let x = -49; x <= 49; x += 7) Q.push([x, 1 + .7 * Math.sin(x / 9 + clock / 300 + k), z]); st.poly(Q, .3 * p * Math.sin(Math.PI * (z + 37) / 74), .8, R); } } }; })(),
      (() => { const rig = model(g => { line(g); [-30, 30].forEach(x => g.box(x - 5, 48, -2.5, x + 5, 60, 2.5)); });
        return { name: "Dry", draw: 2000, act: 4400, pitch: .1, yaw: c => -.3 + .1 * Math.sin(c / 1500), lift: 4, frame(p, t, clock, img) { const R = rotX(.09 * Math.sin(clock / 900), 53, 0), a = inout(clamp(p * 1.3));
          const pa = [[-43, 53, 0], [43, 53, 0], [43, -4, 0], [-43, -4, 0]];
          st.fill(pa, .66 * a, R); st.image(img, [-39, 49, 0], [39, 49, 0], [-39, 0, 0], a, R); st.poly(path(pa, true), .7 * p, .9, R, clamp(p * 1.4)); st.model(rig, p);
          if (t > 0 && t < .5) { const f = t / .5; st.poly(ring([36, -6 - 50 * f * f, 0], 1.5, "z", 10), (1 - f) * p); } } }; })()
    ];
    const ERASE = 1200, GAP = 400, imgs = []; let si = 0, pi = 0, clock = 0, t0 = 0, last = 0, seen = false, label = -1;
    const photo = () => { const P = window.PHOTOS || []; if (!P.length) return null; const h = window.SHEET_HOVER, i = (h != null ? h : pi) % P.length; if (!imgs[i]) { imgs[i] = new Image(); imgs[i].src = "./photos/" + P[i].src; } return imgs[i]; };
    const caption = i => { label = i; $("stepNum").textContent = `0${i + 1} / 0${scenes.length}`; $("stepName").textContent = scenes[i].name; };
    const show = (s, p, t) => { st.begin(typeof s.yaw === "function" ? s.yaw(clock) : s.yaw + .06 * Math.sin(clock / 2600), s.pitch + .02 * Math.sin(clock / 2100), s.lift, s.zoom || 1); s.frame(p, t, clock, photo()); };
    function frame(now) {
      requestAnimationFrame(frame); const dt = Math.min(64, now - last); last = now; if (!seen || paused()) return;
      clock += dt; let s = scenes[si], e = clock - t0; if (e >= s.draw + s.act + ERASE + GAP) { si = (si + 1) % scenes.length; if (!si) pi++; s = scenes[si]; t0 = clock; e = 0; }
      if (label !== si) caption(si);
      let p = 1, t = 0; const a = s.draw, b = a + s.act, c = b + ERASE;
      if (e < a) p = e / a; else if (e < b) t = (e - a) / s.act; else if (e < c) { const u = (e - b) / ERASE; p = 1 - u * u; t = 1; } else { p = 0; t = 1; }
      plate.classList.toggle("on", e > 400 && e < b + 300); show(s, p, t);
    }
    st.size(); addEventListener("resize", () => { st.size(); if (reduce) show(scenes[4], 1, 1); });
    if (reduce) { caption(4); plate.classList.add("on"); const im = photo(); const once = () => show(scenes[4], 1, 1); if (im && !im.complete) im.onload = once; once(); return; }
    watch(cv, v => { if (v && !seen) st.size(); seen = v; });
    requestAnimationFrame(t => { last = t; frame(t); });
  })();
})();
