// P-00 "Why nonparametric Bayes?" (rung 0 of the ladder; after Broderick, MLSS 2016 part I,
// re-implemented from the mathematics). Owner of this file: Step 6.1.
//
// Exchangeable data modelled as a mixture: weights rho ~ Dirichlet(1, ..., 1) over K cells,
// cell means mu_k ~ N(0, sigma0^2 I) in two dimensions, points x_i ~ N(mu_{z_i}, sigma^2 I).
// With K = 2 or K = 5 every point must land in one of the fixed cells. With K = infinity the
// weights come from stick-breaking with alpha = 1 (a Dirichlet process), broken lazily: a
// point whose uniform u falls in the unbroken rest of the stick opens a new cell.
import * as dp from "../dp-core.js";
import { draw, labelOn, palette, srTable } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtProb } from "./format.js";

const N_MAX = 500;
const SIGMA0 = 2.5; // spread of the cell means
const SIGMA = 0.5; // spread of the points around their cell mean
const DP_ALPHA = 1; // concentration of the K = infinity mixture
const MODES = [{ value: 2, label: "K = 2" }, { value: 5, label: "K = 5" }, { value: Infinity, label: "K = ∞" }];

/** N_MAX points from the mixture with K cells (K = Infinity: lazy stick-breaking, alpha = 1). */
export function mixtureDraw(K, seed) {
  const rng = dp.makeRng(seed);
  const cells = [];
  const newCell = (w) => cells.push({ w, mx: SIGMA0 * dp.rnorm(rng), my: SIGMA0 * dp.rnorm(rng) });
  let rest = 1;
  if (Number.isFinite(K)) {
    dp.rdirichlet(rng, new Array(K).fill(1)).forEach((w) => newCell(w));
    rest = 0;
  }
  const points = [];
  for (let i = 0; i < N_MAX; i += 1) {
    const u = rng.next();
    let acc = 0;
    let z = -1;
    for (let k = 0; k < cells.length; k += 1) {
      acc += cells[k].w;
      if (u < acc) { z = k; break; }
    }
    while (z < 0) {
      // u is in the unbroken rest: break new pieces until one covers it
      const w = rest * dp.rbeta1(rng, DP_ALPHA);
      rest -= w;
      newCell(w);
      acc += w;
      if (u < acc) z = cells.length - 1;
    }
    const c = cells[z];
    points.push({ i, z, x: c.mx + SIGMA * dp.rnorm(rng), y: c.my + SIGMA * dp.rnorm(rng), brokenSoFar: cells.length, restSoFar: rest });
  }
  return { K, cells, points };
}

export function mountWidget(el, spec = {}) {
  const k0 = Number(spec.K);
  const state = {
    K: k0 === 2 || k0 === 5 ? k0 : spec.preset === "inf" || k0 === 0 ? Infinity : 2,
    N: Math.round(num(spec, "n", 100, 10, N_MAX)),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
  };
  let sim = null;
  const ui = frame(el, { label: "Why nonparametric Bayes: a mixture with a fixed number of cells versus one that can open new cells", className: "dpx-finite" });
  const pScatter = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pBar = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pScatter, pBar);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part I). Colours mark the cell each point came from. A finite mixture fixes the number of cells before any data arrive; the Dirichlet process keeps unbroken mass for cells nobody has used yet. Draws are seeded.";
  let width = 720;

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { K, N } = state;
    const shown = sim.points.slice(0, N);
    const counts = new Map();
    for (const p of shown) counts.set(p.z, (counts.get(p.z) ?? 0) + 1);
    const occupied = counts.size;
    const last = shown[shown.length - 1];
    const broken = Number.isFinite(K) ? K : last.brokenSoFar;
    const rest = Number.isFinite(K) ? 0 : last.restSoFar;
    const cells = sim.cells.slice(0, broken);
    const colour = (z) => c.brod[z % 6];
    const ext = Math.max(...sim.points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) + 0.5;
    // numbered means: from the seventh cell on the six colours repeat, so the number names the cell
    // on the scatter and on the stick (since 1.1.0)
    const means = cells.map((cell, k) => ({ x: cell.mx, y: cell.my, k })).filter((d) => counts.has(d.k));
    const side = Math.min(width, 440);
    draw(pScatter, {
      width: side, height: side, marginLeft: 36,
      x: { domain: [-ext, ext], label: null, ticks: 5 },
      y: { domain: [-ext, ext], label: null, ticks: 5 },
      marks: [
        P.dot(shown, { x: "x", y: "y", r: 3, fill: (d) => colour(d.z), fillOpacity: 0.85, stroke: c.stroke, strokeOpacity: 0.3, strokeWidth: 0.5 }),
        P.dot(means, { x: "x", y: "y", symbol: "plus", r: 6, stroke: c.fg, strokeWidth: 2 }),
        P.text(means, { x: "x", y: "y", text: (d) => String(d.k + 1), dx: 9, dy: -9, fill: c.fg, stroke: c.raised, strokeWidth: 3, paintOrder: "stroke", fontSize: 11, fontWeight: 700 }),
      ],
    }, `Scatter of ${N} points coloured by cell; ${occupied} cells are occupied${Number.isFinite(K) ? ` out of K = ${K}` : ""}. Plus signs mark the occupied cell means, numbered as on the stick.`);
    pScatter.prepend(h("p", { class: "dpx-panel-title", text: `${N} points; ${Number.isFinite(K) ? `K = ${K} cells fixed in advance` : "K = ∞: cells open as they are needed"}` }));

    // weights bar (top row) and shares of the N points (bottom row)
    const segs = [];
    let x0 = 0;
    cells.forEach((cell, k) => { segs.push({ row: "weights", x1: x0, x2: x0 + cell.w, k }); x0 += cell.w; });
    const restSeg = rest > 0 ? [{ row: "weights", x1: 1 - rest, x2: 1 }] : [];
    let s0 = 0;
    const shareSegs = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([k, n]) => {
      const seg = { row: `shares of the ${N} points`, x1: s0, x2: s0 + n / N, k, n };
      s0 += n / N;
      return seg;
    });
    const rows = ["weights", `shares of the ${N} points`];
    draw(pBar, {
      width, height: 130, marginLeft: 150, marginRight: 12, marginTop: 22,
      x: { domain: [0, 1], label: null, ticks: [0, 0.25, 0.5, 0.75, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 2)) },
      y: { domain: rows, label: null },
      marks: [
        P.barX(segs, { x1: "x1", x2: "x2", y: "row", fill: (d) => colour(d.k), stroke: c.raised, strokeWidth: 1, inset: 0 }),
        P.barX(restSeg, { x1: "x1", x2: "x2", y: "row", fill: c.rest, stroke: c.marker, strokeWidth: 1.5, strokeDasharray: "4,3" }),
        P.barX(shareSegs, { x1: "x1", x2: "x2", y: "row", fill: (d) => colour(d.k), stroke: c.raised, strokeWidth: 1, inset: 0 }),
        P.text([...segs, ...shareSegs].filter((d) => counts.has(d.k) && (d.x2 - d.x1) * (width - 162) >= 16), { x: (d) => (d.x1 + d.x2) / 2, y: "row", text: (d) => String(d.k + 1), fill: (d) => labelOn(colour(d.k), c), fontSize: 11, fontWeight: 700 }),
        ...(Number.isFinite(K) ? [] : [P.text([{}], { frameAnchor: "top-right", dy: -10, textAnchor: "end", text: () => `new cells needed: the dashed rest, ${fmtProb(rest)} of the stick`, fill: c.marker, fontWeight: 700, fontSize: 11 })]),
      ],
    }, Number.isFinite(K)
      ? `Weights of the ${K} cells: ${cells.map((cl) => fmtProb(cl.w)).join(", ")}; shares of the points: ${shareSegs.map((d) => fmtProb(d.n / N)).join(", ")}.`
      : `Stick broken into ${broken} pieces so far with ${fmtProb(rest)} of the stick left for new cells; ${occupied} pieces hold points.`);
    pBar.prepend(h("p", { class: "dpx-panel-title", text: Number.isFinite(K) ? `The ${K} cells: weights rho_k (top) and where the points fell (bottom)` : "The stick so far: broken pieces, the dashed rest for new cells, and where the points fell" }));
    pBar.append(srTable("Cells", ["cell", "weight", "points"], cells.map((cl, k) => [k + 1, fmtProb(cl.w), counts.get(k) ?? 0])));
    ui.readout.textContent = Number.isFinite(K)
      ? `K = ${K}: the ${N} points use ${occupied} of the ${K} cells. However many points arrive, a ${K}-cell mixture can never open cell ${K + 1}.`
      : `K = ∞ (Dirichlet process, alpha = ${DP_ALPHA}): the ${N} points occupy ${occupied} cells; ${broken} pieces are broken and ${fmtProb(rest)} of the stick is still unbroken, so more points can still need new cells.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.occupied = String(occupied);
  };

  const redraw = () => { sim = mixtureDraw(state.K, state.seed); render(); };
  const kSeg = segmented({ label: "Cells", options: MODES, value: state.K, onChange: (v) => { state.K = v; redraw(); } });
  const sN = slider({ label: "N (points)", min: 10, max: N_MAX, step: 1, value: state.N, format: (v) => String(Math.round(v)), onInput: (v) => { state.N = Math.round(v); render(); } });
  const seedOut = h("span", { class: "dpx-value", text: `seed ${state.seed}` });
  const again = button({ label: "Redraw", primary: true, onClick: () => { state.seed += 1; seedOut.textContent = `seed ${state.seed}`; redraw(); } });
  ui.controls.append(kSeg.root, sN.root, h("div", { class: "dpx-control dpx-buttons" }, again, seedOut));
  const unbind = bindPrimaryKey(ui.root, () => again.click());
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  redraw();
  ready = true;
  return {
    update(next = {}) {
      if (next.K !== undefined) { const k = Number(next.K); state.K = k === 2 || k === 5 ? k : Infinity; kSeg.set(state.K); }
      if (next.n !== undefined) { state.N = Math.round(num(next, "n", state.N, 10, N_MAX)); sN.set(state.N); }
      if (next.seed !== undefined) { state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9)); seedOut.textContent = `seed ${state.seed}`; }
      redraw();
    },
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}
