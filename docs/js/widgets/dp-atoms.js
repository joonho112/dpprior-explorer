// P-11 "A draw G from the Dirichlet process" and P-12 "DP or not: finite versus GEM" (after
// Broderick, MLSS 2016 part I; re-implemented from the mathematics). Owner of this file: Step 6.7.
//
// mode "atoms" (P-11): G = sum_k w_k delta_{phi_k}, w ~ GEM(alpha), phi_k ~ N(0, sigma0^2).
//   (a) the weights over k, (b) the same weights at their locations phi_k, (c) N draws from G,
//   which land exactly on atoms and repeat (a DP draw is discrete).
// mode "compare" (P-12): one GEM(alpha) draw against finite Dirichlet(alpha/K, ..., alpha/K)
//   draws with K = 5 and K = 50. As N grows the finite models' K_N stops at K, the GEM keeps
//   growing like alpha log N. Expected curves: finite K (1 - E(1 - rho)^N) and E(K_N | alpha).
import * as dp from "../dp-core.js";
import { lollipopMarks } from "./lollipop.js";
import { expectedOccupied } from "./paintbox.js";
import { draw, palette, srTable } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtAlpha, fmtCount, fmtProb } from "./format.js";

const GEM_SHOWN = 30;
const K_SMALL = 5;
const K_LARGE = 50;
const N_COMPARE = 10000;

/** K_N after each of n draws from weights w (cumulative search; GEM grows lazily). */
function occupancyPath(weights, rng, n, lazyAlpha = null) {
  const w = [...weights];
  const cum = [];
  let acc = 0;
  for (const x of w) { acc += x; cum.push(acc); }
  let rest = lazyAlpha === null ? 0 : 1 - acc;
  const seen = new Set();
  const path = [];
  for (let i = 1; i <= n; i += 1) {
    const u = rng.next();
    let k = cum.findIndex((c) => u < c);
    while (k < 0 && lazyAlpha !== null) {
      const piece = rest * dp.rbeta1(rng, lazyAlpha);
      rest -= piece;
      w.push(piece);
      cum.push((cum[cum.length - 1] ?? 0) + piece);
      if (u < cum[cum.length - 1]) k = cum.length - 1;
    }
    if (k < 0) k = cum.length - 1; // rounding at the top of a finite stick
    seen.add(k);
    path.push(seen.size);
  }
  return path;
}

export function mountWidget(el, spec = {}) {
  const state = {
    mode: spec.mode === "compare" ? "compare" : "atoms",
    alpha: num(spec, "alpha", 2, 0.1, 20),
    sigma0: num(spec, "sigma0", 1, 0.2, 5),
    N: Math.round(num(spec, "n", 100, 10, 1000)),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    sampleSeed: 1,
    finiteA: spec.preset === "scaled" ? "scaled" : "flat", // Dirichlet(1, ..., 1) or Dirichlet(alpha/K, ...)
  };
  const aFinite = (K) => (state.finiteA === "flat" ? 1 : state.alpha / K);
  let G = null;
  let samples = [];
  let cmp = null;
  const ui = frame(el, {
    label: state.mode === "atoms" ? "A draw G from the Dirichlet process: weights, atoms and draws from G" : "Dirichlet process or not: finite Dirichlet weights against stick-breaking",
    className: "dpx-dp-atoms",
  });
  const pA = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pB = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pC = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pA, pB, pC);
  let width = 720;

  const newG = () => {
    const rng = dp.makeRng(state.seed);
    const gem = dp.rgem(rng, state.alpha);
    G = { w: gem.w, rest: gem.rest, phi: gem.w.map(() => state.sigma0 * dp.rnorm(rng)) };
    sample();
  };
  const sample = () => {
    const rng = dp.makeRng(state.seed * 7919 + state.sampleSeed * 131 + state.N);
    const cum = [];
    let acc = 0;
    for (const x of G.w) { acc += x; cum.push(acc); }
    samples = Array.from({ length: state.N }, () => { const u = rng.next() * acc; const k = Math.max(0, cum.findIndex((c) => u < c)); return k; });
  };
  const newCompare = () => {
    const rng = dp.makeRng(state.seed * 104729 + 7);
    const gem = dp.rgem(rng, state.alpha);
    const small = dp.rdirichlet(rng, new Array(K_SMALL).fill(aFinite(K_SMALL)));
    const large = dp.rdirichlet(rng, new Array(K_LARGE).fill(aFinite(K_LARGE)));
    const r2 = dp.makeRng(state.seed * 104729 + 11);
    cmp = {
      gem, small, large,
      paths: {
        gem: occupancyPath(gem.w, r2, N_COMPARE, state.alpha),
        small: occupancyPath(small, r2, N_COMPARE),
        large: occupancyPath(large, r2, N_COMPARE),
      },
    };
  };

  const renderAtoms = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const w = G.w.slice(0, GEM_SHOWN);
    draw(pA, {
      width, height: 150, marginLeft: 40,
      x: { domain: [0.5, GEM_SHOWN + 0.5], label: null, ticks: [1, 5, 10, 15, 20, 25, 30], tickFormat: (d) => String(d) },
      y: { domain: [0, 1], label: null, ticks: [0, 0.5, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)), grid: true },
      marks: lollipopMarks(w, c, { r: 3.5 }),
    }, `GEM(${fmtAlpha(state.alpha)}) weights w_k for k = 1 to ${w.length}: ${w.slice(0, 6).map(fmtProb).join(", ")}, ...`);
    pA.prepend(h("p", { class: "dpx-panel-title", text: `(a) Weights w_k ~ GEM(${fmtAlpha(state.alpha)}) by index k` }));
    const lim = Math.max(3 * state.sigma0, ...G.phi.slice(0, GEM_SHOWN).map((v) => Math.abs(v))) * 1.05;
    const atoms = G.w.map((wk, k) => ({ k, wk, phi: G.phi[k] })).filter((d) => d.wk > 1e-4);
    const top = atoms.reduce((b, d) => (d.wk > b.wk ? d : b), atoms[0]);
    const base = [];
    for (let i = 0; i <= 120; i += 1) { const v = -lim + (2 * lim * i) / 120; base.push({ v, d: Math.exp(-0.5 * (v / state.sigma0) ** 2) / (state.sigma0 * Math.sqrt(2 * Math.PI)) }); }
    const dMax = Math.max(...base.map((b) => b.d));
    draw(pB, {
      width, height: 170, marginLeft: 40,
      x: { domain: [-lim, lim], label: "phi (location)" },
      y: { domain: [0, 1], label: null, ticks: [0, 0.5, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)), grid: true },
      marks: [
        P.areaY(base, { x: "v", y: (b) => (0.3 * b.d) / dMax, fill: c.slate, fillOpacity: 0.15 }),
        P.ruleX(atoms, { x: "phi", y1: 0, y2: "wk", stroke: c.fg, strokeWidth: 1.5 }),
        P.dot(atoms, { x: "phi", y: "wk", r: 3.5, fill: (d) => c.brod[d.k % 6], stroke: c.stroke, strokeWidth: 0.8 }),
        P.text([top], { x: "phi", y: "wk", dy: -10, dx: top.phi < 0 ? 6 : -6, textAnchor: top.phi < 0 ? "start" : "end", text: (d) => `rho_${d.k + 1} = ${fmtProb(d.wk)} @ phi_${d.k + 1} = ${fmt(d.phi, 2)}`, fill: c.fg, fontWeight: 700, fontSize: 11 }),
      ],
    }, `G = sum of w_k at phi_k: ${atoms.length} atoms above 1e-4 on the real line; the largest has weight ${fmtProb(top.wk)} at ${fmt(top.phi, 2)}. Shaded: the base distribution N(0, ${fmt(state.sigma0, 2)}^2).`);
    pB.prepend(h("p", { class: "dpx-panel-title", text: `(b) The same weights at their locations phi_k ~ N(0, ${fmt(state.sigma0, 2)}^2): G = sum w_k delta(phi_k)` }));
    // (c) draws from G stack up on the atoms
    const stacks = new Map();
    const pts = samples.map((k) => { const n = (stacks.get(k) ?? 0) + 1; stacks.set(k, n); return { k, x: G.phi[k], n }; });
    const maxStack = Math.max(1, ...stacks.values());
    draw(pC, {
      width, height: 190, marginLeft: 40,
      x: { domain: [-lim, lim], label: "x (a draw from G)" },
      y: { domain: [0, maxStack + 1], label: "draws at this value", grid: true },
      marks: [P.dot(pts, { x: "x", y: "n", r: Math.max(1.5, Math.min(4, 120 / maxStack)), fill: (d) => c.brod[d.k % 6], stroke: c.stroke, strokeOpacity: 0.3, strokeWidth: 0.5 })],
    }, `${state.N} draws from G land on ${stacks.size} distinct values; the most repeated value appears ${maxStack} times.`);
    pC.prepend(h("p", { class: "dpx-panel-title", text: `(c) ${state.N} draws from G: they land exactly on atoms and repeat (${stacks.size} distinct values)` }));
    pC.append(srTable("Distinct values among the draws", ["atom k", "phi_k", "draws"], [...stacks.entries()].sort((p, q) => q[1] - p[1]).slice(0, 12).map(([k, n]) => [k + 1, fmt(G.phi[k], 2), n])));
    ui.readout.textContent =
      `alpha = ${fmtAlpha(state.alpha)}: the largest atom holds ${fmtProb(top.wk)}. ${state.N} draws from G take ${stacks.size} distinct values (E(K_N | alpha) = ${fmtCount(dp.condMean(state.N, state.alpha))}): a Dirichlet process draw is a discrete distribution, so draws from it repeat.`;
    ui.root.dataset.distinct = String(stacks.size);
  };

  const renderCompare = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const bar = (name, w, restLabel) => {
      let x0 = 0;
      return w.map((v, k) => { const s = { row: name, x1: x0, x2: x0 + v, k }; x0 += v; return s; }).concat(restLabel && x0 < 1 ? [{ row: name, x1: x0, x2: 1, k: -1 }] : []);
    };
    const rows = [`GEM(${fmtAlpha(state.alpha)})`, `finite K = ${K_SMALL}`, `finite K = ${K_LARGE}`];
    const segs = [...bar(rows[0], cmp.gem.w, true), ...bar(rows[1], cmp.small), ...bar(rows[2], cmp.large)];
    draw(pA, {
      width, height: 140, marginLeft: 110, marginRight: 12,
      x: { domain: [0, 1], label: null, ticks: [0, 0.5, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)) },
      y: { domain: rows, label: null },
      marks: [P.barX(segs, { x1: "x1", x2: "x2", y: "row", fill: (d) => (d.k < 0 ? c.unused : c.brod[d.k % 6]), stroke: c.raised, strokeWidth: 0.6, inset: 0 })],
    }, `Weights of one draw each: GEM(${fmtAlpha(state.alpha)}) with ${cmp.gem.w.length} pieces, and Dirichlet with ${K_SMALL} and with ${K_LARGE} components (${state.finiteA === "flat" ? "every a_k = 1" : "a_k = alpha/K"}).`);
    pA.prepend(h("p", { class: "dpx-panel-title", text: state.finiteA === "flat"
      ? `Weights: stick-breaking GEM(${fmtAlpha(state.alpha)}) against flat Dirichlet(1, ..., 1) with K = ${K_SMALL} and ${K_LARGE}`
      : `Weights with the same total mass alpha = ${fmtAlpha(state.alpha)}: GEM against Dirichlet(alpha/K) with K = ${K_SMALL} and ${K_LARGE}` }));
    const Ns = [];
    for (let n = 1; n <= N_COMPARE; n = Math.max(n + 1, Math.round(n * 1.15))) Ns.push(n);
    const lines = [];
    for (const n of Ns) {
      lines.push({ n, v: cmp.paths.gem[n - 1], s: rows[0], kind: "this draw" });
      lines.push({ n, v: cmp.paths.small[n - 1], s: rows[1], kind: "this draw" });
      lines.push({ n, v: cmp.paths.large[n - 1], s: rows[2], kind: "this draw" });
    }
    const expected = Ns.flatMap((n) => [
      { n, v: dp.condMean(n, state.alpha), s: rows[0] },
      { n, v: expectedOccupied(K_SMALL, aFinite(K_SMALL), n), s: rows[1] },
      { n, v: expectedOccupied(K_LARGE, aFinite(K_LARGE), n), s: rows[2] },
    ]);
    const colours = [c.brod[0], c.brod[1], c.brod[2]];
    draw(pB, {
      width, height: 280, marginLeft: 44,
      x: { type: "log", domain: [1, N_COMPARE], label: "N (draws, log scale)", grid: true },
      y: { domain: [0, Math.max(K_LARGE, ...lines.map((d) => d.v)) + 2], label: "K_N (distinct components used)", grid: true },
      color: { domain: rows, range: colours, legend: true },
      marks: [
        P.ruleY([K_SMALL, K_LARGE], { stroke: c.borderStrong, strokeDasharray: "2,3" }),
        P.line(expected, { x: "n", y: "v", stroke: "s", strokeDasharray: "5,4", strokeWidth: 1.2 }),
        P.line(lines, { x: "n", y: "v", stroke: "s", strokeWidth: 2.2, curve: "step-after" }),
      ],
    }, `K_N against N for one draw of each model (solid) and its expectation (dashed): after ${N_COMPARE} draws the GEM reaches ${cmp.paths.gem[N_COMPARE - 1]}, finite K = ${K_SMALL} ${cmp.paths.small[N_COMPARE - 1]}, finite K = ${K_LARGE} ${cmp.paths.large[N_COMPARE - 1]}.`);
    pB.prepend(h("p", { class: "dpx-panel-title", text: "How many components N draws use: solid = these draws, dashed = expectation, dotted = the ceilings K" }));
    const at = (n) => `N = ${n}: GEM ${cmp.paths.gem[n - 1]}, K = ${K_SMALL}: ${cmp.paths.small[n - 1]}, K = ${K_LARGE}: ${cmp.paths.large[n - 1]}`;
    pC.replaceChildren(h("p", { class: "dpx-caption-note", text: `${at(100)}; ${at(1000)}; ${at(N_COMPARE)}.` }));
    ui.readout.textContent =
      `alpha = ${fmtAlpha(state.alpha)}: a finite mixture can never use more than its K components, so K_N stops at ${K_SMALL} or ${K_LARGE}; the stick-breaking (Dirichlet process) weights keep supplying new components, and K_N keeps growing like alpha log N (expected ${fmtCount(dp.condMean(N_COMPARE, state.alpha))} at N = ${N_COMPARE}). ` +
      (state.finiteA === "flat" ? "Choose the Dirichlet process for this growth behaviour." : `With a_k = alpha/K the K = ${K_LARGE} mixture imitates the Dirichlet process for a long time (expected ${fmtCount(expectedOccupied(K_LARGE, aFinite(K_LARGE), N_COMPARE))} at N = ${N_COMPARE}), but it still cannot pass ${K_LARGE}.`);
    ui.root.dataset.paths = JSON.stringify([cmp.paths.gem[N_COMPARE - 1], cmp.paths.small[N_COMPARE - 1], cmp.paths.large[N_COMPARE - 1]]);
  };

  const render = () => {
    const t0 = performance.now();
    if (state.mode === "atoms") renderAtoms(); else renderCompare();
    sS0.root.hidden = state.mode !== "atoms";
    finiteSeg.root.hidden = state.mode !== "compare";
    sN.root.hidden = state.mode !== "atoms";
    bSample.hidden = state.mode !== "atoms";
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };
  const regenerate = () => { if (state.mode === "atoms") newG(); else newCompare(); };
  const finiteSeg = segmented({ label: "finite a_k", options: [{ value: "flat", label: "1 (flat)" }, { value: "scaled", label: "alpha/K (same total mass)" }], value: state.finiteA, onChange: (v) => { state.finiteA = v; newCompare(); render(); } });
  const modeSeg = segmented({ label: "Show", options: [{ value: "atoms", label: "a draw G (P-11)" }, { value: "compare", label: "DP or not (P-12)" }], value: state.mode, onChange: (v) => { state.mode = v; regenerate(); render(); } });
  const sAlpha = slider({ label: "alpha", min: 0.1, max: 20, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { state.alpha = v; regenerate(); render(); } });
  const sS0 = slider({ label: "sigma0 (spread of G0)", min: 0.2, max: 5, value: state.sigma0, log: true, format: (v) => fmt(v, 2), onInput: (v) => { state.sigma0 = v; newG(); render(); } });
  const sN = slider({ label: "N (draws from G)", min: 10, max: 1000, step: 1, value: state.N, format: (v) => String(Math.round(v)), onInput: (v) => { state.N = Math.round(v); sample(); render(); } });
  const bNew = button({ label: "New G", primary: true, onClick: () => { state.seed += 1; regenerate(); render(); } });
  const bSample = button({ label: "Sample N points", onClick: () => { state.sampleSeed += 1; sample(); render(); } });
  ui.controls.append(modeSeg.root, sAlpha.root, finiteSeg.root, sS0.root, sN.root, h("div", { class: "dpx-control dpx-buttons" }, bNew, bSample));
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part I). The base distribution G0 = N(0, sigma0^2) says where atoms go; alpha says how the mass is shared among them. Draws are seeded.";
  const unbind = bindPrimaryKey(ui.root, () => bNew.click());
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  regenerate();
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.mode !== undefined) { state.mode = next.mode === "compare" ? "compare" : "atoms"; modeSeg.set(state.mode); }
      if (next.alpha !== undefined) { state.alpha = num(next, "alpha", state.alpha, 0.1, 20); sAlpha.set(state.alpha); }
      if (next.n !== undefined) { state.N = Math.round(num(next, "n", state.N, 10, 1000)); sN.set(state.N); }
      if (next.seed !== undefined) state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9));
      regenerate();
      render();
    },
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}
