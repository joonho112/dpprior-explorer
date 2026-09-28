// M-12 "Quasi-degenerate Gamma(eps, eps)" and M-13 "K_n-diffuse priors on the relative axis
// k / n". Owner of this file: Step 7.8. One module, two modes (spec.mode "eps" | "relative").
//
// eps mode: Gamma(eps, eps) has mean 1 and variance 1 / eps, and on the log-alpha scale it looks
// flat, the reason it is chosen as a "reference" prior (a, b -> 0 in Escobar and West, 1995;
// Gamma(0.001, 0.001) in BUGS). The flat density runs off to alpha -> 0, where K_J = 1: as eps
// falls from 1 to 0.001, P(K_J = 1) climbs to 1 for every J. At eps = 0.037 (the SCAL shortcut at
// m = 100, rounded) P(K_100 = 1) = .834.
// relative mode: the K_n-diffuse priors of West and Escobar (1993) and West, Mueller and
// Escobar (1994), and Vicentini and Jermyn's Gamma(10, 1), drawn on k / n for n = 10, 53, 74,
// 100: chosen by eye for one n, narrow and left-shifted at another, and all but ruling out a
// dominant cluster (Pr(W_SB > .5) = .013 for Gamma(5, 0.5)).
// Every number is recomputed with dp-core; each read-out repeats the moments with twice the
// alpha nodes (the contract's node-doubling check).
import * as dp from "../dp-core.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, segmented, slider, toggle } from "./base.js";
import { fmt, fmtCount, fmtParam, fmtProb } from "./format.js";

const EPS_MIN = 0.001;
const EPS_MAX = 1;
const EPS_PRESETS = [1, 0.1, 0.037, 0.001];
const J_SET = [50, 100, 500];
const LOG10_MIN = -14; // the log10 alpha axis of the density panel
const LOG10_MAX = 4;
const N_SET = [10, 53, 74, 100];
const REL_PRESETS = {
  g10: { a: 10, b: 1, label: "Gamma(10, 1)", note: "Vicentini and Jermyn, 2025, Fig. 1", n: 100 },
  g5: { a: 5, b: 0.5, label: "Gamma(5, 0.5)", note: "West and Escobar, 1993, chosen for n = 74", n: 74 },
  g35: { a: 3.5, b: 0.5, label: "Gamma(3.5, 0.5)", note: "West, Mueller and Escobar, 1994, chosen for n = 53", n: 53 },
};
const CELL_MIN = 336;

const fmtVar = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));

/** Largest change of E K_J when the alpha nodes are doubled (CONTRACT section 6: < 1e-4). */
function nodeCheck(Js, a, b) {
  const g1 = dp.alphaGrid(a, b);
  const g2 = dp.alphaGrid(a, b, 2);
  return Math.max(...Js.map((J) => Math.abs(dp.mixMoments(J, a, b, g2).mean - dp.mixMoments(J, a, b, g1).mean)));
}

let pk1Cache = null; // P(K_J = 1) along eps for J = 50, 100, 500 (shared)

export function mountWidget(el, spec = {}) {
  const mode = spec.mode === "relative" ? "relative" : "eps";
  const relKey = REL_PRESETS[spec.preset] ? spec.preset : "g5";
  const state = {
    eps: num(spec, "a", 0.037, EPS_MIN, EPS_MAX),
    J: J_SET.includes(Number(spec.J)) ? Number(spec.J) : 100,
    show: Object.fromEntries(J_SET.map((J) => [J, true])),
    rel: relKey,
    n: N_SET.includes(Number(spec.n)) ? Number(spec.n) : REL_PRESETS[relKey].n,
  };
  const ui = frame(el, {
    label: mode === "eps" ? "Quasi-degenerate Gamma(eps, eps): flat on log alpha, yet it expects a single cluster" : "K_n-diffuse priors on the relative axis k / n",
    className: `dpx-quasi dpx-quasi-${mode}`,
  });
  const pA = h("div", { class: "dpx-panel" });
  const pB = h("div", { class: "dpx-panel" });
  ui.charts.append(pA, pB);
  let width = 720;
  const cellWidth = () => {
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    return Math.floor((width - 16 * (cols - 1)) / cols);
  };

  // ------------------------------------------------------------------ eps mode ------
  const epsGrid = () => {
    const out = [];
    for (let i = 0; i <= 36; i += 1) out.push(EPS_MAX * (EPS_MIN / EPS_MAX) ** (i / 36));
    return out;
  };
  const renderEps = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const w = cellWidth();
    const e = state.eps;
    const LN10 = Math.log(10);
    const dens = [];
    for (let i = 0; i <= 180; i += 1) {
      const x = LOG10_MIN + ((LOG10_MAX - LOG10_MIN) * i) / 180;
      const al = 10 ** x;
      dens.push({ x, g: Math.exp(dp.dgammaLog(al, e, e) + Math.log(al) + Math.log(LN10)) });
    }
    const below12 = dp.pgamma(1e-12, e, e);
    const below2 = dp.pgamma(0.01, e, e);
    const gTop = Math.max(...dens.map((d) => d.g)) * 1.15;
    const ticks = [-12, -8, -4, 0, 4];
    draw(pA, {
      width: w, height: 230, marginLeft: 48, marginBottom: 42,
      x: { domain: [LOG10_MIN, LOG10_MAX], label: "alpha (log scale)", labelOffset: 36, ticks, tickFormat: (d) => (d === 0 ? "1" : `1e${d}`) },
      y: { domain: [0, gTop], label: "density per decade", grid: true },
      marks: [
        P.areaY(dens, { x: "x", y: "g", fill: c.brod[4], fillOpacity: 0.25 }),
        P.line(dens, { x: "x", y: "g", stroke: c.brod[4], strokeWidth: 2 }),
        P.ruleX([-12, -2], { stroke: c.muted, strokeDasharray: "3,3" }),
        P.text([{ x: -12, g: gTop * 0.97 }], { x: "x", y: "g", text: () => `Pr(alpha < 1e-12) = ${fmtProb(below12)}`, dx: 4, textAnchor: "start", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11, fontWeight: 600 }),
        P.text([{ x: -2, g: gTop * 0.87 }], { x: "x", y: "g", text: () => `Pr(alpha < .01) = ${fmtProb(below2)}`, dx: -4, textAnchor: "end", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11 }),
      ],
    }, `Gamma(${fmtParam(e)}, ${fmtParam(e)}) on the log10 alpha scale: ${e < 0.2 ? "flat over many decades" : "a single hump near alpha = 1"}; Pr(alpha < 1e-12) = ${fmtProb(below12)}, Pr(alpha < .01) = ${fmtProb(below2)}.`);
    pA.prepend(h("p", { class: "dpx-panel-title", text: `Gamma(${fmtParam(e)}, ${fmtParam(e)}) on log alpha: mean 1, variance ${fmtVar(1 / e)}` }));
    if (!pk1Cache) pk1Cache = epsGrid().flatMap((x) => J_SET.map((J) => ({ eps: x, J, p: dp.mixPK1(J, x, x) })));
    const shown = J_SET.filter((J) => state.show[J]);
    const cols = { 50: c.brod[0], 100: c.brod[4], 500: c.brod[2] };
    const now = shown.map((J) => ({ eps: e, J, p: dp.mixPK1(J, e, e) }));
    draw(pB, {
      width: w, height: 230, marginLeft: 48, marginBottom: 42,
      x: { type: "log", domain: [EPS_MAX, EPS_MIN], label: "eps (log scale, falling to the right)", ticks: [1, 0.1, 0.01, 0.001], tickFormat: () => "", labelOffset: 36 },
      y: { domain: [0, 1], label: "P(K_J = 1)", grid: true },
      marks: [
        ...shown.map((J) => P.line(pk1Cache.filter((d) => d.J === J), { x: "eps", y: "p", stroke: cols[J], strokeWidth: 2 })),
        P.dot(now, { x: "eps", y: "p", r: 5, fill: (d) => cols[d.J], stroke: c.fg }),
        P.text(now.filter((d) => d.J === state.J), { x: "eps", y: "p", text: (d) => `${fmtProb(d.p)} (J = ${d.J})`, dx: -8, dy: -10, textAnchor: "end", fill: c.fg, fontSize: 11, fontWeight: 700 }),
        logTickLabels([1, 0.1, 0.01, 0.001], c.muted, (d) => String(d)),
      ],
    }, `P(K_J = 1) as eps falls from 1 to 0.001: ${shown.map((J) => `J = ${J}: ${fmtProb(pk1Cache.find((d) => d.J === J).p)} to ${fmtProb(pk1Cache.filter((d) => d.J === J).slice(-1)[0].p)}`).join("; ")}. At eps = ${fmtParam(e)}: ${now.map((d) => `${fmtProb(d.p)} (J = ${d.J})`).join(", ")}.`);
    pB.prepend(h("p", { class: "dpx-panel-title", text: "The flatter the prior on log alpha, the surer it is of one cluster" }));
    pB.append(h("p", { class: "dpx-legend" }, ...shown.map((J) => h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${cols[J]};height:0.25rem;width:1.2rem` }), `J = ${J}`))));
    pB.append(srTable("P(K_J = 1) under Gamma(eps, eps)", ["eps", ...J_SET.map((J) => `J = ${J}`)], EPS_PRESETS.map((x) => [x, ...J_SET.map((J) => fmtProb(dp.mixPK1(J, x, x)))])));
    const pJ = dp.mixPK1(state.J, e, e);
    const eK = dp.mixMoments(state.J, e, e).mean;
    const chk = nodeCheck(J_SET, e, e);
    ui.readout.textContent = `eps = ${fmtParam(e)}: Gamma(${fmtParam(e)}, ${fmtParam(e)}) has mean 1 and variance ${fmtVar(1 / e)} and looks flat on log alpha, yet ${fmtProb(below12)} of its mass lies below alpha = 1e-12, so P(K_${state.J} = 1) = ${fmtProb(pJ)} and E K_${state.J} = ${fmtCount(eK)}. Doubling the alpha nodes changes E K_J by ${chk.toExponential(1)} (J = 50, 100, 500).`;
    ui.root.dataset.pK1 = String(pJ);
    ui.root.dataset.nodeCheck = String(chk);
  };

  // --------------------------------------------------------------- relative mode ------
  const renderRel = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const w = cellWidth();
    const pr = REL_PRESETS[state.rel];
    const rows = N_SET.flatMap((n) => {
      const pmf = dp.mixPmf(n, pr.a, pr.b);
      return Array.from({ length: n }, (_, i) => ({ n, x: (i + 1) / n, y: n * pmf[i + 1], cur: n === state.n }));
    });
    const pmfN = dp.mixPmf(state.n, pr.a, pr.b);
    const s = dp.pmfSummary(pmfN);
    const eK = dp.mixMoments(state.n, pr.a, pr.b).mean;
    const S50 = dp.wsbTail(0.5, pr.a, pr.b);
    const cols = Object.fromEntries(N_SET.map((n, i) => [n, c.brod[[0, 1, 2, 3][i]]]));
    draw(pA, {
      width: w, height: 250, marginLeft: 48, marginBottom: 42,
      x: { domain: [0, 1], label: "k / n (the number of clusters as a share of n)", labelOffset: 36 },
      y: { label: "n x P(K_n = k)", grid: true },
      marks: [
        ...N_SET.map((n) => P.line(rows.filter((d) => d.n === n), { x: "x", y: "y", stroke: cols[n], strokeWidth: n === state.n ? 3 : 1.2, strokeOpacity: n === state.n ? 1 : 0.55 })),
        P.dot(rows.filter((d) => d.cur), { x: "x", y: "y", r: 2.2, fill: cols[state.n] }),
        P.ruleX([s.q05 / state.n, s.q95 / state.n], { stroke: cols[state.n], strokeDasharray: "4,3" }),
        ...N_SET.map((n) => {
          const top = rows.filter((d) => d.n === n).reduce((m, d) => (d.y > m.y ? d : m), { y: -1 });
          return P.text([top], { x: "x", y: "y", text: () => `n = ${n}`, dy: -8, fill: cols[n], fontSize: 11, fontWeight: n === state.n ? 700 : 400 });
        }),
      ],
    }, `${pr.label} drawn on k / n for n = ${N_SET.join(", ")}: at n = ${state.n}, E K = ${fmtCount(eK)} (${fmt(eK / state.n, 3)} of n), 90% interval [${s.q05}, ${s.q95}]; the spread shrinks and moves left as n grows.`);
    pA.prepend(h("p", { class: "dpx-panel-title", text: `${pr.label} on the relative axis: wide at n = 10, narrow and left at n = 100` }));
    pA.append(srTable(`${pr.label}: K_n by n`, ["n", "E K_n", "E K_n / n", "90% interval"], N_SET.map((n) => {
      const sn = dp.pmfSummary(dp.mixPmf(n, pr.a, pr.b));
      const en = dp.mixMoments(n, pr.a, pr.b).mean;
      return [n, fmtCount(en), fmt(en / n, 3), `[${sn.q05}, ${sn.q95}]`];
    })));
    const bars = [
      ...Object.values(REL_PRESETS).map((p) => ({ label: p.label, s: dp.wsbTail(0.5, p.a, p.b), cur: p === pr })),
      { label: "Gamma(1, 1)", s: dp.wsbTail(0.5, 1, 1), cur: false },
    ];
    draw(pB, {
      width: w, height: 200, marginLeft: 118,
      x: { domain: [0, 1], label: "Pr(W_SB > .5)", grid: true },
      y: { domain: bars.map((d) => d.label), label: null },
      marks: [
        P.barX(bars, { x: "s", y: "label", fill: (d) => (d.label === "Gamma(1, 1)" ? c.methods.vague : c.brod[2]), fillOpacity: (d) => (d.cur ? 1 : 0.5) }),
        P.text(bars, { x: "s", y: "label", text: (d) => fmtProb(d.s), dx: 6, textAnchor: "start", fill: c.fg, fontSize: 11, fontWeight: 600 }),
      ],
    }, `Pr(W_SB > .5): ${bars.map((d) => `${d.label} ${fmtProb(d.s)}`).join(", ")}. Diffuse in K means a dominant cluster is all but ruled out.`);
    pB.prepend(h("p", { class: "dpx-panel-title", text: "Diffuse in K, extreme in the weights" }));
    const chk = nodeCheck([state.n], pr.a, pr.b);
    ui.readout.textContent = `${pr.label} at n = ${state.n} (${pr.note}): E K = ${fmtCount(eK)}, 90% interval [${s.q05}, ${s.q95}], E K / n = ${fmt(eK / state.n, 3)}; Pr(W_SB > .5) = ${fmtProb(S50)} at every n. Doubling the alpha nodes changes E K by ${chk.toExponential(1)}.`;
    ui.root.dataset.eK = String(eK);
    ui.root.dataset.nodeCheck = String(chk);
  };

  const render = () => {
    const t0 = performance.now();
    if (mode === "eps") renderEps(); else renderRel();
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  if (mode === "eps") {
    ui.caption.textContent =
      "Gamma(eps, eps) as a 'reference' hyperprior (Escobar and West, 1995; Gamma(0.001, 0.001) in BUGS). Left: the prior on the log10 alpha scale (density per decade). Right: P(K_J = 1), the prior probability that all J units fall in one cluster, as eps falls. K_J is the number of fitted components among the J units.";
    const sEps = slider({ label: "eps (Gamma(eps, eps))", min: EPS_MIN, max: EPS_MAX, value: state.eps, log: true, format: fmtParam,
      onInput: (v) => { state.eps = v; ePre.set(null); render(); } });
    const ePre = segmented({ label: "eps presets", options: EPS_PRESETS.map((x) => ({ value: x, label: String(x) })), value: EPS_PRESETS.includes(state.eps) ? state.eps : null,
      onChange: (v) => { state.eps = v; sEps.set(v); render(); } });
    const jToggles = J_SET.map((J) => toggle({ label: `J = ${J}`, checked: true, onChange: (v) => { state.show[J] = v; render(); } }));
    const jRead = segmented({ label: "read-out J", options: J_SET.map((J) => ({ value: J, label: String(J) })), value: state.J, onChange: (v) => { state.J = v; render(); } });
    ui.controls.append(sEps.root, ePre.root, h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "curves shown" }, ...jToggles.map((t) => t.root)), jRead.root);
    ui.api = { set: (e) => { state.eps = e; sEps.set(e); } };
  } else {
    ui.caption.textContent =
      "K_n-diffuse Gamma priors (West and Escobar, 1993; West, Mueller and Escobar, 1994; Vicentini and Jermyn, 2025) drawn on the relative axis k / n, scaled by n so the curves are comparable. Dashed lines: the 90% interval at the chosen n. K_n is the number of fitted components among the n units.";
    const sRel = segmented({ label: "Prior", options: Object.entries(REL_PRESETS).map(([value, p]) => ({ value, label: p.label })), value: state.rel,
      onChange: (v) => { state.rel = v; render(); } });
    const sN = segmented({ label: "n", options: N_SET.map((n) => ({ value: n, label: String(n) })), value: state.n, onChange: (v) => { state.n = v; render(); } });
    ui.controls.append(sRel.root, sN.root);
    ui.api = { setRel: (k) => { state.rel = k; sRel.set(k); }, setN: (n) => { state.n = n; sN.set(n); } };
  }
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (mode === "eps") {
        if (next.a !== undefined) ui.api.set(num(next, "a", state.eps, EPS_MIN, EPS_MAX));
        if (J_SET.includes(Number(next.J))) state.J = Number(next.J);
      } else {
        if (REL_PRESETS[next.preset]) ui.api.setRel(next.preset);
        if (N_SET.includes(Number(next.n))) ui.api.setN(Number(next.n));
      }
      render();
    },
    get mode() { return mode; },
    destroy() { stop(); el.replaceChildren(); },
  };
}
