// M-03 "The unintended prior" (paper Fig. 1).
//
// Gamma(1.60, 1.22) at J = 50 reproduces a plausible count judgment ("about five
// clusters": E K_50 = 5.05, SD 3.06, the moments of the negative-binomial target), yet
// it implies Pr(W_SB > .5) = .487 and Pr(W_SB > .9) = .183: a randomly chosen unit has
// nearly even odds of belonging to a cluster holding more than half of the population.
// Panel A: induced pmf of K_J (bars) vs the shifted negative binomial with the same mean
// and variance (circles). Panel B: density of the size-biased weight W_SB with the tails
// above t and above .9 shaded. All numbers from dp-core.
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, slider, toggle } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const EXTREME_T = 0.9;

/** Shifted negative binomial on k = 1, 2, ... with mean mu and variance v (needs v > mu - 1). */
function shiftedNb(mu, v, kmax) {
  const m0 = mu - 1;
  if (!(v > m0) || !(m0 > 0)) return null;
  const r = (m0 * m0) / (v - m0);
  const p = r / (r + m0);
  const out = new Float64Array(kmax + 1);
  for (let k = 1; k <= kmax; k += 1) {
    out[k] = Math.exp(dp.lgamma(k - 1 + r) - dp.lgamma(r) - dp.lgamma(k) + r * Math.log(p) + (k - 1) * Math.log1p(-p));
  }
  return out;
}

export function mountWidget(el, spec = {}) {
  const state = {
    a: num(spec, "a", 1.6, 0.05, 50),
    b: num(spec, "b", 1.22, 0.05, 50),
    J: Math.round(num(spec, "J", 50, 10, 500)),
    t: num(spec, "t", 0.5, 0.05, 0.95),
    target: true,
  };
  const ui = frame(el, { label: "The unintended prior: a count judgment and a weight implication from the same Gamma hyperprior", className: "dpx-unintended" });
  const pA = h("div", { class: "dpx-panel" });
  const pB = h("div", { class: "dpx-panel" });
  ui.charts.append(pA, pB);
  const sentence = h("p", { class: "dpx-readout", style: "border-left-color: var(--dp-red)" });
  ui.root.insertBefore(sentence, ui.readout);
  ui.caption.textContent =
    "K_J is the number of fitted components (occupied clusters) among the J units. W_SB is the population share of the cluster that a randomly chosen unit belongs to (size-biased), not the largest weight. These are prior statements, before any data.";

  let width = 720;
  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const { a, b, J, t } = state;
    const grid = dp.alphaGrid(a, b);
    const pmf = dp.mixPmf(J, a, b, grid);
    const s = dp.pmfSummary(pmf);
    const kmax = Math.min(J, Math.max(15, s.q95 + 6));
    const nb = state.target ? shiftedNb(s.mean, s.var, kmax) : null;
    const bars = [];
    const dots = [];
    for (let k = 1; k <= kmax; k += 1) {
      bars.push({ k, p: pmf[k] });
      if (nb) dots.push({ k, p: nb[k] });
    }
    const half = width >= 680 ? Math.floor((width - 16) / 2) : width;
    const altA = `Bar chart of the prior distribution of K_${J} under ${fmtGamma(a, b)}: mean ${fmtCount(s.mean)}, SD ${fmtCount(s.sd)}, median ${s.median}, 90% interval [${s.q05}, ${s.q95}]${nb ? "; circles show a negative binomial with the same mean and SD" : ""}.`;
    draw(pA, {
      width: half, height: 260, marginLeft: 46,
      x: { label: `k (clusters among J = ${J} units)`, type: "band", tickFormat: (d) => (d === 1 || d % 5 === 0 ? d : "") },
      y: { label: "P(K_J = k)", grid: true },
      marks: [
        globalThis.Plot.barY(bars, { x: "k", y: "p", fill: c.teal, fillOpacity: 0.85 }),
        ...(nb ? [globalThis.Plot.dot(dots, { x: "k", y: "p", r: 3.5, stroke: c.fg, fill: c.raised, strokeWidth: 1.5 })] : []),
        globalThis.Plot.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, altA);
    pA.prepend(h("p", { class: "dpx-panel-title", text: `A. Count view: K_${J} (bars) vs negative-binomial target (circles)` }));
    pA.append(srTable(`P(K_${J} = k)`, ["k", "induced", "NB target"], bars.map((d, i) => [d.k, fmtProb(d.p), nb ? fmtProb(dots[i].p) : "n/a"])));

    const sT = dp.wsbTail(t, a, b);
    const s9 = dp.wsbTail(EXTREME_T, a, b);
    const dens = [];
    for (let i = 0; i <= 400; i += 1) {
      const w = Math.min(dp.W_DENSITY_MAX, i / 400);
      dens.push({ w, d: dp.wsbDensity(w, a, b) });
    }
    const top = Math.min(4, Math.max(2, ...dens.filter((d) => d.w <= 0.95).map((d) => d.d)) * 1.15);
    const clipped = dens.map((d) => ({ ...d, d: Math.min(d.d, top) }));
    const altB = `Density of the size-biased weight W_SB under ${fmtGamma(a, b)}; shaded area above ${fmtProb(t)} is ${fmtProb(sT)} and above .9 is ${fmtProb(s9)}.`;
    draw(pB, {
      width: half, height: 260, marginLeft: 46, marginRight: 16,
      x: { domain: [0, 1], label: "W_SB (share of a random unit's cluster)", tickFormat: (d) => fmtProb(d) },
      y: { domain: [0, top], label: `density${top < 4 ? "" : " (clipped)"}`, grid: true },
      marks: [
        globalThis.Plot.areaY(clipped.filter((d) => d.w >= t), { x: "w", y: "d", fill: c.red, fillOpacity: 0.22 }),
        globalThis.Plot.areaY(clipped.filter((d) => d.w >= EXTREME_T), { x: "w", y: "d", fill: c.red, fillOpacity: 0.45 }),
        globalThis.Plot.lineY(clipped, { x: "w", y: "d", stroke: c.fg, strokeWidth: 1.6 }),
        globalThis.Plot.ruleX([t], { stroke: c.red, strokeDasharray: "4,3" }),
        globalThis.Plot.ruleX([EXTREME_T], { stroke: c.red, strokeDasharray: "2,3" }),
        globalThis.Plot.text([{ w: t, lab: `> ${fmt(t, 2)}: ${fmtProb(sT)}` }], { x: "w", frameAnchor: "top", text: "lab", dy: 6, dx: 4, textAnchor: "start", fill: c.red, fontWeight: 700, fontSize: 11 }),
        globalThis.Plot.text([{ w: EXTREME_T, lab: `> .90: ${fmtProb(s9)}` }], { x: "w", frameAnchor: "top", text: "lab", dy: 22, dx: -4, textAnchor: "end", fill: c.red, fontSize: 11 }),
      ],
    }, altB);
    pB.prepend(h("p", { class: "dpx-panel-title", text: "B. Weight view: size-biased weight W_SB" }));

    const about = Math.round(s.mean);
    ui.readout.textContent =
      `${fmtGamma(a, b)}, J = ${J}. Count view: E K_J = ${fmtCount(s.mean)}, SD ${fmtCount(s.sd)}, median ${s.median}, 90% [${s.q05}, ${s.q95}]. ` +
      `Weight view: Pr(W_SB > ${fmt(t, 2)}) = ${fmtProb(sT)}, Pr(W_SB > .90) = ${fmtProb(s9)}.`;
    sentence.textContent =
      `"About ${about} clusters" and ${fmtProb(dp.wsbTail(0.5, a, b))} majority dominance at once: pick one of the ${J} units at random, and with probability ${fmtProb(dp.wsbTail(0.5, a, b))} it sits at a table that holds more than half of the whole population.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  const sa = slider({ label: "a (shape)", min: 0.05, max: 50, value: state.a, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.a = v; render(); } });
  const sb = slider({ label: "b (rate)", min: 0.05, max: 50, value: state.b, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.b = v; render(); } });
  const sJ = slider({ label: "J (units)", min: 10, max: 500, step: 1, value: state.J, format: (v) => String(Math.round(v)), onInput: (v) => { state.J = Math.round(v); render(); } });
  const st = slider({ label: "tail threshold t", min: 0.05, max: 0.95, step: 0.01, value: state.t, format: (v) => fmt(v, 2), onInput: (v) => { state.t = v; render(); } });
  const tg = toggle({ label: "NB target circles", checked: true, onChange: (v) => { state.target = v; render(); } });
  ui.controls.append(sa.root, sb.root, sJ.root, st.root, tg.root);

  const stop = observeWidth(ui.charts, (w) => { width = w; render(); });
  render();
  return {
    update(next = {}) {
      if (next.a !== undefined) { state.a = num(next, "a", state.a, 0.05, 50); sa.set(state.a); }
      if (next.b !== undefined) { state.b = num(next, "b", state.b, 0.05, 50); sb.set(state.b); }
      if (next.J !== undefined) { state.J = Math.round(num(next, "J", state.J, 10, 500)); sJ.set(state.J); }
      if (next.t !== undefined) { state.t = num(next, "t", state.t, 0.05, 0.95); st.set(state.t); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}
