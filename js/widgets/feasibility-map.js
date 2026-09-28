// C-06 "Where a Gamma prior exists: the (mu_K, sigma^2) plane at J units". Owner of this file:
// Step 8.7.
//
// For a count K_J on {1, ..., J} with mean mu_K the variance cannot exceed (mu_K - 1)(J - mu_K)
// (grey: no count at all), and no Gamma(a, b) mixture has a variance below v_J(alpha*), the
// variance of the point mass alpha* with kappa_J(alpha*) = mu_K (red: the profile bound, dp-core
// profileBound). In between, TSMM finds the exact prior. Just above the red curve that prior is
// nearly a point mass, CV(alpha) < .01 (an exact solution with a large shape, found by the profile
// solve); that band is about .002 thick in sigma^2, so it is drawn as the gold edge of the curve.
// Only the two-point law on {1, J} reaches the grey ceiling itself. Drag the point (or use the
// sliders): each move re-solves tsmmFit.
import * as dp from "../dp-core.js";
import { palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtGamma, fmtPct } from "./format.js";

const JS = [50, 79, 100, 500];
const MU_TOP = 20;
const Y_MIN = 0.5;
const Y_SLIDER_MAX = 15000;
const A_PM = dp.POINT_MASS_A; // a above this (CV(alpha) below .01) is a point mass
const EXAMPLES = {
  i80: { label: "[3, 10] at 80%, J = 100", J: 100, mu: 6.5, v: dp.intervalToMoments(3, 10, 0.8).varK },
  i95: { label: "[3, 10] at 95%, J = 100", J: 100, mu: 6.5, v: dp.intervalToMoments(3, 10, 0.95).varK },
  star: { label: "STAR: [2, 8] at 80%, J = 79", J: 79, mu: 5, v: dp.intervalToMoments(2, 8, 0.8).varK },
};
const TABLE_MU = [2, 3, 5, 6.5, 8, 10, 15, 20];

const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "–");
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const ceilingVar = (J, mu) => (mu - 1) * (J - mu);

// The boundary curves at one J (they do not depend on the point, so they are cached).
const cache = new Map();
function curves(J) {
  if (cache.has(J)) return cache.get(J);
  const muMax = Math.min(J - 1, MU_TOP);
  const n = 160;
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const mu = 1.02 + ((muMax - 1.02) * i) / n;
    const pb = dp.profileBound(J, mu);
    pts.push({ mu, min: pb.minVar, alphaStar: pb.alphaStar, band: dp.tsmmMoments(J, A_PM, A_PM / pb.alphaStar).V, top: ceilingVar(J, mu) });
  }
  const out = { J, muMax, pts, yMax: Math.max(...pts.map((p) => p.top)) * 1.5 };
  cache.set(J, out);
  return out;
}

export function mountWidget(el, spec = {}) {
  const d3 = globalThis.d3;
  if (!d3) throw new Error("D3 is not loaded (js/vendor/d3.min.js)");
  const ex0 = EXAMPLES[spec.preset] ?? EXAMPLES.i80;
  const state = {
    J: JS.includes(Number(spec.J)) ? Number(spec.J) : ex0.J,
    mu: Number.isFinite(Number(spec.mu)) && spec.mu !== undefined ? Math.min(MU_TOP, Math.max(1.05, Number(spec.mu))) : ex0.mu,
    v: Number.isFinite(Number(spec.var)) && spec.var !== undefined ? Math.min(Y_SLIDER_MAX, Math.max(Y_MIN, Number(spec.var))) : ex0.v,
  };
  const overridden = spec.J !== undefined || spec.mu !== undefined || spec.var !== undefined;
  const exKey = overridden ? null : EXAMPLES[spec.preset] ? spec.preset : "i80";
  const ui = frame(el, { label: "Feasibility map: where a Gamma prior exists for a count target (mu_K, sigma^2)", className: "dpx-feas" });
  const tiles = h("div", { class: "dpx-tiles", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, panel);
  ui.caption.textContent =
    "K_J is the number of clusters among the J units. Red: below the profile bound v_J(alpha*), the variance of the point mass whose mean count is mu_K; no Gamma prior has less. Grey: above (mu_K - 1)(J - mu_K), the largest variance any count on 1..J with mean mu_K can have. The gold edge marks where the solution becomes a point mass (CV(alpha) < .01). Drag the point, or use the sliders; TSMM re-solves at every move.";

  const title = h("p", { class: "dpx-panel-title" });
  const svg = d3.create("svg").attr("role", "img");
  const gRed = svg.append("path");
  const gGrey = svg.append("path");
  const gBand = svg.append("path").attr("fill", "none").attr("stroke-width", 6).attr("stroke-linejoin", "round");
  const gProf = svg.append("path").attr("fill", "none").attr("stroke-width", 2);
  const gTop = svg.append("path").attr("fill", "none").attr("stroke-width", 1.5);
  const gX = svg.append("g");
  const gY = svg.append("g");
  const xLab = svg.append("text").attr("text-anchor", "end").attr("font-size", 11);
  const yLab = svg.append("text").attr("font-size", 11).attr("x", 4).attr("y", 11);
  const gRegion = svg.append("g").attr("font-size", 11).attr("font-weight", 600).attr("pointer-events", "none");
  const gOver = svg.append("g");
  const guide = gOver.append("line").attr("stroke-dasharray", "2,3").attr("stroke-width", 1.2);
  const marker = gOver.append("circle").attr("r", 4.5).attr("stroke-width", 2);
  const markLab = gOver.append("text").attr("font-size", 11).attr("font-weight", 600).attr("paint-order", "stroke").attr("stroke-width", 4);
  const point = gOver.append("circle").attr("r", 9).attr("stroke-width", 1.5).style("cursor", "grab");
  const pointLab = gOver.append("text").attr("font-size", 11).attr("font-weight", 700).attr("paint-order", "stroke").attr("stroke-width", 4);
  const legend = h("p", { class: "dpx-legend" });
  const tableBox = h("div");
  panel.append(title, svg.node(), legend, tableBox);

  let width = 720;
  let sc = null; // scales and curves of the current drawing
  let res = null;

  const solve = () => {
    const t0 = performance.now();
    const J = state.J;
    const pb = dp.profileBound(J, state.mu);
    const top = ceilingVar(J, state.mu);
    const band = dp.tsmmMoments(J, A_PM, A_PM / pb.alphaStar).V;
    let fit = null;
    let status;
    if (state.v >= top) status = "support";
    else if (state.v <= pb.minVar) status = "infeasible";
    else { fit = dp.tsmmFit(J, state.mu, state.v); status = fit.status; }
    res = { pb, top, band, fit, status, ms: performance.now() - t0 };
  };

  const statusText = () => ({
    ok: "a Gamma prior exists",
    "point-mass": "a Gamma prior exists: nearly a point mass (CV(alpha) < .01)",
    approximate: `only an approximation: |F| = ${res.fit ? res.fit.residual.toExponential(1) : "–"} misses the target`,
    infeasible: "no Gamma prior: below the red curve",
    support: `no count on 1..${state.J} has this mean and variance`,
    "no-convergence": state.v > 0.9 * res.top
      ? `Newton did not converge: within ${fmtPct(1 - state.v / res.top, 0)} of the ceiling the prior needs a shape a near 0 and a rate b far below 1e-17`
      : "Newton did not converge from the A1 start",
  })[res.status];

  const colorFor = (c) => ({ ok: c.methods.tsmm, "point-mass": c.gold, approximate: c.slate, infeasible: c.red, support: c.slate, "no-convergence": c.slate })[res.status];

  const overlay = () => {
    const c = sc.c;
    const { x, y } = sc;
    const px = x(state.mu);
    const py = y(Math.max(Y_MIN, Math.min(sc.cv.yMax, state.v)));
    const my = y(Math.max(Y_MIN, res.pb.minVar));
    guide.attr("x1", px).attr("x2", px).attr("y1", py).attr("y2", my).attr("stroke", c.fg);
    marker.attr("cx", px).attr("cy", my).attr("fill", c.raised).attr("stroke", c.red);
    const right = px < sc.W * 0.58;
    const narrow = sc.W < 520;
    const fit = res.fit;
    const ok = res.status === "ok" || res.status === "point-mass";
    const at = `(${f2(state.mu)}, ${f2(state.v)})`;
    const label = narrow ? at : ok ? `${at}: ${fit.a >= 1e4 ? fmtGamma(fit.a, fit.b) : fmtGamma(fit.a, fit.b, 2)}` : `${at}: ${res.status === "infeasible" ? "no solution" : res.status === "support" ? "impossible" : "no convergence"}`;
    point.attr("cx", px).attr("cy", py).attr("fill", colorFor(c)).attr("stroke", c.fg);
    // the marker sits on the red curve: above the point when the target is infeasible, else below.
    // Each label goes on the far side of its own dot, so the two never meet.
    const markerAbove = my < py;
    pointLab.attr("x", px + (right ? 14 : -14)).attr("y", markerAbove ? py + 20 : py - 10).attr("text-anchor", right ? "start" : "end").attr("fill", c.fg).attr("stroke", c.raised).text(label);
    markLab.attr("x", px + (right ? 10 : -10)).attr("y", markerAbove ? my - 8 : my + 16).attr("text-anchor", right ? "start" : "end").attr("fill", c.red).attr("stroke", c.raised)
      .text(narrow ? `min ${f3(res.pb.minVar)}` : `min ${f3(res.pb.minVar)} at alpha* = ${f3(res.pb.alphaStar)}`);
    svg.attr("aria-label", `Feasibility map at J = ${state.J}: mu_K from 1 to ${sc.cv.muMax} across, sigma^2 on a log scale up. The point (${f2(state.mu)}, ${f2(state.v)}) is ${res.status === "infeasible" ? "in the red region: no Gamma prior" : res.status === "support" ? "in the grey region: no count at all" : "between the curves"}; at this mu_K the smallest Gamma variance is ${f3(res.pb.minVar)} (alpha* = ${f3(res.pb.alphaStar)}) and the largest count variance ${fmt(res.top, 1)}.`);
  };

  const renderTiles = () => {
    const fit = res.fit;
    const ok = res.status === "ok" || res.status === "point-mass";
    const note = (t) => h("p", { class: "dpx-tile-note", text: t });
    tiles.replaceChildren(
      h("div", { class: "dpx-tile" }, note(`J = ${state.J}, (mu_K, sigma^2) = (${f2(state.mu)}, ${f3(state.v)})`),
        h("p", {}, h("span", { class: `dpx-pill ${ok ? "dpx-pill-ok" : "dpx-pill-bad"}`, text: statusText() }))),
      h("div", { class: "dpx-tile" }, note("TSMM: Gamma(a, b)"), h("p", { class: "dpx-tile-big", text: ok ? (fit.a >= 1e4 ? fmtGamma(fit.a, fit.b) : fmtGamma(fit.a, fit.b, 3)) : "–" }),
        ok ? note(`E(alpha) = ${f3(fit.a / fit.b)}, CV(alpha) = ${f3(1 / Math.sqrt(fit.a))}; ${fit.iter} Newton steps, ${res.ms.toFixed(1)} ms`) : null),
      h("div", { class: "dpx-tile" }, note(`What sigma^2 can be at mu_K = ${f2(state.mu)}`), h("p", { class: "dpx-tile-big", text: `${f3(res.pb.minVar)} < sigma^2 < ${fmt(res.top, 1)}` }),
        note(`The lower end is the point mass alpha* = ${f3(res.pb.alphaStar)}; up to ${f3(res.band)} the exact prior is nearly that point mass (CV(alpha) < .01). Only a law that splits all mass between K = 1 and K = ${state.J} reaches the upper end.`)),
    );
  };

  const readout = () => {
    const fit = res.fit;
    const ok = res.status === "ok" || res.status === "point-mass";
    ui.readout.textContent = `J = ${state.J}, target (${f2(state.mu)}, ${f3(state.v)}): ${ok ? `TSMM gives ${fit.a >= 1e4 ? fmtGamma(fit.a, fit.b) : fmtGamma(fit.a, fit.b, 3)}${res.status === "point-mass" ? ", nearly a point mass" : ""}` : statusText()}. At mu_K = ${f2(state.mu)} a Gamma prior needs ${f3(res.pb.minVar)} < sigma^2 < ${fmt(res.top, 1)} (alpha* = ${f3(res.pb.alphaStar)}; the ceiling is reached only by a two-point law).`;
    ui.root.dataset.status = res.status;
    ui.root.dataset.minVar = String(res.pb.minVar);
    ui.root.dataset.alphaStar = String(res.pb.alphaStar);
    ui.root.dataset.a = ok ? String(fit.a) : "";
    ui.root.dataset.b = ok ? String(fit.b) : "";
  };

  // full drawing: J or width changed
  const draw = () => {
    const c = palette(ui.root);
    const cv = curves(state.J);
    const W = Math.max(300, width);
    const H = W < 520 ? 300 : 360;
    const m = { l: 50, r: 14, t: 22, b: 40 };
    const x = d3.scaleLinear().domain([1, cv.muMax]).range([m.l, W - m.r]);
    const y = d3.scaleLog().domain([Y_MIN, cv.yMax]).range([H - m.b, m.t]).clamp(true);
    sc = { c, cv, x, y, W, H, m };
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).style("color", c.fg);
    const area = (y0, y1) => d3.area().x((p) => x(p.mu)).y0(y0).y1(y1)(cv.pts);
    gRed.attr("d", area(() => y(Y_MIN), (p) => y(Math.max(Y_MIN, p.min)))).attr("fill", c.red).attr("fill-opacity", 0.14);
    gGrey.attr("d", area((p) => y(Math.min(cv.yMax, p.top)), () => y(cv.yMax))).attr("fill", c.slate).attr("fill-opacity", 0.22);
    const line = (key) => d3.line().x((p) => x(p.mu)).y((p) => y(Math.max(Y_MIN, p[key])))(cv.pts);
    gBand.attr("d", line("band")).attr("stroke", c.gold).attr("stroke-opacity", 0.75);
    gProf.attr("d", line("min")).attr("stroke", c.red);
    gTop.attr("d", line("top")).attr("stroke", c.slate);
    gX.attr("transform", `translate(0,${H - m.b})`).attr("color", c.muted).call(d3.axisBottom(x).ticks(W < 520 ? 5 : 10));
    const decades = [];
    for (let e = 0; 10 ** e <= cv.yMax; e += 1) decades.push(10 ** e);
    gY.attr("transform", `translate(${m.l},0)`).attr("color", c.muted).call(d3.axisLeft(y).tickValues(decades).tickFormat((d) => String(d)));
    gX.selectAll("text").attr("font-size", 11);
    gY.selectAll("text").attr("font-size", 11);
    xLab.attr("x", W - m.r).attr("y", H - 6).attr("fill", c.muted).text("mu_K (target mean of K_J) →");
    yLab.attr("fill", c.muted).text("↑ sigma^2 (target variance, log scale)");
    // region labels: the grey region fills the top-left corner, the red one the bottom-right
    const at = (mu) => cv.pts.reduce((best, p) => (Math.abs(p.mu - mu) < Math.abs(best.mu - mu) ? p : best));
    const pf = at(cv.muMax * 0.72);
    const labels = [
      { x: W - m.r - 8, y: H - m.b - 8, text: "no Gamma prior", fill: c.red, anchor: "end" },
      { x: m.l + 8, y: m.t + 14, text: `no count on 1..${state.J}`, fill: c.fg, anchor: "start" },
      { x: x(pf.mu), y: y(Math.sqrt(pf.min * Math.min(pf.top, cv.yMax))), text: "TSMM finds Gamma(a, b)", fill: c.fg, anchor: "middle" },
    ];
    gRegion.selectAll("text").data(labels).join("text").attr("x", (d) => d.x).attr("y", (d) => d.y).attr("text-anchor", (d) => d.anchor).attr("fill", (d) => d.fill)
      .attr("stroke", c.raised).attr("stroke-width", 4).attr("paint-order", "stroke").attr("fill-opacity", 0.9).text((d) => d.text);
    title.textContent = `J = ${state.J}: the targets a Gamma prior can meet lie between the red and the grey curves`;
    legend.replaceChildren(
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.red}` }), "profile bound v_J(alpha*): no Gamma prior below"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.gold}` }), "gold edge: point mass (CV(alpha) < .01), a band too thin to see"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.slate}` }), `(mu_K - 1)(J - mu_K): no count on 1..${state.J} above`),
    );
    tableBox.replaceChildren(srTable(`The bounds at J = ${state.J}`, ["mu_K", "smallest Gamma variance v_J(alpha*)", "alpha*", "largest count variance"],
      TABLE_MU.filter((mu) => mu < state.J).map((mu) => { const pb = dp.profileBound(state.J, mu); return [mu, f3(pb.minVar), f3(pb.alphaStar), fmt(ceilingVar(state.J, mu), 1)]; })));
    overlay();
  };

  const update = () => {
    const t0 = performance.now();
    solve();
    overlay();
    renderTiles();
    readout();
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  // drag the point; the sliders are the keyboard route to the same two numbers
  point.call(d3.drag()
    .subject(() => ({ x: Number(point.attr("cx")), y: Number(point.attr("cy")) }))
    .on("start", () => point.style("cursor", "grabbing"))
    .on("drag", (event) => {
      state.mu = Math.max(1.05, Math.min(sc.cv.muMax, sc.x.invert(event.x)));
      state.v = Math.max(Y_MIN, Math.min(sc.cv.yMax, sc.y.invert(event.y)));
      sMu.set(state.mu);
      sV.set(state.v);
      sEx.set(null);
      update();
    })
    .on("end", () => point.style("cursor", "grab")));

  const sJ = segmented({ label: "J (units)", options: JS.map((J) => ({ value: J, label: String(J) })), value: state.J, onChange: (J) => { state.J = J; sEx.set(null); solve(); draw(); renderTiles(); readout(); } });
  const sEx = segmented({ label: "Examples", options: Object.entries(EXAMPLES).map(([value, e]) => ({ value, label: e.label })), value: exKey,
    onChange: (k) => applyExample(k) });
  const sMu = slider({ label: "mu_K (target mean)", min: 1.05, max: MU_TOP, step: 0.05, value: state.mu, format: f2, onInput: (v) => { state.mu = v; sEx.set(null); update(); } });
  const sV = slider({ label: "sigma^2 (target variance)", min: Y_MIN, max: Y_SLIDER_MAX, value: state.v, log: true, format: f3, onInput: (v) => { state.v = v; sEx.set(null); update(); } });
  function applyExample(k) {
    const e = EXAMPLES[k];
    if (!e) return;
    const redraw = e.J !== state.J;
    Object.assign(state, { J: e.J, mu: e.mu, v: e.v });
    sJ.set(e.J); sMu.set(e.mu); sV.set(e.v); sEx.set(k);
    solve();
    if (redraw) draw(); else overlay();
    renderTiles();
    readout();
  }
  ui.controls.append(sEx.root, sJ.root, sMu.root, sV.root);

  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) draw(); });
  solve();
  draw();
  renderTiles();
  readout();
  ready = true;
  return {
    update(next = {}) {
      if (EXAMPLES[next.preset]) { applyExample(next.preset); return; }
      const redraw = next.J !== undefined && JS.includes(Number(next.J)) && Number(next.J) !== state.J;
      if (redraw) { state.J = Number(next.J); sJ.set(state.J); }
      if (next.mu !== undefined && Number.isFinite(Number(next.mu))) state.mu = Math.min(MU_TOP, Math.max(1.05, Number(next.mu)));
      if (next.var !== undefined && Number.isFinite(Number(next.var))) state.v = Math.min(Y_SLIDER_MAX, Math.max(Y_MIN, Number(next.var)));
      sMu.set(state.mu); sV.set(state.v); sEx.set(null);
      solve();
      if (redraw) draw(); else overlay();
      renderTiles();
      readout();
    },
    /** Move the point as a drag would (for tests): returns the milliseconds the update took. */
    dragTo(mu, v) {
      const t0 = performance.now();
      state.mu = mu; state.v = v; sMu.set(mu); sV.set(v); sEx.set(null);
      update();
      return performance.now() - t0;
    },
    get result() { return { J: state.J, mu: state.mu, v: state.v, status: res.status, minVar: res.pb.minVar, alphaStar: res.pb.alphaStar, a: res.fit?.a, b: res.fit?.b }; },
    destroy() { stop(); point.on(".drag", null); el.replaceChildren(); },
  };
}
