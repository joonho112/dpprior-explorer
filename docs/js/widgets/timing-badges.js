// C-11 "Timing badges: calibration in milliseconds, measured in this browser". Owner of this
// file: Step 8.12.
//
// On mount the widget warms up (the Stirling table up to J = 500 and one fit), then times the two
// operations the site relies on, five runs each, and shows the median: a TSMM Newton solve for the
// J = 50 example (5, 10) and the exact pmf of K_500 under a Gamma prior. Two tiles put the numbers
// next to the alternatives: a grid search over (a, b), estimated from the measured cost of one
// moment evaluation, and the MCMC the paper's simulation needed to fit the model to data (64,400
// requested fits, 57,151 admitted, four chains of 12,000 iterations each; R1 manuscript, Sec. 5).
// "Sweep" calibrates 150 targets (J = 10..500, mu_K = 3, 5, 8, VIF 2.5) to show why sweeping J
// and mu_K needs no MCMC.
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { button, frame, h, observeWidth } from "./base.js";
import { fmt, fmtGamma } from "./format.js";

const RUNS = 5;
const GRID_SIDE = 200; // a grid search over (a, b) with 200 x 200 points
const SWEEP_J = Array.from({ length: 50 }, (_, i) => Math.round(10 * 50 ** (i / 49))); // 10 .. 500, log spaced
const SWEEP_MU = [3, 5, 8];
const VIF = 2.5;
const PAPER = { requested: 64400, admitted: 57151, chains: 4, iter: 12000, warmup: 4000 };

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const ms = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const time = (f) => { const t0 = performance.now(); f(); return performance.now() - t0; };

export function mountWidget(el, spec = {}) {
  const ui = frame(el, { label: "Timing badges: TSMM and the exact pmf, measured in this browser", className: "dpx-timing" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pT = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pS = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, pT, pS);
  ui.caption.textContent =
    `Times are medians of ${RUNS} runs with performance.now() after a warm-up, in this browser on this device; they vary by machine. The MCMC numbers are the design of the paper's simulation study, not a timing: MCMC fits the model to data, while choosing the prior needs no data and no sampling.`;

  // warm-up: build the Stirling rows to J = 500 and let the engine compile the hot paths
  const vocab = dp.tsmmFit(500, 5, dp.intervalToMoments(2, 10, 0.8).varK); // the Vocabulary prior, J = 500
  const warm = time(() => { dp.condPmf(500, 1); dp.tsmmFit(50, 5, 10); dp.mixPmf(500, vocab.a, vocab.b); });
  const res = { newton: null, pmf: null, grid: null, sweep: null };

  const runNewton = () => { const t = Array.from({ length: RUNS }, () => time(() => dp.tsmmFit(50, 5, 10))); res.newton = { med: median(t), min: Math.min(...t), max: Math.max(...t), fit: dp.tsmmFit(50, 5, 10) }; };
  const runPmf = () => { const t = Array.from({ length: RUNS }, () => time(() => dp.mixPmf(500, vocab.a, vocab.b))); res.pmf = { med: median(t), min: Math.min(...t), max: Math.max(...t) }; };
  const runGrid = () => {
    // cost of one moment evaluation (the unit a grid search repeats), from 40 evaluations
    const t = time(() => { for (let i = 0; i < 40; i += 1) dp.tsmmMoments(50, 0.5 + i * 0.05, 0.4 + i * 0.04); });
    res.grid = { per: t / 40, total: (t / 40) * GRID_SIDE * GRID_SIDE };
  };
  const runSweep = () => {
    const rows = [];
    const t = time(() => {
      for (const mu of SWEEP_MU) for (const J of SWEEP_J) {
        if (mu >= J) continue;
        const f = dp.tsmmFit(J, mu, VIF * (mu - 1));
        rows.push({ J, mu, status: f.status, a: f.a, b: f.b, S5: f.status === "ok" || f.status === "point-mass" ? dp.wsbTail(0.5, f.a, f.b) : Number.NaN });
      }
    });
    res.sweep = { rows, ms: t };
  };

  const tile = (title, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: title }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);
  let width = 720;

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const n = res.newton;
    const p = res.pmf;
    const g = res.grid;
    tiles.replaceChildren(
      tile("TSMM Newton, J = 50, target (5, 10)", `${ms(n.med)} ms`, `median of ${RUNS} (${ms(n.min)} to ${ms(n.max)} ms): ${fmtGamma(n.fit.a, n.fit.b, 4)} in ${n.fit.iter} steps`),
      tile("exact pmf of K_500 under a Gamma prior", `${ms(p.med)} ms`, `median of ${RUNS} (${ms(p.min)} to ${ms(p.max)} ms), ${fmtGamma(vocab.a, vocab.b, 3)} (Vocabulary)`),
      tile(`a ${GRID_SIDE} x ${GRID_SIDE} grid search instead`, `about ${g.total >= 1000 ? `${(g.total / 1000).toFixed(1)} s` : `${ms(g.total)} ms`}`, `${(GRID_SIDE * GRID_SIDE).toLocaleString("en-US")} moment evaluations at ${ms(g.per)} ms each (measured), for one target and a coarse answer; Newton needs about ${n.fit.iter + 1}`),
      tile("MCMC is for the data, not the prior", `${PAPER.admitted.toLocaleString("en-US")} fits`, `The paper's simulation requested ${PAPER.requested.toLocaleString("en-US")} fits, each with ${PAPER.chains} chains of ${PAPER.iter.toLocaleString("en-US")} iterations (${PAPER.warmup.toLocaleString("en-US")} warm-up). Choosing the prior needs none of it.`),
    );
    // the three costs on one log axis: orders of magnitude apart
    const bars = [
      { what: "TSMM Newton, J = 50", ms: n.med, fill: c.methods.tsmm },
      { what: "exact pmf, J = 500", ms: p.med, fill: c.accent },
      { what: `${GRID_SIDE} x ${GRID_SIDE} grid (estimate)`, ms: g.total, fill: c.slate },
    ];
    const xMin = 10 ** Math.floor(Math.log10(Math.min(...bars.map((b) => b.ms))));
    const xMax = 10 ** Math.ceil(Math.log10(Math.max(...bars.map((b) => b.ms)) * 3));
    const ticks = [];
    for (let t = xMin; t <= xMax; t *= 10) ticks.push(t);
    draw(pT, {
      width: Math.min(width, 720), height: 150, marginLeft: 170, marginRight: 70, marginBottom: 34,
      x: { type: "log", domain: [xMin, xMax], label: "milliseconds (log scale)", labelOffset: 28, ticks, tickFormat: (d) => (d >= 1000 ? `${d / 1000} s` : `${Number(d.toPrecision(1))} ms`) },
      y: { domain: bars.map((b) => b.what), label: null },
      marks: [
        P.barX(bars, { x1: xMin, x2: "ms", y: "what", fill: "fill", insetTop: 6, insetBottom: 6 }),
        P.text(bars, { x: "ms", y: "what", text: (b) => (b.ms >= 1000 ? `${(b.ms / 1000).toFixed(1)} s` : `${ms(b.ms)} ms`), dx: 6, textAnchor: "start", fill: c.fg, fontWeight: 600 }),
      ],
    }, `Measured medians: TSMM Newton ${ms(n.med)} ms, exact pmf of K_500 ${ms(p.med)} ms; a ${GRID_SIDE} x ${GRID_SIDE} grid search would take about ${(g.total / 1000).toFixed(1)} s.`);
    pT.prepend(h("p", { class: "dpx-panel-title", text: "The costs on one scale: Newton against a grid search" }));
    if (res.sweep) {
      const pts = res.sweep.rows.filter((r) => Number.isFinite(r.S5));
      draw(pS, {
        width: Math.min(width, 720), height: 220, marginLeft: 44, marginBottom: 36,
        x: { type: "log", domain: [10, 500], label: "J (units, log scale)", labelOffset: 30, ticks: [10, 20, 50, 100, 200, 500], tickFormat: (d) => String(d) },
        y: { domain: [Math.min(0.35, ...pts.map((r) => r.S5)) - 0.02, Math.max(0.45, ...pts.map((r) => r.S5)) + 0.02], label: "Pr(W_SB > .5)", grid: true, tickFormat: (d) => fmt(d, 2) },
        color: { domain: SWEEP_MU.map((m) => `mu_K = ${m}`), range: [c.blue, c.methods.tsmm, c.gold], legend: true },
        marks: [
          // one mark per mu_K so each line also has its own dash pattern (colour is not the only cue)
          ...SWEEP_MU.map((m, k) => P.line(pts.filter((d) => d.mu === m), { x: "J", y: "S5", stroke: () => `mu_K = ${m}`, strokeWidth: 2, strokeDasharray: ["", "6,3", "2,3"][k] })),
          P.ruleY([0.4], { stroke: c.red, strokeDasharray: "4,3" }),
        ],
      }, `Sweep: ${res.sweep.rows.length} TSMM calibrations (J = 10 to 500, mu_K = 3, 5, 8, VIF 2.5) in ${ms(res.sweep.ms)} ms; Pr(W_SB > .5) of each calibrated prior against J, with the .40 trigger dashed.`);
      pS.prepend(h("p", { class: "dpx-panel-title", text: `Sweep: ${res.sweep.rows.length} calibrations in ${ms(res.sweep.ms)} ms. Pr(W_SB > .5) of each calibrated prior against J (dashed: the .40 trigger)` }));
      pS.append(srTable("Sweep results", ["J", "mu_K", "status", "a", "b", "Pr(W_SB > .5)"], res.sweep.rows.filter((_, i) => i % 7 === 0).map((r) => [r.J, r.mu, r.status, r.a.toFixed(3), r.b.toFixed(3), Number.isFinite(r.S5) ? fmt(r.S5, 3) : "–"])));
    }
    ui.readout.textContent = `In this browser: a TSMM solve takes ${ms(n.med)} ms and the exact pmf of K_500 ${ms(p.med)} ms (medians of ${RUNS}, after a ${ms(warm)} ms warm-up)${res.sweep ? `; ${res.sweep.rows.length} calibrations took ${ms(res.sweep.ms)} ms in all` : ""}. Because a calibration costs milliseconds, J and mu_K can be swept freely, without MCMC.`;
    ui.root.dataset.newtonMs = String(n.med);
    ui.root.dataset.pmfMs = String(p.med);
    ui.root.dataset.warmMs = String(warm);
  };

  const bN = button({ label: "Run Newton", primary: true, onClick: () => { runNewton(); render(); } });
  const bP = button({ label: "pmf J = 500", onClick: () => { runPmf(); render(); } });
  const bS = button({ label: "Sweep 150 targets", onClick: () => { runSweep(); render(); } });
  ui.controls.append(h("div", { class: "dpx-control dpx-buttons" }, bN, bP, bS));

  runNewton();
  runPmf();
  runGrid();
  if (spec.preset === "sweep") runSweep();
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) { if (next.preset === "sweep") runSweep(); render(); },
    get timings() { return { warm, newton: res.newton && { ...res.newton, fit: undefined }, pmf: res.pmf, grid: res.grid, sweepMs: res.sweep?.ms, sweepN: res.sweep?.rows.length }; },
    rerun() { runNewton(); runPmf(); render(); return { newton: res.newton.med, pmf: res.pmf.med }; },
    destroy() { stop(); el.replaceChildren(); },
  };
}
