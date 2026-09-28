// M-11 "SSI explorer: fixed weights, a count that never stops growing" and A-10 "SSI-Weight
// against a true K* = 30" (after Vicentini and Jermyn, 2025, and the paper's SSI-Weight).
// Owner of this file: Step 7.7.
//
// SSI-Weight fixes Pr(W_SB > .5) = .25 and Pr(W_SB > .9) = .05 and says nothing about J. The
// W_SB density (left) is the same at every J; E K_J (right) grows like E(alpha) log J: 6.44 at
// J = 25, 10.05 at 100, 20.9 at 5000. Presets: SSI-Weight (solved live by dp-core ssiSolve),
// Vicentini and Jermyn's two exemplars (method_catalog.json), or any two tails the reader sets.
// A-10 overlays the paper's simulation at J = 100 (data/released/headline_primary.json): the
// posterior mean of K and its average 95% interval under SSI-Weight against the true K*.
import * as dp from "../dp-core.js";
import mc from "../../data/precomputed/method_catalog.js";
import sims from "../../data/released/headline_primary.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, segmented, slider, toggle } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const J_MIN = 25;
const J_MAX = 5000;
const J_TICKS = [25, 50, 100, 500, 1000, 5000];
const PMF_CAP = dp.LIVE_J_MAX; // the 90% band needs the pmf: J <= 500 only
const T1 = 0.5;
const T2 = 0.9;
const SIM_J = 100; // the simulation's number of units
const SIM_OFFSET = 1.18; // horizontal offset (on the log J axis) of the simulation overlay
const K_STARS = [5, 10, 30];
const I_LEVELS = [0.2, 0.5, 0.8];
const CELL_MIN = 336;

const recordAB = (id) => { const r = mc.records.find((x) => x.id === id); return [r.a, r.b]; };

export function mountWidget(el, spec = {}) {
  const ssi = dp.ssiSolve();
  const PRESETS = {
    ssi: { label: "SSI-Weight", ab: [ssi.a, ssi.b] },
    thirds: { label: "Vicentini (1/3, 1/3, 1/3)", ab: recordAB("ssi_thirds") },
    half: { label: "Vicentini (1/2, 1/4, 1/4)", ab: recordAB("ssi_half") },
    custom: { label: "Your two tails", ab: null },
  };
  const preset0 = String(spec.preset ?? "ssi");
  const state = {
    preset: PRESETS[preset0] ? preset0 : "ssi",
    p1: dp.SSI_TARGETS.p1,
    p2: dp.SSI_TARGETS.p2,
    J: Math.round(num(spec, "J", SIM_J, J_MIN, J_MAX)),
    overlay: spec.K !== undefined || preset0 === "truth",
    kStar: K_STARS.includes(Number(spec.K)) ? Number(spec.K) : 30,
    I: I_LEVELS[0],
  };
  if (preset0 === "truth") state.preset = "ssi";
  let ab = PRESETS[state.preset].ab ?? PRESETS.ssi.ab;
  let feasible = true;
  const ui = frame(el, { label: "SSI explorer: fixed weight tails at every J, and an expected count that keeps growing", className: "dpx-ssi" });
  const pW = h("div", { class: "dpx-panel" });
  const pK = h("div", { class: "dpx-panel" });
  ui.charts.append(pW, pK);
  ui.caption.textContent =
    "After Vicentini and Jermyn (2025) and the paper's SSI-Weight. Left: the density of W_SB, the share of the cluster a randomly chosen unit joins, with Pr(W_SB > .5) and Pr(W_SB > .9) shaded; it does not depend on J. Right: E K_J, the expected number of fitted components among the J units, with its 90% interval where the pmf is computed (J <= 500; above 500, E K_J only, by the digamma path).";
  let width = 720;

  const solveCustom = () => {
    const r = dp.ssiSolve(state.p1, state.p2, T1, T2);
    feasible = state.p2 < state.p1 && Math.abs(r.achieved[0] - state.p1) < 1e-6 && Math.abs(r.achieved[1] - state.p2) < 1e-6;
    if (feasible) ab = [r.a, r.b];
  };

  const simRows = () => sims.filter((r) => r.prior === "SSI-Weight" && r.J === SIM_J && r.I_target === state.I);

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const [a, b] = ab;
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const half = Math.floor((width - 16 * (cols - 1)) / cols);
    const col = c.methods.ssi;
    // left: the W_SB density (J-free)
    const ws = [];
    for (let i = 0; i <= 200; i += 1) {
      const w = (i / 200) * dp.W_DENSITY_MAX;
      ws.push({ w, f: dp.wsbDensity(w, a, b) });
    }
    const S1 = dp.wsbTail(T1, a, b);
    const S2 = dp.wsbTail(T2, a, b);
    const fTop = Math.min(8, Math.max(...ws.map((d) => d.f)) * 1.1);
    draw(pW, {
      width: half, height: 230, marginLeft: 44,
      x: { domain: [0, 1], label: "W_SB (share of a random unit's cluster)" },
      y: { domain: [0, fTop], label: "density", grid: true },
      marks: [
        P.areaY(ws.filter((d) => d.w >= T1), { x: "w", y: (d) => Math.min(d.f, fTop), fill: col, fillOpacity: 0.3 }),
        P.areaY(ws.filter((d) => d.w >= T2), { x: "w", y: (d) => Math.min(d.f, fTop), fill: col, fillOpacity: 0.45 }),
        P.line(ws, { x: "w", y: (d) => Math.min(d.f, fTop), stroke: col, strokeWidth: 2 }),
        P.ruleX([T1, T2], { stroke: c.muted, strokeDasharray: "3,3" }),
        P.text([{ w: T1, f: fTop * 0.92 }], { x: "w", y: "f", text: () => `Pr(> .5) = ${fmtProb(S1)}`, dx: 4, textAnchor: "start", fill: c.fg, fontSize: 11, fontWeight: 600 }),
        P.text([{ w: T2, f: fTop * 0.78 }], { x: "w", y: "f", text: () => `Pr(> .9) = ${fmtProb(S2)}`, dx: -4, textAnchor: "end", fill: c.fg, fontSize: 11, fontWeight: 600 }),
      ],
    }, `W_SB density of ${fmtGamma(a, b, 3)}: Pr(W_SB > .5) = ${fmtProb(S1)}, Pr(W_SB > .9) = ${fmtProb(S2)}, whatever J is.`);
    pW.prepend(h("p", { class: "dpx-panel-title", text: `Weights: the same at every J (${fmtGamma(a, b, 3)})` }));
    // right: E K_J against J, with the 90% band up to J = 500
    const curve = [];
    for (let i = 0; i <= 40; i += 1) {
      const J = Math.round(J_MIN * (J_MAX / J_MIN) ** (i / 40));
      curve.push({ J, e: dp.mixMoments(J, a, b).mean });
    }
    const grid = dp.alphaGrid(a, b);
    const band = [25, 35, 50, 70, 100, 150, 200, 300, 400, PMF_CAP].map((J) => { const s = dp.pmfSummary(dp.mixPmf(J, a, b, grid)); return { J, lo: s.q05, hi: s.q95 }; });
    const eJ = dp.mixMoments(state.J, a, b).mean;
    const sim = state.overlay ? simRows().find((r) => r.K_true === state.kStar) : null;
    const yMax = Math.max(curve[curve.length - 1].e, ...band.map((d) => d.hi), sim ? state.kStar : 0) * 1.08;
    const marks = [
      P.areaY(band, { x: "J", y1: "lo", y2: "hi", fill: col, fillOpacity: 0.15 }),
      P.line(curve, { x: "J", y: "e", stroke: col, strokeWidth: 2.4 }),
      P.ruleX([PMF_CAP], { stroke: c.muted, strokeDasharray: "2,3" }),
      P.dot([{ J: state.J, e: eJ }], { x: "J", y: "e", r: 5.5, fill: col, stroke: c.fg }),
      P.text([{ J: state.J, e: eJ }], { x: "J", y: "e", text: () => fmtCount(eJ), dx: -8, dy: -10, textAnchor: "end", fill: c.fg, fontWeight: 700 }),
      logTickLabels(J_TICKS, c.muted),
    ];
    if (sim) {
      const xs = SIM_J * SIM_OFFSET; // drawn just right of J = 100 so the prior point stays readable
      marks.push(
        P.ruleX([sim], { x: () => xs, y1: "mean_q025_K", y2: "mean_q975_K", stroke: c.fg, strokeWidth: 3 }),
        P.dot([sim], { x: () => xs, y: "mean_E_K", r: 5, fill: c.raised, stroke: c.fg, strokeWidth: 2 }),
        P.text([sim], { x: () => xs, y: "mean_q975_K", text: () => "posterior 95%", dx: 6, dy: 4, textAnchor: "start", fill: c.fg, fontSize: 10 }),
        P.dot([{ J: xs, k: state.kStar }], { x: "J", y: "k", r: 7, symbol: "star", fill: c.red, stroke: c.fg }),
        P.text([{ J: xs, k: state.kStar }], { x: "J", y: "k", text: () => `true K* = ${state.kStar}`, dx: 10, textAnchor: "start", fill: c.red, fontSize: 11, fontWeight: 700 }),
      );
    }
    draw(pK, {
      width: half, height: 230, marginLeft: 44, marginBottom: 42,
      x: { type: "log", domain: [J_MIN, J_MAX], label: "J (log scale)", ticks: J_TICKS, tickFormat: () => "", labelOffset: 36 },
      y: { domain: [0, yMax], label: "E K_J", grid: true },
      marks,
    }, `E K_J under ${fmtGamma(a, b, 3)} grows from ${fmtCount(curve[0].e)} at J = ${J_MIN} to ${fmtCount(curve[curve.length - 1].e)} at J = ${J_MAX}; ${fmtCount(eJ)} at J = ${state.J}.${sim ? ` Simulation at J = ${SIM_J}: posterior mean ${fmtCount(sim.mean_E_K)}, average 95% interval ${fmt(sim.mean_q025_K, 2)} to ${fmt(sim.mean_q975_K, 2)}, true K* = ${state.kStar}.` : ""}`);
    pK.prepend(h("p", { class: "dpx-panel-title", text: sim ? `Counts grow with J; at J = ${SIM_J} the posterior never reaches K* = ${state.kStar}` : "Counts: E K_J keeps growing with J" }));
    pK.append(srTable("E K_J by J", ["J", "E K_J", "90% interval"], [25, 100, 500, 1000, 5000].map((J) => {
      const bnd = band.find((d) => d.J === J);
      return [J, fmtCount(dp.mixMoments(J, a, b).mean), bnd ? `[${bnd.lo}, ${bnd.hi}]` : "E K only (J > 500)"];
    })));
    let text = feasible
      ? `${PRESETS[state.preset].label} ${fmtGamma(a, b, 3)}: Pr(W_SB > .5) = ${fmtProb(S1)} and Pr(W_SB > .9) = ${fmtProb(S2)} at every J, while E K_J = ${fmtCount(eJ)} at J = ${state.J}${state.J > PMF_CAP ? " (E K only above J = 500, digamma path)" : ""}, rising from ${fmtCount(curve[0].e)} at J = ${J_MIN} to ${fmtCount(curve[curve.length - 1].e)} at J = ${J_MAX}.`
      : `No Gamma prior has Pr(W_SB > .5) = ${fmtProb(state.p1)} and Pr(W_SB > .9) = ${fmtProb(state.p2)}: the ratio log(.5 tail) / log(.9 tail) must lie between log 2 / log 10 and 1. Showing the last feasible prior.`;
    if (sim) text += ` Simulation (J = ${SIM_J}, I = ${state.I}, true K* = ${state.kStar}): posterior mean ${fmtCount(sim.mean_E_K)}, average 95% interval [${fmt(sim.mean_q025_K, 2)}, ${fmt(sim.mean_q975_K, 2)}]; the interval covers K* in ${Math.round(sim.coverage95_K * sim.n_scientific_eligible)} of ${sim.n_scientific_eligible} replications.`;
    ui.readout.textContent = text;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.a = String(a);
    ui.root.dataset.b = String(b);
  };

  const setPreset = (p) => {
    state.preset = p;
    customBox.hidden = p !== "custom";
    if (p === "custom") solveCustom();
    else { ab = PRESETS[p].ab; feasible = true; }
    render();
  };
  const sPreset = segmented({ label: "Prior", options: Object.entries(PRESETS).map(([value, v]) => ({ value, label: v.label })), value: state.preset, onChange: setPreset });
  const sP1 = slider({ label: "Pr(W_SB > .5)", min: 0.05, max: 0.6, step: 0.01, value: state.p1, format: fmtProb, onInput: (v) => { state.p1 = v; solveCustom(); render(); } });
  const sP2 = slider({ label: "Pr(W_SB > .9)", min: 0.005, max: 0.3, step: 0.005, value: state.p2, format: fmtProb, onInput: (v) => { state.p2 = v; solveCustom(); render(); } });
  const customBox = h("div", { class: "dpx-control dpx-buttons" }, sP1.root, sP2.root);
  customBox.hidden = state.preset !== "custom";
  const sJ = slider({ label: "J (units)", min: J_MIN, max: J_MAX, value: state.J, log: true, format: (v) => String(Math.round(v)), onInput: (v) => { state.J = Math.round(v); render(); } });
  const tOverlay = toggle({ label: "overlay the simulation at J = 100 (A-10)", checked: state.overlay, onChange: (v) => { state.overlay = v; render(); } });
  const sK = segmented({ label: "true K*", options: K_STARS.map((k) => ({ value: k, label: String(k) })), value: state.kStar, onChange: (v) => { state.kStar = v; state.overlay = true; tOverlay.set(true); render(); } });
  const sI = segmented({ label: "information I", options: I_LEVELS.map((i) => ({ value: i, label: String(i) })), value: state.I, onChange: (v) => { state.I = v; render(); } });
  ui.controls.append(sPreset.root, customBox, sJ.root, tOverlay.root, sK.root, sI.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.J !== undefined) { state.J = Math.round(num(next, "J", state.J, J_MIN, J_MAX)); sJ.set(state.J); }
      if (next.K !== undefined && K_STARS.includes(Number(next.K))) { state.kStar = Number(next.K); state.overlay = true; sK.set(state.kStar); tOverlay.set(true); }
      if (next.p1 !== undefined || next.p2 !== undefined) {
        state.p1 = num(next, "p1", state.p1, 0.05, 0.6);
        state.p2 = num(next, "p2", state.p2, 0.005, 0.3);
        sP1.set(state.p1);
        sP2.set(state.p2);
        sPreset.set("custom");
        setPreset("custom");
        return;
      }
      if (next.preset && PRESETS[next.preset]) { sPreset.set(next.preset); setPreset(next.preset); return; }
      render();
    },
    get ab() { return [...ab]; },
    get feasible() { return feasible; },
    destroy() { stop(); el.replaceChildren(); },
  };
}
