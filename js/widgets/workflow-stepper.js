// C-13 "The workflow, step by step" (the paper's workflow figure and Algorithm 1). Owner of this
// file: Step 8.13.
//
// Six steps: state the target (J, mu_K and how sure), calibrate with TSMM, diagnose the implied
// K_J and weights, check the .40 trigger on Pr(W_SB > .5), refine with the Dual-Anchor rule (or
// keep TSMM), and report the .25 hard bound separately as a sensitivity analysis. The diagram is a
// picture that also takes clicks; the step buttons are the keyboard route (Tab, Enter, arrow
// keys). "Fill in the J = 50 example" writes the paper's numbers into every step, computed with
// dp-core: (5, 10) -> Gamma(1.4082, 1.0770) -> Pr(W_SB > .5) = .497 > .40 -> lambda = .30,
// Gamma(2.3158, 1.4204), .398; hard bound Gamma(5.2745, 2.3059), .250. Each step links to the
// page with the matching tool; spec.base is the path from the host page to pages/dpprior/.
import * as dp from "../dp-core.js";
import we from "../../data/precomputed/worked_example_j50.js";
import grid from "../../data/released/dual_anchor_grid.js";
import { draw, palette, srTable } from "./chart.js";
import { button, frame, h, observeWidth } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const J = we.target.J;
const MU = we.target.mu_K;
const V = we.target.var_K;
const TRIGGER = we.policy.trigger;
const HARD = we.policy.hard_bound;
const VIF = V / (MU - 1); // the example's variance inflation factor (medium confidence)

// the J = 50 example, computed once
function example() {
  const st = Object.fromEntries(we.stages.map((s) => [s.key, s]));
  const fit = dp.tsmmFit(J, MU, V);
  const pmf = dp.mixPmf(J, fit.a, fit.b);
  const sum = dp.pmfSummary(pmf);
  const s = (a, b) => ({ a, b, S5: dp.wsbTail(0.5, a, b), S9: dp.wsbTail(0.9, a, b), EK: dp.mixMoments(J, a, b).mean, rho: dp.meanRho(a, b) });
  return {
    fit, pmf, sum,
    tsmm: s(fit.a, fit.b),
    da: { ...s(st.da.a, st.da.b), lambda: st.da.lambda },
    hard: s(st.hard.a, st.hard.b),
    frontier: grid.map((r) => ({ lambda: r.lambda, S5: dp.wsbTail(0.5, r.a, r.b) })),
  };
}

export function mountWidget(el, spec = {}) {
  const d3 = globalThis.d3;
  const base = typeof spec.base === "string" ? spec.base : "";
  const ex = example();
  const fires = ex.tsmm.S5 > TRIGGER;
  const state = { step: 0, filled: spec.preset === "j50" };

  const STEPS = [
    { key: "state", title: "1 State", link: "elicitation.html", tool: "the elicitation form (C-05)",
      blank: ["J, a mean for K_J,", "and how sure you are"], full: () => [`J = ${J}, mu_K = ${MU}`, `sigma^2 = ${V} (VIF ${fmt(VIF, 1)})`],
      text: `Say how many clusters you expect among the J units and how sure you are: an interval with a probability, a confidence level or a CV. The J = ${J} example: about ${MU} clusters with medium confidence, so sigma^2 = ${fmt(VIF, 1)} (${MU} - 1) = ${V}.` },
    { key: "calibrate", title: "2 Calibrate", link: "calibrator.html", tool: "the calibrator (C-02)",
      blank: ["TSMM: Gamma(a, b)", "with those moments"], full: () => [fmtGamma(ex.fit.a, ex.fit.b, 4), `${ex.fit.iter} Newton steps`],
      text: `TSMM starts from a closed form and runs Newton until the prior's exact E K_J and Var K_J equal the target. The example: ${fmtGamma(ex.fit.a, ex.fit.b, 4)} after ${ex.fit.iter} steps, in milliseconds.` },
    { key: "diagnose", title: "3 Diagnose", link: "two-anchors.html", tool: "the four-view dashboard (C-09)",
      blank: ["K_J interval,", "Pr(W_SB > .5), E(rho)"], full: () => [`E K ${fmtCount(ex.tsmm.EK)}, 90% [${ex.sum.q05}, ${ex.sum.q95}]`, `Pr(W_SB > .5) = ${fmtProb(ex.tsmm.S5)}`],
      text: `Report what the calibrated prior implies beyond the two moments: the interval for K_J, the chance a random unit's cluster holds more than half the population, Pr(W_SB > .5), the extreme tail Pr(W_SB > .9), and E(rho). The example: 90% interval [${ex.sum.q05}, ${ex.sum.q95}], Pr(W_SB > .5) = ${fmtProb(ex.tsmm.S5)}, Pr(W_SB > .9) = ${fmtProb(ex.tsmm.S9)}, E(rho) = ${fmtProb(ex.tsmm.rho)}.` },
    { key: "trigger", title: `4 Trigger ${fmt(TRIGGER, 2)}`, link: "two-anchors.html", tool: "the four-view dashboard (C-09)",
      blank: [`Pr(W_SB > .5) > ${fmt(TRIGGER, 2)}?`, "fixed before any fit"], full: () => [`${fmtProb(ex.tsmm.S5)} ${fires ? ">" : "<="} ${fmt(TRIGGER, 2)}`, fires ? "yes: refine" : "no: keep TSMM"],
      text: `The operating policy is fixed in advance: if Pr(W_SB > .5) exceeds ${fmt(TRIGGER, 2)}, refine; otherwise keep the TSMM prior. The example: ${fmtProb(ex.tsmm.S5)} ${fires ? `> ${fmt(TRIGGER, 2)}, so the trigger fires` : `<= ${fmt(TRIGGER, 2)}, so TSMM is kept`}.` },
    { key: "refine", title: "5 Refine", link: "dual-anchor.html", tool: "the Dual-Anchor frontier (C-08)",
      blank: ["Dual-Anchor: largest", `lambda at or below ${fmt(TRIGGER, 2)}`], full: () => [`lambda = ${fmt(ex.da.lambda, 2)}`, fmtGamma(ex.da.a, ex.da.b, 4), `${fmtProb(ex.da.S5)}, E K ${fmtCount(ex.da.EK)}`],
      text: `The Dual-Anchor refinement weighs the count anchor by lambda and the weight anchor by 1 - lambda on a fixed grid, and takes the largest lambda whose prior is at or below the trigger. The example: lambda = ${fmt(ex.da.lambda, 2)}, ${fmtGamma(ex.da.a, ex.da.b, 4)}, Pr(W_SB > .5) = ${fmtProb(ex.da.S5)}, at the price of E K ${fmtCount(ex.tsmm.EK)} -> ${fmtCount(ex.da.EK)}.` },
    { key: "hard", title: `6 Hard bound ${fmt(HARD, 2)}`, link: "dual-anchor.html?preset=hard", tool: "the hard bound on the frontier page (C-08)",
      blank: [`Pr(W_SB > .5) <= ${fmt(HARD, 2)}`, "reported separately"], full: () => [fmtGamma(ex.hard.a, ex.hard.b, 4), `${fmtProb(ex.hard.S5)}, E K ${fmtCount(ex.hard.EK)}`],
      text: `If a strict bound is wanted, the hard version enforces Pr(W_SB > .5) <= ${fmt(HARD, 2)}. It is a sensitivity analysis, declared in advance and reported next to the primary prior, not instead of it. The example: ${fmtGamma(ex.hard.a, ex.hard.b, 4)}, ${fmtProb(ex.hard.S5)}, E K ${fmtCount(ex.hard.EK)}.` },
  ];

  const ui = frame(el, { label: "The DPprior workflow in six steps", className: "dpx-workflow" });
  const pFlow = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pDetail = h("div", { class: "dpx-panel dpx-wf-detail", style: "grid-column: 1 / -1", "aria-live": "polite" });
  ui.charts.append(pFlow, pDetail);
  ui.caption.textContent =
    `After the paper's workflow figure and Algorithm 1: inputs J, mu_K and sigma^2; policy t = .5, trigger ${fmt(TRIGGER, 2)}, soft target ${fmt(we.policy.soft_target, 2)}, a fixed lambda grid, and a separate hard bound ${fmt(HARD, 2)}. K_J is the number of clusters among the J units; W_SB is the population share of the cluster a randomly chosen unit belongs to. Values computed with dp-core; Dual-Anchor and hard-bound priors from the replication package (CC BY 4.0).`;
  const svg = d3.create("svg").attr("role", "img");
  pFlow.append(h("p", { class: "dpx-panel-title", text: "The six steps (click a box, or use the step buttons)" }), svg.node());
  let width = 720;

  const drawFlow = () => {
    const c = palette(ui.root);
    svg.selectAll("*").remove();
    const W = Math.max(300, width);
    const wide = W >= 700;
    const pos = [];
    let H;
    if (wide) {
      const gap = 42; // room for the "> .40" label between steps 4 and 5
      const bw = Math.min(170, (W - 8 - 4 * gap) / 5);
      const bh = 92;
      const x0 = (W - (5 * bw + 4 * gap)) / 2;
      for (let i = 0; i < 5; i += 1) pos.push({ x: x0 + i * (bw + gap), y: 8, w: bw, h: bh });
      pos.push({ x: pos[4].x, y: 8 + bh + 44, w: bw, h: bh - 12 }); // 6 under 5
      pos.keep = { x: pos[3].x, y: 8 + bh + 44, w: bw, h: 40 };
      H = 8 + bh + 44 + bh + 4;
    } else {
      const bw = Math.min(W - 16, 320);
      const x0 = (W - bw) / 2;
      const bh = 90;
      const gap = 30;
      for (let i = 0; i < 6; i += 1) pos.push({ x: x0, y: 8 + i * (bh + gap) + (i === 5 ? 0 : 0), w: bw, h: bh });
      pos.keep = null;
      H = 8 + 6 * (bh + gap);
    }
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).style("color", c.fg);
    const defs = svg.append("defs");
    const mk = (id, col) => defs.append("marker").attr("id", id).attr("viewBox", "0 0 10 10").attr("refX", 9).attr("refY", 5).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto-start-reverse")
      .append("path").attr("d", "M0,0L10,5L0,10z").attr("fill", col);
    const idA = `wf-a-${Math.random().toString(36).slice(2, 8)}`;
    const idR = `${idA}-r`;
    mk(idA, c.muted);
    mk(idR, c.red);
    const arrow = (x1, y1, x2, y2, { hot = false, dash = null, label = null, lx = 0, ly = -6, anchor = "middle" } = {}) => {
      svg.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("stroke", hot ? c.red : c.muted).attr("stroke-width", hot ? 2.5 : 1.5)
        .attr("stroke-dasharray", dash).attr("marker-end", `url(#${hot ? idR : idA})`);
      if (label) svg.append("text").attr("x", (x1 + x2) / 2 + lx).attr("y", (y1 + y2) / 2 + ly).attr("text-anchor", anchor).attr("font-size", 11).attr("font-weight", hot ? 700 : 400)
        .attr("fill", hot ? c.red : c.muted).attr("paint-order", "stroke").attr("stroke", c.raised).attr("stroke-width", 4).text(label);
    };
    const hotBranch = state.filled && fires;
    if (wide) {
      for (let i = 0; i < 3; i += 1) arrow(pos[i].x + pos[i].w, pos[i].y + pos[i].h / 2, pos[i + 1].x - 2, pos[i + 1].y + pos[i + 1].h / 2);
      arrow(pos[3].x + pos[3].w, pos[3].y + pos[3].h / 2, pos[4].x - 2, pos[4].y + pos[4].h / 2, { hot: hotBranch, label: `> ${fmt(TRIGGER, 2)}` });
      arrow(pos[3].x + pos[3].w / 2, pos[3].y + pos[3].h, pos.keep.x + pos.keep.w / 2, pos.keep.y - 2, { label: `<= ${fmt(TRIGGER, 2)}`, lx: 6, ly: 4, anchor: "start" });
      arrow(pos[4].x + pos[4].w / 2, pos[4].y + pos[4].h, pos[5].x + pos[5].w / 2, pos[5].y - 2, { dash: "4,3", label: "separately", lx: 6, ly: 4, anchor: "start" });
      const k = pos.keep;
      const keepDim = state.filled && fires;
      svg.append("rect").attr("x", k.x).attr("y", k.y).attr("width", k.w).attr("height", k.h).attr("rx", 20).attr("fill", c.bg).attr("stroke", c.borderStrong).attr("opacity", keepDim ? 0.45 : 1);
      svg.append("text").attr("x", k.x + k.w / 2).attr("y", k.y + k.h / 2 + 4).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", c.fg).attr("opacity", keepDim ? 0.45 : 1).text("keep the TSMM prior");
    } else {
      for (let i = 0; i < 5; i += 1) {
        const hot = i === 3 && hotBranch;
        arrow(pos[i].x + pos[i].w / 2, pos[i].y + pos[i].h, pos[i + 1].x + pos[i + 1].w / 2, pos[i + 1].y - 2, {
          hot, dash: i === 4 ? "4,3" : null, label: i === 3 ? `> ${fmt(TRIGGER, 2)} (else keep TSMM)` : i === 4 ? "separately" : null, lx: 8, ly: 4, anchor: "start" });
      }
    }
    STEPS.forEach((s, i) => {
      const p = pos[i];
      const active = i === state.step;
      const g = svg.append("g").attr("class", "dpx-wf-node").style("cursor", "pointer").on("click", () => select(i));
      const hot = state.filled && fires && (s.key === "trigger" || s.key === "refine");
      g.append("rect").attr("x", p.x).attr("y", p.y).attr("width", p.w).attr("height", p.h).attr("rx", 8)
        .attr("fill", active ? c.bg : c.raised).attr("stroke", hot ? c.red : active ? c.accentInk : c.borderStrong).attr("stroke-width", active || hot ? 2.5 : 1.2)
        .attr("stroke-dasharray", s.key === "hard" ? "5,3" : null);
      g.append("text").attr("x", p.x + 10).attr("y", p.y + 20).attr("font-size", 13).attr("font-weight", 700).attr("fill", hot ? c.red : c.fg).text(s.title);
      const lines = state.filled ? s.full() : s.blank;
      lines.forEach((ln, j) => g.append("text").attr("x", p.x + 10).attr("y", p.y + 40 + j * 16).attr("font-size", 11).attr("fill", state.filled ? c.fg : c.muted).attr("font-weight", state.filled ? 600 : 400).text(ln));
    });
    svg.attr("aria-label", `Workflow in six steps: state, calibrate, diagnose, trigger at ${fmt(TRIGGER, 2)}, refine with the Dual-Anchor rule or keep TSMM, and the hard bound ${fmt(HARD, 2)} reported separately. ${state.filled ? `J = ${J} example: ${fmtGamma(ex.fit.a, ex.fit.b, 4)}, Pr(W_SB > .5) = ${fmtProb(ex.tsmm.S5)} ${fires ? ">" : "<="} ${fmt(TRIGGER, 2)}, ${fires ? `refined to lambda = ${fmt(ex.da.lambda, 2)}, ${fmtGamma(ex.da.a, ex.da.b, 4)}, ${fmtProb(ex.da.S5)}` : "TSMM kept"}.` : "Not filled in yet."} Step ${state.step + 1} is selected.`);
  };

  const detail = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const s = STEPS[state.step];
    const chart = h("div", { class: "dpx-wf-chart" });
    const w = Math.min(width, 520);
    const ttl = (t) => chart.prepend(h("p", { class: "dpx-panel-title", text: t }));
    if (s.key === "state") {
      const sd = Math.sqrt(V);
      draw(chart, { width: w, height: 110, marginLeft: 20, marginBottom: 34, x: { domain: [0, 14], label: "number of clusters K_J", labelOffset: 28 }, y: { axis: null, domain: [0, 1] },
        marks: [P.ruleY([0.5], { x1: Math.max(0, MU - dp.qnorm(0.9) * sd), x2: MU + dp.qnorm(0.9) * sd, stroke: c.accent, strokeWidth: 8, strokeOpacity: 0.35 }), P.dot([{ x: MU }], { x: "x", y: 0.5, r: 7, fill: c.accent }),
          P.text([{ x: MU }], { x: "x", y: 0.5, text: () => `mean ${MU}, sd ${fmt(sd, 2)}`, dy: -16, fill: c.fg, fontWeight: 600 })] },
      `The target: mean ${MU}, sigma^2 = ${V} (sd ${fmt(sd, 2)}); the band is the 80% normal-proxy range.`);
      ttl(`The target for K_${J}: mean ${MU}, variance ${V}`);
    } else if (s.key === "calibrate") {
      const xs = Array.from({ length: 121 }, (_, i) => { const x = (5 * (i + 0.5)) / 121; return { x, d: Math.exp(dp.dgammaLog(x, ex.fit.a, ex.fit.b)) }; });
      draw(chart, { width: w, height: 150, marginLeft: 40, marginBottom: 34, x: { label: "alpha", labelOffset: 28 }, y: { label: "density", grid: true },
        marks: [P.areaY(xs, { x: "x", y: "d", fill: c.methods.tsmm, fillOpacity: 0.3 }), P.line(xs, { x: "x", y: "d", stroke: c.methods.tsmm, strokeWidth: 2 })] },
      `TSMM prior on alpha: ${fmtGamma(ex.fit.a, ex.fit.b, 4)}.`);
      ttl(`The calibrated prior on alpha: ${fmtGamma(ex.fit.a, ex.fit.b, 4)}`);
    } else if (s.key === "diagnose") {
      const bars = Array.from({ length: 15 }, (_, i) => ({ k: i + 1, p: ex.pmf[i + 1] }));
      draw(chart, { width: w, height: 150, marginLeft: 40, marginBottom: 34, x: { domain: [0.5, 15.5], label: `k (clusters among J = ${J})`, labelOffset: 28 }, y: { label: "probability", grid: true },
        marks: [P.rectY(bars, { x1: (d) => d.k - 0.4, x2: (d) => d.k + 0.4, y: "p", fill: c.methods.tsmm, fillOpacity: 0.85 }), P.ruleX([MU], { stroke: c.fg, strokeDasharray: "4,3" })] },
      `Implied K_${J} under TSMM: mean ${fmtCount(ex.tsmm.EK)}, 90% interval [${ex.sum.q05}, ${ex.sum.q95}].`);
      ttl(`The implied K_${J}: mean ${fmtCount(ex.tsmm.EK)}, 90% [${ex.sum.q05}, ${ex.sum.q95}]`);
    } else if (s.key === "trigger" || s.key === "hard") {
      const rows = s.key === "trigger" ? [{ who: "TSMM", v: ex.tsmm.S5 }] : [{ who: "TSMM", v: ex.tsmm.S5 }, { who: "Dual-Anchor", v: ex.da.S5 }, { who: "hard bound", v: ex.hard.S5 }];
      draw(chart, { width: w, height: 40 + 30 * rows.length, marginLeft: 90, marginBottom: 30, x: { domain: [0, 0.6], label: "Pr(W_SB > .5)", labelOffset: 26, ticks: [0, HARD, TRIGGER, 0.6], tickFormat: (d) => (d === 0 ? "0" : fmt(d, 2)) }, y: { domain: rows.map((r) => r.who), label: null },
        marks: [P.barX(rows, { x1: 0, x2: "v", y: "who", fill: (d) => (d.v > TRIGGER ? c.red : d.who === "hard bound" ? c.methods.hard : c.methods.da), insetTop: 5, insetBottom: 5 }),
          P.ruleX([TRIGGER], { stroke: c.red, strokeDasharray: "4,2", strokeWidth: 2 }), P.ruleX([HARD], { stroke: c.methods.hard, strokeDasharray: "2,2", strokeWidth: 2 }),
          P.text(rows, { x: "v", y: "who", text: (d) => fmtProb(d.v), dx: 6, textAnchor: "start", fill: c.fg, fontWeight: 600 })] },
      `Pr(W_SB > .5): ${rows.map((r) => `${r.who} ${fmtProb(r.v)}`).join(", ")}; trigger ${fmt(TRIGGER, 2)}, hard bound ${fmt(HARD, 2)}.`);
      ttl(s.key === "trigger" ? `Pr(W_SB > .5) = ${fmtProb(ex.tsmm.S5)} against the ${fmt(TRIGGER, 2)} trigger` : "The three priors against the trigger and the hard bound");
    } else {
      draw(chart, { width: w, height: 160, marginLeft: 44, marginBottom: 34, x: { domain: [0, 1.02], label: "lambda", labelOffset: 28 }, y: { label: "Pr(W_SB > .5)", grid: true, tickFormat: (d) => fmt(d, 2) },
        marks: [P.line(ex.frontier, { x: "lambda", y: "S5", stroke: c.muted }), P.dot(ex.frontier, { x: "lambda", y: "S5", r: 3, fill: (d) => (d.S5 <= TRIGGER ? c.methods.da : c.faint) }),
          P.ruleY([TRIGGER], { stroke: c.red, strokeDasharray: "4,2" }), P.dot([{ lambda: ex.da.lambda, S5: ex.da.S5 }], { x: "lambda", y: "S5", r: 7, stroke: c.fg, strokeWidth: 2, fill: "none" })] },
      `Pr(W_SB > .5) along lambda; the largest lambda at or below ${fmt(TRIGGER, 2)} is ${fmt(ex.da.lambda, 2)} (${fmtProb(ex.da.S5)}).`);
      ttl(`The frontier: lambda = ${fmt(ex.da.lambda, 2)} is the largest at or below ${fmt(TRIGGER, 2)}`);
    }
    pDetail.replaceChildren(
      h("h4", { class: "dpx-wf-title", text: `Step ${s.title}` }),
      h("p", { class: "dpx-wf-text", text: s.text }),
      chart,
      h("p", { class: "dpx-wf-link" }, "Try it: ", h("a", { href: base + s.link, text: s.tool })),
    );
    ui.readout.textContent = `Step ${s.title}${state.filled ? `: ${s.full().join("; ")}` : ""}. ${state.filled && fires ? `With the J = ${J} example the trigger fires (${fmtProb(ex.tsmm.S5)} > ${fmt(TRIGGER, 2)}).` : ""}`.trim();
  };

  const stepBtns = STEPS.map((s, i) => h("button", { type: "button", class: "dpx-seg", "aria-pressed": String(i === state.step), onclick: () => select(i),
    onkeydown: (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const j = (i + (e.key === "ArrowRight" ? 1 : STEPS.length - 1)) % STEPS.length;
      select(j);
      stepBtns[j].focus();
    } }, s.title));
  const stepGroup = h("div", { class: "dpx-control dpx-segmented", role: "group", "aria-label": "Workflow steps" }, h("span", { class: "dpx-seg-label", text: "Steps" }), ...stepBtns);
  const bFill = button({ label: `Fill in the J = ${J} example`, primary: true, onClick: () => { state.filled = !state.filled; bFill.textContent = state.filled ? "Clear the example" : `Fill in the J = ${J} example`; render(); } });
  if (state.filled) bFill.textContent = "Clear the example";
  ui.controls.append(stepGroup, h("div", { class: "dpx-control dpx-buttons" }, bFill));

  function select(i) {
    state.step = i;
    stepBtns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    render();
  }
  const render = () => {
    const t0 = performance.now();
    drawFlow();
    detail();
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.step = String(state.step + 1);
    ui.root.dataset.filled = String(state.filled);
  };
  pFlow.append(srTable("The workflow with the J = 50 example", ["step", "what", "J = 50 example"], STEPS.map((s) => [s.title, s.blank.join(" "), s.full().join("; ")])));

  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) { if (next.preset === "j50" && !state.filled) bFill.click(); else render(); },
    select,
    get state() { return { ...state, fires, links: STEPS.map((s) => base + s.link) }; },
    destroy() { stop(); el.replaceChildren(); },
  };
}
