// M-07 "What Gamma(1, 1) actually says": five tiles. Owner of this file: Step 5.9.
//
// One hyperprior, five readings: (1) the prior mass of alpha below .5, (2) the pmf of K_J at
// the chosen J (live for J <= 500; beyond that the mean is live on the digamma path and the
// band comes from R, data/precomputed/kj_bands_J_gt_500.js), (3) the size-biased tail
// Pr(W_SB > t), which does not depend on J, (4) twenty simulated 79-site restaurants, and
// (5) the prior collapse probability P(K_J = 1) (dp.mixPK1, a closed-form expectation
// computed live for every J). Changing J moves tiles 2 and 5 only.
import * as dp from "../dp-core.js";
import bands from "../../data/precomputed/kj_bands_J_gt_500.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { button, frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const PRESETS = [
  { key: "g11", label: "Gamma(1, 1)", a: 1, b: 1 },
  { key: "g24", label: "Gamma(2, 4)", a: 2, b: 4 },
  { key: "g13", label: "Gamma(1, 3)", a: 1, b: 3 },
  { key: "scal", label: "Gamma(0.037, 0.037)", a: 0.037, b: 0.037 },
];
const J_CHOICES = [10, 50, 79, 100, 500, 1000, 2000, 5000];
const ALPHA_T = 0.5; // tile 1: prior mass of alpha at or below one half
const EXTREME_T = 0.9;
const SITES = 79; // tile 4: the STAR schools
const REPS = 20;
const TILE_MIN = 272; // px, matches .dpx-tiles minmax(17rem, 1fr)
const GAP = 16;

const bandFor = (a, b, J) => bands.rows.find((r) => r.J === J && Math.abs(r.a - a) < 1e-9 && Math.abs(r.b - b) < 1e-9) ?? null;

export function mountWidget(el, spec = {}) {
  const preset = PRESETS.find((p) => p.key === spec.preset) ?? PRESETS[0];
  const jSpec = Math.round(num(spec, "J", 100, 10, 5000));
  const state = {
    a: num(spec, "a", preset.a, 0.01, 50),
    b: num(spec, "b", preset.b, 0.01, 50),
    J: J_CHOICES.includes(jSpec) ? jSpec : 100,
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
  };
  const ui = frame(el, { label: "What a Gamma hyperprior says: five readings of one prior", className: "dpx-implications" });
  const grid = h("div", { class: "dpx-tiles", style: "grid-column: 1 / -1" });
  const tiles = [1, 2, 3, 4, 5].map((i) => {
    const title = h("p", { class: "dpx-panel-title" });
    const big = h("p", { class: "dpx-tile-big" });
    const chart = h("div");
    const note = h("p", { class: "dpx-tile-note" });
    const tile = h("div", { class: "dpx-tile", "data-tile": i }, title, big, chart, note);
    grid.append(tile);
    return { tile, title, big, chart, note };
  });
  ui.charts.append(grid);
  let width = 720;
  const name = () => PRESETS.find((p) => p.a === state.a && p.b === state.b)?.label ?? fmtGamma(state.a, state.b);
  const inner = () => {
    const cols = Math.max(1, Math.floor((width + GAP) / (TILE_MIN + GAP)));
    return Math.max(180, Math.floor((width - GAP * (cols - 1)) / cols) - 26);
  };

  const tileAlpha = (c, P) => {
    const t = tiles[0];
    const { a, b } = state;
    const lo = Math.max(1e-8, Math.min(1e-3, dp.qgamma(0.01, a, b)));
    const hi = Math.max(10, dp.qgamma(0.999, a, b));
    const hidden = dp.prAlphaBelow(lo, a, b);
    const dens = [];
    for (let i = 0; i <= 200; i += 1) {
      const x = Math.exp(Math.log(lo) + ((Math.log(hi) - Math.log(lo)) * i) / 200);
      dens.push({ x, d: Math.exp(dp.dgammaLog(x, a, b)) * x });
    }
    const pHalf = dp.prAlphaBelow(ALPHA_T, a, b);
    const ticks = (lo < 1e-4 ? [1e-8, 1e-6, 1e-4, 0.01, 1, 100] : [0.001, 0.01, 0.1, 1, 10, 100]).filter((v) => v >= lo && v <= hi);
    t.title.textContent = "1. alpha: vague on a log scale";
    t.big.textContent = `Pr(alpha <= .5) = ${fmtProb(pHalf)}`;
    draw(t.chart, {
      width: inner(), height: 150, marginLeft: 36, marginBottom: 36,
      x: { type: "log", domain: [lo, hi], label: "alpha (log scale)", labelOffset: 32, ticks, tickFormat: () => "" },
      y: { label: null, ticks: 3, grid: true },
      marks: [
        P.areaY(dens.filter((d) => d.x <= ALPHA_T), { x: "x", y: "d", fill: c.blue, fillOpacity: 0.35 }),
        P.lineY(dens, { x: "x", y: "d", stroke: c.fg, strokeWidth: 1.4 }),
        P.ruleX([ALPHA_T], { stroke: c.blue, strokeDasharray: "4,3" }),
        logTickLabels(ticks, c.muted, (d) => (d < 0.001 ? `1e${Math.round(Math.log10(d))}` : String(d))),
      ],
    }, `Density of log alpha under ${name()}; shaded: alpha at or below .5, probability ${fmtProb(pHalf)}.`);
    t.note.textContent = `Mean alpha ${fmt(a / b, 2)}; the shaded area is probability${hidden > 0.01 ? ` (${fmtProb(hidden)} of the mass lies left of the axis)` : ""}. Same for every J.`;
    return pHalf;
  };

  const tileK = (c, P) => {
    const t = tiles[1];
    const { a, b, J } = state;
    const mom = dp.mixMoments(J, a, b);
    t.title.textContent = `2. K_J at J = ${J}: depends on J`;
    if (J <= dp.LIVE_J_MAX) {
      const pmf = dp.mixPmf(J, a, b);
      const s = dp.pmfSummary(pmf);
      const kmax = Math.min(J, Math.max(10, s.q95 + 3));
      const bars = [];
      for (let k = 1; k <= kmax; k += 1) bars.push({ k, p: pmf[k], inside: k >= s.q05 && k <= s.q95 });
      t.big.textContent = `E K_J = ${fmtCount(mom.mean)}, 90% [${s.q05}, ${s.q95}]`;
      draw(t.chart, {
        width: inner(), height: 150, marginLeft: 36, marginBottom: 30,
        x: { type: "band", label: null, tickFormat: (d) => (d === 1 || d % 5 === 0 ? d : "") },
        y: { label: null, ticks: 3, grid: true },
        marks: [P.barY(bars, { x: "k", y: "p", fill: c.teal, fillOpacity: (d) => (d.inside ? 0.9 : 0.35) }), P.ruleY([0], { stroke: c.borderStrong })],
      }, `Prior pmf of K_${J} under ${name()}: mean ${fmtCount(mom.mean)}, 90% interval [${s.q05}, ${s.q95}].`);
      t.chart.append(srTable(`P(K_${J} = k)`, ["k", "probability"], bars.map((d) => [d.k, fmtProb(d.p)])));
      t.note.textContent = `Live pmf; SD ${fmt(mom.sd, 2)}. K_J is the number of fitted components among the J units.`;
      return mom.mean;
    }
    const band = bandFor(a, b, J);
    t.big.textContent = band ? `E K_J = ${fmtCount(mom.mean)}, 90% [${band.q05}, ${band.q95}]` : `E K_J = ${fmtCount(mom.mean)}, SD ${fmt(mom.sd, 2)}`;
    const pts = band
      ? [{ y: "90% band", lo: band.q05, hi: band.q95, mid: band.median }]
      : [{ y: "mean ± 2 SD", lo: Math.max(1, mom.mean - 2 * mom.sd), hi: mom.mean + 2 * mom.sd, mid: mom.mean }];
    draw(t.chart, {
      width: inner(), height: 150, marginLeft: 36, marginBottom: 30,
      x: { domain: [0, Math.max(10, pts[0].hi * 1.15)], label: `K_${J}`, grid: true },
      y: { domain: [pts[0].y], label: null, axis: null },
      marks: [
        P.ruleY(pts, { y: "y", x1: "lo", x2: "hi", stroke: c.teal, strokeWidth: 10, strokeOpacity: 0.5 }),
        P.dot(pts, { y: "y", x: "mid", r: 5, fill: c.fg }),
        P.dot([{ y: pts[0].y, x: mom.mean }], { y: "y", x: "x", r: 6, symbol: "diamond", fill: c.red }),
        P.text(pts, { y: "y", x: "lo", text: (d) => String(Math.round(d.lo)), dy: -14, fill: c.fg, fontSize: 11 }),
        P.text(pts, { y: "y", x: "hi", text: (d) => String(Math.round(d.hi)), dy: -14, fill: c.fg, fontSize: 11 }),
      ],
    }, band
      ? `K_${J} under ${name()} (precomputed): median ${band.median}, 90% interval [${band.q05}, ${band.q95}]; live mean ${fmtCount(mom.mean)}.`
      : `K_${J} under ${name()}: mean ${fmtCount(mom.mean)} and SD ${fmt(mom.sd, 2)}; no precomputed band for this prior.`);
    t.note.textContent = band
      ? `J > ${dp.LIVE_J_MAX}: band and median (dot) precomputed in R; mean (diamond) live on the digamma path.`
      : `J > ${dp.LIVE_J_MAX}: no precomputed band for this prior; mean ± 2 SD shown (live).`;
    return mom.mean;
  };

  const tileWeight = (c, P) => {
    const t = tiles[2];
    const { a, b } = state;
    const S5 = dp.wsbTail(dp.MAJORITY_T, a, b);
    const S9 = dp.wsbTail(EXTREME_T, a, b);
    const wd = [];
    for (let i = 0; i <= 160; i += 1) {
      const w = Math.min(dp.W_DENSITY_MAX, i / 160);
      wd.push({ w, d: dp.wsbDensity(w, a, b) });
    }
    const top = Math.min(4, Math.max(2, ...wd.filter((x) => x.w <= 0.95).map((x) => x.d)) * 1.15);
    const clip = wd.map((x) => ({ ...x, d: Math.min(x.d, top) }));
    t.title.textContent = "3. W_SB: the same for every J";
    t.big.textContent = `Pr(W_SB > .5) = ${fmtProb(S5)}, > .9 = ${fmtProb(S9)}`;
    draw(t.chart, {
      width: inner(), height: 150, marginLeft: 36, marginBottom: 30,
      x: { domain: [0, 1], label: null, ticks: [0, 0.5, 0.9], tickFormat: (d) => (d === 0 ? "0" : fmt(d, 1)) },
      y: { domain: [0, top], label: null, ticks: 3, grid: true },
      marks: [
        P.areaY(clip.filter((x) => x.w >= dp.MAJORITY_T), { x: "w", y: "d", fill: c.red, fillOpacity: 0.22 }),
        P.areaY(clip.filter((x) => x.w >= EXTREME_T), { x: "w", y: "d", fill: c.red, fillOpacity: 0.45 }),
        P.lineY(clip, { x: "w", y: "d", stroke: c.fg, strokeWidth: 1.4 }),
      ],
    }, `Density of W_SB under ${name()}: Pr(W_SB > .5) = ${fmtProb(S5)}, Pr(W_SB > .9) = ${fmtProb(S9)}.`);
    t.note.textContent = "Share of a randomly chosen unit's cluster; the tail (b / (b - log(1 - t)))^a has no J in it.";
    return S5;
  };

  const tileSites = (c, P) => {
    const t = tiles[3];
    const { a, b } = state;
    const rng = dp.makeRng(state.seed);
    const rows = [];
    let one = 0;
    for (let r = 0; r < REPS; r += 1) {
      const crp = new dp.Crp(dp.rgamma(rng, a) / b, rng);
      for (let i = 0; i < SITES; i += 1) crp.seat();
      const sizes = [...crp.counts].sort((x, y) => y - x);
      if (sizes.length === 1) one += 1;
      sizes.forEach((size, k) => rows.push({ rep: r + 1, k, size }));
    }
    t.title.textContent = `4. ${REPS} simulated sets of ${SITES} sites`;
    t.big.textContent = `${one} of ${REPS} put all ${SITES} sites in one cluster`;
    draw(t.chart, {
      width: inner(), height: 150, marginLeft: 36, marginBottom: 30,
      x: { domain: [0, SITES], label: null, ticks: [0, 20, 40, 60, SITES] },
      y: { label: null, axis: null, padding: 0.15 },
      marks: [P.barX(rows, { x: "size", y: "rep", fill: (d) => c.brod[d.k % 6], stroke: c.raised, strokeWidth: 0.4 })],
    }, `${REPS} simulated sets of ${SITES} sites under ${name()}, cluster sizes largest first; ${one} have a single cluster.`);
    t.note.textContent = `Each row draws alpha from ${name()}, then seats ${SITES} sites by the Chinese restaurant rule; clusters largest first. Seed ${state.seed}.`;
  };

  const tileOne = (c, P) => {
    const t = tiles[4];
    const { a, b, J } = state;
    const g = dp.alphaGrid(a, b);
    const pts = J_CHOICES.map((j) => ({ J: j, p: dp.mixPK1(j, a, b, g) }));
    const cur = pts.find((d) => d.J === J).p;
    t.title.textContent = "5. Prior collapse: depends on J";
    t.big.textContent = `P(K_${J} = 1) = ${fmtProb(cur)}`;
    draw(t.chart, {
      width: inner(), height: 150, marginLeft: 36, marginBottom: 36,
      x: { type: "log", domain: [J_CHOICES[0], J_CHOICES[J_CHOICES.length - 1]], label: "J (log scale)", labelOffset: 32, ticks: [10, 100, 1000], tickFormat: () => "" },
      y: { domain: [0, Math.max(0.25, ...pts.map((d) => d.p)) * 1.1], label: null, ticks: 3, grid: true },
      r: { type: "identity" }, // dot r in pixels (the current J is larger), not a scaled channel
      marks: [
        P.lineY(pts, { x: "J", y: "p", stroke: c.red, strokeWidth: 1.6 }),
        P.dot(pts, { x: "J", y: "p", r: (d) => (d.J === J ? 5 : 2.5), fill: (d) => (d.J === J ? c.red : c.raised), stroke: c.red }),
        logTickLabels([10, 100, 1000], c.muted),
      ],
    }, `Prior probability that all J units share one cluster under ${name()}: ${pts.map((d) => `${fmtProb(d.p)} at J = ${d.J}`).join(", ")}.`);
    t.note.textContent = "Before any data. Posterior collapse, Pr(K_J = 1 | data), is a different statement.";
    return cur;
  };

  let last = {};
  const renderAll = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    last.pHalf = tileAlpha(c, P);
    last.mean = tileK(c, P);
    last.S5 = tileWeight(c, P);
    tileSites(c, P);
    last.one = tileOne(c, P);
    readout();
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };
  const renderJ = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    last.mean = tileK(c, P);
    last.one = tileOne(c, P);
    readout();
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };
  function readout() {
    ui.readout.textContent =
      `${name()}, J = ${state.J}: Pr(alpha <= .5) = ${fmtProb(last.pHalf)}; E K_J = ${fmtCount(last.mean)}; Pr(W_SB > .5) = ${fmtProb(last.S5)}; P(K_J = 1) = ${fmtProb(last.one)}. ` +
      "Vague in alpha is not vague in clusters.";
    ui.root.dataset.pHalf = String(last.pHalf);
    ui.root.dataset.mean = String(last.mean);
    ui.root.dataset.s5 = String(last.S5);
    ui.root.dataset.one = String(last.one);
  }

  const presetSeg = segmented({ label: "Prior", options: PRESETS.map((p) => ({ value: p.key, label: p.label })), value: PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null,
    onChange: (v) => { const p = PRESETS.find((q) => q.key === v); state.a = p.a; state.b = p.b; sa.set(p.a); sb.set(p.b); renderAll(); } });
  const sa = slider({ label: "a (shape)", min: 0.01, max: 50, value: state.a, log: true, format: (v) => (v < 0.1 ? v.toFixed(3) : v.toFixed(2)), onInput: (v) => { state.a = v; presetSeg.set(null); renderAll(); } });
  const sb = slider({ label: "b (rate)", min: 0.01, max: 50, value: state.b, log: true, format: (v) => (v < 0.1 ? v.toFixed(3) : v.toFixed(2)), onInput: (v) => { state.b = v; presetSeg.set(null); renderAll(); } });
  const jSeg = segmented({ label: "J", options: J_CHOICES.map((j) => ({ value: j, label: String(j) })), value: state.J, onChange: (v) => { state.J = v; renderJ(); } });
  const again = button({ label: "New sites", onClick: () => { state.seed += 1; const c = palette(ui.root); tileSites(c, globalThis.Plot); } });
  ui.controls.append(presetSeg.root, sa.root, sb.root, jSeg.root, h("div", { class: "dpx-control dpx-buttons" }, again));
  ui.caption.textContent =
    "Prior statements under one Gamma hyperprior. Tiles 1, 3 and 4 do not depend on J; tiles 2 and 5 do. For J above 500 the band of K_J is precomputed in R (DPprior 2.0.0); everything else is computed in the browser.";
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) renderAll(); });
  renderAll();
  ready = true;
  return {
    update(next = {}) {
      if (next.preset !== undefined) {
        const p = PRESETS.find((q) => q.key === next.preset);
        if (p) { state.a = p.a; state.b = p.b; }
      }
      if (next.a !== undefined) state.a = num(next, "a", state.a, 0.01, 50);
      if (next.b !== undefined) state.b = num(next, "b", state.b, 0.01, 50);
      if (next.J !== undefined && J_CHOICES.includes(Math.round(Number(next.J)))) state.J = Math.round(Number(next.J));
      sa.set(state.a);
      sb.set(state.b);
      jSeg.set(state.J);
      presetSeg.set(PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null);
      renderAll();
    },
    setJ(J) { if (J_CHOICES.includes(J)) { state.J = J; jSeg.set(J); renderJ(); } },
    destroy() { stop(); el.replaceChildren(); },
  };
}
