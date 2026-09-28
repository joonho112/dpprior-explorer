// M-04 "Three published rules, three odd implications" (+ the vague default).
//
//   DORO-Unif  a KL projection onto a flat count target cannot be flat: the Gamma-mixed
//              pmf is negative-binomial shaped, puts ~.07 on K = 1 and leaks ~.07 beyond
//              the target's support.
//   SCAL       fixing P(K = 1) = .34 and P(K >= ceil(2 ln m)) = .15 at every m pins the
//              homogeneity prior at .34 forever; the shortcut a = b = exp(-0.033 m) drifts
//              to P(K_100 = 1) = .834.
//   SSI-Weight fixing only the weight tails (.25 / .05) lets E K_J grow without bound:
//              6.44 at J = 25, 20.9 at J = 5000.
//   Vague      Gamma(1, 1): P(K_100 = 1) = .168 and Pr(W_SB > .5) = .591.
// (a, b) solutions come from r-export/02_methods_catalog.R (method_catalog.json); the
// widget recomputes every displayed number with dp-core.
import * as dp from "../dp-core.js";
import mc from "../../data/precomputed/method_catalog.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

export function mountWidget(el, spec = {}) {
  const state = {
    doroJ: [48, 79, 100, 500].includes(Number(spec.J)) ? Number(spec.J) : 100,
    m: [6, 10, 25, 50, 75, 100].includes(Number(spec.m)) ? Number(spec.m) : 100,
    ssiJ: num(spec, "ssiJ", 100, 25, 5000),
  };
  const ui = frame(el, { label: "DORO, SCAL and SSI side by side: what three published hyperprior rules imply", className: "dpx-strip" });
  const pDoro = h("div", { class: "dpx-panel" });
  const pScal = h("div", { class: "dpx-panel" });
  const pSsi = h("div", { class: "dpx-panel" });
  const pVague = h("div", { class: "dpx-panel" });
  ui.charts.append(pDoro, pScal, pSsi, pVague);
  ui.caption.textContent =
    "K_J is the number of fitted components among the J units (m in SCAL's notation); all panels are prior statements. Solutions: DORO-Unif by minimising the KL divergence (Dorazio, 2009); SCAL exact by solving its two tail equations (Murugiah & Sweeting, 2012; the tabulated values in Vicentini et al., 2025, are these rounded); SSI-Weight as in the paper. Numbers recomputed with dp-core.";
  let width = 720;
  const P = () => globalThis.Plot;
  // SSI's (a, b) is fixed, so its E K_J curve is computed once
  const ssiGrid = dp.alphaGrid(mc.ssi.a, mc.ssi.b);
  const ssiCurve = [];
  for (let i = 0; i <= 80; i += 1) {
    const x = Math.round(25 * (5000 / 25) ** (i / 80));
    ssiCurve.push({ J: x, e: dp.mixMoments(x, mc.ssi.a, mc.ssi.b, ssiGrid).mean });
  }

  const render = () => {
    const c = palette(ui.root);
    const col = (tok) => getComputedStyle(ui.root).getPropertyValue(tok).trim();
    const half = width >= 680 ? Math.floor((width - 16) / 2) : width;
    // --- DORO ---
    const d = mc.doro.find((x) => x.J === state.doroJ);
    const pmfD = dp.mixPmf(d.J, d.a, d.b);
    const kmaxD = Math.min(d.J, 16);
    const barsD = Array.from({ length: kmaxD }, (_, i) => ({ k: i + 1, p: pmfD[i + 1], inside: i + 1 <= d.support_max }));
    const target = barsD.filter((x) => x.inside).map((x) => ({ k: x.k, t: 1 / d.support_max }));
    let inside = 0;
    for (let k = 1; k <= d.support_max; k += 1) inside += pmfD[k];
    const leak = 1 - inside;
    let kl = 0;
    for (let k = 1; k <= d.support_max; k += 1) kl += (1 / d.support_max) * Math.log(1 / d.support_max / pmfD[k]);
    draw(pDoro, {
      width: half, height: 210, marginLeft: 40,
      x: { type: "band", label: "k", tickFormat: (k) => (k === 1 || k % 5 === 0 ? k : "") },
      y: { label: "probability", grid: true },
      marks: [
        P().barY(barsD, { x: "k", y: "p", fill: col("--m-doro"), fillOpacity: (x) => (x.inside ? 0.9 : 0.4) }),
        P().tickY(target, { x: "k", y: "t", stroke: c.fg, strokeWidth: 2.5 }),
        P().ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `DORO-Unif at J = ${d.J}: flat target ${fmt(1 / d.support_max, 3)} on 1 to ${d.support_max} (black ticks) against the fitted ${fmtGamma(d.a, d.b)} pmf; P(K = 1) = ${fmtProb(pmfD[1])}, mass beyond ${d.support_max} = ${fmtProb(leak)}.`);
    pDoro.prepend(h("p", { class: "dpx-panel-title", text: `DORO-Unif (${d.label.startsWith("J =") ? "" : `${d.label}, `}J = ${d.J}, mu_K = ${d.muK}): a flat target the Gamma family cannot hit` }));
    pDoro.append(h("p", { class: "dpx-caption-note", text: `${fmtGamma(d.a, d.b)}: P(K = 1) = ${fmtProb(pmfD[1])}, P(K > ${d.support_max}) = ${fmtProb(leak)} leaks outside the target, KL = ${fmt(kl, 3)}.` }));
    // --- SCAL ---
    const sc = mc.scal.find((x) => x.m === state.m);
    const pmfE = dp.mixPmf(sc.m, sc.exact.a, sc.exact.b);
    const pmfS = dp.mixPmf(sc.m, sc.shortcut.a, sc.shortcut.b);
    const kmaxS = Math.min(sc.m, 14);
    const barsE = Array.from({ length: kmaxS }, (_, i) => ({ k: i + 1, p: pmfE[i + 1], tail: i + 1 >= sc.q }));
    const dotsS = Array.from({ length: kmaxS }, (_, i) => ({ k: i + 1, p: pmfS[i + 1] }));
    let below = 0;
    for (let k = 1; k < sc.q; k += 1) below += pmfE[k];
    draw(pScal, {
      width: half, height: 210, marginLeft: 40,
      x: { type: "band", label: `k (clusters among m = ${sc.m})`, tickFormat: (k) => (k === 1 || k % 5 === 0 ? k : "") },
      y: { domain: [0, 1], label: "probability", grid: true },
      marks: [
        P().barY(barsE, { x: "k", y: "p", fill: (x) => (x.k === 1 ? c.red : x.tail ? c.gold : c.slate), fillOpacity: 0.85 }),
        P().dot(dotsS, { x: "k", y: "p", r: 3.4, stroke: c.fg, fill: c.raised, strokeWidth: 1.4 }),
        P().ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `SCAL at m = ${sc.m}: exact solution ${fmtGamma(sc.exact.a, sc.exact.b)} keeps P(K = 1) = ${fmtProb(pmfE[1])} and P(K >= ${sc.q}) = ${fmtProb(1 - below)}; the shortcut a = b = ${fmt(sc.shortcut.a, 3)} gives P(K = 1) = ${fmtProb(pmfS[1])} (circles).`);
    pScal.prepend(h("p", { class: "dpx-panel-title", text: `SCAL (m = ${sc.m}): P(K = 1) clamped at .34; the shortcut drifts` }));
    pScal.append(h("p", { class: "dpx-caption-note", text: `Exact ${fmtGamma(sc.exact.a, sc.exact.b)}: P(K = 1) = ${fmtProb(pmfE[1])} (red), P(K ≥ ${sc.q}) = ${fmtProb(1 - below)} (gold). Shortcut a = b = exp(-0.033 m) = ${fmt(sc.shortcut.a, 3)} (circles): P(K = 1) = ${fmtProb(pmfS[1])}.` }));
    // --- SSI ---
    const J = Math.round(state.ssiJ);
    const curve = ssiCurve;
    const eJ = dp.mixMoments(J, mc.ssi.a, mc.ssi.b).mean;
    draw(pSsi, {
      width: half, height: 210, marginLeft: 40, marginBottom: 42,
      x: { type: "log", domain: [25, 5000], label: "J (log scale)", ticks: [25, 50, 100, 500, 1000, 5000], tickFormat: () => "", labelOffset: 38 },
      y: { domain: [0, 23], label: "E K_J", grid: true },
      marks: [
        P().lineY(curve, { x: "J", y: "e", stroke: col("--m-ssi"), strokeWidth: 2.4 }),
        P().dot([{ J, e: eJ }], { x: "J", y: "e", r: 5, fill: col("--m-ssi"), stroke: c.fg }),
        P().text([{ J, e: eJ }], { x: "J", y: "e", text: () => fmtCount(eJ), dy: -12, fill: c.fg, fontWeight: 700 }),
        logTickLabels([25, 50, 100, 500, 1000, 5000], c.muted),
      ],
    }, `SSI-Weight ${fmtGamma(mc.ssi.a, mc.ssi.b)}: the weight tails stay at ${fmtProb(dp.wsbTail(0.5, mc.ssi.a, mc.ssi.b))} and ${fmtProb(dp.wsbTail(0.9, mc.ssi.a, mc.ssi.b))} while E K_J grows from ${fmtCount(curve[0].e)} at J = 25 to ${fmtCount(curve[curve.length - 1].e)} at J = 5000; at J = ${J}, ${fmtCount(eJ)}.`);
    pSsi.prepend(h("p", { class: "dpx-panel-title", text: "SSI-Weight: fixed weight tails, unbounded count" }));
    pSsi.append(h("p", { class: "dpx-caption-note", text: `${fmtGamma(mc.ssi.a, mc.ssi.b)}: Pr(W_SB > .5) = ${fmtProb(dp.wsbTail(0.5, mc.ssi.a, mc.ssi.b))} and Pr(W_SB > .9) = ${fmtProb(dp.wsbTail(0.9, mc.ssi.a, mc.ssi.b))} at every J; E K_J = ${fmtCount(eJ)} at J = ${J}.` }));
    // --- Vague mini tile ---
    const pmfV = dp.mixPmf(100, 1, 1);
    const barsV = Array.from({ length: 14 }, (_, i) => ({ k: i + 1, p: pmfV[i + 1] }));
    draw(pVague, {
      width: half, height: 210, marginLeft: 40,
      x: { type: "band", label: "k (clusters among J = 100)", tickFormat: (k) => (k === 1 || k % 5 === 0 ? k : "") },
      y: { label: "probability", grid: true },
      marks: [P().barY(barsV, { x: "k", y: "p", fill: (x) => (x.k === 1 ? c.red : col("--m-vague")), fillOpacity: 0.9 }), P().ruleY([0], { stroke: c.borderStrong })],
    }, `Vague Gamma(1, 1) at J = 100: P(K = 1) = ${fmtProb(pmfV[1])}, E K = ${fmtCount(dp.mixMoments(100, 1, 1).mean)}, Pr(W_SB > .5) = ${fmtProb(dp.wsbTail(0.5, 1, 1))}.`);
    pVague.prepend(h("p", { class: "dpx-panel-title", text: "For comparison: the vague Gamma(1, 1) at J = 100" }));
    pVague.append(h("p", { class: "dpx-caption-note", text: `P(K = 1) = ${fmtProb(pmfV[1])} (red), E K = ${fmtCount(dp.mixMoments(100, 1, 1).mean)}, Pr(W_SB > .5) = ${fmtProb(dp.wsbTail(0.5, 1, 1))}.` }));
    pVague.append(srTable("Summary of the four rules", ["rule", "Gamma(a, b)", "P(K = 1)", "note"], [
      ["DORO-Unif", fmtGamma(d.a, d.b), fmtProb(pmfD[1]), `J = ${d.J}; leak ${fmtProb(leak)}`],
      ["SCAL exact", fmtGamma(sc.exact.a, sc.exact.b), fmtProb(pmfE[1]), `m = ${sc.m}`],
      ["SCAL shortcut", fmtGamma(sc.shortcut.a, sc.shortcut.b), fmtProb(pmfS[1]), `m = ${sc.m}`],
      ["SSI-Weight", fmtGamma(mc.ssi.a, mc.ssi.b), "", `E K_J ${fmtCount(eJ)} at J = ${J}`],
      ["Vague", "Gamma(1, 1)", fmtProb(pmfV[1]), "J = 100"],
    ]));
    ui.readout.textContent =
      `DORO-Unif at J = ${d.J}: P(K = 1) ${fmtProb(pmfD[1])}, leak ${fmtProb(leak)}. SCAL at m = ${sc.m}: exact P(K = 1) ${fmtProb(pmfE[1])}, shortcut ${fmtProb(pmfS[1])}. ` +
      `SSI-Weight: E K_J ${fmtCount(eJ)} at J = ${J} with the tails fixed at .25 and .05. Vague: P(K_100 = 1) ${fmtProb(pmfV[1])}, Pr(W_SB > .5) ${fmtProb(dp.wsbTail(0.5, 1, 1))}.`;
  };

  const doroSeg = segmented({ label: "DORO: J", options: mc.doro.map((x) => ({ value: x.J, label: `${x.J}` })), value: state.doroJ, onChange: (v) => { state.doroJ = v; render(); } });
  const scalSeg = segmented({ label: "SCAL: m", options: mc.scal.map((x) => ({ value: x.m, label: String(x.m) })), value: state.m, onChange: (v) => { state.m = v; render(); } });
  const ssiS = slider({ label: "SSI: J", min: 25, max: 5000, value: state.ssiJ, log: true, format: (v) => String(Math.round(v)), onInput: (v) => { state.ssiJ = v; render(); } });
  ui.controls.append(doroSeg.root, scalSeg.root, ssiS.root);
  const stop = observeWidth(ui.charts, (w) => { width = w; render(); });
  render();
  return {
    update(next = {}) {
      if ([48, 79, 100, 500].includes(Number(next.J))) { state.doroJ = Number(next.J); doroSeg.set(state.doroJ); }
      if ([6, 10, 25, 50, 75, 100].includes(Number(next.m))) { state.m = Number(next.m); scalSeg.set(state.m); }
      if (next.ssiJ !== undefined) { state.ssiJ = num(next, "ssiJ", state.ssiJ, 25, 5000); ssiS.set(state.ssiJ); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}
