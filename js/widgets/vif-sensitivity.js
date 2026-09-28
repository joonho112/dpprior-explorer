// C-03 "VIF sensitivity (Table 2)": the same mean, four confidence levels. Owner of this file:
// Step 8.5.
//
// At J = 100 and mu_K = 5, the variance inflation factor sets sigma^2 = VIF (mu_K - 1): 1.25, 1.5,
// 2.5, 5 give sigma^2 = 5, 6, 10, 20. TSMM (dp-core tsmmFit) turns each into Gamma(a, b), from
// (7.13, 7.41) to (0.62, 0.56). The mean E(alpha) stays near 1, so Pr(W_SB > .5) moves little
// (.53 to .61); the variance of alpha grows, so the extreme tail Pr(W_SB > .9) (.15 to .36) and
// the mass near alpha = 0, Pr(alpha < .1) (0 to .18), move a lot. The three densities below come
// from the C-04 two-lenses widget (js/widgets/two-lenses.js), imported and driven through its
// spec; that file is not changed.
import * as dp from "../dp-core.js";
import { mountWidget as mountLenses } from "./two-lenses.js";
import { srTable } from "./chart.js";
import { frame, h, num, segmented, slider } from "./base.js";
import { fmt, fmtGamma, fmtProb } from "./format.js";

const J = 100;
const MU = 5;
const VIFS = [1.25, 1.5, 2.5, 5];
const VIF_MIN = 1.05;
const VIF_MAX = 8;

const fitFor = (vif) => {
  const v = vif * (MU - 1);
  const f = dp.tsmmFit(J, MU, v);
  return { vif, v, f, S5: dp.wsbTail(0.5, f.a, f.b), S9: dp.wsbTail(0.9, f.a, f.b), low: dp.prAlphaBelow(0.1, f.a, f.b) };
};

export function mountWidget(el, spec = {}) {
  const state = { vif: VIFS.includes(Number(spec.preset)) ? Number(spec.preset) : 2.5 };
  const ui = frame(el, { label: "VIF sensitivity: the same target mean with four levels of confidence", className: "dpx-vif" });
  const tiles = h("div", { class: "dpx-tiles", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const tableBox = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const lensHost = h("div", { class: "dpx-panel dpx-lens-host", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, tableBox, lensHost);
  ui.caption.textContent =
    "J = 100 units, target mean mu_K = 5, variance sigma^2 = VIF (mu_K - 1). The mean of alpha drives majority dominance, Pr(W_SB > .5); the variance of alpha drives extreme dominance, Pr(W_SB > .9), and the mass near alpha = 0. The lens panels below are the C-04 two-lenses widget driven by the calibrated (a, b).";
  const rows = VIFS.map(fitFor);
  const REF = { a: 1, b: 1 }; // the uncalibrated default Gamma(1, 1)
  const vm = dp.mixMoments(J, REF.a, REF.b);
  const vague = { S5: dp.wsbTail(0.5, REF.a, REF.b), S9: dp.wsbTail(0.9, REF.a, REF.b), low: dp.prAlphaBelow(0.1, REF.a, REF.b), ek: vm.mean, v: vm.var, mean: REF.a / REF.b };
  const tbl = h("table", { class: "dpx-parity" },
    h("thead", {}, h("tr", {}, ...["VIF", "sigma^2", "Gamma(a, b)", "E(alpha)", "Pr(W_SB > .5)", "Pr(W_SB > .9)", "Pr(alpha < .1)"].map((t) => h("th", { scope: "col", text: t })))),
    h("tbody", {},
      ...rows.map((r) => h("tr", { "data-vif": String(r.vif) },
        h("th", { scope: "row", text: String(r.vif) }), h("td", { text: fmt(r.v, 0) }), h("td", { class: "dpx-nowrap", text: fmtGamma(r.f.a, r.f.b, 2) }),
        h("td", { text: (r.f.a / r.f.b).toFixed(2) }), h("td", { text: fmtProb(r.S5) }), h("td", { text: fmtProb(r.S9) }), h("td", { text: fmtProb(r.low) }))),
      h("tr", {}, h("th", { scope: "row", text: "default" }), h("td", { text: `${fmt(vague.v, 1)} (implied)` }), h("td", { class: "dpx-nowrap", text: fmtGamma(REF.a, REF.b) }),
        h("td", { text: vague.mean.toFixed(2) }), h("td", { text: fmtProb(vague.S5) }), h("td", { text: fmtProb(vague.S9) }), h("td", { text: fmtProb(vague.low) }))));
  tableBox.append(h("p", { class: "dpx-panel-title", text: "Table 2 of the paper, recomputed: J = 100, mu_K = 5" }), h("div", { class: "dpx-table-scroll", tabindex: 0, role: "region", "aria-label": "Table 2 (scrolls sideways on narrow screens)" }, tbl),
    h("p", { class: "dpx-row-note", text: `Last row: the uncalibrated default Gamma(1, 1), for reference. At J = 100 it implies E K = ${fmt(vague.ek, 2)} and Var K = ${fmt(vague.v, 1)} (VIF ${fmt(vague.v / (vague.ek - 1), 2)}).` }));
  const lensEl = h("div");
  lensHost.append(h("p", { class: "dpx-panel-title", text: "The calibrated prior in both lenses (C-04)" }), lensEl);
  let cur = fitFor(state.vif);
  const lenses = mountLenses(lensEl, { a: cur.f.a, b: cur.f.b, J });

  const tile = (title, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: title }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);
  const render = () => {
    const t0 = performance.now();
    cur = fitFor(state.vif);
    const f = cur.f;
    tiles.replaceChildren(
      tile(`VIF ${fmt(state.vif, 2)}: sigma^2 = ${fmt(cur.v, 2)}`, fmtGamma(f.a, f.b, 3), `E(alpha) = ${fmt(f.a / f.b, 2)}, CV(alpha) = ${fmt(1 / Math.sqrt(f.a), 2)}`),
      tile("majority dominance Pr(W_SB > .5)", fmtProb(cur.S5), "moves with the mean of alpha"),
      tile("extreme dominance Pr(W_SB > .9)", fmtProb(cur.S9), "moves with the variance of alpha"),
      tile("mass near 0: Pr(alpha < .1)", fmtProb(cur.low), "the collapse-prone part of the prior"),
    );
    tbl.querySelectorAll("tr[data-vif]").forEach((tr) => tr.classList.toggle("dpx-row-current", Math.abs(Number(tr.dataset.vif) - state.vif) < 1e-9));
    lenses.update({ a: f.a, b: f.b, J });
    ui.readout.textContent = `VIF ${fmt(state.vif, 2)} (sigma^2 = ${fmt(cur.v, 2)}): ${fmtGamma(f.a, f.b, 3)}; Pr(W_SB > .5) = ${fmtProb(cur.S5)}, Pr(W_SB > .9) = ${fmtProb(cur.S9)}, Pr(alpha < .1) = ${fmtProb(cur.low)}. From VIF 1.25 to 5 the first moves ${fmtProb(rows[0].S5)} to ${fmtProb(rows[3].S5)}, the second ${fmtProb(rows[0].S9)} to ${fmtProb(rows[3].S9)}.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };
  const sSeg = segmented({ label: "VIF (Table 2)", options: VIFS.map((v) => ({ value: v, label: String(v) })), value: VIFS.includes(state.vif) ? state.vif : null,
    onChange: (v) => { state.vif = v; sVif.set(v); render(); } });
  const sVif = slider({ label: "VIF (any value)", min: VIF_MIN, max: VIF_MAX, value: state.vif, log: true, format: (v) => fmt(v, 2), onInput: (v) => { state.vif = v; sSeg.set(VIFS.find((x) => Math.abs(x - v) < 1e-9) ?? null); render(); } });
  ui.controls.append(sSeg.root, sVif.root);
  ui.charts.append(srTable("Table 2 recomputed", ["VIF", "sigma^2", "a", "b", "Pr(W_SB > .5)", "Pr(W_SB > .9)", "Pr(alpha < .1)"], [...rows.map((r) => [r.vif, fmt(r.v, 0), fmt(r.f.a, 3), fmt(r.f.b, 3), fmtProb(r.S5), fmtProb(r.S9), fmtProb(r.low)]),
    ["default Gamma(1, 1)", `${fmt(vague.v, 1)} (implied)`, 1, 1, fmtProb(vague.S5), fmtProb(vague.S9), fmtProb(vague.low)]]));
  render();
  return {
    update(next = {}) {
      if (next.preset !== undefined && VIFS.includes(Number(next.preset))) { state.vif = Number(next.preset); sVif.set(state.vif); sSeg.set(state.vif); }
      if (next.vif !== undefined) { state.vif = num(next, "vif", state.vif, VIF_MIN, VIF_MAX); sVif.set(state.vif); sSeg.set(VIFS.includes(state.vif) ? state.vif : null); }
      render();
    },
    get rows() { return rows.map((r) => ({ vif: r.vif, a: r.f.a, b: r.f.b, S5: r.S5, S9: r.S9, low: r.low })); },
    destroy() { lenses.destroy(); el.replaceChildren(); },
  };
}
