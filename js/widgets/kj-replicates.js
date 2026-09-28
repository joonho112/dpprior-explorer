// P-15 "K_J is a random variable: 100 replicates against the Antoniak pmf" (after Broderick,
// MLSS 2016 part II; re-implemented from the mathematics). Owner of this file: Step 6.12.
//
// Each replicate seats J customers by the Chinese restaurant process with a fixed alpha and
// records the number of occupied tables K_J. Replicates stack as dots on top of the expected
// counts, R x P(K_J = k | alpha) (the Antoniak pmf, dp-core condPmf).
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, slider } from "./base.js";
import { fmt, fmtAlpha, fmtCount } from "./format.js";

const BATCH = 100;

export function mountWidget(el, spec = {}) {
  const state = {
    J: Math.round(num(spec, "J", 100, 10, 500)),
    alpha: num(spec, "alpha", 1, 0.1, 20),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
  };
  let rng = dp.makeRng(state.seed);
  let reps = [];
  const ui = frame(el, { label: "K_J is a random variable: replicated Chinese restaurants against the exact pmf", className: "dpx-kj-reps" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(panel);
  ui.caption.textContent =
    "K_J is the number of fitted components (occupied clusters) among the J units. Each dot is one simulated restaurant of J customers with the chosen alpha; the bars are the expected number of restaurants at each K_J from the exact Antoniak pmf. Seeded.";
  let width = 720;

  const addReps = (n) => { for (let i = 0; i < n; i += 1) reps.push(dp.rcrpTables(rng, state.alpha, state.J)); };
  const clear = () => { reps = []; rng = dp.makeRng(state.seed); };

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { J, alpha } = state;
    const pmf = dp.condPmf(J, alpha);
    const s = dp.pmfSummary(pmf);
    const R = reps.length;
    const kmax = Math.min(J, Math.max(12, s.q95 + 4, ...reps));
    const counts = new Map();
    const dots = reps.map((k) => { const n = (counts.get(k) ?? 0) + 1; counts.set(k, n); return { k, y: n - 0.5 }; });
    const bars = [];
    for (let k = 1; k <= kmax; k += 1) bars.push({ k, e: Math.max(R, BATCH) * pmf[k] });
    const yTop = Math.max(...bars.map((b) => b.e), ...counts.values(), 1) * 1.1;
    const mean = R ? reps.reduce((a, b) => a + b, 0) / R : NaN;
    const E = dp.condMean(J, alpha);
    draw(panel, {
      width, height: 300, marginLeft: 44,
      x: { type: "band", domain: bars.map((b) => b.k), label: `K_${J} (occupied tables among J = ${J} customers)`, tickFormat: (d) => (d === 1 || d % 5 === 0 ? d : "") },
      y: { domain: [0, yTop], label: R ? "restaurants" : `expected restaurants per ${BATCH}`, grid: true },
      marks: [
        P.barY(bars, { x: "k", y: "e", fill: c.slate, fillOpacity: 0.25, stroke: c.slate, strokeOpacity: 0.5 }),
        P.dot(dots, { x: "k", y: "y", r: Math.max(2, Math.min(5, 180 / yTop)), fill: c.brod[0], stroke: c.stroke, strokeOpacity: 0.3 }),
        P.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `${R} simulated restaurants of J = ${J} at alpha = ${fmtAlpha(alpha)}${R ? `: mean K_J ${fmt(mean, 2)}` : ""}; bars show R times the exact pmf, E(K_J | alpha) = ${fmtCount(E)}.`);
    panel.prepend(h("p", { class: "dpx-panel-title", text: `${R} replicates of K_${J} at alpha = ${fmtAlpha(alpha)} (dots) on ${R || BATCH} x P(K_${J} = k | alpha) (bars)` }));
    panel.append(srTable(`K_${J} counts`, ["k", "restaurants", "expected"], bars.filter((b) => b.e >= 0.5 || counts.has(b.k)).map((b) => [b.k, counts.get(b.k) ?? 0, fmt(b.e, 1)])));
    ui.readout.textContent = R
      ? `${R} restaurants: mean K_${J} = ${fmt(mean, 2)}, from ${Math.min(...reps)} to ${Math.max(...reps)} tables; E(K_${J} | alpha) = ${fmtCount(E)}, 90% interval [${s.q05}, ${s.q95}]. The same alpha gives a different K_J in every restaurant: K_J is a random variable.`
      : `E(K_${J} | alpha = ${fmtAlpha(alpha)}) = ${fmtCount(E)}. Press "${BATCH} replicates" (or Enter) to seat ${BATCH} restaurants.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.mean = String(mean);
    ui.root.dataset.expected = String(E);
  };

  const sJ = slider({ label: "J (customers)", min: 10, max: 500, step: 1, value: state.J, format: (v) => String(Math.round(v)), onInput: (v) => { state.J = Math.round(v); clear(); render(); } });
  const sA = slider({ label: "alpha", min: 0.1, max: 20, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { state.alpha = v; clear(); render(); } });
  const bAdd = button({ label: `${BATCH} replicates`, primary: true, onClick: () => { addReps(BATCH); render(); } });
  const bClear = button({ label: "Clear", onClick: () => { clear(); render(); } });
  ui.controls.append(sJ.root, sA.root, h("div", { class: "dpx-control dpx-buttons" }, bAdd, bClear));
  const unbind = bindPrimaryKey(ui.root, () => bAdd.click());
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  addReps(Math.round(num(spec, "n", 0, 0, 2000)));
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.J !== undefined) { state.J = Math.round(num(next, "J", state.J, 10, 500)); sJ.set(state.J); }
      if (next.alpha !== undefined) { state.alpha = num(next, "alpha", state.alpha, 0.1, 20); sA.set(state.alpha); }
      if (next.seed !== undefined) state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9));
      clear();
      addReps(Math.round(num(next, "n", 0, 0, 2000)));
      render();
    },
    add: (n = BATCH) => { addReps(n); render(); },
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}
