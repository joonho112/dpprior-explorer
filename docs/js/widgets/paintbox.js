// P-03 large-K paintbox and P-04 order-of-appearance staircase (after Broderick, MLSS 2016
// part I, demos 3 and 4; re-implemented from the mathematics). Owner of this file: Step 6.3.
//
// rho ~ Dirichlet(a, ..., a) with K = 1000 components and a = 0.01 splits the unit interval
// into K pieces (the paintbox). Each drop is a uniform u; the piece containing u becomes
// occupied. Components (K) and clusters (the occupied pieces, K_N after N drops) are
// different numbers: K_N grows slowly, with E[K_N] = K (1 - E[(1 - rho_k)^N]) and
// E[(1 - rho_k)^N] = Gamma(K a) Gamma((K - 1) a + N) / (Gamma((K - 1) a) Gamma(K a + N)).
// With K a = alpha fixed and K large this is the Dirichlet process with concentration alpha.
import * as dp from "../dp-core.js";
import { draw, palette } from "./chart.js";
import { button, frame, h, num, observeWidth, reducedMotion, slider, toggle } from "./base.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const A_MIN = 0.001;
const A_MAX = 1;
const K_MIN = 100;
const K_MAX = 5000;
const FALL_MS = 380; // one falling marker
const RAIN_MS = 60; // gap between markers in a burst of ten
const INSPECT = 50; // largest pieces reachable with the keyboard picker
const GRID_ASPECT = 5; // columns : rows of the component grid

/** E[K_N] for N uniform drops on a Dirichlet(a, ..., a) paintbox with K pieces. */
export function expectedOccupied(K, a, N) {
  if (N === 0) return 0;
  const l = dp.lgamma(K * a) + dp.lgamma((K - 1) * a + N) - dp.lgamma((K - 1) * a) - dp.lgamma(K * a + N);
  return K * -Math.expm1(l);
}

export function mountWidget(el, spec = {}) {
  const state = {
    K: Math.round(num(spec, "K", 1000, K_MIN, K_MAX)),
    a: num(spec, "a", 0.01, A_MIN, A_MAX),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    logx: false,
    pick: null,
  };
  let rho = [];
  let starts = [];
  let hits = []; // per drop: { n, k, order }
  let firstHit = new Map(); // piece -> order of appearance
  let dropRng = null;
  let queue = [];
  let timer = 0;
  let falling = null; // { u, t0 }
  const ui = frame(el, { label: "Paintbox: uniform drops on a Dirichlet partition of the unit interval, and the order in which pieces are first hit", className: "dpx-paintbox" });
  const pBox = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pStair = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pBox, pStair);
  const boxTitle = h("p", { class: "dpx-panel-title" });
  const canvas = h("canvas", { role: "img" });
  const note = h("p", { class: "dpx-caption-note", "aria-live": "polite" });
  pBox.append(boxTitle, canvas, note);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part I). The bar is the unit interval cut into K pieces of sizes rho_1, ..., rho_K (in index order; most are too thin to see). Grey pieces have not been hit, blue ones have. Draws are seeded.";
  let width = 720;

  const newRho = () => {
    rho = dp.rdirichlet(dp.makeRng(state.seed), new Array(state.K).fill(state.a));
    starts = [];
    let acc = 0;
    for (const w of rho) { starts.push(acc); acc += w; }
    resetDrops();
  };
  const resetDrops = () => {
    hits = [];
    firstHit = new Map();
    dropRng = dp.makeRng(state.seed * 7919 + 17);
    queue = [];
    clearTimeout(timer);
    falling = null;
  };
  const pieceAt = (u) => {
    let lo = 0;
    let hi = rho.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= u) lo = mid; else hi = mid - 1;
    }
    return lo;
  };
  const landDrop = (u) => {
    const k = pieceAt(u);
    const first = !firstHit.has(k);
    if (first) firstHit.set(k, firstHit.size + 1);
    hits.push({ n: hits.length + 1, k, order: firstHit.get(k), u, first });
  };
  const dropNow = (n) => { for (let i = 0; i < n; i += 1) landDrop(dropRng.next()); };

  const drawBox = () => {
    const c = palette(ui.root);
    const W = width;
    const barY = 34;
    const barH = 30;
    // below the bar: the same K components as equal cells, so occupied and empty ones can be counted
    const cols = Math.ceil(Math.sqrt(state.K * GRID_ASPECT));
    const cell = Math.max(2, Math.floor((W - 16) / cols));
    const rows = Math.ceil(state.K / cols);
    const gridY = barY + barH + 22;
    const H = gridY + rows * cell + 6;
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext?.("2d");
    const occupied = firstHit.size;
    boxTitle.textContent = `Paintbox: K = ${state.K} pieces, a = ${fmt(state.a, 3)} (K a = ${fmt(state.K * state.a, 2)}); ${hits.length} drops hit ${occupied} ${occupied === 1 ? "piece" : "pieces"}`;
    canvas.setAttribute("aria-label", `Unit interval cut into ${state.K} pieces; ${hits.length} uniform drops have hit ${occupied} distinct pieces; the largest piece has rho = ${fmtProb(Math.max(...rho))}. Below, the ${state.K} components as equal cells, ${occupied} of them blue.`);
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const x = (v) => 8 + v * (W - 16);
    for (let k = 0; k < rho.length; k += 1) {
      const w = rho[k] * (W - 16);
      if (w < 0.05 && !firstHit.has(k)) continue;
      ctx.fillStyle = firstHit.has(k) ? c.brod[0] : c.unused;
      ctx.fillRect(x(starts[k]), barY, Math.max(firstHit.has(k) ? 1 : 0.2, w), barH);
    }
    ctx.strokeStyle = c.borderStrong;
    ctx.lineWidth = 1;
    ctx.strokeRect(x(0), barY, W - 16, barH);
    if (state.pick !== null) {
      const k = state.pick;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2;
      ctx.strokeRect(x(starts[k]) - 1, barY - 2, Math.max(2, rho[k] * (W - 16)) + 2, barH + 4);
    }
    ctx.fillStyle = c.muted;
    ctx.font = "11px sans-serif";
    ctx.fillText(`the same ${state.K} components as equal cells (blue = occupied)`, 8, gridY - 6);
    for (let k = 0; k < state.K; k += 1) {
      ctx.fillStyle = firstHit.has(k) ? c.brod[0] : c.unused;
      ctx.fillRect(8 + (k % cols) * cell, gridY + Math.floor(k / cols) * cell, cell - 1, cell - 1);
    }
    // recent drops as ticks above the bar, the falling marker as a red triangle
    ctx.fillStyle = c.marker;
    for (const d of hits.slice(-12)) ctx.fillRect(x(d.u) - 0.75, barY - 6, 1.5, 6);
    if (falling) {
      const f = Math.min(1, (performance.now() - falling.t0) / FALL_MS);
      const y = 4 + f * (barY - 12);
      ctx.beginPath();
      ctx.moveTo(x(falling.u) - 6, y);
      ctx.lineTo(x(falling.u) + 6, y);
      ctx.lineTo(x(falling.u), y + 10);
      ctx.closePath();
      ctx.fill();
    }
  };

  const drawStair = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const N = hits.length;
    const exp = expectedOccupied(state.K, state.a, Math.max(1, N));
    const occupied = firstHit.size;
    const firsts = hits.filter((d) => d.first);
    draw(pStair, {
      width, height: 240, marginLeft: 44, marginBottom: 36,
      x: { type: state.logx ? "log" : "linear", domain: [1, Math.max(10, N)], label: `sample index (${state.logx ? "log scale" : "linear"})`, grid: true },
      y: { domain: [0, Math.max(5, occupied + 1)], label: "cluster by order of appearance", grid: true },
      marks: [
        P.dot(hits, { x: "n", y: "order", r: 2, fill: c.slate, fillOpacity: 0.55 }),
        P.dot(firsts, { x: "n", y: "order", r: 3.5, fill: c.brod[0] }),
        P.line(firsts, { x: "n", y: "order", stroke: c.brod[0], strokeWidth: 1.2, curve: "step-after" }),
      ],
    }, `Order-of-appearance staircase: ${N} drops, ${occupied} distinct pieces; new pieces appear ever more rarely (expected ${fmtCount(exp)} after ${N} drops).`);
    pStair.prepend(h("p", { class: "dpx-panel-title", text: `Order of appearance: each drop at (drop number, which new piece it was); blue marks a first hit. Components ${state.K}, clusters ${occupied}` }));
    ui.readout.textContent =
      `${N} drops: ${occupied} of the ${state.K} pieces are occupied (expected ${fmtCount(exp)} for a fresh paintbox with these K and a). ` +
      `Components (${state.K}) and clusters (${occupied}) are different numbers. With K a = ${fmt(state.K * state.a, 2)} held fixed and K large, this is the Dirichlet process with alpha = K a.`;
    ui.root.dataset.occupied = String(occupied);
    ui.root.dataset.expected = String(exp);
  };

  const describe = (k) => `Piece ${k + 1}: rho = ${rho[k] < 0.0005 ? rho[k].toExponential(1) : fmtProb(rho[k])}${firstHit.has(k) ? `, occupied (cluster ${firstHit.get(k)} in order of appearance)` : ", not hit yet"}.`;
  const render = () => {
    const t0 = performance.now();
    drawBox();
    drawStair();
    if (state.pick !== null) note.textContent = describe(state.pick);
    else if (!note.textContent) note.textContent = "Hover over the bar, or use the piece picker, to read one piece's rho_k.";
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  const pump = () => {
    if (!queue.length) { timer = 0; return; }
    const u = queue.shift();
    if (reducedMotion()) { landDrop(u); pump(); render(); return; }
    falling = { u, t0: performance.now() };
    const step = () => {
      if (performance.now() - falling.t0 < FALL_MS) { drawBox(); timer = setTimeout(step, 16); return; }
      falling = null;
      landDrop(u);
      render();
      timer = setTimeout(pump, queue.length ? RAIN_MS : 0);
    };
    step();
  };
  const drop = (n) => {
    const us = Array.from({ length: n }, () => dropRng.next());
    if (n > 10 || reducedMotion()) {
      queue = [];
      clearTimeout(timer);
      if (falling) { landDrop(falling.u); falling = null; }
      us.forEach(landDrop);
      render();
      return;
    }
    queue.push(...us);
    if (!timer) pump();
  };

  canvas.addEventListener("pointermove", (ev) => {
    const r = canvas.getBoundingClientRect();
    const u = (ev.clientX - r.left - 8) / (r.width - 16);
    if (u < 0 || u >= 1) return;
    state.pick = pieceAt(u);
    note.textContent = describe(state.pick);
    drawBox();
  });
  canvas.addEventListener("pointerleave", () => { state.pick = null; drawBox(); });

  const bySize = () => rho.map((w, k) => [w, k]).sort((p, q) => q[0] - p[0]).slice(0, INSPECT).map((p) => p[1]);
  const picker = slider({ label: "Inspect piece (by size rank)", min: 1, max: INSPECT, step: 1, value: 1, format: (v) => String(Math.round(v)), onInput: (v) => { state.pick = bySize()[Math.round(v) - 1]; note.textContent = describe(state.pick); drawBox(); } });
  const sA = slider({ label: "a (each piece)", min: A_MIN, max: A_MAX, value: state.a, log: true, format: (v) => fmt(v, 3), onInput: (v) => { state.a = v; newRho(); render(); } });
  const sK = slider({ label: "K (pieces)", min: K_MIN, max: K_MAX, step: 1, value: state.K, format: (v) => String(Math.round(v)), onInput: (v) => { state.K = Math.round(v); newRho(); render(); } });
  const b1 = button({ label: "Drop 1", primary: true, onClick: () => drop(1) });
  const b10 = button({ label: "Drop 10", onClick: () => drop(10) });
  const b100 = button({ label: "Drop 100", onClick: () => drop(100) });
  const bNew = button({ label: "New rho", onClick: () => { state.seed += 1; newRho(); render(); } });
  const logT = toggle({ label: "log x (staircase)", checked: state.logx, onChange: (v) => { state.logx = v; render(); } });
  ui.controls.append(sA.root, sK.root, h("div", { class: "dpx-control dpx-buttons" }, b1, b10, b100, bNew), logT.root, picker.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  newRho();
  dropNow(Math.round(num(spec, "n", 0, 0, 5000)));
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.K !== undefined) { state.K = Math.round(num(next, "K", state.K, K_MIN, K_MAX)); sK.set(state.K); }
      if (next.a !== undefined) { state.a = num(next, "a", state.a, A_MIN, A_MAX); sA.set(state.a); }
      if (next.seed !== undefined) state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9));
      newRho();
      if (next.n !== undefined) dropNow(Math.round(num(next, "n", 0, 0, 5000)));
      render();
    },
    drop,
    destroy() { clearTimeout(timer); stop(); el.replaceChildren(); },
  };
}
