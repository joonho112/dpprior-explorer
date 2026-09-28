// P-10 "Distributions ladder: Beta -> Dirichlet -> GEM -> DP atoms" (after Broderick, MLSS 2016
// part I; re-implemented from the mathematics). Owner of this file: Step 6.6; the lollipop rows
// reuse lollipopMarks from lollipop.js (Step 6.2).
//
// One total concentration alpha drives four random distributions whose support grows:
//   Beta(alpha/2, alpha/2)          on {1, 2}
//   Dirichlet(alpha/K, ..., alpha/K) on {1, ..., K}, K = 10
//   GEM(alpha)                      on {1, 2, ...} (the rest below 1e-3 shown as "...")
//   DP(alpha, N(0, 1))              atoms at phi_k ~ N(0, 1) carrying the GEM weights of row 3
// Row 4 moves each GEM bar from its index k to its location phi_k.
import * as dp from "../dp-core.js";
import { lollipopMarks } from "./lollipop.js";
import { draw, palette } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, reducedMotion, slider } from "./base.js";
import { fmt, fmtAlpha, fmtProb } from "./format.js";

const K_DIR = 10;
const GEM_SHOWN = 30;
const MOVE_MS = 900;
const PHI_RANGE = 3.5; // the base measure N(0, 1) is drawn on [-3.5, 3.5]

export function mountWidget(el, spec = {}) {
  const state = { alpha: num(spec, "alpha", 2, 0.1, 20), seed: Math.round(num(spec, "seed", 1, 1, 1e9)) };
  const rngs = [];
  const rows = { beta: [], dir: [], gem: null, phi: [] };
  const ui = frame(el, { label: "Distributions ladder: Beta, Dirichlet, GEM and Dirichlet process draws driven by one concentration alpha", className: "dpx-ladder-rows" });
  const rowParts = [0, 1, 2, 3].map((i) => {
    const title = h("p", { class: "dpx-panel-title" });
    const chart = h("div");
    const btn = button({ label: i === 3 ? "New locations" : "Draw", onClick: () => { drawRow(i); render(i >= 2); } });
    const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" }, title, chart, btn);
    return { title, chart, btn, panel };
  });
  ui.charts.append(...rowParts.map((r) => r.panel));
  const atomSvg = globalThis.d3 ? globalThis.d3.create("svg").attr("role", "img") : null;
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part I). Each row is one draw of a random probability distribution; its support grows from two points to K points, to the positive integers, to the whole real line. Rows 3 and 4 share the same weights. Draws are seeded.";
  let width = 720;
  let moved = false;

  const newRngs = () => { for (let i = 0; i < 4; i += 1) rngs[i] = dp.makeRng(state.seed * 31 + i); };
  const drawRow = (i) => {
    const a = state.alpha;
    if (i === 0) rows.beta = dp.rdirichlet(rngs[0], [a / 2, a / 2]);
    if (i === 1) rows.dir = dp.rdirichlet(rngs[1], new Array(K_DIR).fill(a / K_DIR));
    if (i === 2 || i === 3) {
      if (i === 2 || !rows.gem) rows.gem = dp.rgem(rngs[2], a);
      rows.phi = rows.gem.w.map(() => dp.rnorm(rngs[3]));
      moved = false;
    }
  };


  const render = (animate = false) => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const a = state.alpha;
    const lolli = (panel, values, xMax, alt, extra = []) => draw(panel, {
      width, height: 120, marginLeft: 40, marginRight: 24,
      x: { domain: [0.5, xMax + 0.5], label: null, ticks: xMax <= 12 ? Array.from({ length: xMax }, (_, i) => i + 1) : [1, 5, 10, 15, 20, 25, 30].filter((t) => t <= xMax), tickFormat: (d) => String(d) },
      y: { domain: [0, 1], label: null, ticks: [0, 0.5, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)), grid: true },
      marks: [...lollipopMarks(values, c, { r: 3.5 }), ...extra],
    }, alt);
    lolli(rowParts[0].chart, rows.beta, 2, `Beta(${fmt(a / 2, 2)}, ${fmt(a / 2, 2)}) draw: ${rows.beta.map(fmtProb).join(", ")}.`);
    rowParts[0].title.textContent = `1. Beta(alpha/2, alpha/2) = Beta(${fmt(a / 2, 2)}, ${fmt(a / 2, 2)}): weights on {1, 2}`;
    lolli(rowParts[1].chart, rows.dir, K_DIR, `Dirichlet draw with ${K_DIR} components: ${rows.dir.map(fmtProb).join(", ")}.`);
    rowParts[1].title.textContent = `2. Dirichlet(alpha/${K_DIR}, ..., alpha/${K_DIR}) with a = ${fmt(a / K_DIR, 3)}: weights on {1, ..., ${K_DIR}}`;
    const w = rows.gem.w.slice(0, GEM_SHOWN);
    const restShown = 1 - w.reduce((s, x) => s + x, 0);
    lolli(rowParts[2].chart, w, GEM_SHOWN + 1, `GEM(${fmtAlpha(a)}) draw: first weights ${w.slice(0, 6).map(fmtProb).join(", ")}; ${fmtProb(restShown)} left after ${w.length} pieces.`,
      [P.text([{ x: Math.min(w.length, GEM_SHOWN) + 1, y: 0.12 }], { x: "x", y: "y", text: () => `... ${fmtProb(restShown)} more`, fill: c.muted, fontSize: 12, fontWeight: 700 })]);
    rowParts[2].title.textContent = `3. GEM(alpha) = GEM(${fmtAlpha(a)}): weights on {1, 2, 3, ...}; infinitely many, most tiny`;

    // row 4: atoms on the real line, animated from their index position to phi_k
    const d3 = globalThis.d3;
    const W = width;
    const H = 130;
    const m = { l: 40, r: 24, t: 10, b: 26 };
    const x = d3.scaleLinear().domain([-PHI_RANGE, PHI_RANGE]).range([m.l, W - m.r]);
    const xIndex = d3.scaleLinear().domain([0.5, GEM_SHOWN + 1.5]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
    atomSvg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    atomSvg.selectAll("*").remove();
    const base = [];
    for (let i = 0; i <= 120; i += 1) { const v = -PHI_RANGE + (2 * PHI_RANGE * i) / 120; base.push([v, Math.exp(-0.5 * v * v) / Math.sqrt(2 * Math.PI)]); }
    atomSvg.append("path").attr("d", d3.area().x((d) => x(d[0])).y0(y(0)).y1((d) => y(d[1] * 0.5))(base)).attr("fill", c.slate).attr("fill-opacity", 0.15);
    atomSvg.append("g").attr("transform", `translate(0,${H - m.b})`).attr("color", c.muted).call(d3.axisBottom(x).ticks(7));
    atomSvg.append("text").attr("x", W - m.r).attr("y", H - 2).attr("text-anchor", "end").attr("font-size", 11).attr("fill", c.muted).text("phi (location on the real line)");
    const atoms = rows.gem.w.map((wk, k) => ({ k, wk, phi: rows.phi[k] })).filter((d) => d.k < GEM_SHOWN && Math.abs(d.phi) <= PHI_RANGE);
    const g = atomSvg.append("g");
    const sel = g.selectAll("g").data(atoms).join("g");
    sel.append("line").attr("y1", y(0)).attr("y2", (d) => y(d.wk)).attr("stroke", c.fg).attr("stroke-width", 1.5);
    sel.append("circle").attr("cy", (d) => y(d.wk)).attr("r", 3.5).attr("fill", (d) => c.brod[d.k % 6]).attr("stroke", c.stroke).attr("stroke-width", 0.8);
    const place = (s, where) => s.attr("transform", (d) => `translate(${where(d)},0)`);
    if (animate && !moved && !reducedMotion()) {
      place(sel, (d) => xIndex(d.k + 1));
      sel.transition().duration(MOVE_MS).attr("transform", (d) => `translate(${x(d.phi)},0)`);
    } else place(sel, (d) => x(d.phi));
    moved = true;
    const top = atoms.reduce((best, d) => (d.wk > best.wk ? d : best), atoms[0] ?? { wk: 0, phi: 0 });
    if (atoms.length) atomSvg.append("text").attr("x", x(top.phi)).attr("y", y(top.wk) - 8).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700).attr("fill", c.fg).text(`${fmtProb(top.wk)} at phi = ${fmt(top.phi, 2)}`);
    atomSvg.attr("aria-label", `Dirichlet process draw: the GEM weights of row 3 placed at locations phi_k drawn from N(0, 1); the largest atom has weight ${fmtProb(top.wk)} at phi = ${fmt(top.phi, 2)}.`);
    rowParts[3].title.textContent = "4. DP(alpha, N(0, 1)): the same weights as row 3, each moved to a random location phi_k ~ N(0, 1) (shaded)";
    if (!rowParts[3].chart.firstChild) rowParts[3].chart.append(atomSvg.node());

    ui.readout.textContent =
      `alpha = ${fmtAlpha(a)}. Largest weight: Beta ${fmtProb(Math.max(...rows.beta))}, Dirichlet ${fmtProb(Math.max(...rows.dir))}, GEM ${fmtProb(Math.max(...rows.gem.w))}. ` +
      "The same alpha, a growing support: {1, 2}, {1, ..., 10}, {1, 2, ...}, and finally points of the real line, which is the Dirichlet process.";
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  const redrawAll = () => { [0, 1, 2].forEach(drawRow); render(true); };
  const sAlpha = slider({ label: "alpha (shared)", min: 0.1, max: 20, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { state.alpha = v; redrawAll(); } });
  const bAll = button({ label: "Redraw all", primary: true, onClick: redrawAll });
  ui.controls.append(sAlpha.root, h("div", { class: "dpx-control dpx-buttons" }, bAll));
  const unbind = bindPrimaryKey(ui.root, redrawAll);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(false); });
  newRngs();
  [0, 1, 2].forEach(drawRow);
  render(false);
  ready = true;
  return {
    update(next = {}) {
      if (next.alpha !== undefined) { state.alpha = num(next, "alpha", state.alpha, 0.1, 20); sAlpha.set(state.alpha); }
      if (next.seed !== undefined) { state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9)); newRngs(); }
      [0, 1, 2].forEach(drawRow);
      render(false);
    },
    redrawAll,
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}
