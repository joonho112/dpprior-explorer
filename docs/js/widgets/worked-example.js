// C-15 "J = 50 worked example" (paper Sec. 3.5): state -> calibrate -> diagnose -> decide.
//
// Target: J = 50, mu_K = 5, sigma_K^2 = 10 (medium confidence). Stage 1 (shifted NB proxy)
// starts at Gamma(2.667, 2.608), whose moments 4.415 / 5.618 miss the target, so Stage 2
// (Newton on log a, log b) reaches TSMM Gamma(1.4082, 1.0770): E K = 5.00, Var 10.00, but
// Pr(W_SB > .5) = .497 is above the .40 trigger. Dual-Anchor (lambda = .30) trades a little
// count fit for weight control: Gamma(2.3158, 1.4204), .398. A hard bound .25 is a separate
// sensitivity analysis: Gamma(5.2745, 2.3059), E K 7.49. Exact (a, b) come from the
// replication package; every displayed number is recomputed here with dp-core.
import * as dp from "../dp-core.js";
import we from "../../data/precomputed/worked_example_j50.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented, toggle } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const TOKENS = { tsmm: "--m-tsmm", da: "--m-da", hard: "--m-hard", init: "--m-neutral" };

function summarize(a, b, J) {
  const grid = dp.alphaGrid(a, b);
  const pmf = dp.mixPmf(J, a, b, grid);
  const s = dp.pmfSummary(pmf);
  return { a, b, pmf, s, mom: dp.mixMoments(J, a, b, grid), s5: dp.wsbTail(0.5, a, b), s9: dp.wsbTail(0.9, a, b), rho: dp.meanRho(a, b) };
}

export function mountWidget(el, spec = {}) {
  const J = we.target.J;
  const stages = we.stages.map((st) => ({ ...st, ...summarize(st.a, st.b, J) }));
  const init = { key: "init", label: "Stage 1 initializer", ...we.initializer, ...summarize(we.initializer.a, we.initializer.b, J) };
  const state = { focus: ["tsmm", "da", "hard"].includes(spec.preset) ? spec.preset : "tsmm", showInit: spec.preset === "init" || Boolean(spec.init ?? false) };
  const ui = frame(el, { label: "Worked example, J = 50: count calibration, weight diagnosis and the Dual-Anchor decision", className: "dpx-worked" });
  const pAlpha = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pK = stages.map(() => h("div", { class: "dpx-panel" }));
  const pTail = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const kRow = h("div", { class: "dpx-triple", style: "grid-column: 1 / -1" }, ...pK);
  ui.charts.append(pAlpha, kRow, pTail);
  const initNote = h("p", { class: "dpx-readout", style: "border-left-color: var(--m-neutral)" });
  ui.root.insertBefore(initNote, ui.readout);
  ui.caption.textContent =
    `Target: J = ${J}, mu_K = ${we.target.mu_K}, sigma_K^2 = ${we.target.var_K} (${we.target.confidence}). Policy: refine when Pr(W_SB > .5) > ${fmt(we.policy.trigger, 2)} (trigger); the hard bound ${fmt(we.policy.hard_bound, 2)} is a sensitivity analysis, not the recommended prior. K_J is the number of fitted components among the J units. Gamma parameters from the replication package (CC BY 4.0); all displayed values recomputed with dp-core.`;

  let width = 720;
  const render = () => {
    const c = palette(ui.root);
    const col = (key) => getComputedStyle(ui.root).getPropertyValue(TOKENS[key]).trim();
    const half3 = width >= 680 ? Math.floor((width - 32) / 3) : width;
    // A. alpha prior densities
    const dens = [];
    const shown = state.showInit ? [init, ...stages] : stages;
    for (const st of shown) {
      for (let i = 1; i <= 240; i += 1) {
        const al = (i / 240) * 6;
        dens.push({ key: st.key, al, d: Math.exp(dp.dgammaLog(al, st.a, st.b)) });
      }
    }
    const altA = `Densities of alpha: ${shown.map((st) => `${st.label} ${fmtGamma(st.a, st.b, 4)}, mean ${fmt(st.a / st.b, 2)}`).join("; ")}.`;
    draw(pAlpha, {
      width, height: 200, marginLeft: 44, marginRight: 20,
      x: { domain: [0, 6], label: "alpha (concentration)" },
      y: { label: "prior density of alpha", grid: true },
      marks: [
        ...shown.map((st) => globalThis.Plot.lineY(dens.filter((d) => d.key === st.key), {
          x: "al", y: "d", stroke: col(st.key), strokeWidth: st.key === state.focus ? 2.8 : 1.6,
          strokeDasharray: st.key === "init" ? "5,4" : st.key === "hard" ? "2,3" : undefined,
        })),
      ],
    }, altA);
    pAlpha.prepend(h("p", { class: "dpx-panel-title", text: "1. Calibrate: the Gamma(a, b) prior on alpha at each stage" }));
    // legend as HTML (reliable wrapping)
    pAlpha.append(h("p", { class: "dpx-legend" }, ...shown.map((st) =>
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${col(st.key)}` }),
        `${st.label} ${fmtGamma(st.a, st.b, 4).replace("Gamma", "")}`))));

    // B. K_50 pmf per stage
    stages.forEach((st, i) => {
      const kmax = 20;
      const bars = [];
      for (let k = 1; k <= kmax; k += 1) bars.push({ k, p: st.pmf[k], inside: k >= st.s.q05 && k <= st.s.q95 });
      const initBars = state.showInit && st.key === "tsmm" ? Array.from({ length: kmax }, (_, j) => ({ k: j + 1, p: init.pmf[j + 1] })) : [];
      const alt = `${st.label}: prior pmf of K_${J}; mean ${fmtCount(st.mom.mean)}, variance ${fmtCount(st.mom.var)}, median ${st.s.median}, 90% interval [${st.s.q05}, ${st.s.q95}].`;
      draw(pK[i], {
        width: half3, height: 190, marginLeft: 38, marginBottom: 32,
        x: { type: "band", label: "k", tickFormat: (d) => (d === 1 || d % 5 === 0 ? d : "") },
        y: { domain: [0, 0.2], label: "P(K = k)", grid: true },
        marks: [
          globalThis.Plot.barY(bars, { x: "k", y: "p", fill: col(st.key), fillOpacity: (d) => (d.inside ? 0.9 : 0.35) }),
          ...(initBars.length ? [globalThis.Plot.dot(initBars, { x: "k", y: "p", r: 2.6, stroke: c.fg, fill: c.raised })] : []),
          globalThis.Plot.ruleY([0], { stroke: c.borderStrong }),
        ],
      }, alt);
      const head = st.key === "tsmm" ? "2. TSMM" : st.key === "da" ? `4. Dual-Anchor, lambda = ${fmt(st.lambda, 2)}` : "Hard bound (sensitivity)";
      pK[i].prepend(h("p", { class: "dpx-panel-title", style: st.key === state.focus ? `color:${col(st.key)}` : "" },
        `${head}: E K = ${fmtCount(st.mom.mean)}, 90% [${st.s.q05}, ${st.s.q95}]`));
    });

    // C. Diagnose: Pr(W_SB > .5) against the trigger and the hard bound
    const rows = stages.map((st) => ({ key: st.key, label: st.key === "tsmm" ? "TSMM" : st.key === "da" ? "Dual-Anchor" : "hard", s5: st.s5, s9: st.s9 }));
    if (state.showInit) rows.unshift({ key: "init", label: "initializer", s5: init.s5, s9: init.s9 });
    const altC = `Pr(W_SB > .5) at each stage: ${rows.map((r) => `${r.label} ${fmtProb(r.s5)}`).join(", ")}; trigger ${fmt(we.policy.trigger, 2)}, hard bound ${fmt(we.policy.hard_bound, 2)}.`;
    draw(pTail, {
      width, height: 60 + rows.length * 34, marginLeft: 96, marginRight: 60,
      x: { domain: [0, 1], label: "Pr(W_SB > .5): chance that a random unit sits in a majority cluster", tickFormat: (d) => fmtProb(d), grid: true },
      y: { domain: rows.map((r) => r.label), label: null },
      marks: [
        globalThis.Plot.barX(rows, { y: "label", x: "s5", fill: (d) => col(d.key), fillOpacity: (d) => (d.key === state.focus ? 0.95 : 0.6) }),
        globalThis.Plot.text(rows, { y: "label", x: "s5", text: (d) => `${fmtProb(d.s5)}  (> .9: ${fmtProb(d.s9)})`, dx: 6, textAnchor: "start", fill: c.fg, fontSize: 11 }),
        globalThis.Plot.ruleX([we.policy.trigger], { stroke: c.red, strokeWidth: 1.6, strokeDasharray: "5,3" }),
        globalThis.Plot.ruleX([we.policy.hard_bound], { stroke: c.fg, strokeWidth: 1.2, strokeDasharray: "2,3" }),
        globalThis.Plot.text([{ x: we.policy.trigger, t: `trigger ${fmt(we.policy.trigger, 2)}` }, { x: we.policy.hard_bound, t: `hard ${fmt(we.policy.hard_bound, 2)}` }],
          { x: "x", text: "t", frameAnchor: "top", dy: -2, lineAnchor: "bottom", fill: c.muted, fontSize: 10 }),
      ],
    }, altC);
    pTail.prepend(h("p", { class: "dpx-panel-title", text: "3. Diagnose the weights, then decide" }));
    pTail.append(srTable("Stages of the worked example", ["stage", "Gamma(a, b)", "E K_50", "Var K_50", "90% interval", "Pr(W_SB > .5)", "Pr(W_SB > .9)"],
      [...(state.showInit ? [init] : []), ...stages].map((st) => [st.label, fmtGamma(st.a, st.b, 4), fmtCount(st.mom.mean), fmtCount(st.mom.var), `[${st.s.q05}, ${st.s.q95}]`, fmtProb(st.s5), fmtProb(st.s9)])));

    const f = stages.find((st) => st.key === state.focus);
    const why = f.key === "tsmm"
      ? `Matches the target exactly, but ${fmtProb(f.s5)} is above the ${fmt(we.policy.trigger, 2)} trigger, so the weight view asks for refinement.`
      : f.key === "da"
        ? `The largest lambda on the grid whose tail is at or below ${fmt(we.policy.trigger, 2)}: it costs ${fmtCount(f.mom.mean - stages[0].mom.mean)} expected clusters.`
        : `Forcing the tail to ${fmt(we.policy.hard_bound, 2)} costs ${fmtCount(f.mom.mean - stages[0].mom.mean)} expected clusters; report it as a sensitivity analysis.`;
    ui.readout.textContent = `${f.label} ${fmtGamma(f.a, f.b, 4)}: E K_50 = ${fmtCount(f.mom.mean)}, Var ${fmtCount(f.mom.var)}, median ${f.s.median}, 90% [${f.s.q05}, ${f.s.q95}], Pr(W_SB > .5) = ${fmtProb(f.s5)}, Pr(W_SB > .9) = ${fmtProb(f.s9)}. ${why}`;
    initNote.hidden = !state.showInit;
    initNote.textContent = `Stage 1 initializer ${fmtGamma(init.a, init.b, 3)} (shifted negative-binomial proxy): E K_50 = ${fmt(init.mom.mean, 3)} and Var ${fmt(init.mom.var, 3)} miss the target ${we.target.mu_K} and ${we.target.var_K}, so Stage 2 runs Newton steps on (log a, log b) and converges to ${fmtGamma(stages[0].a, stages[0].b, 4)} (the replication trace lists ${we.newton.length} iterates, starting from the initializer). Circles in the TSMM panel: the initializer's pmf.`;
  };

  const focusSeg = segmented({
    label: "Focus",
    options: [{ value: "tsmm", label: "TSMM" }, { value: "da", label: "Dual-Anchor" }, { value: "hard", label: "hard bound" }],
    value: state.focus,
    onChange: (v) => { state.focus = v; render(); },
  });
  const initT = toggle({ label: "Show the Stage 1 initializer", checked: state.showInit, onChange: (v) => { state.showInit = v; render(); } });
  ui.controls.append(focusSeg.root, initT.root);
  const stop = observeWidth(ui.charts, (w) => { width = w; render(); });
  render();
  return {
    update(next = {}) {
      if (["tsmm", "da", "hard"].includes(next.preset)) { state.focus = next.preset; focusSeg.set(state.focus); }
      if (next.init !== undefined) { state.showInit = Boolean(next.init); initT.set(state.showInit); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}
