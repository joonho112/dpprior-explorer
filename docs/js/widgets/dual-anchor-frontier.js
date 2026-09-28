// C-08 "The Dual-Anchor frontier: trading the count target for less dominance" (OSM Fig. G.4).
// Owner of this file: Step 8.9.
//
// J = 50, target (mu_K, sigma^2) = (5, 10). The Dual-Anchor objective weighs the count anchor by
// lambda and the weight anchor (Pr(W_SB > .5) toward .25) by 1 - lambda. Each of the 29 grid
// solutions (data/released/dual_anchor_grid.json, CC BY 4.0) is recomputed with dp-core: as lambda
// falls from 1 (TSMM, Gamma(1.4082, 1.0770), .497) Pr(W_SB > .5) falls and E K_50 rises. The paper
// takes the largest lambda whose solution is below the .40 trigger: lambda = .30, Gamma(2.3158,
// 1.4204), .398 and E K 5.88; larger lambdas are not eligible (grey). The hard bound .25 is a
// separate sensitivity analysis: Gamma(5.2745, 2.3059), E K 7.49 (data/precomputed/
// worked_example_j50.json). In the applications (data/released/app_priors.json) the hard bound for
// STAR and Vocabulary has a > 1e4 (CV(alpha) below .01): nearly a point mass at alpha = a / b. Its
// summaries use the same Gamma integrals as every other prior (CONTRACT.md section 6).
import * as dp from "../dp-core.js";
import grid from "../../data/released/dual_anchor_grid.js";
import we from "../../data/precomputed/worked_example_j50.js";
import apps from "../../data/released/app_priors.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const J = we.target.J;
const TRIGGER = we.policy.trigger;
const HARD = we.policy.hard_bound;
const CELL_MIN = 336;
const APP_ORDER = ["STAR", "Bangert-Drowns", "Vocabulary"];

const isPointMass = (a) => a > dp.POINT_MASS_A;
const gammaText = (a, b) => (isPointMass(a) ? `nearly a point mass at alpha = ${(a / b).toFixed(3)} (a = ${a.toExponential(2).replace("e+", "e")})` : fmtGamma(a, b, 4));

/** Summaries of a prior on alpha at J units; a > 1e4 is described as nearly a point mass at a / b. */
function summarize(a, b, J0) {
  return { pm: isPointMass(a), alpha: a / b, pmf: dp.mixPmf(J0, a, b), S5: dp.wsbTail(0.5, a, b), S9: dp.wsbTail(0.9, a, b), EK: dp.mixMoments(J0, a, b).mean, dens: (w) => dp.wsbDensity(w, a, b) };
}

export function mountWidget(el, spec = {}) {
  const rows = grid.map((r) => {
    const s = summarize(r.a, r.b, J);
    return { lambda: r.lambda, a: r.a, b: r.b, S5: s.S5, EK: s.EK, eligible: s.S5 <= TRIGGER, flagged: Boolean(r.selected) };
  });
  const chosen = rows.filter((r) => r.eligible).reduce((m, r) => (r.lambda > m.lambda ? r : m));
  const tsmm = rows.reduce((m, r) => (r.lambda > m.lambda ? r : m));
  const hardSt = we.stages.find((s) => s.key === "hard");
  const hard = { a: hardSt.a, b: hardSt.b, ...summarize(hardSt.a, hardSt.b, J) };
  const appRows = APP_ORDER.map((app) => {
    const pick = (prior) => apps.find((x) => x.app === app && x.prior === prior);
    return { app, J: pick("TSMM").J, da: pick("Dual-Anchor"), hard: pick("Dual-Anchor (hard)") };
  });

  const i0 = rows.indexOf(chosen);
  const lamSpec = Number(spec.preset);
  const state = { sel: { kind: "grid", i: Number.isFinite(lamSpec) ? Math.max(0, rows.findIndex((r) => Math.abs(r.lambda - lamSpec) < 1e-9)) : spec.preset === "hard" ? -1 : i0 } };
  if (spec.preset === "hard") state.sel = { kind: "hard" };
  if (state.sel.kind === "grid" && state.sel.i < 0) state.sel.i = i0;

  const ui = frame(el, { label: "Dual-Anchor frontier: Pr(W_SB > .5) and E K_50 along lambda, with the trigger and the hard bound", className: "dpx-frontier" });
  const tiles = h("div", { class: "dpx-tiles", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pS = h("div", { class: "dpx-panel" });
  const pK = h("div", { class: "dpx-panel" });
  const pPmf = h("div", { class: "dpx-panel" });
  const pW = h("div", { class: "dpx-panel" });
  const pApps = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, pS, pK, pPmf, pW, pApps);
  ui.caption.textContent =
    `J = ${J}, target mu_K = ${we.target.mu_K} and sigma^2 = ${we.target.var_K}. Each point is the Dual-Anchor solution at one lambda (the weight on the count anchor; lambda = 1 is TSMM), from the replication package (CC BY 4.0); Pr(W_SB > .5) and E K_50 are recomputed with dp-core. Eligible: Pr(W_SB > .5) at or below the ${fmt(TRIGGER, 2)} trigger. The hard bound ${fmt(HARD, 2)} is a sensitivity analysis, not the recommended prior.`;
  let width = 720;

  const current = () => {
    if (state.sel.kind === "hard") return { label: `hard bound ${fmt(HARD, 2)} (sensitivity analysis)`, a: hard.a, b: hard.b, J0: J, s: hard };
    if (state.sel.kind === "app") {
      const ar = appRows[state.sel.app];
      const p = state.sel.which === "hard" ? ar.hard : ar.da;
      return { label: `${ar.app} (J = ${ar.J}), ${state.sel.which === "hard" ? "hard bound" : "Dual-Anchor"}`, a: p.a, b: p.b, J0: ar.J, s: summarize(p.a, p.b, ar.J) };
    }
    const r = rows[state.sel.i];
    return { label: `lambda = ${fmt(r.lambda, 2)}${r === chosen ? " (the paper's choice)" : r === tsmm ? " (TSMM)" : ""}`, a: r.a, b: r.b, J0: J, s: summarize(r.a, r.b, J), row: r };
  };

  const tile = (title, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: title }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const cur = current();
    const s = cur.s;
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const w = Math.floor((width - 16 * (cols - 1)) / cols);
    const ok = s.S5 <= TRIGGER;
    tiles.replaceChildren(
      tile(cur.label, gammaText(cur.a, cur.b), cur.row ? `E(alpha) = ${(cur.a / cur.b).toFixed(3)}` : s.pm ? `a > 1e4: CV(alpha) = ${(1 / Math.sqrt(cur.a)).toExponential(1)}` : null),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "Pr(W_SB > .5) against the .40 trigger" }), h("p", { class: "dpx-tile-big", text: fmtProb(s.S5) }),
        h("p", {}, h("span", { class: `dpx-pill ${ok ? "dpx-pill-ok" : "dpx-pill-bad"}`, text: cur.row ? (ok ? `eligible: <= ${fmt(TRIGGER, 2)}` : `not eligible: > ${fmt(TRIGGER, 2)}`) : ok ? `below the trigger: <= ${fmt(TRIGGER, 2)}` : `above the trigger: > ${fmt(TRIGGER, 2)}` }))),
      tile(`E K_${cur.J0} (target ${we.target.mu_K})`, fmtCount(s.EK), `Pr(W_SB > .9) = ${fmtProb(s.S9)}`),
    );

    // frontier panels: the grid points coloured by eligibility, the current one ringed
    const selRow = state.sel.kind === "grid" ? rows[state.sel.i] : null;
    const lab = [
      { ...chosen, text: `lambda = ${fmt(chosen.lambda, 2)}: ${fmtProb(chosen.S5)}, E K ${fmt(chosen.EK, 2)}` },
      { ...tsmm, text: `TSMM: ${fmtProb(tsmm.S5)}` },
    ];
    const common = (y, extra, alt, title, yOpt) => {
      const panel = y === "S5" ? pS : pK;
      draw(panel, {
        width: w, height: 240, marginLeft: 44, marginRight: 16, marginBottom: 40, marginTop: 24,
        x: { domain: [0, 1.04], label: "lambda (weight on the count anchor)", labelOffset: 34, ticks: [0, 0.2, 0.3, 0.4, 0.6, 0.8, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)) },
        y: yOpt,
        marks: [
          ...extra,
          P.line(rows, { x: "lambda", y, stroke: c.muted, strokeWidth: 1 }),
          P.dot(rows, { x: "lambda", y, r: 4, fill: (d) => (d.eligible ? c.methods.da : c.faint), stroke: (d) => (d.eligible ? c.methods.da : c.muted) }),
          P.dot([tsmm], { x: "lambda", y, r: 5.5, fill: c.methods.tsmm, symbol: "square" }),
          P.dot([chosen], { x: "lambda", y, r: 8, stroke: c.fg, strokeWidth: 2, fill: "none" }),
          ...(selRow ? [P.dot([selRow], { x: "lambda", y, r: 11, stroke: c.red, strokeWidth: 2.5, fill: "none" })] : []),
        ],
      }, alt);
      panel.prepend(h("p", { class: "dpx-panel-title", text: title }));
    };
    common("S5", [
      P.ruleY([TRIGGER], { stroke: c.red, strokeDasharray: "5,3" }),
      P.ruleY([HARD], { stroke: c.methods.hard, strokeDasharray: "2,3", strokeWidth: 1.5 }),
      P.text([{ x: 1.02, y: TRIGGER, t: `trigger ${fmt(TRIGGER, 2)}: eligible below` }, { x: 1.02, y: HARD, t: `hard bound ${fmt(HARD, 2)}` }], { x: "x", y: "y", text: "t", dy: -7, textAnchor: "end", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11 }),
      P.text(lab, { x: "lambda", y: "S5", text: "text", dx: 12, dy: 18, textAnchor: "start", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11, fontWeight: 600, filter: (d) => d.lambda < 1 }),
      P.text([tsmm], { x: "lambda", y: "S5", text: () => `TSMM ${fmtProb(tsmm.S5)}`, dy: -12, textAnchor: "end", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11, fontWeight: 600 }),
    ], `Pr(W_SB > .5) along lambda: from ${fmtProb(rows[0].S5)} at lambda = ${fmt(rows[0].lambda, 2)} to ${fmtProb(tsmm.S5)} at lambda = 1 (TSMM); the largest lambda at or below the ${fmt(TRIGGER, 2)} trigger is ${fmt(chosen.lambda, 2)} (${fmtProb(chosen.S5)}); ${rows.filter((r) => !r.eligible).length} larger lambdas are not eligible (grey).`,
    "Pr(W_SB > .5) along lambda: eligible at or below the trigger", { domain: [0.22, 0.52], label: "Pr(W_SB > .5)", grid: true, tickFormat: (d) => fmt(d, 2) });
    common("EK", [
      P.ruleY([we.target.mu_K], { stroke: c.fg, strokeDasharray: "5,3" }),
      P.ruleY([hard.EK], { stroke: c.methods.hard, strokeDasharray: "2,3", strokeWidth: 1.5 }),
      // textAnchor is a constant option in Plot, so the two labels are two marks
      P.text([{ x: 0.02, y: we.target.mu_K, t: `target ${we.target.mu_K}` }], { x: "x", y: "y", text: "t", dy: -7, textAnchor: "start", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11 }),
      P.text([{ x: 1.02, y: hard.EK, t: `hard bound: E K ${fmt(hard.EK, 2)}` }], { x: "x", y: "y", text: "t", dy: -7, textAnchor: "end", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11 }),
    ], `E K_50 along lambda: ${fmt(rows[0].EK, 2)} at lambda = ${fmt(rows[0].lambda, 2)}, ${fmt(chosen.EK, 2)} at lambda = ${fmt(chosen.lambda, 2)}, ${fmt(tsmm.EK, 2)} at lambda = 1 (the target); the hard bound gives ${fmt(hard.EK, 2)}.`,
    "E K_50 along lambda: the price of less dominance", { domain: [4.8, Math.max(7.7, hard.EK + 0.2)], label: "E K_50", grid: true });

    // detail strip for the current prior
    const kmax = Math.min(cur.J0, 16);
    const bars = Array.from({ length: kmax }, (_, i) => ({ k: i + 1, p: s.pmf[i + 1] }));
    draw(pPmf, {
      width: w, height: 190, marginLeft: 44, marginBottom: 36,
      x: { domain: [0.5, kmax + 0.5], label: `k (clusters among J = ${cur.J0})`, labelOffset: 30 },
      y: { label: "probability", grid: true },
      marks: [P.rectY(bars, { x1: (d) => d.k - 0.4, x2: (d) => d.k + 0.4, y: "p", fill: state.sel.kind === "hard" || state.sel.which === "hard" ? c.methods.hard : c.methods.da, fillOpacity: 0.85 }), P.ruleX([s.EK], { stroke: c.fg, strokeDasharray: "4,3" }), P.ruleY([0], { stroke: c.borderStrong })],
    }, `pmf of K_${cur.J0} under ${gammaText(cur.a, cur.b)}: mean ${fmtCount(s.EK)} (dashed).`);
    pPmf.prepend(h("p", { class: "dpx-panel-title", text: `The count: K_${cur.J0}, mean ${fmtCount(s.EK)}` }));
    const wd = [];
    for (let i = 0; i <= 200; i += 1) { const x = Math.min(dp.W_DENSITY_MAX, i / 200); wd.push({ w: x, d: s.dens(x) }); }
    const top = Math.min(4, Math.max(2, ...wd.filter((x) => x.w <= 0.95).map((x) => x.d)) * 1.15);
    const clip = wd.map((x) => ({ ...x, d: Math.min(x.d, top) }));
    draw(pW, {
      width: w, height: 190, marginLeft: 42, marginBottom: 36,
      x: { domain: [0, 1], label: "W_SB", labelOffset: 30, ticks: [0, 0.5, 0.9, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)) },
      y: { domain: [0, top], label: "density", grid: true },
      marks: [
        P.areaY(clip.filter((x) => x.w >= 0.5), { x: "w", y: "d", fill: c.red, fillOpacity: 0.22 }),
        P.lineY(clip, { x: "w", y: "d", stroke: c.fg, strokeWidth: 1.6 }),
        P.ruleX([0.5], { stroke: c.red, strokeDasharray: "3,3" }),
      ],
    }, `Density of W_SB under ${gammaText(cur.a, cur.b)}: Pr(W_SB > .5) = ${fmtProb(s.S5)} (shaded).`);
    pW.prepend(h("p", { class: "dpx-panel-title", text: `The weights: Pr(W_SB > .5) = ${fmtProb(s.S5)}` }));

    // the applications: Dual-Anchor and hard solutions; the hard ones for STAR and Vocabulary are nearly point masses
    const tbl = h("table", { class: "dpx-parity" },
      h("thead", {}, h("tr", {}, ...["application", "J", "Dual-Anchor (lambda)", "Pr(W_SB > .5)", "hard bound", "Pr(W_SB > .5)"].map((t) => h("th", { scope: "col", text: t })))),
      h("tbody", {}, ...appRows.map((ar, k) => {
        const sd = summarize(ar.da.a, ar.da.b, ar.J);
        const sh = summarize(ar.hard.a, ar.hard.b, ar.J);
        const btn = (which, text) => h("button", { type: "button", class: "dpx-row-btn", "aria-pressed": String(state.sel.kind === "app" && state.sel.app === k && state.sel.which === which), onclick: () => { state.sel = { kind: "app", app: k, which }; sPre.set(null); render(); } }, text);
        return h("tr", {},
          h("th", { scope: "row", text: ar.app }), h("td", { text: String(ar.J) }),
          h("td", {}, btn("da", `${fmtGamma(ar.da.a, ar.da.b, 3)}${ar.da.lambda === null ? "" : ` (${fmt(ar.da.lambda, 2)})`}`)), h("td", { text: fmtProb(sd.S5) }),
          h("td", {}, btn("hard", sh.pm ? `near point mass, alpha = ${sh.alpha.toFixed(2)}` : fmtGamma(ar.hard.a, ar.hard.b, 3))), h("td", { text: fmtProb(sh.S5) }));
      })));
    pApps.replaceChildren(h("p", { class: "dpx-panel-title", text: "The same two anchors in the applications (select a prior to draw it above)" }),
      h("div", { class: "dpx-table-scroll", tabindex: 0, role: "region", "aria-label": "Applications table (scrolls sideways on narrow screens)" }, tbl),
      h("p", { class: "dpx-row-note", text: `A hard bound with a > 1e4 is nearly a point mass (CV(alpha) below .01): STAR and Vocabulary put almost all prior mass at alpha = ${(appRows[0].hard.a / appRows[0].hard.b).toFixed(2)}, where Pr(W_SB > .5) = ${fmtProb(summarize(appRows[0].hard.a, appRows[0].hard.b, appRows[0].J).S5)}.` }),
      srTable("Dual-Anchor frontier at J = 50", ["lambda", "a", "b", "Pr(W_SB > .5)", "E K_50", "eligible"], rows.map((r) => [r.lambda, r.a.toFixed(4), r.b.toFixed(4), fmtProb(r.S5), fmt(r.EK, 2), r.eligible ? "yes" : "no"])));

    ui.readout.textContent = `${cur.label}: ${gammaText(cur.a, cur.b)}; Pr(W_SB > .5) = ${fmtProb(s.S5)} (${ok ? (cur.row ? "eligible" : "below the trigger") : "above the trigger"}), E K_${cur.J0} = ${fmtCount(s.EK)}. The paper's choice at J = 50 is lambda = ${fmt(chosen.lambda, 2)}: ${fmtGamma(chosen.a, chosen.b, 4)}, ${fmtProb(chosen.S5)}, E K ${fmt(chosen.EK, 2)}.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.s5 = String(s.S5);
    ui.root.dataset.ek = String(s.EK);
  };

  const sLam = slider({ label: "lambda (grid point)", min: 0, max: rows.length - 1, step: 1, value: state.sel.kind === "grid" ? state.sel.i : i0, format: (i) => fmt(rows[Math.round(i)].lambda, 2),
    onInput: (i) => { state.sel = { kind: "grid", i: Math.round(i) }; sPre.set(rows[state.sel.i] === chosen ? "chosen" : rows[state.sel.i] === tsmm ? "tsmm" : null); render(); } });
  const PRE = { tsmm: "TSMM (lambda = 1)", chosen: `the paper's choice (lambda = ${fmt(chosen.lambda, 2)})`, hard: `hard bound ${fmt(HARD, 2)}` };
  const sPre = segmented({ label: "Show", options: Object.entries(PRE).map(([value, label]) => ({ value, label })), value: state.sel.kind === "hard" ? "hard" : rows[state.sel.i] === chosen ? "chosen" : rows[state.sel.i] === tsmm ? "tsmm" : null,
    onChange: (k) => {
      if (k === "hard") state.sel = { kind: "hard" };
      else { state.sel = { kind: "grid", i: rows.indexOf(k === "tsmm" ? tsmm : chosen) }; sLam.set(state.sel.i); }
      render();
    } });
  ui.controls.append(sPre.root, sLam.root);

  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.preset === "hard") { state.sel = { kind: "hard" }; sPre.set("hard"); }
      else if (next.preset !== undefined) {
        const i = rows.findIndex((r) => Math.abs(r.lambda - num(next, "preset", chosen.lambda, 0, 1)) < 1e-9);
        if (i >= 0) { state.sel = { kind: "grid", i }; sLam.set(i); sPre.set(rows[i] === chosen ? "chosen" : rows[i] === tsmm ? "tsmm" : null); }
      }
      render();
    },
    get frontier() { return { chosen: { ...chosen }, tsmm: { ...tsmm }, hard: { a: hard.a, b: hard.b, S5: hard.S5, EK: hard.EK }, ineligible: rows.filter((r) => !r.eligible).map((r) => r.lambda), flaggedMatches: rows.find((r) => r.flagged) === chosen }; },
    destroy() { stop(); el.replaceChildren(); },
  };
}
