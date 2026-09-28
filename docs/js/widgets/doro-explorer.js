// M-09 "DORO explorer: a flat count target against the hump a Gamma can deliver" (after
// Dorazio, 2009). Owner of this file: Step 7.5.
//
// DORO chooses Gamma(a, b) to minimise KL(uniform on {1, ..., n} || implied pmf of K_n). Two
// parameters cannot make a flat line: the closest Gamma (a < 1, b near 0) puts a spike at K = 1
// (alpha near 0) and a hump near 0.9 n (large alpha) and sags in between. The KL gap grows with
// n, b goes to 0 and E(alpha) = a / b grows, and the prior ends up expecting about n / 2
// clusters where every fixed Gamma grows like log n. DORO-Unif (the paper's variant) targets
// {1, ..., 2 mu_K - 1} at J = 100 instead; its solution (a > 1) is a single right-skewed hump. Every (a, b) is solved live by dp-core
// doroKL (Nelder-Mead on (log a, log b)); the n-path is filled in after the first paint.
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtAlpha, fmtCount, fmtGamma, fmtProb } from "./format.js";

const N_MIN = 5;
const N_MAX = 100;
const PATH_STEP = 5; // the KL and E K_n curves are solved at n = 5, 10, ..., 100
const UNIF_J = 100;
const CELL_MIN = 336; // grid cell minimum (20rem) plus the 1rem gap, as in .dpx-charts
const MU_OPTIONS = [5, 10, 30];

let pathCache = null; // [{n, a, b, kl, ek}] shared by every mount on the page

export function mountWidget(el, spec = {}) {
  const preset = String(spec.preset ?? "");
  const state = {
    mode: preset.startsWith("unif") ? "unif" : "doro",
    n: Math.round(num(spec, "n", 53, N_MIN, N_MAX)),
    mu: MU_OPTIONS.includes(Number(preset.slice(4))) ? Number(preset.slice(4)) : 5,
  };
  let fit = null;
  let lastStart;
  const ui = frame(el, { label: "DORO explorer: a flat count target against the count distribution a Gamma hyperprior can deliver", className: "dpx-doro" });
  const pMain = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pKL = h("div", { class: "dpx-panel" });
  const pEK = h("div", { class: "dpx-panel" });
  ui.charts.append(pMain, pKL, pEK);
  const CAPTION = "After Dorazio (2009). The dashed line is the flat target; the bars are the count distribution implied by the Gamma(a, b) closest to it in Kullback-Leibler divergence, solved live. K_n is the number of fitted components among the n units. Two parameters cannot draw a flat line: ";
  const setCaption = () => {
    ui.caption.textContent = CAPTION + (state.mode === "doro"
      ? "the closest Gamma gives a spike at one cluster and a hump near n."
      : "the closest Gamma is a single right-skewed hump that still puts mass on one cluster and beyond the target.");
  };
  let width = 720;

  const solve = () => {
    const t0 = performance.now();
    if (state.mode === "doro") fit = dp.doroKL(state.n, lastStart ? { start: lastStart } : {});
    else fit = dp.doroKL(UNIF_J, { muK: state.mu });
    if (state.mode === "doro") lastStart = [fit.a, fit.b];
    fit.ms = performance.now() - t0;
  };

  const fillPath = () => {
    if (pathCache) return;
    const ns = [];
    for (let n = N_MIN; n <= N_MAX; n += PATH_STEP) ns.push(n);
    const rows = [];
    let prev;
    const chunk = () => {
      for (let k = 0; k < 4 && ns.length; k += 1) {
        const n = ns.shift();
        const r = dp.doroKL(n, prev ? { start: prev } : {});
        prev = [r.a, r.b];
        rows.push({ n, a: r.a, b: r.b, kl: r.kl, ek: dp.mixMoments(n, r.a, r.b).mean });
      }
      if (ns.length) setTimeout(chunk, 0);
      else { pathCache = rows; if (!destroyed) renderSide(); }
    };
    setTimeout(chunk, 0);
  };
  let destroyed = false;

  const renderMain = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const J = fit.J;
    const top = fit.top;
    const pmf = dp.mixPmf(J, fit.a, fit.b);
    const s = dp.pmfSummary(pmf);
    const kmax = state.mode === "doro" ? J : Math.min(J, Math.max(top + 6, s.q95 + 3));
    const bars = Array.from({ length: kmax }, (_, i) => ({ k: i + 1, p: pmf[i + 1], out: i + 1 > top }));
    const tgt = 1 / top;
    const yTop = Math.max(tgt, ...bars.map((d) => d.p)) * 1.15;
    const ek = dp.mixMoments(J, fit.a, fit.b).mean;
    const S50 = dp.wsbTail(0.5, fit.a, fit.b);
    draw(pMain, {
      width, height: 270, marginLeft: 48, marginBottom: 44,
      x: { domain: [0.5, kmax + 0.5], label: `k (clusters among ${state.mode === "doro" ? "n" : "J"} = ${J})`, labelOffset: 38, ticks: Math.min(10, kmax) },
      y: { domain: [0, yTop], label: "probability", grid: true },
      marks: [
        P.rectY(bars, { x1: (d) => d.k - 0.42, x2: (d) => d.k + 0.42, y: "p", fill: (d) => (d.out ? c.gold : c.methods.doro), fillOpacity: 0.9 }),
        P.ruleY([tgt], { x1: 0.5, x2: top + 0.5, stroke: c.fg, strokeWidth: 2, strokeDasharray: "6,4" }),
        P.ruleX([top + 0.5], { stroke: c.muted, strokeDasharray: "2,3" }),
        P.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `Target ${fmt(tgt, 3)} on 1 to ${top} (dashed) against the pmf of ${fmtGamma(fit.a, fit.b)}${state.mode === "doro" ? "" : ` at J = ${J}`}: P(K = 1) = ${fmtProb(pmf[1])}, mode at ${s.mode}, E K = ${fmtCount(ek)}${state.mode === "unif" ? `, ${fmtProb(fit.leak)} beyond ${top}` : ""}.`);
    const title = state.mode === "doro"
      ? `DORO, n = ${J}: the flat target 1/${J} against the closest Gamma-mixed pmf`
      : `DORO-Unif, J = ${J}, mu_K = ${state.mu}: flat target on 1 to ${top}; mass beyond ${top} in gold`;
    pMain.prepend(h("p", { class: "dpx-panel-title", text: title }));
    pMain.append(srTable(`Target and implied pmf, ${state.mode === "doro" ? `n = ${J}` : `J = ${J}`}`, ["k", "target", "implied"],
      bars.filter((d) => d.k <= Math.min(kmax, 30)).map((d) => [d.k, d.k <= top ? fmt(tgt, 4) : "0", fmt(d.p, 4)])));
    return { pmf, ek, S50, s };
  };

  const renderSide = () => {
    const show = state.mode === "doro";
    pKL.hidden = !show;
    pEK.hidden = !show;
    if (!show) return;
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const half = Math.floor((width - 16 * (cols - 1)) / cols);
    const cur = { n: state.n, kl: fit.kl, ek: dp.mixMoments(state.n, fit.a, fit.b).mean };
    const path = pathCache ?? [];
    draw(pKL, {
      width: half, height: 200, marginLeft: 48,
      x: { domain: [0, N_MAX], label: "n" },
      y: { domain: [0, Math.max(cur.kl, ...path.map((d) => d.kl)) * 1.1], label: "KL(target || implied)", grid: true },
      marks: [
        P.line(path, { x: "n", y: "kl", stroke: c.methods.doro, strokeWidth: 2 }),
        P.dot(path, { x: "n", y: "kl", r: 2.5, fill: c.methods.doro }),
        P.dot([cur], { x: "n", y: "kl", r: 6, fill: c.accent, stroke: c.fg }),
      ],
    }, `The KL gap grows with n: ${path.length ? `${fmt(path[0].kl, 4)} at n = ${path[0].n} to ${fmt(path[path.length - 1].kl, 4)} at n = ${path[path.length - 1].n}` : "computing the path"}; at n = ${state.n}, ${fmt(fit.kl, 4)}.`);
    pKL.prepend(h("p", { class: "dpx-panel-title", text: "The best fit gets worse as n grows" }));
    const ref = [];
    for (let n = N_MIN; n <= N_MAX; n += PATH_STEP) ref.push({ n, half: n / 2, g11: dp.mixMoments(n, 1, 1).mean });
    draw(pEK, {
      width: half, height: 200, marginLeft: 48,
      x: { domain: [0, N_MAX], label: "n" },
      y: { domain: [0, N_MAX / 2 + 2], label: "E K_n", grid: true },
      marks: [
        P.line(ref, { x: "n", y: "half", stroke: c.muted, strokeDasharray: "6,4" }),
        P.line(ref, { x: "n", y: "g11", stroke: c.methods.vague, strokeWidth: 2 }),
        P.line(path, { x: "n", y: "ek", stroke: c.methods.doro, strokeWidth: 2 }),
        P.dot([cur], { x: "n", y: "ek", r: 6, fill: c.accent, stroke: c.fg }),
        P.text([ref[ref.length - 1]], { x: "n", y: "half", text: () => "n / 2", dy: -8, textAnchor: "end", fill: c.muted, fontSize: 11 }),
        P.text([ref[ref.length - 1]], { x: "n", y: "g11", text: () => "Gamma(1, 1)", dy: -8, textAnchor: "end", fill: c.fg, fontSize: 11 }),
      ],
    }, `E K_n under DORO follows n / 2 (${fmtCount(cur.ek)} at n = ${state.n}); a fixed Gamma(1, 1) grows like log n (${fmtCount(ref[ref.length - 1].g11)} at n = ${N_MAX}).`);
    pEK.prepend(h("p", { class: "dpx-panel-title", text: "DORO's count grows like n / 2, a fixed Gamma's like log n" }));
  };

  const render = () => {
    const t0 = performance.now();
    setCaption();
    const m = renderMain();
    renderSide();
    const ea = fit.a / fit.b;
    if (state.mode === "doro") {
      ui.readout.textContent = `n = ${state.n}: the KL-closest Gamma is ${fmtGamma(fit.a, fit.b)}, so E(alpha) = ${fmtAlpha(ea)} and E K_${state.n} = ${fmtCount(m.ek)} (n / 2 = ${fmt(state.n / 2, 1)}); P(K = 1) = ${fmtProb(m.pmf[1])}, Pr(W_SB > .5) = ${fmtProb(m.S50)}; KL = ${fmt(fit.kl, 4)}. As n grows, b goes to 0 and the gap widens.`;
    } else {
      ui.readout.textContent = `DORO-Unif, J = ${UNIF_J}, target flat on 1 to ${fit.top}: ${fmtGamma(fit.a, fit.b)} gives P(K = 1) = ${fmtProb(m.pmf[1])}, ${fmtProb(fit.leak)} of the mass beyond ${fit.top}, E K = ${fmtCount(m.ek)} and Pr(W_SB > .5) = ${fmtProb(m.S50)}; KL = ${fmt(fit.kl, 3)}.`;
    }
    ui.root.dataset.renderMs = (performance.now() - t0 + fit.ms).toFixed(1);
    ui.root.dataset.a = String(fit.a);
    ui.root.dataset.b = String(fit.b);
    ui.root.dataset.kl = String(fit.kl);
  };

  const sN = slider({ label: "n (units; target uniform on 1 to n)", min: N_MIN, max: N_MAX, step: 1, value: state.n, format: (v) => String(Math.round(v)),
    onInput: (v) => { const n = Math.round(v); if (n === state.n) return; state.n = n; solve(); render(); } });
  const sMu = segmented({ label: "DORO-Unif mu_K (target 1 to 2 mu_K - 1, J = 100)", options: MU_OPTIONS.map((m) => ({ value: m, label: String(m) })), value: state.mu,
    onChange: (v) => { state.mu = v; solve(); render(); } });
  const setMode = (m) => {
    state.mode = m;
    sN.root.hidden = m !== "doro";
    sMu.root.hidden = m !== "unif";
    solve();
    render();
  };
  const sMode = segmented({ label: "Target", options: [{ value: "doro", label: "DORO: flat on 1 to n" }, { value: "unif", label: "DORO-Unif: flat on 1 to 2 mu_K - 1" }], value: state.mode, onChange: setMode });
  ui.controls.append(sMode.root, sN.root, sMu.root);
  sN.root.hidden = state.mode !== "doro";
  sMu.root.hidden = state.mode !== "unif";
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  solve();
  render();
  ready = true;
  fillPath();
  return {
    update(next = {}) {
      if (next.n !== undefined) { state.n = Math.round(num(next, "n", state.n, N_MIN, N_MAX)); sN.set(state.n); }
      const p = String(next.preset ?? "");
      if (p.startsWith("unif")) { const mu = Number(p.slice(4)); if (MU_OPTIONS.includes(mu)) { state.mu = mu; sMu.set(mu); } sMode.set("unif"); setMode("unif"); return; }
      if (p === "doro") { sMode.set("doro"); setMode("doro"); return; }
      solve();
      render();
    },
    get fit() { return { ...fit }; },
    destroy() { destroyed = true; stop(); el.replaceChildren(); },
  };
}
