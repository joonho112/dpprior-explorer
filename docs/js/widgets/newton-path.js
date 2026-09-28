// C-07 "Stage 1 -> Stage 2: the Newton path of TSMM". Owner of this file: Step 8.8.
//
// The paper's J = 50 example, target (mu_K, sigma^2) = (5, 10). Stage 1 (A1) matches the target
// under a shifted negative-binomial proxy and starts at Gamma(2.667, 2.608); under the exact Gamma
// mixture that start gives E K = 4.415 and Var K = 5.618, a residual (-0.59, -4.38). Stage 2 runs
// Newton on (log a, log b) to Gamma(1.4082, 1.0770). The left panel draws the contours of
// log10 |F| (F = exact moments minus target), computed once per mount on a coarse alpha grid, with
// the R path (DPprior 2.0.0, data/released/newton_trace.json) and the browser path (dp-core
// tsmmFit). The slider moves along the path without recomputing the contours. The right panel
// compares the exact pmf of K_50 at the current iterate with the Stage 1 proxy, whose mean and
// variance are the target by construction.
import * as dp from "../dp-core.js";
import trace from "../../data/released/newton_trace.js";
import { draw, palette, srTable } from "./chart.js";
import { button, frame, h, num, observeWidth, reducedMotion, slider, toggle } from "./base.js";
import { fmtCount } from "./format.js";

const J = 50;
const MU = 5;
const VAR = 10;
const GRID = 56; // contour grid per axis
const LA = [-0.7, 1.4]; // log a range of the contour panel
const LB = [-1.0, 1.3]; // log b range
const THRESH = [-1, -0.5, 0, 0.5, 1, 1.25];
const CELL_MIN = 336;
const PLAY_MS = 900;

const f4 = (x) => x.toFixed(4);
const f3 = (x) => x.toFixed(3);
const eFmt = (x) => (x >= 0.01 ? x.toFixed(3) : x.toExponential(1));

// exact (M1, V) on a coarse alpha grid with the digamma forms: enough for contour lines
function momentsFast(a, b) {
  const g = dp.alphaGrid(a, b, dp.SEARCH_NODE_FACTOR);
  if (g.pointMass !== null) return [dp.condMean(J, g.pointMass), dp.condVar(J, g.pointMass)];
  let e1 = g.p0;
  let e2 = g.p0;
  let ev = 0;
  for (let i = 0; i < g.alpha.length; i += 1) {
    const k = dp.condMeanDigamma(J, g.alpha[i]);
    e1 += g.weight[i] * k;
    e2 += g.weight[i] * k * k;
    ev += g.weight[i] * dp.condVarDigamma(J, g.alpha[i]);
  }
  return [e1, ev + e2 - e1 * e1];
}

let contourCache = null;
function contourGrid() {
  if (contourCache) return contourCache;
  const t0 = performance.now();
  const values = new Float64Array(GRID * GRID);
  for (let j = 0; j < GRID; j += 1) {
    const lb = LB[0] + ((LB[1] - LB[0]) * (j + 0.5)) / GRID;
    for (let i = 0; i < GRID; i += 1) {
      const la = LA[0] + ((LA[1] - LA[0]) * (i + 0.5)) / GRID;
      const [m1, v] = momentsFast(Math.exp(la), Math.exp(lb));
      // stored as -log10 |F|: contour regions {value >= t} are then the valleys around the root, so
      // the innermost level is a closed curve instead of a region that runs along the grid edge
      values[j * GRID + i] = -Math.log10(Math.max(1e-6, Math.hypot(m1 - MU, v - VAR)));
    }
  }
  contourCache = { values, ms: performance.now() - t0 };
  return contourCache;
}

// Stage 1 proxy: K - 1 ~ NB(r = a0, p = a0 / (a0 + m)), mean m = mu_K - 1, variance sigma^2
function proxyPmf(a0, kmax) {
  const m = MU - 1;
  const p = a0 / (a0 + m);
  const out = [];
  for (let k = 1; k <= kmax; k += 1) {
    const x = k - 1;
    out.push({ k, p: Math.exp(dp.lgamma(x + a0) - dp.lgamma(a0) - dp.lgamma(x + 1) + a0 * Math.log(p) + x * Math.log1p(-p)) });
  }
  return out;
}

export function mountWidget(el, spec = {}) {
  const rPath = trace.map((r, i) => ({ step: i, a: r.a, b: r.b, M1: r.M1, V: r.V, residual: r.residual }));
  const fit = dp.tsmmFit(J, MU, VAR);
  const jPath = fit.trace.map((s, i) => ({ step: i, a: s.a, b: s.b, M1: s.M1, V: s.V, residual: s.residual }));
  const last = Math.max(rPath.length, jPath.length) - 1;
  const state = { t: Math.round(num(spec, "t", 0, 0, last)), showR: true, showJ: true, showProxy: true, showExact: true };
  const ui = frame(el, { label: "Stage 1 to Stage 2: the Newton path of TSMM for the J = 50 example", className: "dpx-newton" });
  const tiles = h("div", { class: "dpx-tiles", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pC = h("div", { class: "dpx-panel" });
  const pP = h("div", { class: "dpx-panel" });
  const pR = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, pC, pP, pR);
  ui.caption.textContent =
    `J = 50, target mu_K = 5 and sigma^2 = 10 (VIF 2.5). Stage 1 (A1) solves the target under a shifted negative-binomial proxy; Stage 2 runs Newton on (log a, log b) with the exact moments of K_50, the number of clusters among the 50 units. R: DPprior 2.0.0 (data/released/newton_trace.json); browser: dp-core tsmmFit. Contours: log10 |F|, computed once when the page loads.`;
  let width = 720;
  const grid = contourGrid();

  const at = (path, t) => path[Math.min(t, path.length - 1)];
  const la = (d) => Math.log(d.a);
  const lb = (d) => Math.log(d.b);
  const tickA = [0.5, 1, 2, 4].filter((v) => Math.log(v) >= LA[0] && Math.log(v) <= LA[1]);
  const tickB = [0.5, 1, 2, 3].filter((v) => Math.log(v) >= LB[0] && Math.log(v) <= LB[1]);

  const tile = (title, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: title }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const t = state.t;
    const r = at(rPath, t);
    const j = at(jPath, t);
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const w = Math.floor((width - 16 * (cols - 1)) / cols);
    tiles.replaceChildren(
      tile(`Step ${t} of ${last}${t === 0 ? ": the Stage 1 (A1) start" : t === last ? ": converged" : ""}`, `(${f4(j.a)}, ${f4(j.b)})`, `R: (${f4(r.a)}, ${f4(r.b)})`),
      tile("exact E K_50 and Var K_50 (target 5 and 10)", `${f3(j.M1)} and ${f3(j.V)}`, `residual (${(j.M1 - MU).toFixed(2)}, ${(j.V - VAR).toFixed(2)})`),
      tile("|F| in the browser and in R", `${eFmt(j.residual)} and ${eFmt(r.residual)}`, t === last ? "both below 1e-8" : `next step shrinks it to ${eFmt(at(jPath, t + 1).residual)}`),
    );

    // contour panel: log10 |F| over (log a, log b), with both paths
    const marks = [
      // stroke-only contours (Plot 0.6.17 draws empty paths for contour fill: "value"); a frame makes
      // the outer levels, which close along the grid edge, read as the panel border
      P.frame({ stroke: c.slate, strokeOpacity: 0.8 }),
      P.contour(grid.values, { x1: LA[0], x2: LA[1], y1: LB[0], y2: LB[1], width: GRID, height: GRID, thresholds: THRESH.slice(1).map((e) => -e), stroke: c.slate, strokeOpacity: 0.8 }),
      P.contour(grid.values, { x1: LA[0], x2: LA[1], y1: LB[0], y2: LB[1], width: GRID, height: GRID, thresholds: [-THRESH[0]], stroke: c.accentInk, strokeWidth: 1.8 }),
    ];
    if (state.showR) marks.push(
      P.line(rPath, { x: la, y: lb, stroke: c.methods.tsmm, strokeWidth: 2 }),
      P.dot(rPath, { x: la, y: lb, r: 4, fill: c.methods.tsmm }),
    );
    if (state.showJ) marks.push(
      P.line(jPath, { x: la, y: lb, stroke: c.fg, strokeWidth: 1.4, strokeDasharray: "4,3" }),
      P.dot(jPath, { x: la, y: lb, r: 6.5, stroke: c.fg, fill: "none" }),
    );
    marks.push(
      P.dot([j], { x: la, y: lb, r: 9, stroke: c.red, strokeWidth: 2.5, fill: "none" }),
      P.text([{ ...at(jPath, 0), label: `A1 start (${f3(at(jPath, 0).a)}, ${f3(at(jPath, 0).b)})` }, { ...at(jPath, last), label: `(${f4(at(jPath, last).a)}, ${f4(at(jPath, last).b)})` }], { x: la, y: lb, text: "label", dy: -14, fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11, fontWeight: 600 }),
    );
    draw(pC, {
      width: w, height: Math.min(360, Math.max(260, w * 0.85)), marginLeft: 44, marginBottom: 40,
      x: { domain: LA, label: "a (log scale)", labelOffset: 34, ticks: tickA.map(Math.log), tickFormat: (d) => String(Number(Math.exp(d).toFixed(2))) },
      y: { domain: LB, label: "b (log scale)", ticks: tickB.map(Math.log), tickFormat: (d) => String(Number(Math.exp(d).toFixed(2))) },
      marks,
    }, `Contours of log10 |F| for the target (5, 10) at J = 50 over (log a, log b); the Newton path from the A1 start (${f3(at(jPath, 0).a)}, ${f3(at(jPath, 0).b)}) to (${f4(at(jPath, last).a)}, ${f4(at(jPath, last).b)}), R and browser on top of each other; step ${t} circled at (${f4(j.a)}, ${f4(j.b)}).`);
    pC.prepend(h("p", { class: "dpx-panel-title", text: "Stage 2: Newton on (log a, log b), over the contours of log10 |F|" }));
    pC.append(h("p", { class: "dpx-legend" },
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.methods.tsmm}` }), "R (DPprior 2.0.0)"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.fg}` }), "browser (dp-core), dashed with rings"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.red}` }), `step ${t}`),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.accentInk}` }), `contours of |F|: ${THRESH.map((e) => String(Number((10 ** e).toPrecision(2)))).join(", ")} (darkest ${String(10 ** THRESH[0])})`)));

    // pmf panel: the exact mixture at the current iterate against the Stage 1 proxy
    const pmf = dp.mixPmf(J, j.a, j.b);
    const kmax = 16;
    const bars = Array.from({ length: kmax }, (_, i) => ({ k: i + 1, p: pmf[i + 1] }));
    const prox = proxyPmf(at(jPath, 0).a, kmax);
    const pm = [];
    if (state.showExact) pm.push(P.rectY(bars, { x1: (d) => d.k - 0.4, x2: (d) => d.k + 0.4, y: "p", fill: c.methods.tsmm, fillOpacity: 0.75 }));
    if (state.showProxy) pm.push(P.line(prox, { x: "k", y: "p", stroke: c.gold, strokeWidth: 2.5, curve: "step" }), P.dot(prox, { x: "k", y: "p", r: 2.5, fill: c.gold }));
    pm.push(P.ruleX([MU], { stroke: c.fg, strokeDasharray: "4,3" }), P.ruleY([0], { stroke: c.borderStrong }));
    draw(pP, {
      width: w, height: Math.min(360, Math.max(260, w * 0.85)) - 20, marginLeft: 44, marginBottom: 40,
      x: { domain: [0.5, kmax + 0.5], label: "k (clusters among J = 50)", labelOffset: 34 },
      y: { label: "probability", grid: true },
      marks: pm,
    }, `At step ${t}, Gamma(${f4(j.a)}, ${f4(j.b)}): the exact pmf of K_50 has mean ${fmtCount(j.M1)} and variance ${fmtCount(j.V)}; the Stage 1 proxy has mean 5 and variance 10 by construction.`);
    pP.prepend(h("p", { class: "dpx-panel-title", text: `Exact pmf at step ${t} (bars): mean ${fmtCount(j.M1)}, variance ${fmtCount(j.V)}; Stage 1 proxy (gold): 5 and 10` }));

    // residual panel
    const resMarks = [];
    if (state.showR) resMarks.push(P.line(rPath, { x: "step", y: "residual", stroke: c.methods.tsmm, strokeWidth: 2 }), P.dot(rPath, { x: "step", y: "residual", r: 4, fill: c.methods.tsmm }));
    if (state.showJ) resMarks.push(P.line(jPath, { x: "step", y: "residual", stroke: c.fg, strokeWidth: 1.4, strokeDasharray: "4,3" }), P.dot(jPath, { x: "step", y: "residual", r: 6.5, stroke: c.fg, fill: "none" }));
    resMarks.push(P.dot([j], { x: "step", y: "residual", r: 9, stroke: c.red, strokeWidth: 2.5, fill: "none" }), P.ruleY([1e-8], { stroke: c.muted, strokeDasharray: "2,3" }));
    draw(pR, {
      width: Math.min(width, 640), height: 180, marginLeft: 52, marginBottom: 36,
      x: { domain: [-0.3, last + 0.3], label: "Newton step", labelOffset: 30, ticks: Array.from({ length: last + 1 }, (_, i) => i), tickFormat: (d) => String(d) },
      y: { type: "log", domain: [1e-13, 20], label: "|F|", grid: true, ticks: [1e-12, 1e-8, 1e-4, 1], tickFormat: (d) => (d === 1 ? "1" : `1e${Math.round(Math.log10(d))}`) },
      marks: resMarks,
    }, `Residual |F| by Newton step, R and browser: ${rPath.map((d) => eFmt(d.residual)).join(", ")} in R; dotted line at 1e-8.`);
    pR.prepend(h("p", { class: "dpx-panel-title", text: "The residual falls quadratically once Newton is close (dotted: 1e-8)" }));
    pR.append(srTable("Newton path, R and browser", ["step", "R a", "R b", "R |F|", "browser a", "browser b", "browser |F|"],
      Array.from({ length: last + 1 }, (_, i) => { const x = at(rPath, i); const y = at(jPath, i); return [i, f4(x.a), f4(x.b), eFmt(x.residual), f4(y.a), f4(y.b), eFmt(y.residual)]; })));

    ui.readout.textContent = `Step ${t} of ${last}: Gamma(${f4(j.a)}, ${f4(j.b)}) in the browser, (${f4(r.a)}, ${f4(r.b)}) in R; the exact E K_50 = ${f3(j.M1)} and Var K_50 = ${f3(j.V)} against the target 5 and 10; |F| = ${eFmt(j.residual)} (R ${eFmt(r.residual)}).`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.contourMs = grid.ms.toFixed(0);
    ui.root.dataset.step = String(t);
  };

  let timer = null;
  const stopPlay = () => { if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "Play"; } };
  const setStep = (t) => { state.t = Math.max(0, Math.min(last, Math.round(t))); sT.set(state.t); render(); };
  const sT = slider({ label: "Newton step", min: 0, max: last, step: 1, value: state.t, format: (v) => `${Math.round(v)} of ${last}`, onInput: (v) => { stopPlay(); setStep(v); } });
  const bPlay = button({ label: "Play", onClick: () => {
    if (timer) { stopPlay(); return; }
    if (reducedMotion()) { setStep(last); return; } // no animation: show the converged step at once
    if (state.t >= last) setStep(0);
    bPlay.textContent = "Pause";
    timer = setInterval(() => { if (state.t >= last) stopPlay(); else setStep(state.t + 1); }, PLAY_MS);
  } });
  const tR = toggle({ label: "R path", checked: true, onChange: (v) => { state.showR = v; render(); } });
  const tJ = toggle({ label: "browser path", checked: true, onChange: (v) => { state.showJ = v; render(); } });
  const tE = toggle({ label: "exact pmf", checked: true, onChange: (v) => { state.showExact = v; render(); } });
  const tP = toggle({ label: "Stage 1 proxy", checked: true, onChange: (v) => { state.showProxy = v; render(); } });
  ui.controls.append(sT.root, h("div", { class: "dpx-control dpx-buttons" }, bPlay), h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Show" }, tR.root, tJ.root, tE.root, tP.root));

  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) { if (next.t !== undefined) setStep(num(next, "t", state.t, 0, last)); else render(); },
    get paths() { return { r: rPath, js: jPath }; },
    destroy() { stopPlay(); stop(); el.replaceChildren(); },
  };
}
