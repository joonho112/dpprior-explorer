// P-08 "How K_N grows" (after Broderick, MLSS 2016 part III; re-implemented).
//
// Seat customers one at a time and follow K_N, the number of occupied tables after N
// arrivals: a staircase in order of appearance. Its expectation is
// E[K_N] = sum_{n=1}^N alpha/(alpha + n - 1), close to alpha log N for large N, and at a
// fixed N its exact distribution is the Antoniak pmf, which is also the prior of K_J for a
// study with J = N units. Twenty ghost paths show the spread a single path hides.
import * as dp from "../dp-core.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { button, frame, h, num, observeWidth, segmented, slider, toggle } from "./base.js";
import { fmt, fmtAlpha, fmtCount } from "./format.js";

const PRESETS = [0.5, 1, 2, 5];
const MAX_N = 5000;
const GHOSTS = 20;
const GUIDES = [48, 79, 500];

export function mountWidget(el, spec = {}) {
  const state = {
    alpha: num(spec, "alpha", 1, 0.01, 10),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    logx: Boolean(spec.logx ?? false),
    ghosts: Boolean(spec.ghosts ?? true),
  };
  let live;
  let ghosts;
  const reset = () => {
    const mk = (s) => ({ crp: new dp.Crp(state.alpha, dp.makeRng(s)), path: [] });
    live = mk(state.seed);
    ghosts = Array.from({ length: GHOSTS }, (_, i) => mk(state.seed * 1009 + i + 1));
  };
  const add = (k) => {
    const target = Math.min(MAX_N, live.crp.n + k);
    for (const run of [live, ...ghosts]) {
      while (run.crp.n < target) {
        run.crp.seat();
        run.path.push(run.crp.tables);
      }
    }
  };
  reset();
  // the embed page passes the number of customers as J (N = J units)
  add(Math.round(num(spec, "N", num(spec, "J", 100, 1, MAX_N), 1, MAX_N)));

  const ui = frame(el, { label: "How the number of occupied tables K_N grows with the number of customers N", className: "dpx-growth" });
  const pPath = h("div", { class: "dpx-panel" });
  const pPmf = h("div", { class: "dpx-panel" });
  ui.charts.append(pPath, pPmf);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part III). The exact distribution of K_N at the current N is the Antoniak pmf, the same distribution the site calls the prior of K_J for J = N units (shown for N up to 500). Seeded: the same seed and alpha give the same paths.";
  let width = 720;

  const render = () => {
    const c = palette(ui.root);
    const a = state.alpha;
    const N = live.crp.n;
    const half = width >= 680 ? Math.floor((width - 16) / 2) : width;
    const P = globalThis.Plot;
    // A. paths
    const stride = Math.max(1, Math.floor(N / 600));
    const pts = (path) => {
      const out = [];
      for (let n = 1; n <= path.length; n += stride) out.push({ n, k: path[n - 1] });
      if (out.length && out[out.length - 1].n !== path.length) out.push({ n: path.length, k: path[path.length - 1] });
      return out;
    };
    const curve = [];
    const ns = new Set([1, N]);
    for (let i = 0; i <= 120; i += 1) ns.add(Math.max(1, Math.round(state.logx ? N ** (i / 120) : (N * i) / 120)));
    for (const n of [...ns].sort((x, y) => x - y)) curve.push({ n, e: dp.condMean(n, a), l: a * Math.log(n) });
    const marks = [];
    if (state.ghosts) for (const g of ghosts) marks.push(P.lineY(pts(g.path), { x: "n", y: "k", stroke: c.faint, strokeOpacity: 0.35, strokeWidth: 1, curve: "step-after" }));
    marks.push(P.lineY(pts(live.path), { x: "n", y: "k", stroke: c.brod[0], strokeWidth: 2.2, curve: "step-after" }));
    marks.push(P.lineY(curve, { x: "n", y: "e", stroke: c.fg, strokeWidth: 1.8 }));
    marks.push(P.lineY(curve.filter((d) => d.n > 1), { x: "n", y: "l", stroke: c.red, strokeWidth: 1.4, strokeDasharray: "5,3" }));
    for (const J of GUIDES.filter((J) => J <= N)) marks.push(P.ruleX([J], { stroke: c.borderStrong, strokeDasharray: "2,3" }));
    const xTicks = state.logx ? [1, 10, 48, 79, 500, 1000, 5000].filter((t) => t <= N) : undefined;
    if (state.logx) marks.push(logTickLabels(xTicks, c.muted));
    const eN = dp.condMean(N, a);
    draw(pPath, {
      width: half, height: 280, marginLeft: 40, marginBottom: state.logx ? 42 : 36,
      x: state.logx
        ? { type: "log", domain: [1, Math.max(2, N)], label: "N (customers, log scale)", ticks: xTicks, tickFormat: () => "", labelOffset: 38 }
        : { domain: [1, Math.max(2, N)], label: "N (customers)" },
      y: { domain: [0, Math.max(3, ...live.path, ...(state.ghosts ? ghosts.map((g) => Math.max(...g.path)) : [0]), eN, a * Math.log(Math.max(N, 2))) * 1.08], label: "K_N (occupied tables)", grid: true },
      marks,
    }, `Staircase of K_N for N = 1 to ${N} at alpha = ${fmtAlpha(a)}; this path ends at ${live.crp.tables}; E[K_N] = ${fmtCount(eN)}; alpha log N = ${fmtCount(a * Math.log(N))}.`);
    pPath.prepend(h("p", { class: "dpx-panel-title", text: "A. K_N as customers arrive: this path (blue), 20 ghosts (grey), E[K_N] (black), alpha log N (red dashed)" }));

    // B. exact pmf at the current N
    if (N <= dp.LIVE_J_MAX) {
      const pmf = dp.condPmf(N, a);
      const s = dp.pmfSummary(pmf);
      const kmax = Math.min(N, Math.max(12, s.q95 + 5));
      const bars = [];
      for (let k = 1; k <= kmax; k += 1) bars.push({ k, p: pmf[k] });
      const ghostK = ghosts.map((g) => g.crp.tables);
      const ghostBars = [];
      if (state.ghosts) for (let k = 1; k <= kmax; k += 1) ghostBars.push({ k, f: ghostK.filter((x) => x === k).length / GHOSTS });
      draw(pPmf, {
        width: half, height: 280, marginLeft: 44,
        x: { type: "band", label: `k (tables at N = ${N})`, tickFormat: (d) => (d === 1 || d % 5 === 0 ? d : "") },
        y: { label: "probability", grid: true },
        marks: [
          P.barY(bars, { x: "k", y: "p", fill: c.teal, fillOpacity: 0.85 }),
          ...(state.ghosts ? [P.dot(ghostBars.filter((d) => d.f > 0), { x: "k", y: "f", r: 3.5, fill: c.faint, stroke: c.fg, strokeWidth: 0.8 })] : []),
          P.ruleX([live.crp.tables], { stroke: c.brod[0], strokeWidth: 2 }),
          P.ruleY([0], { stroke: c.borderStrong }),
        ],
      }, `Exact Antoniak pmf of K_${N} at alpha = ${fmtAlpha(a)}: mean ${fmtCount(s.mean)}, 90% [${s.q05}, ${s.q95}]; this path at ${live.crp.tables}.`);
      pPmf.prepend(h("p", { class: "dpx-panel-title", text: `B. Exact distribution of K_${N} (bars), 20 ghost endpoints (dots), this path (blue line)` }));
      pPmf.append(srTable(`P(K_${N} = k)`, ["k", "probability"], bars.map((d) => [d.k, fmt(d.p, 3)])));
      ui.readout.textContent =
        `alpha = ${fmtAlpha(a)}, N = ${N}: this path has ${live.crp.tables} tables. E[K_N] = sum alpha/(alpha + n - 1) = ${fmtCount(eN)} ` +
        `(the pmf mean is ${fmtCount(s.mean)}); alpha log N = ${fmtCount(a * Math.log(N))}; 90% of paths end in [${s.q05}, ${s.q95}].`;
    } else {
      pPmf.replaceChildren(h("p", { class: "dpx-panel-title", text: `B. At N = ${N} > 500 the exact pmf is not drawn live` }),
        h("p", { class: "dpx-caption-note", text: `E[K_N] = ${fmtCount(eN)} (digamma path); alpha log N = ${fmtCount(a * Math.log(N))}. See panel A for the curve.` }));
      ui.readout.textContent = `alpha = ${fmtAlpha(a)}, N = ${N}: this path has ${live.crp.tables} tables; E[K_N] = ${fmtCount(eN)}; alpha log N = ${fmtCount(a * Math.log(N))}.`;
    }
  };

  const setAlpha = (a) => {
    const N = live.crp.n;
    state.alpha = a;
    reset();
    add(N);
    render();
  };
  const sAlpha = slider({ label: "alpha (concentration)", min: 0.01, max: 10, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { presetSeg.set(null); setAlpha(v); } });
  const presetSeg = segmented({ label: "Presets", options: PRESETS.map((a) => ({ value: a, label: String(a) })), value: PRESETS.includes(state.alpha) ? state.alpha : null, onChange: (v) => { sAlpha.set(v); setAlpha(v); } });
  const scaleSeg = segmented({ label: "N axis", options: [{ value: false, label: "linear" }, { value: true, label: "log" }], value: state.logx, onChange: (v) => { state.logx = v; render(); } });
  const ghostT = toggle({ label: "x20 paths", checked: state.ghosts, onChange: (v) => { state.ghosts = v; render(); } });
  ui.controls.append(
    sAlpha.root, presetSeg.root,
    h("div", { class: "dpx-control dpx-buttons" },
      ...[1, 10, 100, 1000].map((k) => button({ label: `Add ${k}`, primary: k === 1, onClick: () => { add(k); render(); } })),
      button({ label: "Reset", onClick: () => { reset(); add(1); render(); } })),
    scaleSeg.root, ghostT.root,
  );
  const stop = observeWidth(ui.charts, (w) => { width = w; render(); });
  render();
  return {
    update(next = {}) {
      if (next.alpha !== undefined) { const a = num(next, "alpha", state.alpha, 0.01, 10); sAlpha.set(a); presetSeg.set(PRESETS.includes(a) ? a : null); setAlpha(a); }
      if (next.N !== undefined) { const N = Math.round(num(next, "N", live.crp.n, 1, MAX_N)); reset(); add(N); }
      if (next.logx !== undefined) { state.logx = Boolean(next.logx); scaleSeg.set(state.logx); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}
