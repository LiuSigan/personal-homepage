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

  // Single-stroke letters for engravings, on a grid six units tall.
  const GLYPH = { N: [4, [[0, 0], [0, 6], [4, 0], [4, 6]]], i: [1.4, [[.7, 0], [.7, 4]], [[.7, 5.2], [.7, 5.8]]], k: [3.2, [[0, 0], [0, 6]], [[3, 4], [0, 1.7]], [[1.2, 2.6], [3.2, 0]]],
    o: [3.4, [[1, 0], [2.4, 0], [3.4, 1], [3.4, 3], [2.4, 4], [1, 4], [0, 3], [0, 1], [1, 0]]], n: [3, [[0, 0], [0, 4]], [[0, 3], [1, 4], [2.2, 4], [3, 3], [3, 0]]],
    F: [3.4, [[0, 0], [0, 6], [3.4, 6]], [[0, 3.2], [2.7, 3.2]]], M: [5, [[0, 0], [0, 6], [2.5, 2.2], [5, 6], [5, 0]]], 2: [4, [[0, 5], [1, 6], [3, 6], [4, 5], [4, 3.7], [0, 0], [4, 0]]],
    U: [4, [[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]], J: [3, [[0, 1], [1, 0], [2, 0], [3, 1], [3, 6]]], I: [.6, [[.3, 0], [.3, 6]]], L: [3.2, [[0, 6], [0, 0], [3.2, 0]]] };
  const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

  // A model is a list of strokes. A stroke may say which surfaces it lies on (`n`: it shows when any of them faces
  // the viewer), that it runs round a barrel (`rad`: only its near half shows), or that it belongs to a part that
  // disappears behind the body (`grp`). Strokes without any of these are always drawn.
  function model(build) {
    const S = [], cur = { n: null, grp: null }, add = (pts, closed, extra) => S.push(Object.assign({ pts, closed: !!closed, n: cur.n, grp: cur.grp }, extra));
    const g = {
      on: (...n) => { cur.n = n.length ? n : null; }, grp: n => { cur.grp = n || null; },
      line: (...p) => add(path(p)), loop: (...p) => add(path(p, true), true),
      ring: (c, r, ax) => add(ring(c, r, ax), true), rrect: (w, d, r, y) => add(rrect(w, d, r, y), true),
      rect: (x0, y0, x1, y1, z) => g.loop([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]),
      flat: (x0, z0, x1, z1, y) => g.loop([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]),
      box: (x0, y0, z0, x1, y1, z1) => { g.flat(x0, z0, x1, z1, y0); g.flat(x0, z0, x1, z1, y1); [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => g.line([x, y0, z], [x, y1, z])); },
      // Cylinder: two end rings plus two outline edges found per frame, so it always reads as a solid.
      cyl: (c, len, r, ax) => { const e = ax === "z" ? [c[0], c[1], c[2] + len] : ax === "x" ? [c[0] + len, c[1], c[2]] : [c[0], c[1] + len, c[2]]; add(ring(c, r, ax), true); add(ring(e, r, ax), true); S.push({ sil: [c, e, r, 1] }, { sil: [c, e, r, -1] }); },
      shell: (w, d, r, top, base, seams) => { g.rrect(w, d, r, top); g.rrect(w, d, r, base);
        [[w / 2, d / 2 - r], [w / 2 - r, d / 2], [r - w / 2, d / 2], [-w / 2, d / 2 - r], [-w / 2, r - d / 2], [r - w / 2, -d / 2], [w / 2 - r, -d / 2], [w / 2, r - d / 2]].forEach(([x, z]) => g.line([x, top, z], [x, base, z]));
        seams.forEach(y => g.rrect(w, d, r, y)); },
      // The same cylinder as a solid: near half of its foot, its rim, both outline edges, and knurling if asked for.
      tube: (c, len, r, ax, knurl, covered) => { const A = AX[ax], e = c.map((v, i) => v + A[i] * len);
        add(ring(c, r, ax), true, { n: null, rad: [c, ax] }); add(ring(e, r, ax), true, covered ? { n: null, rad: [e, ax] } : { n: [A], rad: [e, ax], cap: true }); S.push({ sil: [c, e, r, 1], grp: cur.grp }, { sil: [c, e, r, -1], grp: cur.grp });
        for (let k = 0; k < (knurl || 0); k++) { const a = k / knurl * TAU, u = Math.cos(a), v = Math.sin(a), o = ax === "z" ? [u, v, 0] : ax === "x" ? [0, u, v] : [u, 0, v];
          add(path([c.map((q, i) => q + o[i] * r + A[i] * len * .14), c.map((q, i) => q + o[i] * r + A[i] * len * .86)]), false, { n: [o] }); } },
      band: (c, r, ax) => add(ring(c, r, ax), true, { n: null, rad: [c, ax] }),
      // A body with rounded ends: the rim of the top plate, the seams and the base where a side faces the viewer, and
      // the two outline edges, which move round the corners as the body turns.
      body: (w, d, r, y0, y1, seams) => { const hw = w / 2 - r, hd = d / 2 - r;
        [[y1, 1], ...seams.map(y => [y, 0]), [y0, 0]].forEach(([y, top]) => {
          [[[-hw, y, d / 2], [hw, y, d / 2], [0, 0, 1]], [[hw, y, -d / 2], [-hw, y, -d / 2], [0, 0, -1]], [[w / 2, y, hd], [w / 2, y, -hd], [1, 0, 0]], [[-w / 2, y, -hd], [-w / 2, y, hd], [-1, 0, 0]]].forEach(([a, b, n]) => add(path([a, b]), false, { n: top ? null : [n] }));
          [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const o = []; for (let i = 0; i <= 6; i++) { const t = i / 6 * Math.PI / 2; o.push([sx * (hw + r * Math.cos(t)), y, sz * (hd + r * Math.sin(t))]); } add(o, false, top ? { n: null } : { n: null, rad: [[sx * hw, y, sz * hd], "y"] }); }); });
        [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => S.push({ vsil: [sx * hw, sz * hd, sx, sz, r, y0, y1] })); },
      text: (str, o, ux, uy, h, slant) => { let x = 0; const k = h / 6; for (const ch of str) { const G = GLYPH[ch]; if (!G) { x += 3; continue; }
        G.slice(1).forEach(pl => add(path(pl.map(([a, b]) => o.map((v, i) => v + ux[i] * (x + a + b * (slant || 0)) * k + uy[i] * b * k))))); x += G[0] + 1.3; } }
    };
    build(g); let total = 0;
    const radial = (P, rad) => P.map(p => { const d = [p[0] - rad[0][0], p[1] - rad[0][1], p[2] - rad[0][2]]; d[rad[1] === "x" ? 0 : rad[1] === "z" ? 2 : 1] = 0; const l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; });
    S.forEach(s => { s.len = s.sil ? plen([s.sil[0], s.sil[1]]) : s.vsil ? s.vsil[6] - s.vsil[5] : plen(s.pts); s.at = total; total += s.len + Math.min(8, s.len); });
    S.forEach(s => { s.t0 = s.at / total * .76; if (!s.pts) return; if (s.len > 5) s.alt = wander(s.pts, s.closed, s.len); if (s.rad) { s.rn = radial(s.pts, s.rad); if (s.alt) s.rna = radial(s.alt, s.rad); } });
    return { S };
  }
  // Rigid moves for parts of a scene.
  const rotZ = (a, cx = 0, cy = 0) => { const c = Math.cos(a), s = Math.sin(a); return q => [cx + (q[0] - cx) * c - (q[1] - cy) * s, cy + (q[0] - cx) * s + (q[1] - cy) * c, q[2]]; };
  const rotY = (a, cx = 0, cz = 0) => { const c = Math.cos(a), s = Math.sin(a); return q => [cx + (q[0] - cx) * c + (q[2] - cz) * s, q[1], cz - (q[0] - cx) * s + (q[2] - cz) * c]; };
  const rotX = (a, cy = 0, cz = 0) => { const c = Math.cos(a), s = Math.sin(a); return q => [q[0], cy + (q[1] - cy) * c - (q[2] - cz) * s, cz + (q[1] - cy) * s + (q[2] - cz) * c]; };
  const shift = (dx, dy, dz) => q => [q[0] + dx, q[1] + dy, q[2] + dz], chain = (...f) => q => f.reduce((v, g) => g(v), q);

  // A length of 35mm film laid along P(s, v): s runs along the strip, v across it.
  const filmStrip = (L, P, tongue) => { const o = [], fr = [], run = (s0, s1, v) => { const r = []; for (let s = s0; s < s1; s += 6) r.push(P(s, v)); r.push(P(s1, v)); return r; };
    o.frames = fr; if (L < 2) return o; const c = tongue ? Math.min(28, L * .6) : 0, end = tongue ? c + 4 : 4;   // the leader's cut grows with the film, so its shape never jumps
    if (tongue) o.push([...run(0, L - c, 17.5), P(L - c * .71, 1), P(L - c * .18, 1), P(L, -5), P(L, -12), P(L - c * .18, -17.5), ...run(0, L - c * .18, -17.5).reverse()]);
    else o.push([...run(0, L, 17.5), ...run(0, L, -17.5).reverse(), P(0, 17.5)]);
    o.outline = o[0];
    for (let s = 5; s < L - 6; s += 6) { o.push([P(s, -16), P(s + 3.2, -16), P(s + 3.2, -13.2), P(s, -13.2), P(s, -16)]); if (s < L - end) o.push([P(s, 16), P(s + 3.2, 16), P(s + 3.2, 13.2), P(s, 13.2), P(s, 16)]); }
    for (let s = 12; s + 36 < L - end; s += 38) { const f = [...run(s, s + 36, 11.5), ...run(s, s + 36, -11.5).reverse(), P(s, 11.5)]; o.push(f); fr.push(f); }
    return o; };

  // ---- a canvas to draw scenes on; dw x dh is the model-space size that should fit
  function stage(cv, dw, dh) {
    const ctx = cv.getContext("2d"), off = document.createElement("canvas"), octx = off.getContext("2d"), F = 520; let W = 0, H = 0, K0 = 1, K = 1, dpr = 1, cy = 1, sy = 0, cp = 1, sp = 0, lift = 0;
    const tf = q => { const x = q[0] * cy + q[2] * sy, z = -q[0] * sy + q[2] * cy, y = q[1] + lift; return [x, y * cp - z * sp, y * sp + z * cp]; };
    const pj = v => { const s = F / (F - v[2]) * K; return [W / 2 + v[0] * s, H / 2 + K - v[1] * s, v[2]]; };
    const map = (pts, xf) => pts.map(q => pj(tf(xf ? xf(q) : q)));
    // V holds how far each point of the stroke faces the viewer (0 to 1), k the same for the whole stroke; what faces
    // away is left at `fl`, so long hidden lines remain as faint construction lines.
    const run = (Q, f, a, w, V, k = 1, fl = 0) => { const n = Q.length - 1, m = f * n; ctx.lineWidth = w;
      for (let i = 0; i < n && i < m; i++) { const t = Math.min(1, m - i), A = Q[i], B = Q[i + 1], al = fl + (1 - fl) * k * (V ? (V[i] + V[i + 1]) / 2 : 1); if (al < .02) continue;
        ctx.globalAlpha = a * al * (.34 + .66 * clamp(((A[2] + B[2]) / 2 + 75) / 150)); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t); ctx.stroke(); } };
    return {
      size() { const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); K0 = K = Math.min(W / dw, H / dh); },
      begin(yaw, pitch, dy = 0, zoom = 1) { K = K0 * zoom; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.strokeStyle = "#f0f0f0"; ctx.fillStyle = "#f1f1ef"; ctx.lineCap = ctx.lineJoin = "round"; cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch); lift = dy; },
      model(m, p, xf) { if (p <= 0) return; const face = n => n[1] * sp + (n[2] * cy - n[0] * sy) * cp, sm = v => clamp((v + .2) / .3);
        m.S.forEach(s => { const f = inout(clamp((p - s.t0) / .24)); if (f <= 0) return; let k = s.grp ? clamp((face(s.grp) + .45) / .3) : 1;
          if (s.sil) { if (k < .03) return; const e = xf ? [xf(s.sil[0]), xf(s.sil[1])] : s.sil, a = tf(e[0]), b = tf(e[1]), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), full = Math.hypot(dx, dy, b[2] - a[2]) || 1; if (l / full < .1) return;
            const nx = dy / l * s.sil[2] * s.sil[3], ny = -dx / l * s.sil[2] * s.sil[3]; run([pj([a[0] + nx, a[1] + ny, a[2]]), pj([b[0] + nx, b[1] + ny, b[2]])], f, .9 * k, 1); return; }
          if (s.vsil) { const [cx, cz, sx, sz, r, y0, y1] = s.vsil; [1, -1].forEach(o => { if (o * cy * sx < -.02 || o * sy * sz < -.02) return; const x = cx + o * r * cy, z = cz + o * r * sy; run(map(path([[x, y1, z], [x, y0, z]])), f, .95, 1.1); }); return; }
          let b = 1; if (s.n) { b = -1; for (const n of s.n) b = Math.max(b, face(n)); b = sm(b); }
          const V = rn => rn ? rn.map(n => s.cap ? Math.max(b, sm(face(n))) : sm(face(n))) : null, fl = s.len > 12 ? .06 : 0; if (!s.cap) k *= b; if (!s.rn && fl + k < .03) return;
          run(map(s.pts, xf), f, .95, 1.1, V(s.rn), k, fl); if (s.alt) run(map(s.alt, xf), inout(clamp((p - s.t0 - .05) / .24)), .36, .8, V(s.rna), k, fl); }); ctx.globalAlpha = 1; },
      poly(pts, a = .8, w = .9, xf, f = 1) { if (a > 0 && pts.length > 1) run(map(pts, xf), f, a, w); ctx.globalAlpha = 1; },
      // Fills the outline of a convex solid given points on its surface.
      hull(pts, a, xf) { if (a <= 0 || pts.length < 3) return; const Q = map(pts, xf).sort((u, v) => u[0] - v[0] || u[1] - v[1]), cr = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]), lo = [], up = [];
        for (const q of Q) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
        for (let i = Q.length - 1; i >= 0; i--) { const q = Q[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
        const B = lo.slice(0, -1).concat(up.slice(0, -1)); ctx.globalAlpha = a; ctx.beginPath(); B.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; },
      fill(pts, a, xf) { if (a <= 0) return; const Q = map(pts, xf); ctx.globalAlpha = a; ctx.beginPath(); Q.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; },
      // Photograph laid on the rectangle tl, tr, bl (and the corner opposite tl) in true perspective: the rectangle is cut
      // into a small grid and each cell is placed separately, off screen, then the whole is blended in at once.
      image(img, tl, tr, bl, a, xf, filter) { if (!img || !img.complete || !img.naturalWidth || a <= 0) return; const ar = plen([tl, tr]) / plen([tl, bl]), NX = 10, NY = 7, G = [];
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy0 = 0; if (sw / sh > ar) { const w = sh * ar; sx = (sw - w) / 2; sw = w; } else { const h = sw / ar; sy0 = (sh - h) / 2; sh = h; }
        for (let n = 0; n <= NY; n++) for (let m = 0; m <= NX; m++) { const u = m / NX, v = n / NY; G.push([0, 1, 2].map(k => tl[k] + (tr[k] - tl[k]) * u + (bl[k] - tl[k]) * v)); }
        const Q = map(G, xf), cw = sw / NX, ch = sh / NY; if (off.width !== cv.width || off.height !== cv.height) { off.width = cv.width; off.height = cv.height; }
        octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, off.width, off.height);
        for (let n = 0; n < NY; n++) for (let m = 0; m < NX; m++) { const A = Q[n * (NX + 1) + m], B = Q[n * (NX + 1) + m + 1], C = Q[(n + 1) * (NX + 1) + m], ex = cw / Math.max(1, Math.hypot(B[0] - A[0], B[1] - A[1])), ey = ch / Math.max(1, Math.hypot(C[0] - A[0], C[1] - A[1]));
          octx.setTransform(dpr * (B[0] - A[0]) / cw, dpr * (B[1] - A[1]) / cw, dpr * (C[0] - A[0]) / ch, dpr * (C[1] - A[1]) / ch, dpr * A[0], dpr * A[1]);
          const w = m < NX - 1 ? Math.min(cw + ex, sw - m * cw) : cw, h = n < NY - 1 ? Math.min(ch + ey, sh - n * ch) : ch; octx.drawImage(img, sx + m * cw, sy0 + n * ch, w, h, 0, 0, w, h); }
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; if (filter && "filter" in ctx) ctx.filter = filter; ctx.drawImage(off, 0, 0); ctx.restore(); }
    };
  }
  const watch = (cv, set) => new IntersectionObserver(es => set(es[0].isIntersecting)).observe(cv);
  const paused = () => document.hidden || document.body.classList.contains("locked");
  const small = () => innerWidth <= 760;

  // ---- objects
  const cassette = (g, X) => { g.cyl([X, -22, 0], 44, 12.5, "y"); g.ring([X, 22, 0], 10.5, "y"); g.ring([X, -22, 0], 10.5, "y"); g.ring([X, 14, 0], 12.5, "y"); g.ring([X, -14, 0], 12.5, "y");
    g.cyl([X, 22, 0], 5, 4.5, "y"); g.line([X - 3, 27, 0], [X + 3, 27, 0]); g.line([X, 27, -3], [X, 27, 3]); g.cyl([X, -25, 0], 3, 4.5, "y");
    const a = X + 2, b = X + 19; g.rect(a, -22, b, 22, 13); g.rect(a, -22, b, 22, 9.5); [[a, -22], [b, -22], [b, 22], [a, 22]].forEach(([x, y]) => g.line([x, y, 9.5], [x, y, 13])); };

  const U = [0, 1, 0], FR = [0, 0, 1], BK = [0, 0, -1], RT = [1, 0, 0], LF = [-1, 0, 0];
  const ticks = (g, c, r0, r1, n, y) => { for (let k = 0; k < n; k++) { const a = k / n * TAU; g.line([c[0] + r0 * Math.cos(a), y, c[1] + r0 * Math.sin(a)], [c[0] + r1 * Math.cos(a), y, c[1] + r1 * Math.sin(a)]); } };
  const arc = (c, r, a0, a1, z) => { const o = []; for (let i = 0; i <= 8; i++) { const a = (a0 + (a1 - a0) * i / 8) * Math.PI / 180; o.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), z]); } return o; };

  // Nikon FM2 with the 50mm f/1.8: 142.5 x 90 x 60 mm. Seen from the front, the shutter side is on the left.
  const fm2 = model(g => {
    const T = 22, B = -42, F = 18.2, K = -18.2, LY = -9;
    g.body(142, 36, 9, B, T, [8, -35]);
    // pentaprism housing and the front plate it stands on
    const FS = [0, .55, .83], BS = [0, .5, -.87], RS = [.88, .47, 0], LS = [-.88, .47, 0];
    const a = [-27, T, 21], b = [27, T, 21], c = [21, 37, 21], d = [-21, 37, 21], e = [-13, 48, 9], f = [13, 48, 9], h = [13, 48, -11], i = [-13, 48, -11], j = [-27, T, -17], k = [27, T, -17];
    g.on(); g.line(b, k, j, a); g.loop(e, f, h, i);
    g.on(FR, RS); g.line(b, c); g.on(FR, LS); g.line(a, d); g.on(FR, FS); g.line(d, c); g.on(FS, RS); g.line(c, f); g.on(FS, LS); g.line(d, e); g.on(RS, BS); g.line(h, k); g.on(LS, BS); g.line(i, j);
    g.on(FR); g.line(a, [-27, -24, 21]); g.line(b, [27, -24, 21]); g.line([-27, -24, 21], [-19, -37, 21], [19, -37, 21], [27, -24, 21]);
    g.rect(-17, 24.5, 17, 34.5, 21.2); g.text("Nikon", [-10.6, 26.6, 21.3], RT, U, 5.6, .22);                      // nameplate
    g.on(); g.flat(-8, 6, 8, -9, 48.6); g.line([-5.5, 48.6, 6], [-5.5, 48.6, -6], [5.5, 48.6, -6], [5.5, 48.6, 6]);   // accessory shoe
    g.on(BK); g.rect(-10, 24, 10, 39, -17.6); g.ring([0, 31.5, -18.4], 7.4, "z"); g.ring([0, 31.5, -18.6], 5, "z");   // eyepiece
    // top plate, shutter side
    g.on(); g.tube([-36, T, -1], 9, 11, "y", 30); g.ring([-36, 31.2, -1], 8, "y"); g.ring([-36, 31.2, -1], 3, "y"); ticks(g, [-36, -1], 8.6, 10.3, 12, 31.2); g.flat(-39, 3, -33, 6, 31.3);
    g.tube([-53, T, 9], 2.6, 6.2, "y"); g.tube([-53, 24.6, 9], 2.6, 3.4, "y"); g.ring([-53, 27.3, 9], 1.3, "y");               // shutter release
    g.tube([-61, T, -5], 4.4, 7.8, "y"); g.ring([-61, 26.5, -5], 4, "y");                                                       // advance lever hub
    g.loop([-65, 27.2, -9], [-58, 27.2, -17.5], [-41, 27.2, -19.5], [-33, 27.2, -18], [-32, 27.2, -13.5], [-41, 27.2, -14.5], [-55, 27.2, -12], [-57, 27.2, -5]); g.line([-41, 27.2, -19.5], [-41, 27.2, -14.5]);
    g.ring([-64.5, T + .2, 8.5], 3.2, "y"); g.ring([-64.5, T + .2, 8.5], 2, "y");                                               // frame counter
    // top plate, rewind side
    g.tube([48, T, -1], 3.5, 11.5, "y"); g.tube([48, 25.5, -1], 5.6, 9.6, "y", 24); g.ring([48, 31.2, -1], 6, "y");
    g.flat(41.5, -3, 59, 1, 31.4); g.tube([56.5, 31.4, -1], 3.6, 2.4, "y");                                                     // rewind crank
    g.ring([31.5, T + .2, -9], 1.7, "y"); g.line([28.5, T + .2, -9], [34.5, T + .2, -9]);                                       // film plane mark
    // front
    g.on(FR); g.ring([-37, 2, F], 4.2, "z"); g.ring([-37, 2, F], 1.6, "z"); g.line([-39.3, -1.4, F], [-39.1, -20, F], [-37, -22.6, F], [-34.9, -20, F], [-34.7, -1.4, F]);   // self-timer
    g.ring([-33.5, 15, F], 2.8, "z"); g.line([-31.6, 13, F], [-28.4, 9.6, F]);                                                 // depth-of-field preview
    g.ring([34, -6, F], 4, "z"); g.ring([34, -6, F], 2.4, "z");                                                                 // lens release
    g.ring([34.5, 13, F], 2.8, "z"); g.ring([34.5, 13, F], 1.2, "z");                                                           // sync terminal
    g.on(FR, LF); g.line([-70.5, 17, 9], [-76.5, 13.5, 9], [-70.5, 10, 9]); g.on(FR, RT); g.line([70.5, 17, 9], [76.5, 13.5, 9], [70.5, 10, 9]);   // strap lugs
    // back
    g.on(BK); g.rect(-60, -36, 60, 7, K); g.line([-56.5, -36, K], [-56.5, 7, K]); g.rect(-17, -27, 17, -5, K); g.rect(-14, -24, 14, -8, K);
    // lens
    g.grp(FR); g.on(); g.tube([0, LY, 21], 3.5, 26.5, "z", 0, 1); g.tube([0, LY, 24.5], 8, 30, "z", 22, 1);
    g.on(FR, BK, U); g.line([-4.6, LY + 30, 28.5], [-4.6, LY + 36, 28.5], [-1.7, LY + 36, 28.5], [-1.7, LY + 32.5, 28.5], [1.7, LY + 32.5, 28.5], [1.7, LY + 36, 28.5], [4.6, LY + 36, 28.5], [4.6, LY + 30, 28.5]);   // meter coupling prong
    g.on(); g.tube([0, LY, 32.5], 4, 30.6, "z", 0, 1); g.tube([0, LY, 36.5], 13, 32.5, "z", 44); g.band([0, LY, 40.5], 32.5, "z"); g.band([0, LY, 45.5], 32.5, "z"); g.tube([0, LY, 49.5], 7, 29.5, "z");
    g.on(FR); g.ring([0, LY, 56.5], 26, "z"); g.ring([0, LY, 55.5], 21.5, "z"); g.ring([0, LY, 54], 15.5, "z"); g.ring([0, LY, 52.5], 9, "z"); g.line(...arc([0, LY], 12.4, 108, 164, 54)); g.line(...arc([0, LY], 6.2, 112, 160, 52.5));
    g.grp(); g.on();
  });

  // Fujifilm X100VI: 128 x 74.8 x 55.3 mm. Seen from the front, the grip is on the left and the finder window top right.
  const x100 = model(g => {
    const T = 33, B = -37, F = 16.7, K = -16.7, LX = 7, LY = -6;
    g.body(128, 33, 6, B, T, [17, -32]);
    // top plate
    g.on(); g.tube([-22, T, -1], 8, 12, "y", 34); g.ring([-22, 41.2, -1], 9, "y"); g.ring([-22, 41.2, -1], 4.6, "y"); ticks(g, [-22, -1], 9.6, 11.3, 12, 41.2);   // shutter speed and ISO dial
    g.tube([-40.5, T, 7], 3, 7.6, "y"); g.tube([-40.5, 36, 7], 3, 4, "y"); g.ring([-40.5, 39.2, 7], 1.5, "y"); g.line([-40.5, 34.5, 14.6], [-40.5, 34.5, 17.6]);   // release and power switch
    g.tube([-54, T, -8], 6, 8.6, "y", 26); g.ring([-54, 39.2, -8], 6, "y");                                         // exposure compensation
    g.tube([-51, T, 7], 1.2, 2.3, "y");                                                                              // Fn
    g.flat(-3, 5, 17, -12, T + .5); g.line([0, T + .5, 5], [0, T + .5, -9], [14, T + .5, -9], [14, T + .5, 5]); g.line([3.5, T + .5, -3], [10.5, T + .5, -3]);   // hot shoe
    // front
    g.on(FR); g.rect(33, 18.5, 59, 31, F); g.rect(35.5, 21, 56.5, 28.5, F); g.rect(9, 22, 23, 28, F); g.ring([28.5, 12.5, F], 2, "z");   // finder window, flash, AF lamp
    g.ring([-22, 8.5, F], 4.6, "z"); g.ring([-22, 8.5, F], 1.8, "z"); g.line([-24.6, 4.8, F], [-30.4, -3.6, F], [-28, -5.2, F], [-21.4, 4, F]);   // viewfinder selector
    g.on(FR, LF); g.rect(-62, -32, -49.5, 12, 19.6); g.line([-62, 12, 16.6], [-62, 12, 19.6]); g.line([-49.5, 12, 16.6], [-49.5, 12, 19.6]); g.line([-49.5, -32, 16.6], [-49.5, -32, 19.6]);   // grip
    g.on(FR, U); g.tube([-56, 21.5, 16.5], 9, 3.4, "x", 12);                                                         // front command dial
    g.on(FR, LF); g.line([-64.5, 22, 4], [-70.5, 19, 4], [-64.5, 16, 4]); g.on(FR, RT); g.line([64.5, 22, 4], [70.5, 19, 4], [64.5, 16, 4]);
    g.on(RT); g.loop([64.1, 2, -5], [64.1, 2, 6], [64.1, -9, 6], [64.1, -9, -5]); g.loop([64.2, -1, -2], [64.2, -1, 3], [64.2, -5, 3], [64.2, -5, -2]);   // focus mode selector
    // back
    g.on(BK); g.rect(-20, -30, 55, 12, K); g.rect(-17.5, -27.5, 52.5, 9.5, K); g.rect(33, 16, 59, 30.5, K); g.ring([46, 23.2, K], 5.6, "z");   // screen, eyepiece
    g.ring([-38, 3, K], 3.2, "z"); g.ring([-38, 3, K], 1.5, "z"); g.ring([-38, -9, K], 3.6, "z"); g.ring([-33, -21, K], 2.4, "z"); g.ring([-44, -21, K], 2.4, "z"); g.ring([-48, 14, K], 2.6, "z"); g.ring([22, 23, K], 2.4, "z"); g.ring([12, 23, K], 2.4, "z");
    g.on(BK, U); g.tube([-40, 24.5, -16.5], 10, 3.2, "x", 12);                                                       // rear command dial
    g.on(BK); g.line([-55, 10, K], [-55, -6, K], [-47, -14, K]);                                                     // thumb rest
    // lens
    g.grp(FR); g.on(); g.tube([LX, LY, 16.5], 2.5, 28, "z"); g.tube([LX, LY, 19], 8, 26, "z", 0);
    [[-1, 0], [1, 0]].forEach(([sx]) => { g.on(FR, [sx, 0, 0]); g.loop([LX + sx * 26, LY - 5, 20.5], [LX + sx * 29, LY - 5, 20.5], [LX + sx * 29, LY + 5, 20.5], [LX + sx * 26, LY + 5, 20.5]); g.line([LX + sx * 29, LY - 5, 20.5], [LX + sx * 29, LY - 5, 26], [LX + sx * 29, LY + 5, 26], [LX + sx * 29, LY + 5, 20.5]); });   // aperture ring tabs
    g.on(); g.band([LX, LY, 23], 26, "z"); g.tube([LX, LY, 27], 7, 25, "z", 40); g.tube([LX, LY, 34], 3.5, 23.5, "z");
    g.on(FR); g.ring([LX, LY, 37.5], 20.5, "z"); g.ring([LX, LY, 36.5], 17, "z"); g.ring([LX, LY, 35.5], 11.5, "z"); g.ring([LX, LY, 34.5], 6.5, "z"); g.line(...arc([LX, LY], 9, 108, 164, 35.5));
    g.grp(); g.on();
  });

  const FX = -88, roll = model(g => cassette(g, FX));

  // ---- hero: two cameras and a roll of film, each drawn, turned once, erased
  (() => {
    const cv = $("sketch"); if (!cv) return; const st = stage(cv, small() ? 178 : 195, 124), plate = $("plate"), Y0 = -.56, P0 = .24;
    const M = [{ m: fm2, name: "Nikon FM2", note: "35mm SLR — 1982", draw: 5600 }, { m: x100, name: "Fujifilm X100VI", note: "23mm fixed lens — 2024", draw: 5400 }, { m: roll, name: "35mm film", note: "36 exposures", draw: 2600, film: true }];
    const HOLD = 450, SPIN = 10500, ERASE = 1500, GAP = 550, lead = (s, v) => [FX + 19 + s, v, 11.2 + 11 * Math.sin(s / 48) * clamp(s / 50)];
    const show = (o, p, yaw, pitch, L) => { st.begin(yaw, pitch); st.model(o.m, p); if (L) { const f = filmStrip(L, lead, true); if (f.outline) st.fill(f.outline, .025); f.forEach(Q => st.poly(Q, .8)); } };
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
      (() => { const RX = 36, cas = model(g => cassette(g, -74)), reel = model(g => { [19.5, -19.5].forEach(y => { g.ring([RX, y, 0], 33, "y"); g.ring([RX, y, 0], 9, "y"); }); g.cyl([RX, -19.5, 0], 39, 6, "y"); }),
          spk = y => model(g => { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.line([RX + 9 * Math.cos(a), y, 9 * Math.sin(a)], [RX + 33 * Math.cos(a), y, 33 * Math.sin(a)]); } }), top = spk(19.5), bot = spk(-19.5);
        const A = [-55, 11.2], B = [RX, 31], LEN = Math.hypot(B[0] - A[0], B[1] - A[1]), at = (f, y) => [A[0] + (B[0] - A[0]) * f, y, A[1] + (B[1] - A[1]) * f];
        return { name: "Load the reel", draw: 2600, act: 6400, pitch: .6, yaw: -.3, lift: 0, frame(p, t) { const turns = 5 * inout(t), th = turns * TAU, travel = turns * 150, tw = t > 0 && t < 1 ? .26 * Math.sin(turns * TAU * 2.5) : 0, run = clamp(p * 1.6);
          // Film between the cassette and the reel: a translucent band whose perforations travel with it.
          st.fill([at(0, 17.5), at(run, 17.5), at(run, -17.5), at(0, -17.5)], .02 * p); [17.5, -17.5].forEach(y => st.poly(path([at(0, y), at(1, y)]), .8 * p, .9, null, run));
          if (p > .6) { for (let s = travel % 6; s < LEN - 3.2; s += 6) { const f0 = s / LEN, f1 = (s + 3.2) / LEN; [[16, 13.2], [-13.2, -16]].forEach(([u, v]) => st.poly([at(f0, u), at(f1, u), at(f1, v), at(f0, v), at(f0, u)], .5 * p, .7)); }
            for (let s = travel % 38; s < LEN; s += 38) st.poly([at(s / LEN, 11.5), at(s / LEN, -11.5)], .4 * p, .7); }
          // Film wound into the spiral: every turn is a thin wall, so the coil grows denser as it fills.
          const sp = []; for (let a = 0; a <= th; a += .1) { const r = 31 - 4.1 * a / TAU, b = Math.PI / 2 - a; sp.push([RX + r * Math.cos(b), r * Math.sin(b)]); }
          for (let i = 1; i < sp.length; i++) st.fill([[sp[i - 1][0], 17.5, sp[i - 1][1]], [sp[i][0], 17.5, sp[i][1]], [sp[i][0], -17.5, sp[i][1]], [sp[i - 1][0], -17.5, sp[i - 1][1]]], .02 * p);
          [17.5, -17.5].forEach(y => st.poly(sp.map(q => [q[0], y, q[1]]), .8 * p));
          if (sp.length > 1) { const e = sp[sp.length - 1]; st.poly([[e[0], 17.5, e[1]], [e[0], -17.5, e[1]]], .9 * p, 1.1); }
          st.model(cas, p); st.model(reel, p); st.model(top, p, rotY(tw, RX, 0)); st.model(bot, p, rotY(-tw, RX, 0)); } }; })(),
      (() => { const tank = model(g => { g.cyl([0, -34, 0], 62, 36, "y"); g.ring([0, -34, 0], 31, "y"); g.ring([0, 24, 0], 36, "y"); }), lid = model(g => { g.cyl([0, 28, 0], 8, 23, "y"); g.cyl([0, 36, 0], 6, 26, "y"); g.ring([0, 42, 0], 10, "y"); }),
          reel = model(g => { g.ring([0, -28, 0], 31, "y"); g.ring([0, 8, 0], 31, "y"); g.cyl([0, -28, 0], 36, 7, "y"); }), coil = [];
        for (let a = 0; a <= 5 * TAU; a += .12) { const r = 30 - 3.8 * a / TAU; coil.push([r * Math.cos(a), r * Math.sin(a)]); }
        const RAD = 35, Y0 = -34, Y1 = 28, PV = -4;
        // Water in the tilted tank is everything below a level surface; the level is solved so the amount stays the same.
        const water = (ang, V) => { const c = Math.cos(ang), s = Math.sin(ang), span = (x, Y) => { const w0 = PV + x * s + (Y0 - PV) * c, w1 = PV + x * s + (Y1 - PV) * c; if (w0 > Y && w1 > Y) return null; if (w0 <= Y && w1 <= Y) return [Y0, Y1, 0];
              const yc = Math.max(Y0, Math.min(Y1, (Y - PV - x * s) / c + PV)); return w0 <= Y ? [Y0, yc, 1] : [yc, Y1, -1]; };
            const vol = Y => { let a = 0, b = 0; for (let i = -10; i <= 10; i++) { const x = i * 3.4, w = Math.sqrt(RAD * RAD - x * x), q = span(x, Y); b += w; if (q) a += w * (q[1] - q[0]); } return a / (b * (Y1 - Y0)); };
            let lo = -90, hi = 90; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (vol(m) < V) lo = m; else hi = m; } const Y = (lo + hi) / 2, body = [], surf = [];
            for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, x = RAD * Math.cos(a), z = RAD * Math.sin(a), q = span(x, Y); if (!q) continue; body.push([x, q[0], z], [x, q[1], z]); if (q[2]) surf.push([x, q[2] > 0 ? q[1] : q[0], z]); }
            return { body, surf }; };
        return { name: "Develop", draw: 2400, act: 11500, pitch: .3, yaw: -.4, lift: -12, zoom: .92, frame(p, t, clock) {
          const k = clamp((t - .36) / .3), tip = inout(clamp((t - .7) / .08)) - inout(clamp((t - .93) / .07)), ang = (k > 0 && k < 1 ? .4 * Math.sin(k * TAU * 2.5) * Math.sin(k * Math.PI) : 0) - 2 * tip, R = rotZ(ang, 0, PV);
          const inn = inout(clamp((t - .19) / .15)), gone = inout(clamp((t - .75) / .16)), V = .7 * inn * (1 - gone);
          if (V > .004) { const w = water(ang, V); st.hull(w.body, .16 * p, R); if (w.surf.length > 2) { st.fill(w.surf, .1 * p, R); st.poly([...w.surf, w.surf[0]], .7 * p, .9, R); } }
          const RR = chain(shift(0, 54 * (1 - inout(clamp(t / .11))), 0), R);
          for (let i = 1; i < coil.length; i++) st.fill([[coil[i - 1][0], 7.5, coil[i - 1][1]], [coil[i][0], 7.5, coil[i][1]], [coil[i][0], -27.5, coil[i][1]], [coil[i - 1][0], -27.5, coil[i - 1][1]]], .02 * p, RR);
          [7.5, -27.5].forEach(y => st.poly(coil.map(q => [q[0], y, q[1]]), .6 * p, .8, RR, clamp(p * 1.3)));
          st.model(tank, p, R); st.model(reel, p, RR); st.model(lid, Math.min(p, clamp((t - .11) / .08)), R);
          if (inn > 0 && inn < 1) { const a = [], b = []; for (let y = 86; y >= 44; y -= 6) { const x = .8 * Math.sin(y / 7 + clock / 90); a.push([x - 1.5, y, 0]); b.push([x + 1.5, y, 0]); } st.fill([...a, ...b.slice().reverse()], .16); st.poly(a, .55); st.poly(b, .55); }
          if (gone > 0 && gone < 1) { const M = R([0, 43, 0]), N = R([0, 44, 0]), dx = N[0] - M[0], dy = N[1] - M[1], flow = Math.sqrt(Math.sin(Math.PI * gone)), a = [], b = [];
            for (let i = 0; i <= 16; i++) { const u = i / 16, x = M[0] + dx * 34 * u + .5 * Math.sin(u * 9 + clock / 80), y = M[1] + dy * 34 * u - 95 * u * u, w = 2.4 - 1.2 * u; a.push([x - w, y, 0]); b.push([x + w, y, 0]); }
            st.fill([...a, ...b.slice().reverse()], .17 * flow); st.poly(a, .6 * flow); st.poly(b, .6 * flow); } } }; })(),
      (() => { const rig = model(g => { line(g); g.box(-7, 47, -2.5, 7, 59, 2.5); g.ring([0, 53, 2.6], 2.2, "z"); }), weight = model(g => { g.box(-8, -63, -2.5, 8, -52, 2.5); g.ring([0, -57.5, 2.6], 2.2, "z"); });
        // A drop: round below, drawn up to a point of height r * k above its centre.
        const tear = (r, k, at) => { const Q = [at(0, r * k)]; for (let i = 0; i <= 12; i++) { const a = (35 - i / 12 * 250) * Math.PI / 180; Q.push(at(r * Math.cos(a), r * Math.sin(a))); } Q.push(Q[0]); return Q; };
        return { name: "Wash and dry", draw: 2600, act: 5600, pitch: .1, yaw: -.3, lift: 16, zoom: .9, frame(p, t, clock) { const L = 100 * inout(clamp(p * 1.15)), sway = .5 * Math.sin(clock / 1100), P = (s, v) => { const a = sway * s / 100; return [v * Math.cos(a), 48 - s, v * Math.sin(a)]; };
          const f = filmStrip(L, P, false); if (f.outline) st.fill(f.outline, .025 * p); f.frames.forEach(Q => st.fill(Q, .025 * p)); f.forEach(Q => st.poly(Q, .8));
          st.model(rig, p); st.model(weight, clamp((p - .8) / .2), rotY(-sway));
          if (t > 0) { const wet = p * clamp(t * 6);
            // beads of water sliding down the wet film, each with a short trail
            [[-9, 5200, .1], [4, 6900, .43], [11, 6100, .7], [-14, 7600, .9]].forEach(([v, T, o]) => { const u = (clock / T + o) % 1, s = 6 + u * (L - 12), a = wet * Math.sin(Math.PI * u) * .7, Q = tear(1.3, 2.3, (x, y) => P(s - y, v + x));
              st.fill(Q, .28 * a); st.poly(Q, a, .7); st.poly([P(s - 11, v), P(s - 3.2, v)], .3 * a, .6); });
            // the drop at the bottom swells, lets go, stretches and falls
            const u = (clock / 1900) % 1, hang = u < .58, g = hang ? u / .58 : (u - .58) / .42, r = hang ? .6 + 1.9 * g : 2.5, y = hang ? -63.4 - r * (.9 + .5 * g) : -67 - 46 * g * g;
            const Q = tear(r, hang ? 1.2 + .7 * g : 2.3 + 1.3 * g, (dx, dy) => [dx, y + dy, 0]), a = wet * (hang ? 1 : 1 - .5 * g); st.fill(Q, .3 * a); st.poly(Q, .9 * a, .8);
            if (hang) st.poly([[-.5 * r, y + .2 * r, .1], [-.75 * r, y - .3 * r, .1]], .5 * a, .6); } } }; })(),
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
          st.model(tray, p, R); st.fill([[-50.3, 1, -37.3], [50.3, 1, -37.3], [50.3, 1, 37.3], [-50.3, 1, 37.3]], .07 * p, R); st.poly(path([[-50.3, 1, -37.3], [50.3, 1, -37.3], [50.3, 1, 37.3], [-50.3, 1, 37.3]], true), .32 * p, .8, R);
          for (let k = 0; k < 3; k++) { const z = (clock / 1000 * 9 + k * 25) % 74 - 37, Q = []; for (let x = -49; x <= 49; x += 7) Q.push([x, 1 + .7 * Math.sin(x / 9 + clock / 300 + k), z]); st.poly(Q, .3 * p * Math.sin(Math.PI * (z + 37) / 74), .8, R); } } }; })(),
      (() => { const rig = model(g => { line(g); [-30, 30].forEach(x => g.box(x - 5, 48, -2.5, x + 5, 60, 2.5)); });
        return { name: "Dry", draw: 2000, act: 4400, pitch: .1, yaw: c => -.3 + .1 * Math.sin(c / 1500), lift: 4, frame(p, t, clock, img) { const R = rotX(.09 * Math.sin(clock / 900), 53, 0), a = inout(clamp(p * 1.3));
          const pa = [[-43, 53, 0], [43, 53, 0], [43, -4, 0], [-43, -4, 0]];
          st.fill(pa, .66 * a, R); st.image(img, [-39, 49, 0], [39, 49, 0], [-39, 0, 0], a, R); st.poly(path(pa, true), .7 * p, .9, R, clamp(p * 1.4)); st.model(rig, p);
          if (t > 0 && t < .5) { const f = t / .5, y = -7 - 46 * f * f, Q = [[36, y + 2 * (2.2 + f), 0]]; for (let i = 0; i <= 12; i++) { const g = (35 - i / 12 * 250) * Math.PI / 180; Q.push([36 + 2 * Math.cos(g), y + 2 * Math.sin(g), 0]); } Q.push(Q[0]); st.fill(Q, .3 * (1 - f) * p); st.poly(Q, .9 * (1 - f) * p, .8); } } }; })()
    ];
    const ERASE = 1200, GAP = 400, imgs = [], N = scenes.length, arrows = [$("stepPrev"), $("stepNext")]; let si = 0, pi = 0, clock = 0, t0 = 0, last = 0, seen = false, label = -1;
    const photo = () => { const P = window.PHOTOS || []; if (!P.length) return null; const h = window.SHEET_HOVER, l = window.SHEET_LAST, i = (h != null ? h : l != null ? l : pi) % P.length; window.SHEET_NOW = i; if (!imgs[i]) { imgs[i] = new Image(); imgs[i].src = "./photos/" + P[i].src; } return imgs[i]; };
    const caption = i => { label = i; $("stepNum").textContent = `0${i + 1} / 0${N}`; $("stepName").textContent = scenes[i].name; };
    const show = (s, p, t) => { st.begin(typeof s.yaw === "function" ? s.yaw(clock) : s.yaw + .06 * Math.sin(clock / 2600), s.pitch + .02 * Math.sin(clock / 2100), s.lift, s.zoom || 1); s.frame(p, t, clock, photo()); };
    // The sequence loops. The arrows for stepping through it by hand appear only once it has been seen in full.
    const go = i => { si = (i + N) % N; t0 = clock; caption(si); if (reduce) show(scenes[si], 1, 1); }, unlock = () => arrows.forEach(b => { b.hidden = false; });
    arrows[0].onclick = () => go(si - 1); arrows[1].onclick = () => go(si + 1);
    function frame(now) {
      requestAnimationFrame(frame); const dt = Math.min(64, now - last); last = now; if (!seen || paused()) return;
      clock += dt; let s = scenes[si], e = clock - t0; if (e >= s.draw + s.act + ERASE + GAP) { si = (si + 1) % N; if (!si) { pi++; unlock(); } s = scenes[si]; t0 = clock; e = 0; }
      if (label !== si) caption(si);
      let p = 1, t = 0; const a = s.draw, b = a + s.act, c = b + ERASE;
      if (e < a) p = e / a; else if (e < b) t = (e - a) / s.act; else if (e < c) { const u = (e - b) / ERASE; p = 1 - u * u; t = 1; } else { p = 0; t = 1; }
      show(s, p, t);
    }
    st.size(); plate.classList.add("on"); addEventListener("resize", () => { st.size(); if (reduce) show(scenes[si], 1, 1); });
    if (reduce) { si = 4; caption(4); unlock(); const im = photo(), once = () => show(scenes[si], 1, 1); if (im && !im.complete) im.onload = once; once(); return; }
    watch(cv, v => { if (v && !seen) st.size(); seen = v; });
    requestAnimationFrame(t => { last = t; frame(t); });
  })();

  // ---- develop a print by hand: the paper lies in a tray; rocking the tray with the pointer brings the picture up
  (() => {
    const lab = $("lab"); if (!lab) return; const cv = $("labCanvas"), st = stage(cv, 156, 112), hint = $("labHint"), bar = $("labProg"), clk = $("labClock");
    const tray = model(g => { const a = [[-56, -8, -41], [56, -8, -41], [56, -8, 41], [-56, -8, 41]], b = [[-63, 6, -47], [63, 6, -47], [63, 6, 47], [-63, 6, 47]]; g.loop(...a); g.loop(...b); a.forEach((q, i) => g.line(q, b[i])); g.flat(-66, -50, 66, 50, 6.7); g.line([46, 7.5, -49], [86, 19, -37], [50, 7.5, -45]); });
    const TIME = 90, fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
    let img = null, ar = 1.5, title = "", on = false, own = false, raf = 0, last = 0, clock = 0, draw = 0, prog = 0, energy = 0, slosh = 0, tx = 0, tz = 0, gx = 0, gz = 0, moved = false, done = false, back = null;
    const aim = (x, y) => { const r = cv.getBoundingClientRect(); gz = (.5 - (x - r.left) / r.width) * .5; gx = ((y - r.top) / r.height - .5) * .34; moved = true; };
    function frame(now) {
      raf = requestAnimationFrame(frame); const dt = Math.min(64, now - last); last = now; clock += dt; draw = Math.min(1, draw + dt / 1500);
      const ox = tx, oz = tz; tx += (gx - tx) * .1; tz += (gz - tz) * .1; const agit = Math.abs(tx - ox) + Math.abs(tz - oz);
      energy = Math.min(1, energy * .96 + agit * 6); slosh += (tz - oz) * 260 + dt * .004;
      if (!done && draw >= 1) { prog = Math.min(1, prog + Math.min(agit, .02) * .6 + dt / 70000); if (prog >= 1) finish(); }
      if (!done) { hint.textContent = prog > .04 ? "Keep rocking" : moved ? "Rock the tray" : small() ? "Drag to rock the tray" : "Move the pointer to rock the tray"; clk.textContent = `${fmt(prog * TIME)} / ${fmt(TIME)}`; }
      bar.style.transform = `scaleX(${prog})`;
      const R = chain(rotZ(tz), rotX(tx)), up = inout(clamp(prog)), d = out(draw), w = ar >= 1 ? 80 : 64 * ar, h = ar >= 1 ? 80 / ar : 64, m = 3.6, y = -3.4 + .4 * Math.sin(clock / 500);
      st.begin(-.1 + tz * .25, .86 + tx * .2, 2, small() ? 1.02 : 1);
      const pa = [[-w / 2 - m, y, -h / 2 - m], [w / 2 + m, y, -h / 2 - m], [w / 2 + m, y, h / 2 + m], [-w / 2 - m, y, h / 2 + m]];
      st.fill(pa, .86 * d, R); st.image(img, [-w / 2, y, -h / 2], [w / 2, y, -h / 2], [-w / 2, y, h / 2], up * d, R, `brightness(${(1.9 - .9 * up).toFixed(2)}) contrast(${(.45 + .55 * up).toFixed(2)})`);
      st.poly(path(pa, true), .5 * d, .8, R); st.model(tray, draw, R); st.fill([[-60.5, 1, -45], [60.5, 1, -45], [60.5, 1, 45], [-60.5, 1, 45]], .06 * d, R);
      for (let k = 0; k < 5; k++) { const z = (((slosh + k * 18) % 90) + 90) % 90 - 45, Q = []; for (let x = -59; x <= 59; x += 6) Q.push([x, 1 + (.5 + 2.4 * energy) * Math.sin(x / 9 + clock / 300 + k), z]); st.poly(Q, (.22 + .4 * energy) * d * Math.sin(Math.PI * (z + 45) / 90), .8, R); }
    }
    function finish() { done = true; hint.textContent = "Developed"; clk.textContent = `${title} — ${fmt(clock / 1000)}`; lab.classList.add("done"); try { localStorage.setItem("developed:" + title, "1"); } catch (e) {} }
    function open(i) { const p = (window.PHOTOS || [])[i]; if (!p || on) return; on = true; back = document.activeElement; title = p.title; ar = p.w / p.h; img = new Image(); img.src = "./photos/" + p.src;
      prog = draw = energy = tx = tz = gx = gz = 0; done = moved = false; lab.classList.remove("done"); $("labName").textContent = `Develop — ${p.title}`; lab.hidden = false;
      own = !document.body.classList.contains("locked"); document.body.classList.add("locked", "labbing"); st.size(); void lab.offsetWidth; lab.classList.add("show"); last = performance.now(); raf = requestAnimationFrame(frame); $("labClose").focus({ preventScroll: true }); }
    function close() { if (!on) return; on = false; lab.classList.remove("show"); document.body.classList.remove("labbing"); if (own) document.body.classList.remove("locked");
      setTimeout(() => { cancelAnimationFrame(raf); lab.hidden = true; if (back && back.focus) back.focus({ preventScroll: true }); }, reduce ? 0 : 600); }
    lab.addEventListener("pointermove", e => aim(e.clientX, e.clientY)); lab.addEventListener("touchmove", e => { e.preventDefault(); aim(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    addEventListener("keydown", e => { if (!on) return; if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") { gz = gz > 0 ? -.22 : .22; moved = true; } else if (e.key === "ArrowRight") { gz = gz < 0 ? .22 : -.22; moved = true; } });
    addEventListener("resize", () => { if (on) st.size(); }); $("labClose").onclick = $("labBack").onclick = close;
    window.LAB = { open, isOpen: () => on };
    const starter = $("labOpen"); if (starter) starter.onclick = () => open(window.SHEET_NOW || 0);
  })();
})();
