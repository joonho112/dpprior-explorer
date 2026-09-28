// C-10 "Why the computation is cheap: K_J is a sum of Bernoulli draws". Owner of this file:
// Step 8.11.
//
// Given alpha, unit i opens a new table with probability p_i = alpha / (alpha + i - 1),
// independently of the others, so K_J = B_1 + ... + B_J with B_i ~ Bernoulli(p_i). Its pmf is
// the convolution of J two-point distributions, built one unit at a time (O(J^2)), and it equals
// the Antoniak pmf that dp-core computes from Stirling numbers. E K_J = sum p_i and Var K_J =
// sum p_i (1 - p_i) are finite sums (at alpha = 1, E K_J = H_J, 6.79 at J = 500). "Play
// convolution" adds the units one by one; with reduced motion it jumps to the end.
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { button, frame, h, num, observeWidth, reducedMotion, slider } from "./base.js";
import { fmt } from "./format.js";

const J_MIN = 10;
const J_MAX = dp.LIVE_J_MAX;
const PLAY_MS = 4500;
const f4 = (x) => x.toFixed(4);

export function mountWidget(el, spec = {}) {
  const d3 = globalThis.d3;
  const state = {
    J: Math.round(num(spec, "J", 50, J_MIN, J_MAX)),
    alpha: num(spec, "alpha", 1, 0.05, 50),
  };
  state.i = Math.round(num(spec, "n", state.J, 1, state.J)); // units added so far (n: an embed key)
  const ui = frame(el, { label: "K_J as a sum of Bernoulli draws: the convolution that gives the exact pmf", className: "dpx-bsum" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pP = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pK = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const tbl = h("div");
  ui.charts.append(tiles, pP, pK, tbl);
  ui.caption.textContent =
    "Given alpha, unit i starts a new cluster with probability p_i = alpha / (alpha + i - 1), independently of the other units (the Chinese restaurant process). The number of clusters K_J is the sum of these J Bernoulli draws, so its pmf is their convolution and its mean and variance are sums. Faint dots: the exact Antoniak pmf from Stirling numbers (dp-core), for comparison.";
  let width = 720;
  let anim = null;

  // the convolution after i units, advanced one unit at a time and restarted when i goes back
  let conv = null;
  const pmfAfter = (i) => {
    if (!conv || conv.J !== state.J || conv.alpha !== state.alpha || conv.i > i) {
      const p = new Float64Array(state.J + 1);
      p[1] = 1;
      conv = { J: state.J, alpha: state.alpha, i: 1, pmf: p };
    }
    const pmf = conv.pmf;
    for (let r = conv.i + 1; r <= i; r += 1) {
      const q = state.alpha / (state.alpha + r - 1);
      for (let k = r; k >= 1; k -= 1) pmf[k] = pmf[k] * (1 - q) + pmf[k - 1] * q;
    }
    conv.i = i;
    return pmf;
  };
  let exact = null;
  const exactPmf = () => {
    if (!exact || exact.J !== state.J || exact.alpha !== state.alpha) exact = { J: state.J, alpha: state.alpha, pmf: dp.condPmf(state.J, state.alpha) };
    return exact.pmf;
  };

  const tile = (title, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: title }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { J, alpha, i } = state;
    const pmf = pmfAfter(i);
    const ex = exactPmf();
    let m = 0;
    let v = 0;
    for (let r = 1; r <= i; r += 1) { const q = alpha / (alpha + r - 1); m += q; v += q * (1 - q); }
    let maxDiff = 0;
    if (i === J) for (let k = 0; k <= J; k += 1) maxDiff = Math.max(maxDiff, Math.abs(pmf[k] - ex[k]));
    const pi = alpha / (alpha + i - 1);
    tiles.replaceChildren(
      tile(`unit ${i} of ${J}`, `p_${i} = ${f4(pi)}`, `alpha / (alpha + ${i - 1}) with alpha = ${fmt(alpha, 2)}`),
      tile(`E K_${i} = sum of p_r`, f4(m), i === J && Math.abs(alpha - 1) < 1e-12 ? `at alpha = 1 this is H_${J}, the harmonic number` : `the mean of K_${J} is ${f4(dp.condMean(J, alpha))}`),
      tile(`Var K_${i} = sum of p_r (1 - p_r)`, f4(v), `sd ${f4(Math.sqrt(v))}`),
      i === J
        ? h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "convolution vs Stirling pmf" }), h("p", { class: "dpx-tile-big", text: `max |diff| = ${maxDiff.toExponential(1)}` }),
          h("p", {}, h("span", { class: `dpx-pill ${maxDiff < 1e-10 ? "dpx-pill-ok" : "dpx-pill-bad"}`, text: maxDiff < 1e-10 ? "agree within 1e-10" : "differ" })))
        : tile("convolution vs Stirling pmf", "–", `compared once all ${J} units are in`),
    );

    // the success probabilities on a log axis (they fall like alpha / i), added ones thick
    const pts = [];
    for (let r = 1; r <= J; r += 1) pts.push({ r, p: alpha / (alpha + r - 1) });
    const pMin = alpha / (alpha + J - 1);
    const lo = 10 ** Math.floor(Math.log10(pMin));
    const ticks = [];
    for (let t = 1; t >= lo; t /= 10) ticks.push(t);
    draw(pP, {
      width: Math.min(width, 900), height: 160, marginLeft: 48, marginBottom: 34,
      x: { domain: [1, J], label: "unit i", labelOffset: 28 },
      y: { type: "log", domain: [lo, 1], label: "p_i (log scale)", grid: true, ticks, tickFormat: (d) => (d >= 0.001 ? String(Number(d.toFixed(3))) : `1e${Math.round(Math.log10(d))}`) },
      marks: [
        P.line(pts, { x: "r", y: "p", stroke: c.muted, strokeWidth: 1.5, strokeOpacity: 0.6 }),
        P.line(pts.slice(0, i), { x: "r", y: "p", stroke: c.accent, strokeWidth: 4 }),
        P.dot([pts[i - 1]], { x: "r", y: "p", r: 5, fill: c.red }),
      ],
    }, `Success probabilities p_i = alpha / (alpha + i - 1) for i = 1 to ${J} at alpha = ${fmt(alpha, 2)}, from 1 down to ${f4(pMin)}; the first ${i} are added (thick).`);
    pP.prepend(h("p", { class: "dpx-panel-title", text: `Each unit is a coin: unit i opens a new cluster with probability p_i (units 1 to ${i} added)` }));

    // the pmf after i units, with the exact pmf as faint dots
    let kmax = 1;
    for (let k = 1; k <= J; k += 1) if (ex[k] > 1e-4 || pmf[k] > 1e-4) kmax = k;
    kmax = Math.min(J, Math.max(12, kmax + 1));
    const cur = [];
    const fin = [];
    for (let k = 1; k <= kmax; k += 1) { cur.push({ k, p: pmf[k] }); fin.push({ k, p: ex[k] }); }
    draw(pK, {
      width: Math.min(width, 900), height: 210, marginLeft: 44, marginBottom: 34,
      x: { domain: [0.5, kmax + 0.5], label: `k (clusters among the first ${i} units)`, labelOffset: 28 },
      y: { label: "probability", grid: true },
      marks: [
        P.rectY(cur, { x1: (d) => d.k - 0.4, x2: (d) => d.k + 0.4, y: "p", fill: c.accent, fillOpacity: 0.8 }),
        P.dot(fin, { x: "k", y: "p", r: 3, stroke: c.fg, fill: "none", strokeOpacity: 0.7 }),
        P.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `pmf of K after ${i} units (bars) and the exact pmf of K_${J} from Stirling numbers (dots); ${i === J ? `they agree within ${maxDiff.toExponential(1)}` : "they meet when all units are in"}.`);
    pK.prepend(h("p", { class: "dpx-panel-title", text: `The pmf after ${i} units (bars), built by convolution; the exact K_${J} pmf (dots)` }));
    if (!anim) tbl.replaceChildren(srTable(`pmf of K_${J} at alpha = ${fmt(alpha, 2)}: convolution and Stirling`, ["k", "convolution", "Stirling"], cur.map((d, j) => [d.k, d.p.toExponential(4), fin[j].p.toExponential(4)])));
    ui.readout.textContent = `alpha = ${fmt(alpha, 2)}, J = ${J}: after ${i} units, E K = ${f4(m)} and Var K = ${f4(v)}${i === J ? `; the convolution matches the Stirling pmf within ${maxDiff.toExponential(1)}` : ""}.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.maxDiff = i === J ? String(maxDiff) : "";
    ui.root.dataset.mean = String(m);
    ui.root.dataset.i = String(i);
  };

  const stopAnim = () => { if (anim) { d3.select(ui.root).interrupt("conv"); anim = null; bPlay.textContent = "Play convolution"; } };
  const setI = (i) => { state.i = Math.max(1, Math.min(state.J, Math.round(i))); sI.set(state.i); render(); };
  const sJ = slider({ label: "J (units)", min: J_MIN, max: J_MAX, value: state.J, log: true, format: (v) => String(Math.round(v)),
    onInput: (v) => { stopAnim(); state.J = Math.round(v); sI.setMax(state.J); state.i = state.J; sI.set(state.i); render(); } });
  const sA = slider({ label: "alpha", min: 0.05, max: 50, value: state.alpha, log: true, format: (v) => fmt(v, 2), onInput: (v) => { stopAnim(); state.alpha = v; render(); } });
  const sI = rangeI();
  const bPlay = button({ label: "Play convolution", primary: true, onClick: () => {
    if (anim) { stopAnim(); return; }
    if (reducedMotion() || !d3) { setI(state.J); return; }
    const from = state.i >= state.J ? 1 : state.i;
    bPlay.textContent = "Pause";
    anim = d3.select(ui.root).transition("conv").duration(PLAY_MS).ease(d3.easeLinear)
      .tween("i", () => (t) => { const i = Math.round(from + (state.J - from) * t); if (i !== state.i) setI(i); });
    anim.on("end", () => { anim = null; bPlay.textContent = "Play convolution"; setI(state.J); }).on("interrupt", () => { anim = null; bPlay.textContent = "Play convolution"; });
  } });
  ui.controls.append(sJ.root, sA.root, sI.root, h("div", { class: "dpx-control dpx-buttons" }, bPlay));

  // the unit slider: its maximum follows J
  function rangeI() {
    const s = slider({ label: "units added", min: 1, max: J_MAX, step: 1, value: state.i, format: (v) => `${Math.round(v)} of ${state.J}`, onInput: (v) => { stopAnim(); setI(v); } });
    s.input.max = String(state.J);
    s.setMax = (m) => { s.input.max = String(m); };
    return s;
  }

  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready && !anim) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      stopAnim();
      if (next.J !== undefined) { state.J = Math.round(num(next, "J", state.J, J_MIN, J_MAX)); sJ.set(state.J); sI.setMax(state.J); state.i = state.J; }
      if (next.alpha !== undefined) { state.alpha = num(next, "alpha", state.alpha, 0.05, 50); sA.set(state.alpha); }
      if (next.n !== undefined) state.i = Math.round(num(next, "n", state.i, 1, state.J));
      sI.set(state.i);
      render();
    },
    /** Play to the end at once (the reduced-motion path), for tests. */
    complete() { stopAnim(); setI(state.J); return { maxDiff: Number(ui.root.dataset.maxDiff), mean: Number(ui.root.dataset.mean) }; },
    destroy() { stopAnim(); stop(); el.replaceChildren(); },
  };
}
