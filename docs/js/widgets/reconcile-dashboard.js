// C-09 "Two anchors, one prior: from TSMM to Dual-Anchor". Owner of this file: Step 8.10.
//
// Four views of one Gamma(a, b) at J = 50 move together: the prior on alpha, the pmf of K_50
// against the target mean 5, the density of W_SB with Pr(W_SB > .5) against the .40 trigger and
// the .25 hard bound, and E(rho), the chance that two random units share a cluster. The button
// animates (log a, log b) from TSMM, Gamma(1.4082, 1.0770), to the Dual-Anchor choice lambda =
// .30, Gamma(2.3158, 1.4204) (data/precomputed/worked_example_j50.json): E K 5.00 → 5.88,
// Pr(W_SB > .5) .497 → .398, E(rho) .518 → .439. With reduced motion the change is immediate.
// The a and b sliders fine-tune from wherever the prior is.
import * as dp from "../dp-core.js";
import we from "../../data/precomputed/worked_example_j50.js";
import { draw, palette, srTable } from "./chart.js";
import { button, frame, h, num, observeWidth, reducedMotion, slider } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const J = we.target.J;
const MU = we.target.mu_K;
const TRIGGER = we.policy.trigger;
const HARD = we.policy.hard_bound;
const DUR = 1400;
const CELL_MIN = 336;
const KMAX = 16;
const f3 = (x) => x.toFixed(3);

function summary(a, b) {
  const pmf = dp.mixPmf(J, a, b);
  let ek = 0;
  for (let k = 1; k <= J; k += 1) ek += k * pmf[k];
  return { a, b, pmf, EK: ek, S5: dp.wsbTail(0.5, a, b), S9: dp.wsbTail(0.9, a, b), rho: dp.meanRho(a, b) };
}

export function mountWidget(el, spec = {}) {
  const d3 = globalThis.d3;
  const st = Object.fromEntries(we.stages.map((s) => [s.key, s]));
  const T = summary(st.tsmm.a, st.tsmm.b);
  const D = summary(st.da.a, st.da.b);
  const start = spec.preset === "da" ? D : T;
  const state = { a: num(spec, "a", start.a, 0.05, 50), b: num(spec, "b", start.b, 0.05, 50) };
  const ui = frame(el, { label: "Reconciling two anchors: TSMM to Dual-Anchor in four linked views", className: "dpx-reconcile" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pA = h("div", { class: "dpx-panel" });
  const pK = h("div", { class: "dpx-panel" });
  const pW = h("div", { class: "dpx-panel" });
  const pR = h("div", { class: "dpx-panel" });
  const tbl = h("div");
  ui.charts.append(tiles, pA, pK, pW, pR, tbl);
  ui.caption.textContent =
    `In Chinese-restaurant terms alpha is the pseudo-count for opening a new table. The Dual-Anchor prior makes it a little larger and less spread (E(alpha) ${f3(st.tsmm.a / st.tsmm.b)} → ${f3(st.da.a / st.da.b)}, CV(alpha) ${f3(1 / Math.sqrt(st.tsmm.a))} → ${f3(1 / Math.sqrt(st.da.a))}), so the first table monopolises the room less often, at the cost of about one more expected table among J = ${J} units. K_50 is the number of clusters among the 50 units; rho is the chance that two random units share one.`;
  let width = 720;
  let anim = null;

  // fixed axes, so the views do not rescale while the prior moves
  const aMax = Math.max(dp.qgamma(0.995, T.a, T.b), dp.qgamma(0.995, D.a, D.b)) * 1.05;
  const peak = (a, b) => { let m = 0; for (let i = 1; i <= 200; i += 1) { const x = (aMax * i) / 200; m = Math.max(m, Math.exp(dp.dgammaLog(x, a, b))); } return m; };
  const aTop = Math.max(peak(T.a, T.b), peak(D.a, D.b)) * 1.15;
  const kTop = Math.max(...Array.from(T.pmf.slice(1, KMAX + 1)), ...Array.from(D.pmf.slice(1, KMAX + 1))) * 1.15;

  const tile = (title, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: title }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);
  const where = (a, b) => (Math.abs(a - T.a) < 1e-6 && Math.abs(b - T.b) < 1e-6 ? "TSMM" : Math.abs(a - D.a) < 1e-6 && Math.abs(b - D.b) < 1e-6 ? `Dual-Anchor, lambda = ${fmt(st.da.lambda, 2)}` : "adjusted");

  const render = (final = true) => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const s = summary(state.a, state.b);
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const w = Math.floor((width - 16 * (cols - 1)) / cols);
    const pos = where(state.a, state.b);
    tiles.replaceChildren(
      tile(`Gamma(a, b): ${pos}`, fmtGamma(state.a, state.b, 4), `TSMM ${fmtGamma(T.a, T.b, 4)}; Dual-Anchor ${fmtGamma(D.a, D.b, 4)}`),
      tile(`E K_${J} (target ${MU})`, fmtCount(s.EK), `TSMM ${fmtCount(T.EK)} → Dual-Anchor ${fmtCount(D.EK)}`),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "Pr(W_SB > .5)" }), h("p", { class: "dpx-tile-big", text: fmtProb(s.S5) }),
        h("p", {}, h("span", { class: `dpx-pill ${s.S5 > TRIGGER ? "dpx-pill-bad" : "dpx-pill-ok"}`, text: s.S5 > TRIGGER ? `above the ${fmt(TRIGGER, 2)} trigger` : `at or below ${fmt(TRIGGER, 2)}` }))),
      tile("E(rho): two random units share a cluster", fmtProb(s.rho), `TSMM ${fmtProb(T.rho)} → Dual-Anchor ${fmtProb(D.rho)}`),
    );

    // 1. the prior on alpha
    const dens = [];
    for (let i = 1; i <= 160; i += 1) { const x = (aMax * i) / 160; dens.push({ x, d: Math.min(aTop, Math.exp(dp.dgammaLog(x, state.a, state.b))) }); }
    draw(pA, {
      width: w, height: 190, marginLeft: 40, marginBottom: 36,
      x: { domain: [0, aMax], label: "alpha", labelOffset: 30 },
      y: { domain: [0, aTop], label: "density", grid: true },
      marks: [
        P.areaY(dens, { x: "x", y: "d", fill: c.methods.da, fillOpacity: 0.2 }),
        P.line(dens, { x: "x", y: "d", stroke: c.fg, strokeWidth: 1.6 }),
        P.ruleX([state.a / state.b], { stroke: c.red, strokeDasharray: "4,3" }),
      ],
    }, `Prior on alpha: ${fmtGamma(state.a, state.b, 4)}, mean ${f3(state.a / state.b)} (dashed), CV ${f3(1 / Math.sqrt(state.a))}.`);
    pA.prepend(h("p", { class: "dpx-panel-title", text: `alpha: mean ${f3(state.a / state.b)}, CV ${f3(1 / Math.sqrt(state.a))}` }));

    // 2. the count
    const bars = Array.from({ length: KMAX }, (_, i) => ({ k: i + 1, p: Math.min(kTop, s.pmf[i + 1]) }));
    draw(pK, {
      width: w, height: 190, marginLeft: 44, marginBottom: 36,
      x: { domain: [0.5, KMAX + 0.5], label: `k (clusters among J = ${J})`, labelOffset: 30 },
      y: { domain: [0, kTop], label: "probability", grid: true },
      marks: [
        P.rectY(bars, { x1: (d) => d.k - 0.4, x2: (d) => d.k + 0.4, y: "p", fill: c.methods.da, fillOpacity: 0.8 }),
        P.ruleX([MU], { stroke: c.fg, strokeDasharray: "4,3" }),
        P.ruleX([s.EK], { stroke: c.red, strokeWidth: 2 }),
        P.text([{ x: MU, t: `target ${MU}` }], { x: "x", frameAnchor: "top", text: "t", dx: -4, dy: 4, textAnchor: "end", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11 }),
        P.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `pmf of K_${J}: mean ${fmtCount(s.EK)} (solid) against the target ${MU} (dashed).`);
    pK.prepend(h("p", { class: "dpx-panel-title", text: `The count: E K_${J} = ${fmtCount(s.EK)} (solid) vs the target ${MU}` }));

    // 3. the weights, with Pr(W_SB > .5) against the trigger and the hard bound
    const wd = [];
    for (let i = 0; i <= 200; i += 1) { const x = Math.min(dp.W_DENSITY_MAX, i / 200); wd.push({ w: x, d: Math.min(3, dp.wsbDensity(x, state.a, state.b)) }); }
    const fig = draw(pW, {
      width: w, height: 150, marginLeft: 40, marginBottom: 32,
      x: { domain: [0, 1], label: "W_SB", labelOffset: 28, ticks: [0, 0.5, 0.9, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)) },
      y: { domain: [0, 3], label: "density", grid: true },
      marks: [
        P.areaY(wd.filter((x) => x.w >= 0.5), { x: "w", y: "d", fill: c.red, fillOpacity: 0.25 }),
        P.lineY(wd, { x: "w", y: "d", stroke: c.fg, strokeWidth: 1.6 }),
        P.ruleX([0.5], { stroke: c.red, strokeDasharray: "3,3" }),
      ],
    }, `Density of W_SB: the shaded area is Pr(W_SB > .5) = ${fmtProb(s.S5)}.`);
    const meter = P.plot({
      width: w, height: 58, marginLeft: 40, marginTop: 6, marginBottom: 22,
      style: { background: "transparent", color: "currentColor", fontSize: "11px", fontFamily: "inherit", overflow: "visible" },
      x: { domain: [0, 0.6], label: null, ticks: [0, 0.25, 0.4, 0.6], tickFormat: (d) => (d === 0 ? "0" : fmt(d, 2)) },
      y: { axis: null },
      marks: [
        P.barX([{ v: s.S5 }], { x1: 0, x2: "v", fill: s.S5 > TRIGGER ? c.red : c.methods.da, fillOpacity: 0.85, insetTop: 4, insetBottom: 4 }),
        P.ruleX([TRIGGER], { stroke: c.red, strokeWidth: 2, strokeDasharray: "4,2" }),
        P.ruleX([HARD], { stroke: c.methods.hard, strokeWidth: 2, strokeDasharray: "2,2" }),
      ],
    });
    meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", `Pr(W_SB > .5) = ${fmtProb(s.S5)} on a bar against the ${fmt(TRIGGER, 2)} trigger and the ${fmt(HARD, 2)} hard bound.`);
    pW.prepend(h("p", { class: "dpx-panel-title", text: `The weights: Pr(W_SB > .5) = ${fmtProb(s.S5)}; trigger ${fmt(TRIGGER, 2)} (red), hard bound ${fmt(HARD, 2)} (orange)` }));
    fig.after(meter);

    // 4. E(rho) gauge with both anchors marked
    const pct = (x) => `${(100 * x).toFixed(1)}%`;
    pR.replaceChildren(
      h("p", { class: "dpx-panel-title", text: `E(rho) = ${fmtProb(s.rho)}: the chance two random units share a cluster` }),
      h("div", { class: "dpx-rho", role: "img", "aria-label": `E(rho) = ${fmtProb(s.rho)}; TSMM ${fmtProb(T.rho)}, Dual-Anchor ${fmtProb(D.rho)}.` },
        h("span", { class: "dpx-gauge-bar dpx-rho-bar" },
          h("span", { class: "dpx-gauge-fill", style: `width:${pct(s.rho)}` }),
          h("span", { class: "dpx-rho-mark", style: `left:${pct(T.rho)}`, title: "TSMM" }),
          h("span", { class: "dpx-rho-mark", style: `left:${pct(D.rho)}`, title: "Dual-Anchor" })),
        h("span", { class: "dpx-rho-scale" }, h("span", { text: "0" }), h("span", { text: ".5" }), h("span", { text: "1" }))),
      h("p", { class: "dpx-tile-note", text: `Marks: TSMM ${fmtProb(T.rho)} and Dual-Anchor ${fmtProb(D.rho)}. Under a CRP with this prior, the second unit joins the first unit's table with probability E(1 / (1 + alpha)) = E(rho).` }),
    );
    if (final) {
      tbl.replaceChildren(srTable("TSMM, Dual-Anchor and the current prior", ["prior", "a", "b", "E K_50", "Pr(W_SB > .5)", "E(rho)"], [
        ["TSMM", T.a.toFixed(4), T.b.toFixed(4), fmtCount(T.EK), fmtProb(T.S5), fmtProb(T.rho)],
        [`Dual-Anchor (lambda = ${fmt(st.da.lambda, 2)})`, D.a.toFixed(4), D.b.toFixed(4), fmtCount(D.EK), fmtProb(D.S5), fmtProb(D.rho)],
        ["current", state.a.toFixed(4), state.b.toFixed(4), fmtCount(s.EK), fmtProb(s.S5), fmtProb(s.rho)],
      ]));
      ui.readout.textContent = `${pos === "adjusted" ? "Adjusted prior" : pos}: ${fmtGamma(state.a, state.b, 4)}; E K_${J} = ${fmtCount(s.EK)}, Pr(W_SB > .5) = ${fmtProb(s.S5)}, E(rho) = ${fmtProb(s.rho)}. From TSMM to Dual-Anchor: E K ${fmtCount(T.EK)} → ${fmtCount(D.EK)}, Pr(W_SB > .5) ${fmtProb(T.S5)} → ${fmtProb(D.S5)}, E(rho) ${fmtProb(T.rho)} → ${fmtProb(D.rho)}.`;
    }
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.ek = String(s.EK);
    ui.root.dataset.s5 = String(s.S5);
    ui.root.dataset.rho = String(s.rho);
  };

  const sA = slider({ label: "a (shape)", min: 0.3, max: 20, value: state.a, log: true, format: (v) => v.toFixed(4), onInput: (v) => { stopAnim(); state.a = v; render(); } });
  const sB = slider({ label: "b (rate)", min: 0.2, max: 10, value: state.b, log: true, format: (v) => v.toFixed(4), onInput: (v) => { stopAnim(); state.b = v; render(); } });
  const stopAnim = () => { if (anim) { d3.select(ui.root).interrupt("ab"); anim = null; } };
  const moveTo = (to) => {
    stopAnim();
    const from = { a: state.a, b: state.b };
    const finish = () => { state.a = to.a; state.b = to.b; sA.set(to.a); sB.set(to.b); render(); anim = null; };
    if (reducedMotion() || !d3) { finish(); return; }
    const la = d3.interpolateNumber(Math.log(from.a), Math.log(to.a));
    const lb = d3.interpolateNumber(Math.log(from.b), Math.log(to.b));
    anim = d3.select(ui.root).transition("ab").duration(DUR).ease(d3.easeCubicInOut)
      .tween("ab", () => (t) => { state.a = Math.exp(la(t)); state.b = Math.exp(lb(t)); sA.set(state.a); sB.set(state.b); render(false); });
    anim.on("end", finish).on("interrupt", () => { anim = null; });
  };
  const bGo = button({ label: "TSMM → Dual-Anchor", primary: true, onClick: () => moveTo(D) });
  const bBack = button({ label: "Back to TSMM", onClick: () => moveTo(T) });
  ui.controls.append(h("div", { class: "dpx-control dpx-buttons" }, bGo, bBack), sA.root, sB.root);

  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready && !anim) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.preset === "da") { moveTo(D); return; }
      if (next.preset === "tsmm") { moveTo(T); return; }
      stopAnim();
      state.a = num(next, "a", state.a, 0.05, 50);
      state.b = num(next, "b", state.b, 0.05, 50);
      sA.set(state.a); sB.set(state.b);
      render();
    },
    get current() { const s = summary(state.a, state.b); return { a: state.a, b: state.b, EK: s.EK, S5: s.S5, rho: s.rho, animating: anim !== null }; },
    destroy() { stopAnim(); stop(); el.replaceChildren(); },
  };
}
