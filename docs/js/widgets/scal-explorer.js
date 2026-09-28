// M-10 "SCAL explorer: two count tails clamped, the weights left free, and the shortcut's
// collapse" (after Murugiah and Sweeting, 2012). Owner of this file: Step 7.6.
//
// SCAL fixes P(K_m = 1) = .34 and P(K_m >= ceil(2 ln m)) = .15 at every m and solves the two
// equations for Gamma(a, b) (dp-core scalSolve, live). The two shaded tails stay put while the
// middle barely moves, but Pr(W_SB > .5) is not targeted and drifts above the vague default's
// .591. The published shortcut a = b = exp(-0.033 m) tracks the solution only up to m of about
// 25 and then collapses to one cluster (P(K_100 = 1) = .834). Tabulated (a, b) come from
// method_catalog.json (r-export/02_methods_catalog.R); the paths along m are solved after the
// first paint.
import * as dp from "../dp-core.js";
import mc from "../../data/precomputed/method_catalog.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, slider, toggle } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const M_MIN = 6;
// the m where ceil(2 ln m), SCAL's second tail point, steps up (computed, not typed)
const CEIL_STEPS = [];
const M_MAX = 100;
for (let m = M_MIN + 1; m <= M_MAX; m += 1) if (Math.ceil(2 * Math.log(m)) > Math.ceil(2 * Math.log(m - 1))) CEIL_STEPS.push(m);
const PATH_STEP = 1; // the paths along m are solved at every m (the solution jumps where ceil(2 ln m) steps)
const CELL_MIN = 336; // grid cell minimum (20rem) plus the 1rem gap, as in .dpx-charts
const KMAX_SHOWN = 16;

let pathCache = null; // [{m, a, b, p1, s50, sa, p1s, s50s}] shared by every mount

export function mountWidget(el, spec = {}) {
  const state = {
    m: Math.round(num(spec, "n", num(spec, "J", 100, M_MIN, M_MAX), M_MIN, M_MAX)),
    shortcut: spec.preset === "shortcut",
  };
  let fit = null;
  let lastStart;
  const ui = frame(el, { label: "SCAL explorer: two clamped count tails, uncontrolled weights and the shortcut's collapse", className: "dpx-scal" });
  const pMain = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pP1 = h("div", { class: "dpx-panel" });
  const pS = h("div", { class: "dpx-panel" });
  const pAB = h("div", { class: "dpx-panel" });
  ui.charts.append(pMain, pP1, pS, pAB);
  ui.caption.textContent =
    "After Murugiah and Sweeting (2012). Bars: the count distribution of the Gamma(a, b) that solves P(K_m = 1) = .34 (red) and P(K_m >= ceil(2 ln m)) = .15 (gold) exactly, recomputed live; circles: the shortcut a = b = exp(-0.033 m). K_m is the number of fitted components among the m units. The weights are not part of the rule.";
  let width = 720;
  const vagueS50 = dp.wsbTail(0.5, 1, 1);

  const solve = () => {
    const t0 = performance.now();
    fit = dp.scalSolve(state.m, undefined, lastStart);
    if (fit.converged) lastStart = [fit.a, fit.b];
    fit.ms = performance.now() - t0;
  };

  let destroyed = false;
  const fillPath = () => {
    if (pathCache) return;
    const ms = [];
    for (let m = M_MIN; m <= M_MAX; m += PATH_STEP) ms.push(m);
    const rows = [];
    let prev;
    const chunk = () => {
      for (let k = 0; k < 12 && ms.length; k += 1) {
        const m = ms.shift();
        const r = dp.scalSolve(m, undefined, prev);
        prev = [r.a, r.b];
        const sa = Math.exp(-dp.SCAL_SHORTCUT_RATE * m);
        rows.push({ m, a: r.a, b: r.b, p1: r.pOne, s50: dp.wsbTail(0.5, r.a, r.b), sa, p1s: dp.mixPK1(m, sa, sa), s50s: dp.wsbTail(0.5, sa, sa) });
      }
      if (ms.length) setTimeout(chunk, 0);
      else { pathCache = rows; if (!destroyed) renderSide(); }
    };
    setTimeout(chunk, 0);
  };

  const tabulated = () => mc.scal.find((x) => x.m === state.m)?.published ?? null;

  const renderMain = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { m } = state;
    const q = fit.q;
    const pmf = dp.mixPmf(m, fit.a, fit.b);
    const sa = Math.exp(-dp.SCAL_SHORTCUT_RATE * m);
    const pmfS = dp.mixPmf(m, sa, sa);
    const kmax = Math.min(m, Math.max(KMAX_SHOWN, q + 4));
    const bars = Array.from({ length: kmax }, (_, i) => ({ k: i + 1, p: pmf[i + 1], zone: i === 0 ? "one" : i + 1 >= q ? "tail" : "mid" }));
    const dots = Array.from({ length: kmax }, (_, i) => ({ k: i + 1, p: pmfS[i + 1] }));
    const yTop = Math.min(1, Math.max(...bars.map((d) => d.p), ...(state.shortcut ? dots.map((d) => d.p) : [0])) * 1.15);
    let tail = 1;
    for (let k = 1; k < q; k += 1) tail -= pmf[k];
    const fill = (d) => (d.zone === "one" ? c.red : d.zone === "tail" ? c.gold : c.slate);
    draw(pMain, {
      width, height: 260, marginLeft: 48, marginBottom: 44,
      x: { domain: [0.5, kmax + 0.5], label: `k (clusters among m = ${m})`, labelOffset: 38, ticks: Math.min(kmax, 16), tickFormat: (d) => (Number.isInteger(d) ? String(d) : "") },
      y: { domain: [0, yTop], label: "probability", grid: true },
      marks: [
        P.rectY(bars, { x1: (d) => d.k - 0.42, x2: (d) => d.k + 0.42, y: "p", fill, fillOpacity: 0.88 }),
        P.ruleX([q - 0.5], { stroke: c.muted, strokeDasharray: "3,3" }),
        P.text([{ k: 1, p: pmf[1] }], { x: "k", y: "p", text: () => `P(K = 1) = ${fmtProb(pmf[1])}`, dy: -9, textAnchor: "start", dx: -8, fill: c.fg, fontSize: 11, fontWeight: 600 }),
        P.text([{ k: q - 0.4, p: yTop * 0.55 }], { x: "k", y: "p", text: () => `P(K ≥ ${q}) = ${fmtProb(tail)} →`, textAnchor: "start", fill: c.fg, fontSize: 11, fontWeight: 600 }),
        ...(state.shortcut ? [P.dot(dots, { x: "k", y: "p", r: 4, stroke: c.fg, fill: c.raised, strokeWidth: 1.5 })] : []),
        P.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `SCAL at m = ${m}: ${fmtGamma(fit.a, fit.b)} keeps P(K = 1) = ${fmtProb(pmf[1])} and P(K >= ${q}) = ${fmtProb(tail)}${state.shortcut ? `; the shortcut a = b = ${fmt(sa, 4)} (circles) gives P(K = 1) = ${fmtProb(pmfS[1])}` : ""}.`);
    pMain.prepend(h("p", { class: "dpx-panel-title", text: `SCAL, m = ${m}: two tails clamped (red K = 1, gold K ≥ ${q})${state.shortcut ? "; circles: the shortcut" : ""}` }));
    pMain.append(srTable(`Count pmf at m = ${m}`, ["k", "solved", "shortcut"], bars.map((d) => [d.k, fmt(d.p, 4), fmt(pmfS[d.k], 4)])));
    return { pmf, pmfS, tail, sa };
  };

  const renderSide = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const cols = Math.min(3, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const third = Math.floor((width - 16 * (cols - 1)) / cols);
    const path = pathCache ?? [];
    const tab = mc.scal.map((x) => ({ m: x.m, p1: dp.mixPK1(x.m, x.published.a, x.published.b), s50: dp.wsbTail(0.5, x.published.a, x.published.b), a: x.published.a, b: x.published.b }));
    const cur = { m: state.m, p1: fit.pOne, s50: dp.wsbTail(0.5, fit.a, fit.b), a: fit.a, b: fit.b };
    const base = { width: third, height: 190, marginLeft: 44, x: { domain: [0, M_MAX], label: "m" } };
    draw(pP1, {
      ...base,
      y: { domain: [0, 1], label: "P(K_m = 1)", grid: true },
      marks: [
        P.line(path, { x: "m", y: "p1", stroke: c.red, strokeWidth: 2 }),
        P.line(path, { x: "m", y: "p1s", stroke: c.fg, strokeDasharray: "5,3" }),
        P.dot(tab, { x: "m", y: "p1", r: 3.5, stroke: c.red, fill: c.raised }),
        P.dot([cur], { x: "m", y: "p1", r: 6, fill: c.accent, stroke: c.fg }),
        P.text(path.slice(-1), { x: "m", y: "p1s", text: () => "shortcut", dy: -9, textAnchor: "end", fill: c.fg, fontSize: 11 }),
      ],
    }, `P(K_m = 1) along m: .34 for the solved rule at every m; the shortcut (dashed) ${path.length ? `rises to ${fmtProb(path[path.length - 1].p1s)} at m = ${M_MAX}` : "is being computed"}; open circles are the tabulated (a, b).`);
    pP1.prepend(h("p", { class: "dpx-panel-title", text: "P(K_m = 1): clamped at .34; the shortcut collapses" }));
    draw(pS, {
      ...base,
      y: { domain: [0.5, 1], label: "Pr(W_SB > .5)", grid: true },
      marks: [
        P.ruleY([vagueS50], { stroke: c.methods.vague, strokeWidth: 2, strokeDasharray: "6,3" }),
        P.line(path, { x: "m", y: "s50", stroke: c.brod[3], strokeWidth: 2 }),
        P.line(path, { x: "m", y: "s50s", stroke: c.fg, strokeDasharray: "5,3" }),
        P.dot(tab, { x: "m", y: "s50", r: 3.5, stroke: c.brod[3], fill: c.raised }),
        P.dot([cur], { x: "m", y: "s50", r: 6, fill: c.accent, stroke: c.fg }),
        P.text([{ m: 4, s50: vagueS50 }], { x: "m", y: "s50", text: () => `Gamma(1, 1): ${fmtProb(vagueS50)}`, dy: 11, textAnchor: "start", fill: c.fg, fontSize: 11 }),
      ],
    }, `Pr(W_SB > .5) is not part of the rule: ${path.length ? `${fmtProb(path[0].s50)} at m = ${path[0].m} and ${fmtProb(path[path.length - 1].s50)} at m = ${M_MAX}` : "computing"}, above the vague Gamma(1, 1)'s ${fmtProb(vagueS50)}.`);
    pS.prepend(h("p", { class: "dpx-panel-title", text: "The weights are not targeted: Pr(W_SB > .5) drifts" }));
    const abRows = path.flatMap((d) => [{ m: d.m, v: d.a, s: "a (solved)" }, { m: d.m, v: d.b, s: "b (solved)" }, { m: d.m, v: d.sa, s: "a = b (shortcut)" }]);
    const at25 = path.reduce((best, d) => (Math.abs(d.m - 25) < Math.abs(best.m - 25) ? d : best), path[0] ?? { m: 25, a: NaN, b: NaN });
    const last = path[path.length - 1] ?? { m: M_MAX, a: NaN, b: NaN };
    const colAB = { "a (solved)": c.blue, "b (solved)": c.teal, "a = b (shortcut)": c.fg };
    draw(pAB, {
      ...base,
      y: { type: "log", domain: [0.02, 2], label: "a, b (log scale)", grid: true, ticks: [0.02, 0.04, 0.1, 0.2, 0.4, 1, 2], tickFormat: (d) => String(d) },
      marks: [
        ...Object.keys(colAB).map((s) => P.line(abRows.filter((d) => d.s === s), { x: "m", y: "v", stroke: colAB[s], strokeWidth: s.includes("shortcut") ? 1.5 : 2, strokeDasharray: s.includes("shortcut") ? "5,3" : null })),
        P.dot([cur], { x: "m", y: "a", r: 5, fill: c.blue, stroke: c.fg }),
        P.dot([cur], { x: "m", y: "b", r: 5, fill: c.teal, stroke: c.fg }),
        P.text(path.slice(-1), { x: "m", y: "sa", text: () => "shortcut", dy: -9, textAnchor: "end", fill: c.fg, fontSize: 11 }),
        P.text(path.slice(-1), { x: "m", y: "a", text: () => "a", dx: 6, textAnchor: "start", fill: c.blue, fontSize: 11 }),
        P.text(path.slice(-1), { x: "m", y: "b", text: () => "b", dx: 6, dy: 8, textAnchor: "start", fill: c.teal, fontSize: 11 }),
      ],
    }, `The solved (a, b) jump wherever ceil(2 ln m) steps up (m = ${CEIL_STEPS.join(", ")}) and change little from m = 25 on (${path.length ? `${fmtGamma(at25.a, at25.b)} at m = ${at25.m}, ${fmtGamma(last.a, last.b)} at m = ${last.m}` : "computing"}; ${fmtGamma(fit.a, fit.b)} at m = ${state.m}); the shortcut a = b = exp(-${dp.SCAL_SHORTCUT_RATE} m) falls to ${path.length ? fmt(path[path.length - 1].sa, 4) : "–"} at m = ${M_MAX}.`);
    pAB.prepend(h("p", { class: "dpx-panel-title", text: "The (a, b) path (it jumps where ceil(2 ln m) steps) and the shortcut" }));
  };

  const render = () => {
    const t0 = performance.now();
    const m = renderMain();
    renderSide();
    const tab = tabulated();
    const S50 = dp.wsbTail(0.5, fit.a, fit.b);
    const ek = dp.mixMoments(state.m, fit.a, fit.b).mean;
    let text = `m = ${state.m}: ${fmtGamma(fit.a, fit.b)} clamps P(K = 1) = ${fmtProb(fit.pOne)} and P(K ≥ ${fit.q}) = ${fmtProb(fit.pTail)}; E K_${state.m} = ${fmtCount(ek)} and Pr(W_SB > .5) = ${fmtProb(S50)}, ${S50 > vagueS50 ? "above" : "below"} the vague Gamma(1, 1)'s ${fmtProb(vagueS50)}.`;
    if (tab) {
      const pmfT = dp.mixPmf(state.m, tab.a, tab.b);
      let tailT = 1;
      for (let k = 1; k < fit.q; k += 1) tailT -= pmfT[k];
      text += ` Tabulated ${fmtGamma(tab.a, tab.b, 3)}: E K = ${fmtCount(dp.mixMoments(state.m, tab.a, tab.b).mean)}, Pr(W_SB > .5) = ${fmtProb(dp.wsbTail(0.5, tab.a, tab.b))}, tails ${fmtProb(pmfT[1])} and ${fmtProb(tailT)}.`;
    }
    if (state.shortcut) text += ` Shortcut a = b = ${fmt(m.sa, 4)}: P(K = 1) = ${fmtProb(m.pmfS[1])}, E K = ${fmtCount(dp.mixMoments(state.m, m.sa, m.sa).mean)}.`;
    ui.readout.textContent = text;
    ui.root.dataset.renderMs = (performance.now() - t0 + fit.ms).toFixed(1);
    ui.root.dataset.pOne = String(fit.pOne);
    ui.root.dataset.pTail = String(fit.pTail);
  };

  const sM = slider({ label: "m (units)", min: M_MIN, max: M_MAX, step: 1, value: state.m, format: (v) => String(Math.round(v)),
    onInput: (v) => { const m = Math.round(v); if (m === state.m) return; state.m = m; solve(); render(); } });
  const tS = toggle({ label: "show the shortcut a = b = exp(-0.033 m)", checked: state.shortcut, onChange: (v) => { state.shortcut = v; render(); } });
  ui.controls.append(sM.root, tS.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  solve();
  render();
  ready = true;
  fillPath();
  return {
    update(next = {}) {
      const m = next.n ?? next.J;
      if (m !== undefined) { state.m = Math.round(num({ m }, "m", state.m, M_MIN, M_MAX)); sM.set(state.m); }
      if (next.preset === "shortcut") { state.shortcut = true; tS.set(true); }
      if (next.preset === "solved") { state.shortcut = false; tS.set(false); }
      solve();
      render();
    },
    get fit() { return { ...fit }; },
    destroy() { destroyed = true; stop(); el.replaceChildren(); },
  };
}
