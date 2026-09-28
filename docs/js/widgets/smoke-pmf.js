// Smoke widget for the embed template (Step 3.2): the prior pmf of K_J under Gamma(a, b).
// Not in the catalog; it proves the pipeline dp-core -> bundle -> embed / page / file://.
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, slider } from "./base.js";
import { fmtCount, fmtGamma, fmtProb } from "./format.js";

export function mountWidget(el, spec = {}) {
  const state = {
    a: num(spec, "a", 1, 0.01, 50),
    b: num(spec, "b", 1, 0.01, 50),
    J: Math.round(num(spec, "J", 50, 10, 500)),
  };
  const ui = frame(el, { label: "Prior distribution of the number of clusters (pipeline check)" });
  const panel = h("div", { class: "dpx-panel" });
  ui.charts.append(panel);
  let width = 640;
  const render = () => {
    const pmf = dp.mixPmf(state.J, state.a, state.b);
    const s = dp.pmfSummary(pmf);
    const kmax = Math.min(state.J, Math.max(12, s.q95 + 4));
    const data = [];
    for (let k = 1; k <= kmax; k += 1) data.push({ k, p: pmf[k] });
    const c = palette(ui.root);
    const alt = `Bar chart of P(K_${state.J} = k) under ${fmtGamma(state.a, state.b)}; mean ${fmtCount(s.mean)}, median ${s.median}.`;
    draw(panel, {
      width, height: 220, marginLeft: 44,
      x: { label: "k (clusters among J units)", tickFormat: (d) => (d % 5 === 0 || d === 1 ? d : "") },
      y: { label: "P(K = k)", grid: true },
      marks: [globalThis.Plot.barY(data, { x: "k", y: "p", fill: c.teal }), globalThis.Plot.ruleY([0], { stroke: c.borderStrong })],
    }, alt);
    panel.append(srTable("P(K = k)", ["k", "probability"], data.map((d) => [d.k, fmtProb(d.p)])));
    ui.readout.textContent = `${fmtGamma(state.a, state.b)}, J = ${state.J}: E K = ${fmtCount(s.mean)}, median ${s.median}, 90% [${s.q05}, ${s.q95}], P(K = 1) = ${fmtProb(s.pK1)}.`;
  };
  const sa = slider({ label: "a (shape)", min: 0.05, max: 20, step: 0.01, value: state.a, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.a = v; render(); } });
  const sb = slider({ label: "b (rate)", min: 0.05, max: 20, step: 0.01, value: state.b, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.b = v; render(); } });
  const sJ = slider({ label: "J (units)", min: 10, max: 500, step: 1, value: state.J, format: (v) => String(Math.round(v)), onInput: (v) => { state.J = Math.round(v); render(); } });
  ui.controls.append(sa.root, sb.root, sJ.root);
  const stop = observeWidth(panel, (w) => { width = w; render(); });
  render();
  return {
    update(next = {}) {
      if (next.a !== undefined) { state.a = num(next, "a", state.a, 0.01, 50); sa.set(state.a); }
      if (next.b !== undefined) { state.b = num(next, "b", state.b, 0.01, 50); sb.set(state.b); }
      if (next.J !== undefined) { state.J = Math.round(num(next, "J", state.J, 10, 500)); sJ.set(state.J); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}
