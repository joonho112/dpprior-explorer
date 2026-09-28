// P-01 Beta lollipop and P-02 Dirichlet lollipop + ternary (after Broderick, MLSS 2016 part I,
// demos 1 and 2; re-implemented from the mathematics). Owner of this file: Step 6.2; Step 6.6
// imports lollipopMarks.
//
// rho ~ Dirichlet(a_1, ..., a_K); K = 2 is Beta(a_1, a_2) for rho_1 with rho_2 = 1 - rho_1.
// Small a: nearly all-or-nothing draws (one rho_k close to 1). Large a: nearly even, 1/K each.
// K = 3 adds a ternary view: each draw is a point in the triangle rho_1 + rho_2 + rho_3 = 1.
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, reducedMotion, segmented, slider, toggle } from "./base.js";
import { fmt, fmtProb } from "./format.js";

const A_MIN = 0.01;
const A_MAX = 1000;
const K_MAX = 12;
const GHOSTS = 20;
const CLOUD = 300; // draws in the ternary cloud
const AUTO_MS = 500; // auto-draw at 2 Hz
const TERNARY = [
  { key: "corners", label: "a = 0.5", a: [0.5, 0.5, 0.5] },
  { key: "centre", label: "a = 5", a: [5, 5, 5] },
  { key: "tilted", label: "a = (40, 10, 10)", a: [40, 10, 10] },
];
const SQRT3_2 = Math.sqrt(3) / 2;

/** Plot marks for one lollipop row: stems from 0 to value_k at x = k (1-based), coloured dots. */
export function lollipopMarks(values, c, { x0 = 1, r = 5, stroke } = {}) {
  const P = globalThis.Plot;
  const pts = values.map((v, i) => ({ k: x0 + i, v, i }));
  return [
    P.ruleX(pts, { x: "k", y1: 0, y2: "v", stroke: stroke ?? c.fg, strokeWidth: 1.5 }),
    P.dot(pts, { x: "k", y: "v", r, fill: (d) => c.brod[d.i % 6], stroke: c.stroke, strokeWidth: 0.8 }),
  ];
}

/** Beta(a, b) density on a grid over (0, 1), clipped at `top`. */
export function betaDensity(a, b, n = 200, top = 6) {
  const lB = dp.lgamma(a) + dp.lgamma(b) - dp.lgamma(a + b);
  const out = [];
  for (let i = 1; i < n; i += 1) {
    const x = i / n;
    out.push({ x, d: Math.min(top, Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - lB)) });
  }
  return out;
}

const ternaryXY = (r) => ({ x: r[1] + r[2] / 2, y: r[2] * SQRT3_2 });

export function mountWidget(el, spec = {}) {
  const K0 = Math.round(num(spec, "K", 3, 2, K_MAX));
  const a0 = num(spec, "a", 1, A_MIN, A_MAX);
  const state = {
    K: K0,
    linked: true,
    a: a0,
    each: new Array(K_MAX).fill(a0),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    ghostsOn: Boolean(spec.ghosts ?? true),
    auto: false,
  };
  let rng = dp.makeRng(state.seed);
  let rho = [];
  let ghosts = [];
  let cloud = [];
  let timer = 0;
  const ui = frame(el, { label: "Beta and Dirichlet lollipops: random probability vectors and how the parameter a shapes them", className: "dpx-lollipop" });
  const pMain = h("div", { class: "dpx-panel" });
  const pSide = h("div", { class: "dpx-panel" });
  ui.charts.append(pMain, pSide);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part I). Each draw is a probability vector rho = (rho_1, ..., rho_K) that sums to one; stems show this draw, faint dots the previous twenty. K = 2 is the Beta distribution. Draws are seeded.";
  let width = 720;
  const params = () => (state.linked ? new Array(state.K).fill(state.a) : state.each.slice(0, state.K));
  const half = () => (width >= 640 ? Math.floor((width - 16) / 2) : width);

  const newDraw = () => {
    if (rho.length === state.K) ghosts = [rho, ...ghosts].slice(0, GHOSTS);
    rho = dp.rdirichlet(rng, params());
  };
  const newCloud = () => {
    const r2 = dp.makeRng(state.seed * 7919 + state.K);
    cloud = state.K === 3 ? Array.from({ length: CLOUD }, () => dp.rdirichlet(r2, params())) : [];
  };

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { K } = state;
    const a = params();
    const aSum = a.reduce((s, x) => s + x, 0);
    const ghostPts = state.ghostsOn ? ghosts.flatMap((g) => g.map((v, i) => ({ k: i + 1, v }))) : [];
    draw(pMain, {
      width: half(), height: 260, marginLeft: 40,
      x: { domain: [0.5, K + 0.5], label: null, ticks: Array.from({ length: K }, (_, i) => i + 1), tickFormat: (d) => String(d) },
      y: { domain: [0, 1], label: "rho_k", grid: true, ticks: [0, 0.25, 0.5, 0.75, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 2)) },
      marks: [
        P.dot(ghostPts, { x: "k", y: "v", r: 3, fill: c.slate, fillOpacity: 0.25 }),
        ...lollipopMarks(rho, c),
        P.ruleY([1 / K], { stroke: c.borderStrong, strokeDasharray: "3,3" }),
      ],
    }, `This draw of rho under ${K === 2 ? "Beta" : "Dirichlet"}(${a.map((x) => fmt(x, 2)).join(", ")}): ${rho.map((v) => fmtProb(v)).join(", ")}; the dashed line is 1/K.`);
    pMain.prepend(h("p", { class: "dpx-panel-title", text: K === 2 ? `Beta(${fmt(a[0], 2)}, ${fmt(a[1], 2)}): rho_1 and rho_2 = 1 - rho_1 by component k` : `Dirichlet with K = ${K}: rho_k by component k, this draw and the previous ${state.ghostsOn ? ghosts.length : 0}` }));
    pMain.append(srTable("This draw", ["k", "rho_k"], rho.map((v, i) => [i + 1, fmtProb(v)])));

    if (K === 2) {
      const top = 6;
      const dens = betaDensity(a[0], a[1], 200, top);
      draw(pSide, {
        width: half(), height: 260, marginLeft: 40,
        x: { domain: [0, 1], label: "rho_1", ticks: [0, 0.5, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)) },
        y: { domain: [0, top], label: "density (clipped at 6)", grid: true },
        marks: [
          P.areaY(dens, { x: "x", y: "d", fill: c.slate, fillOpacity: 0.18 }),
          P.lineY(dens, { x: "x", y: "d", stroke: c.fg, strokeWidth: 1.6 }),
          P.tickX(state.ghostsOn ? ghosts.map((g) => ({ x: g[0] })) : [], { x: "x", stroke: c.slate, strokeOpacity: 0.5 }),
          P.ruleX([rho[0]], { stroke: c.red, strokeWidth: 2.4 }),
        ],
      }, `Beta(${fmt(a[0], 2)}, ${fmt(a[1], 2)}) density of rho_1 with this draw, ${fmtProb(rho[0])}, marked.`);
      pSide.prepend(h("p", { class: "dpx-panel-title", text: `Where this rho_1 = ${fmtProb(rho[0])} falls under the Beta density` }));
    } else if (K === 3) {
      const tri = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: SQRT3_2 }, { x: 0, y: 0 }];
      const pts = cloud.map(ternaryXY);
      const cur = ternaryXY(rho);
      const side = Math.min(half(), 340);
      draw(pSide, {
        width: side, height: Math.round(side * 0.92), margin: 24,
        x: { domain: [-0.05, 1.05], axis: null },
        y: { domain: [-0.08, SQRT3_2 + 0.06], axis: null },
        marks: [
          P.line(tri, { x: "x", y: "y", stroke: c.borderStrong }),
          P.dot(pts, { x: "x", y: "y", r: 1.8, fill: c.slate, fillOpacity: 0.45 }),
          P.dot([cur], { x: "x", y: "y", r: 6, fill: c.red, stroke: c.fg }),
          P.text([{ x: 0, y: 0, t: "rho_1 = 1" }, { x: 1, y: 0, t: "rho_2 = 1" }], { x: "x", y: "y", text: "t", dy: 14, fill: c.muted, fontSize: 11 }),
          P.text([{ x: 0.5, y: SQRT3_2, t: "rho_3 = 1" }], { x: "x", y: "y", text: "t", dy: -10, fill: c.muted, fontSize: 11 }),
        ],
      }, `Ternary view: ${CLOUD} draws under Dirichlet(${a.map((x) => fmt(x, 2)).join(", ")}) as points in the triangle, this draw in red.`);
      pSide.prepend(h("p", { class: "dpx-panel-title", text: `${CLOUD} draws in the triangle rho_1 + rho_2 + rho_3 = 1 (this draw in red)` }));
    } else {
      pSide.replaceChildren(h("p", { class: "dpx-panel-title", text: "Set K = 2 for the Beta density or K = 3 for the ternary view." }));
    }
    const max = Math.max(...rho);
    ui.readout.textContent =
      `${K === 2 ? "Beta" : "Dirichlet"}(${a.map((x) => fmt(x, 2)).join(", ")}): largest rho_k in this draw = ${fmtProb(max)}; E(rho_k) = a_k / sum(a) = ${a.map((x) => fmtProb(x / aSum)).slice(0, 4).join(", ")}${K > 4 ? ", ..." : ""}. ` +
      (Math.min(...a) < 0.2 ? "Small a: draws are nearly all-or-nothing." : Math.min(...a) > 50 ? "Large a: draws sit close to their mean." : "");
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.rho = JSON.stringify(rho);
    if (cloud.length) {
      ui.root.dataset.cloudMeanRho1 = String(cloud.reduce((s, r) => s + r[0], 0) / cloud.length);
      ui.root.dataset.cloudCornerShare = String(cloud.filter((r) => Math.max(...r) > 0.8).length / cloud.length);
    }
  };

  const again = () => { newDraw(); render(); };
  const reset = () => { ghosts = []; rho = []; newDraw(); newCloud(); render(); };
  const sK = slider({ label: "K (components)", min: 2, max: K_MAX, step: 1, value: state.K, format: (v) => String(Math.round(v)), onInput: (v) => { state.K = Math.round(v); rebuildEach(); triSeg.root.hidden = state.K !== 3; reset(); } });
  const sA = slider({ label: "a (every component)", min: A_MIN, max: A_MAX, value: state.a, log: true, format: (v) => fmt(v, v < 1 ? 2 : v < 100 ? 1 : 0), onInput: (v) => { state.a = v; state.each.fill(v); triSeg.set(null); reset(); } });
  const eachBox = h("div", { class: "dpx-control dpx-toggle-group" });
  const rebuildEach = () => {
    eachBox.replaceChildren(...Array.from({ length: state.K }, (_, i) => slider({ label: `a_${i + 1}`, min: A_MIN, max: A_MAX, value: state.each[i], log: true, format: (v) => fmt(v, v < 1 ? 2 : v < 100 ? 1 : 0), onInput: (v) => { state.each[i] = v; triSeg.set(null); reset(); } }).root));
    eachBox.hidden = state.linked;
  };
  const linkT = toggle({ label: "set each a_k", checked: !state.linked, onChange: (v) => { state.linked = !v; if (state.linked) state.each.fill(state.a); rebuildEach(); sA.root.hidden = !state.linked; reset(); } });
  const drawBtn = button({ label: "Draw again", primary: true, onClick: again });
  const autoT = toggle({ label: "auto-draw (2 per second)", checked: false, onChange: (v) => {
    state.auto = v;
    clearInterval(timer);
    if (v) timer = setInterval(again, AUTO_MS);
  } });
  const ghostT = toggle({ label: "ghosts x20", checked: state.ghostsOn, onChange: (v) => { state.ghostsOn = v; render(); } });
  const triSeg = segmented({ label: "Ternary presets", options: TERNARY.map((p) => ({ value: p.key, label: p.label })), value: null,
    onChange: (v) => { const p = TERNARY.find((q) => q.key === v); state.linked = p.a.every((x) => x === p.a[0]); state.a = p.a[0]; p.a.forEach((x, i) => (state.each[i] = x)); linkT.set(!state.linked); sA.set(state.a); sA.root.hidden = !state.linked; rebuildEach(); reset(); } });
  triSeg.root.hidden = state.K !== 3;
  rebuildEach();
  ui.controls.append(sK.root, sA.root, linkT.root, eachBox, h("div", { class: "dpx-control dpx-buttons" }, drawBtn), autoT.root, ghostT.root, triSeg.root);
  const unbind = bindPrimaryKey(ui.root, again);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  newDraw();
  newCloud();
  render();
  ready = true;
  if (reducedMotion()) autoT.root.title = "auto-draw replaces the draw twice a second; it has no animation";
  const api = {
    update(next = {}) {
      if (next.K !== undefined) { state.K = Math.round(num(next, "K", state.K, 2, K_MAX)); sK.set(state.K); triSeg.root.hidden = state.K !== 3; }
      if (next.a !== undefined) { state.a = num(next, "a", state.a, A_MIN, A_MAX); state.each.fill(state.a); state.linked = true; linkT.set(false); sA.set(state.a); sA.root.hidden = false; }
      if (next.preset !== undefined) { const p = TERNARY.find((q) => q.key === next.preset); if (p) { state.K = 3; sK.set(3); triSeg.root.hidden = false; triSeg.set(p.key); state.linked = p.a.every((x) => x === p.a[0]); state.a = p.a[0]; p.a.forEach((x, i) => (state.each[i] = x)); linkT.set(!state.linked); sA.set(state.a); sA.root.hidden = !state.linked; } }
      if (next.seed !== undefined) { state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9)); rng = dp.makeRng(state.seed); }
      rebuildEach();
      reset();
    },
    draw: again,
    destroy() { clearInterval(timer); stop(); unbind(); el.replaceChildren(); },
  };
  if (TERNARY.some((p) => p.key === spec.preset)) api.update({ preset: spec.preset });
  return api;
}
