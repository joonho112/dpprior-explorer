// C-05 "Elicitation form: from a statement about K_J to Gamma(a, b) and its diagnostics". Owner
// of this file: Step 8.6.
//
// Three routes to the count moments (paper, Sec. 3.2):
//   interval    "K_J lies in [k_L, k_U] with probability q": sigma_K = (k_U - k_L) / (2 z_{(1+q)/2})
//               (z = 1.2816 at 80%, 1.96 at 95%); mu_K is the stated "about" value or the midpoint;
//   confidence  sigma^2 = VIF (mu_K - 1), with high / medium / low = VIF 1.5 / 2.5 / 5;
//   CV          sigma^2 = (CV_K mu_K)^2.
// dp-core tsmmFit turns (mu_K, sigma^2) into Gamma(a, b) while the reader types. The diagnostics
// follow: E(alpha), CV(alpha), the implied K_J pmf (and how much of it the stated interval holds),
// the W_SB density, and the dominance check: Pr(W_SB > .5) above .40 raises a red trigger badge,
// the paper's cue to consider the dual-anchor refinement. A target below the profile minimum
// variance gets "no solution", the bound, and the largest coverage (or smallest VIF or CV) that
// would work.
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, num, numberField, observeWidth, segmented, toggle } from "./base.js";
import { fmt, fmtGamma, fmtPct, fmtProb } from "./format.js";

const TRIGGER = 0.4; // Pr(W_SB > .5) above this raises the dominance trigger
const EXTREME_T = 0.9;
const J_MIN = 5;
const J_MAX = dp.LIVE_J_MAX;
const CELL_MIN = 336;
const COVERAGES = [0.5, 0.8, 0.9, 0.95];
const CONFIDENCE = Object.entries(dp.VIF_BY_CONFIDENCE).map(([k, v]) => ({ value: v, label: `${k} (VIF ${v})` }));
const ROUTES = [
  { value: "interval", label: "an interval" },
  { value: "vif", label: "a confidence level" },
  { value: "cv", label: "a coefficient of variation" },
];
// The paper's applications (interval route at 80%) and the [3, 10] example of Sec. 3.2.
const PRESETS = {
  star: { label: "STAR (J = 79)", J: 79, route: "interval", mu: 5, mid: false, lo: 2, hi: 8, q: 0.8 },
  bd: { label: "Bangert-Drowns (J = 48)", J: 48, route: "interval", mu: 4, mid: false, lo: 1, hi: 8, q: 0.8 },
  vocab: { label: "Vocabulary (J = 500)", J: 500, route: "interval", mu: 5, mid: false, lo: 2, hi: 10, q: 0.8 },
  i80: { label: "[3, 10] at 80%, J = 100", J: 100, route: "interval", mu: 6.5, mid: true, lo: 3, hi: 10, q: 0.8 },
  i95: { label: "[3, 10] at 95%, J = 100", J: 100, route: "interval", mu: 6.5, mid: true, lo: 3, hi: 10, q: 0.95 },
  j50: { label: "J = 50, about 5, medium confidence", J: 50, route: "vif", mu: 5, vif: 2.5 },
};

/** A typed number as the reader typed it (no float noise). */
const show = (x) => String(Number(Number(x).toFixed(4)));
/** Non-probabilities (E(alpha), CV, sigma) keep the leading zero: "0.961". */
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "–");
/** Pr(W_SB > .5) next to the trigger: a fourth decimal when three would hide which side it is on. */
const fmtS = (s) => (Math.abs(s - TRIGGER) < 5e-4 ? fmt(s, 4) : fmtProb(s));

/** The largest coverage q at which [lo, hi] still asks for a variance above minVar. */
function maxCoverage(lo, hi, minVar) {
  const zMax = (hi - lo) / (2 * Math.sqrt(minVar));
  let a = 0;
  let b = 1;
  for (let i = 0; i < 60; i += 1) {
    const m = (a + b) / 2;
    if (dp.qnorm((1 + m) / 2) < zMax) a = m;
    else b = m;
  }
  return a;
}

export function mountWidget(el, spec = {}) {
  let presetKey = PRESETS[spec.preset] ? spec.preset : "star";
  const p0 = PRESETS[presetKey];
  const state = { J: p0.J, route: p0.route, mu: p0.mu, mid: p0.mid ?? false, lo: p0.lo ?? 2, hi: p0.hi ?? 8, q: p0.q ?? 0.8, vif: p0.vif ?? 2.5, cv: 0.5 };
  if (spec.J !== undefined) { state.J = Math.round(num(spec, "J", state.J, J_MIN, J_MAX)); presetKey = null; }
  if (spec.mu !== undefined) { state.mu = num(spec, "mu", state.mu, 1.01, J_MAX - 1); state.mid = false; presetKey = null; }

  const ui = frame(el, { label: "Elicitation form: from a statement about the number of clusters to Gamma(a, b)", className: "dpx-elicit" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pK = h("div", { class: "dpx-panel" });
  const pW = h("div", { class: "dpx-panel" });
  const srBox = h("div");
  ui.charts.append(tiles, pK, pW, srBox);
  ui.caption.textContent =
    `K_J is the number of clusters (fitted components) among the J units. An interval held with probability q becomes sigma_K = (k_U - k_L) / (2 z), with z = ${dp.qnorm(0.9).toFixed(4)} at 80% and ${dp.qnorm(0.975).toFixed(2)} at 95%; a confidence level becomes sigma^2 = VIF (mu_K - 1); a coefficient of variation becomes sigma^2 = (CV_K mu_K)^2. TSMM (dp-core tsmmFit) then solves Gamma(a, b) exactly, as you type.`;
  let width = 720;
  let res = null;

  const derive = () => {
    const s = state;
    const mu = s.route === "interval" && s.mid ? (s.lo + s.hi) / 2 : s.mu;
    const issues = [];
    if (s.route === "interval" && !(s.lo >= 1 && s.lo < s.hi && s.hi <= s.J)) issues.push(`the interval needs 1 <= k_L < k_U <= J = ${s.J}`);
    if (!(mu > 1 && mu < s.J)) issues.push(`mu_K must lie strictly between 1 and J = ${s.J}`);
    let v;
    let how;
    let said;
    if (s.route === "interval") {
      const m = dp.intervalToMoments(s.lo, s.hi, s.q, mu);
      v = m.varK;
      how = `sigma_K = (${show(s.hi)} - ${show(s.lo)}) / (2 × ${m.z.toFixed(4)}) = ${f3(Math.sqrt(v))}`;
      said = s.mid
        ? `between ${show(s.lo)} and ${show(s.hi)} clusters among J = ${s.J} units with ${fmtPct(s.q, 0)} probability (mu_K the midpoint, ${show(mu)})`
        : `about ${show(mu)} clusters among J = ${s.J} units, between ${show(s.lo)} and ${show(s.hi)} with ${fmtPct(s.q, 0)} probability`;
    } else if (s.route === "vif") {
      v = dp.vifToVariance(mu, s.vif);
      how = `sigma^2 = VIF (mu_K - 1) = ${show(s.vif)} × ${show(mu - 1)}`;
      const lab = CONFIDENCE.find((o) => Math.abs(o.value - s.vif) < 1e-9);
      said = `about ${show(mu)} clusters among J = ${s.J} units, ${lab ? `${lab.label.split(" ")[0]} confidence (VIF ${show(s.vif)})` : `VIF ${show(s.vif)}`}`;
    } else {
      v = dp.cvToVariance(mu, s.cv);
      how = `sigma^2 = (CV_K mu_K)^2 = (${show(s.cv)} × ${show(mu)})^2`;
      said = `about ${show(mu)} clusters among J = ${s.J} units, give or take ${fmtPct(s.cv, 0)} (CV_K = ${show(s.cv)})`;
    }
    return { mu, v, how, said, issues };
  };

  const solve = () => {
    const d = derive();
    const t0 = performance.now();
    const fit = d.issues.length ? null : dp.tsmmFit(state.J, d.mu, d.v);
    const ok = fit !== null && (fit.status === "ok" || fit.status === "point-mass");
    const out = { d, fit, ok, ms: performance.now() - t0 };
    if (ok) {
      out.S5 = dp.wsbTail(0.5, fit.a, fit.b);
      out.S9 = dp.wsbTail(EXTREME_T, fit.a, fit.b);
      out.pmf = dp.mixPmf(state.J, fit.a, fit.b);
      out.sum = dp.pmfSummary(out.pmf);
      if (state.route === "interval") {
        let cov = 0;
        for (let k = Math.ceil(state.lo); k <= Math.floor(state.hi); k += 1) cov += out.pmf[k];
        out.cov = cov;
      }
    }
    res = out;
  };

  const note = (t) => h("p", { class: "dpx-tile-note", text: t });
  const tile = (title, big, sub) => h("div", { class: "dpx-tile" }, note(title), h("p", { class: "dpx-tile-big", text: big }), sub ? note(sub) : null);
  const pillTile = (title, ok, text, sub) => h("div", { class: "dpx-tile" }, note(title), h("p", {}, h("span", { class: `dpx-pill ${ok ? "dpx-pill-ok" : "dpx-pill-bad"}`, text })), sub ? note(sub) : null);

  const noFitText = () => {
    const { d, fit } = res;
    if (d.issues.length) return `Check the inputs: ${d.issues.join("; ")}.`;
    if (fit.status === "infeasible") {
      const need = state.route === "interval"
        ? `The same interval works at a probability below ${fmtPct(maxCoverage(state.lo, state.hi, fit.minVar), 1)}, or widen it.`
        : state.route === "vif"
          ? `A VIF above ${fmt(fit.minVar / (d.mu - 1), 2)} works.`
          : `A CV_K above ${f3(Math.sqrt(fit.minVar) / d.mu)} works.`;
      return `sigma^2 = ${f3(d.v)} is below ${f3(fit.minVar)}, the smallest variance of K_${state.J} that any Gamma prior with mean ${show(d.mu)} can give (the point mass alpha* = ${f3(fit.alphaStar)}). ${need}`;
    }
    if (fit.status === "support") return `Outside the support: a count on 1..${state.J} with mean ${show(d.mu)} cannot have this variance (sigma^2 must stay below (mu_K - 1)(J - mu_K) = ${fmt(fit.supportUpper, 1)}).`;
    if (fit.status === "approximate") return `Only an approximation: the closest prior found gives mean ${f3(fit.achieved.M1)} and variance ${f3(fit.achieved.V)} (|F| = ${fit.residual.toExponential(1)}), so it is not used.`;
    if (d.v > 0.9 * fit.supportUpper) return `Newton did not converge: sigma^2 = ${f3(d.v)} is within ${fmtPct(1 - d.v / fit.supportUpper, 0)} of the ceiling (mu_K - 1)(J - mu_K) = ${fmt(fit.supportUpper, 1)}, which only a two-point law on {1, ${state.J}} reaches. Narrow the statement a little.`;
    return "Newton did not converge from the A1 start.";
  };

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { d, fit, ok } = res;
    const J = state.J;
    const gam = ok ? (fit.a >= 1e4 ? fmtGamma(fit.a, fit.b) : fmtGamma(fit.a, fit.b, 3)) : "–";
    const trig = ok && res.S5 > TRIGGER;
    tiles.replaceChildren(
      tile("1. Your statement as count moments", d.issues.length ? "–" : `mu_K = ${show(d.mu)}, sigma^2 = ${f3(d.v)}`, d.issues.length ? null : d.how),
      ok
        ? tile("2. TSMM: the Gamma(a, b) prior on alpha", gam, `${fit.iter} Newton steps from the A1 start ${fmtGamma(fit.start.a0, fit.start.b0, 3)}${fit.start.projected ? " (projected)" : ""}; ${fmt(res.ms, 1)} ms`)
        : pillTile("2. TSMM: the Gamma(a, b) prior on alpha", false, d.issues.length ? "not computed" : "no solution", noFitText()),
      ok
        ? tile("3. What the prior implies: E(alpha)", f3(fit.a / fit.b),
          `CV(alpha) = ${f3(1 / Math.sqrt(fit.a))}; K_${J} 90% interval [${res.sum.q05}, ${res.sum.q95}], P(K = 1) = ${fmtProb(res.pmf[1])}${res.cov !== undefined ? `; the stated [${show(state.lo)}, ${show(state.hi)}] holds ${fmtProb(res.cov)} of it (you said ${fmtPct(state.q, 0)})` : ""}`)
        : tile("3. What the prior implies: E(alpha)", "–"),
      ok
        ? pillTile("4. Dominance check: Pr(W_SB > .5)", !trig, trig ? `trigger: ${fmtS(res.S5)} > .40` : `no trigger: ${fmtS(res.S5)} <= .40`,
          `${trig ? "Too likely that one cluster holds most units. Next step: the dual-anchor refinement." : "No single cluster is expected to dominate."} Pr(W_SB > .9) = ${fmtProb(res.S9)}.`)
        : tile("4. Dominance check: Pr(W_SB > .5)", "–"),
    );
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const w = Math.floor((width - 16 * (cols - 1)) / cols);
    if (ok) {
      pK.style.gridColumn = "";
      pW.hidden = false;
      const inside = (k) => state.route === "interval" && k >= state.lo && k <= state.hi;
      const kmax = Math.min(J, Math.max(12, res.sum.q95 + 3, state.route === "interval" ? Math.ceil(state.hi) + 2 : 0));
      const bars = Array.from({ length: kmax }, (_, i) => ({ k: i + 1, p: res.pmf[i + 1], inside: inside(i + 1) }));
      draw(pK, {
        width: w, height: 210, marginLeft: 44, marginBottom: 42,
        x: { domain: [0.5, kmax + 0.5], label: `k (clusters among J = ${J})`, labelOffset: 36 },
        y: { label: "probability", grid: true },
        marks: [
          P.rectY(bars, { x1: (b) => b.k - 0.4, x2: (b) => b.k + 0.4, y: "p", fill: c.methods.tsmm, fillOpacity: (b) => (state.route !== "interval" || b.inside ? 0.85 : 0.3) }),
          P.ruleX([d.mu], { stroke: c.fg, strokeWidth: 2, strokeDasharray: "4,3" }),
          P.ruleY([0], { stroke: c.borderStrong }),
        ],
      }, `Implied K_${J} under ${gam}: mean ${show(d.mu)} (dashed) and variance ${fmt(d.v, 2)} as stated; 90% interval [${res.sum.q05}, ${res.sum.q95}]${res.cov !== undefined ? `; the bars in [${show(state.lo)}, ${show(state.hi)}] (darker) hold ${fmtProb(res.cov)}` : ""}.`);
      pK.prepend(h("p", { class: "dpx-panel-title", text: `The implied K_${J}: mean and variance as stated${state.route === "interval" ? ", the stated interval darker" : ""}` }));
      const wd = [];
      for (let i = 0; i <= 240; i += 1) {
        const x = Math.min(dp.W_DENSITY_MAX, i / 240);
        wd.push({ w: x, d: dp.wsbDensity(x, fit.a, fit.b) });
      }
      const top = Math.min(4, Math.max(2, ...wd.filter((x) => x.w <= 0.95).map((x) => x.d)) * 1.15);
      const clip = wd.map((x) => ({ ...x, d: Math.min(x.d, top) }));
      draw(pW, {
        width: w, height: 210, marginLeft: 42, marginBottom: 42,
        x: { domain: [0, 1], label: "W_SB (share of a random unit's cluster)", labelOffset: 36, ticks: [0, dp.MAJORITY_T, EXTREME_T, 1], tickFormat: (t) => (t === 0 || t === 1 ? String(t) : fmt(t, 1)) },
        y: { domain: [0, top], label: "density", grid: true },
        marks: [
          P.areaY(clip.filter((x) => x.w >= dp.MAJORITY_T), { x: "w", y: "d", fill: c.red, fillOpacity: 0.22 }),
          P.areaY(clip.filter((x) => x.w >= EXTREME_T), { x: "w", y: "d", fill: c.red, fillOpacity: 0.45 }),
          P.lineY(clip, { x: "w", y: "d", stroke: c.fg, strokeWidth: 1.6 }),
          P.ruleX([dp.MAJORITY_T, EXTREME_T], { stroke: c.red, strokeDasharray: "3,3" }),
        ],
      }, `Density of W_SB under ${gam}: Pr(W_SB > .5) = ${fmtS(res.S5)} (shaded) ${trig ? "is above" : "is at or below"} the .40 trigger; Pr(W_SB > .9) = ${fmtProb(res.S9)} (darker).`);
      pW.prepend(h("p", { class: "dpx-panel-title", text: `Weight view: Pr(W_SB > .5) = ${fmtS(res.S5)}, Pr(W_SB > .9) = ${fmtProb(res.S9)}` }));
    } else if (!d.issues.length && fit.status === "infeasible") {
      // where the target sits against the profile bound: no Gamma prior lies below the red curve
      pK.style.gridColumn = "1 / -1";
      pW.hidden = true;
      const muMax = Math.min(J - 1, Math.max(3 * d.mu, 10));
      const curve = Array.from({ length: 41 }, (_, i) => { const mu = 1.2 + ((muMax - 1.2) * i) / 40; return { mu, v: dp.profileBound(J, mu).minVar }; });
      const pt = [{ mu: d.mu, v: d.v, label: `your target (${show(d.mu)}, ${fmt(d.v, 2)}): no solution` }];
      draw(pK, {
        width: Math.min(width, 640), height: 230, marginLeft: 44, marginBottom: 42,
        x: { label: "mu_K (target mean)", labelOffset: 36 },
        y: { label: "sigma^2 (target variance)", grid: true, domain: [0, Math.max(d.v, ...curve.map((x) => x.v)) * 1.1] },
        marks: [
          P.areaY(curve, { x: "mu", y: "v", fill: c.red, fillOpacity: 0.12 }),
          P.line(curve, { x: "mu", y: "v", stroke: c.red, strokeWidth: 2 }),
          P.dot(pt, { x: "mu", y: "v", r: 6, fill: c.red, stroke: c.fg }),
          P.text(pt, { x: "mu", y: "v", text: "label", dx: 10, textAnchor: "start", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11, fontWeight: 600 }),
        ],
      }, `At J = ${J} no Gamma prior has a count variance below the red curve; the target (${show(d.mu)}, ${fmt(d.v, 2)}) lies below it (the smallest variance at mu_K = ${show(d.mu)} is ${fmt(fit.minVar, 2)}).`);
      pK.prepend(h("p", { class: "dpx-panel-title", text: `Below the red curve no Gamma prior exists (J = ${J})` }));
    } else {
      pK.style.gridColumn = "1 / -1";
      pW.hidden = true;
      pK.replaceChildren(h("p", { class: "dpx-panel-title", text: "No prior to draw" }), note(noFitText()));
    }
    srBox.replaceChildren(srTable("From the statement to the prior", ["step", "value"], [
      ["statement", d.said],
      ["count moments", d.issues.length ? "–" : `mu_K = ${show(d.mu)}, sigma^2 = ${f3(d.v)} (${d.how})`],
      ["Gamma(a, b)", ok ? gam : noFitText()],
      ["E(alpha), CV(alpha)", ok ? `${f3(fit.a / fit.b)}, ${f3(1 / Math.sqrt(fit.a))}` : "–"],
      [`K_${J} 90% interval`, ok ? `[${res.sum.q05}, ${res.sum.q95}]` : "–"],
      ["Pr(W_SB > .5), Pr(W_SB > .9)", ok ? `${fmtS(res.S5)}, ${fmtProb(res.S9)}` : "–"],
      ["dominance trigger (> .40)", ok ? (trig ? "yes" : "no") : "–"],
    ]));
    ui.readout.textContent = ok
      ? `You said: ${d.said}. That is mu_K = ${show(d.mu)}, sigma^2 = ${f3(d.v)}; TSMM gives ${gam}, E(alpha) = ${f3(fit.a / fit.b)}; Pr(W_SB > .5) = ${fmtS(res.S5)}${trig ? ", above .40: the dominance trigger fires" : ", at or below .40: no trigger"}.`
      : `You said: ${d.said}. ${d.issues.length ? "" : `That is mu_K = ${show(d.mu)}, sigma^2 = ${f3(d.v)}: `}${noFitText()}`;
    // the interval inputs are each in range but may not form an interval
    const badInterval = state.route === "interval" && !(state.lo >= 1 && state.lo < state.hi && state.hi <= J);
    for (const [f, val] of [[fLo, state.lo], [fHi, state.hi]]) {
      if (badInterval) f.input.setAttribute("aria-invalid", "true");
      else if (Number(f.input.value) === val) f.input.setAttribute("aria-invalid", "false");
    }
    ui.root.dataset.renderMs = (performance.now() - t0 + res.ms).toFixed(1);
    ui.root.dataset.status = d.issues.length ? "input" : fit.status;
    ui.root.dataset.v = String(d.v);
    ui.root.dataset.a = ok ? String(fit.a) : "";
    ui.root.dataset.b = ok ? String(fit.b) : "";
    ui.root.dataset.s5 = ok ? String(res.S5) : "";
    ui.root.dataset.trigger = String(trig);
  };

  const run = () => { solve(); render(); };

  // controls
  const sPre = segmented({ label: "Examples", options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })), value: presetKey, onChange: (k) => applyPreset(k) });
  const custom = () => sPre.set(null);
  const fJ = numberField({ label: "J (units)", value: state.J, min: J_MIN, max: J_MAX, step: 1, onInput: (v) => { state.J = Math.round(v); custom(); run(); } });
  const sRoute = segmented({ label: "State K_J as", options: ROUTES, value: state.route, onChange: (r) => { state.route = r; showRoute(); custom(); run(); } });
  const fMu = numberField({ label: "about how many clusters (mu_K)", value: state.mu, min: 1.01, max: J_MAX, onInput: (v) => { state.mu = v; custom(); run(); } });
  const syncMid = () => {
    if (state.route === "interval" && state.mid) { state.mu = (state.lo + state.hi) / 2; fMu.set(show(state.mu)); }
    fMu.setDisabled(state.route === "interval" && state.mid);
  };
  const tMid = toggle({ label: "mu_K is the midpoint", checked: state.mid, onChange: (m) => { state.mid = m; syncMid(); custom(); run(); } });
  const fLo = numberField({ label: "k_L (low end)", value: state.lo, min: 1, max: J_MAX, onInput: (v) => { state.lo = v; syncMid(); custom(); run(); } });
  const fHi = numberField({ label: "k_U (high end)", value: state.hi, min: 1, max: J_MAX, onInput: (v) => { state.hi = v; syncMid(); custom(); run(); } });
  const sQ = segmented({ label: "held with probability", options: COVERAGES.map((q) => ({ value: q, label: fmtPct(q, 0) })), value: state.q, onChange: (q) => { state.q = q; custom(); run(); } });
  const fVif = numberField({ label: "VIF", value: state.vif, min: 1.01, max: 50, onInput: (v) => { state.vif = v; sConf.set(CONFIDENCE.find((o) => Math.abs(o.value - v) < 1e-9)?.value ?? null); custom(); run(); } });
  const sConf = segmented({ label: "confidence", options: CONFIDENCE, value: CONFIDENCE.some((o) => o.value === state.vif) ? state.vif : null, onChange: (v) => { state.vif = v; fVif.set(v); custom(); run(); } });
  const fCv = numberField({ label: "CV_K = sigma_K / mu_K", value: state.cv, min: 0.01, max: 10, onInput: (v) => { state.cv = v; custom(); run(); } });
  const gInterval = h("div", { class: "dpx-control-sub" }, fLo.root, fHi.root, sQ.root, tMid.root);
  const gVif = h("div", { class: "dpx-control-sub" }, sConf.root, fVif.root);
  const gCv = h("div", { class: "dpx-control-sub" }, fCv.root);
  const showRoute = () => {
    gInterval.hidden = state.route !== "interval";
    gVif.hidden = state.route !== "vif";
    gCv.hidden = state.route !== "cv";
    syncMid();
  };
  const setAll = () => {
    fJ.set(state.J); sRoute.set(state.route); fMu.set(show(state.mu)); tMid.set(state.mid); fLo.set(state.lo); fHi.set(state.hi); sQ.set(state.q);
    fVif.set(state.vif); sConf.set(CONFIDENCE.some((o) => o.value === state.vif) ? state.vif : null); fCv.set(state.cv);
    showRoute();
  };
  function applyPreset(k) {
    const p = PRESETS[k];
    if (!p) return;
    Object.assign(state, { J: p.J, route: p.route, mu: p.mu, mid: p.mid ?? false });
    if (p.lo !== undefined) Object.assign(state, { lo: p.lo, hi: p.hi, q: p.q });
    if (p.vif !== undefined) state.vif = p.vif;
    sPre.set(k);
    setAll();
    run();
  }
  ui.controls.append(
    sPre.root,
    h("div", { class: "dpx-control-group" }, fJ.root, sRoute.root),
    h("div", { class: "dpx-control-group" }, fMu.root, gInterval, gVif, gCv),
  );
  showRoute();
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  run();
  ready = true;
  return {
    update(next = {}) {
      if (PRESETS[next.preset]) { applyPreset(next.preset); return; }
      if (next.J !== undefined) state.J = Math.round(num(next, "J", state.J, J_MIN, J_MAX));
      if (next.mu !== undefined) { state.mu = num(next, "mu", state.mu, 1.01, J_MAX - 1); state.mid = false; }
      custom();
      setAll();
      run();
    },
    get result() { return res.ok ? { status: res.fit.status, a: res.fit.a, b: res.fit.b, muK: res.d.mu, varK: res.d.v, S5: res.S5, S9: res.S9, trigger: res.S5 > TRIGGER } : { status: res.d.issues.length ? "input" : res.fit.status, muK: res.d.mu, varK: res.d.v }; },
    destroy() { stop(); el.replaceChildren(); },
  };
}
