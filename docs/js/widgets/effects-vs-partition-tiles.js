// A-07 "The effects do not move; the partition does". Owner of this file: Step 9.7.
//
// One simulation cell at a time, two panels side by side: the RMSE of the site effects under each
// prior (nearly equal) and the collapse rate Pr(K_J = 1 | y) or the posterior mean of K_J (far
// apart). Three data modes, all read from the released tables: the headline cells
// (headline_primary.json), unequal cluster weights with a dominant share of .6
// (unequal_weights.json, two suites), and fixed lambda for the Dual-Anchor prior (fixed_lambda.json:
// the selected lambda and lambda = .5 and .9). Nothing is recomputed.
import headline from "../../data/released/headline_primary.js";
import unequal from "../../data/released/unequal_weights.js";
import fixed from "../../data/released/fixed_lambda.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const TOKEN = { Vague: "vague", "DORO-Unif": "doro", TSMM: "tsmm", "Dual-Anchor": "da", "SSI-Weight": "ssi" };
const ORDER = Object.keys(TOKEN);
// the two unequal-weights suites differ only in where the dominant cluster sits (the replication
// package's dominant_location_mode: "central" and "balanced_random", which rotates the dominant
// component across the ordered component means)
const SUITE = { central_dominant: "dominant cluster in the centre", fallback: "dominant cluster rotated across locations" };
const GM = (v) => `N(0, ${v >= 1 ? String(v) : fmt(v, 2)})`;

export function mountWidget(el, spec = {}) {
  const MODES = {
    main: { label: "equal weights (headline)", rows: headline },
    unequal: { label: "unequal weights (dominant share .6)", rows: unequal },
    fixed: { label: "fixed lambda (Dual-Anchor)", rows: fixed },
  };
  const state = { mode: MODES[spec.preset] ? spec.preset : "main", K: 5, I: 0.2, right: "collapse", suite: "central_dominant" };
  const ui = frame(el, { label: "Effects versus partition: the RMSE of the site effects against the collapse rate or the number of clusters", className: "dpx-evp" });
  const tiles = h("div", { class: "dpx-tiles", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pL = h("div", { class: "dpx-panel" });
  const pR = h("div", { class: "dpx-panel" });
  const tbl = h("div", { style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, pL, pR, tbl);
  let width = 720;

  const rowsNow = () => {
    const src = MODES[state.mode].rows;
    let rows = src.filter((r) => r.K_true === state.K && r.I_target === state.I);
    if (state.mode === "unequal") rows = rows.filter((r) => r.suite === state.suite);
    if (state.mode === "fixed") return rows.map((r) => ({ ...r, lam: r.dual_lambda ?? r.selected_lambda, key: r.dual_lambda == null ? `lambda = ${fmt(r.selected_lambda, 2)} (selected)` : `lambda = ${fmt(r.dual_lambda, 2)}` })).sort((p, q) => p.lam - q.lam);
    return rows.map((r) => ({ ...r, key: r.prior })).sort((p, q) => ORDER.indexOf(p.prior) - ORDER.indexOf(q.prior));
  };
  const cellsAvail = () => {
    const src = MODES[state.mode].rows.filter((r) => state.mode !== "unequal" || r.suite === state.suite);
    return [...new Set(src.map((r) => `${r.K_true}|${r.I_target}`))].map((k) => k.split("|").map(Number));
  };

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const avail = cellsAvail();
    if (!avail.some(([K, I]) => K === state.K && I === state.I)) [state.K, state.I] = avail[0];
    const rows = rowsNow();
    const rm = rows.map((r) => r.mean_tau_rmse);
    const right = state.right === "collapse" ? { col: "mean_p_K1", label: "collapse Pr(K_J = 1 | y)", fmt: fmtProb } : { col: "mean_E_K", label: "posterior mean K_J", fmt: fmtCount };
    const rv = rows.map((r) => r[right.col]);
    const colFor = (r) => (state.mode === "fixed" ? c.methods.da : c.methods[TOKEN[r.prior]] ?? c.slate);
    ui.caption.textContent = `${MODES[state.mode].label}; cell K* = ${state.K}, I = ${fmt(state.I, 1)}; J = ${rows[0].J}, grand-mean prior ${GM(rows[0].grand_mean_variance)}${state.mode === "unequal" ? `, ${SUITE[state.suite]}` : ""}. ${captionFor(["read", "kj"])} ${state.mode === "main" ? captionFor(["retained"]) : ""}`;
    tiles.replaceChildren(
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "RMSE of the site effects" }), h("p", { class: "dpx-tile-big", text: `${fmt(Math.min(...rm), 3)} to ${fmt(Math.max(...rm), 3)}` }), h("p", { class: "dpx-tile-note", text: `a spread of ${fmt(Math.max(...rm) - Math.min(...rm), 4)} across ${rows.length} ${state.mode === "fixed" ? "lambdas" : "priors"}` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: right.label }), h("p", { class: "dpx-tile-big", text: `${right.fmt(Math.min(...rv))} to ${right.fmt(Math.max(...rv))}` }), h("p", { class: "dpx-tile-note", text: "the partition moves with the prior" })),
    );
    const w = Math.max(280, Math.floor((width - 16) / (width > 680 ? 2 : 1)));
    const bar = (panel, col, label, f, domainMax, title) => {
      draw(panel, {
        width: w, height: 44 + 34 * rows.length, marginLeft: Math.min(170, 16 + 6.4 * Math.max(...rows.map((r) => r.key.length))), marginRight: 60, marginBottom: 38,
        x: { domain: [0, domainMax], label, labelOffset: 32, grid: true, tickFormat: (d) => (Number.isInteger(d) ? String(d) : fmt(d, 2)) },
        y: { domain: rows.map((r) => r.key), label: null },
        marks: [
          P.barX(rows, { x1: 0, x2: col, y: "key", fill: (r) => colFor(r), fillOpacity: 0.85, insetTop: 5, insetBottom: 5 }),
          P.text(rows, { x: col, y: "key", text: (r) => f(r[col]), dx: 5, textAnchor: "start", fill: c.fg, fontSize: 11, fontWeight: 600 }),
        ],
      }, `${label} under each ${state.mode === "fixed" ? "lambda" : "prior"}: ${rows.map((r) => `${r.key} ${f(r[col])}`).join(", ")}.`);
      panel.prepend(h("p", { class: "dpx-panel-title", text: title }));
    };
    bar(pL, "mean_tau_rmse", "RMSE of the site effects", (x) => fmt(x, 4), Math.max(...rm) * 1.25, `The effects: the same RMSE under every ${state.mode === "fixed" ? "lambda" : "prior"}`);
    bar(pR, right.col, right.label, right.fmt, state.right === "collapse" ? 1 : Math.max(...rv) * 1.25, state.right === "collapse" ? "The partition: collapse to one cluster" : "The partition: the number of clusters");
    tbl.replaceChildren(srTable(`Effects and partition, ${MODES[state.mode].label}, K* = ${state.K}, I = ${fmt(state.I, 1)}`, [state.mode === "fixed" ? "lambda" : "prior", "RMSE", "collapse", "E K"], rows.map((r) => [r.key, fmt(r.mean_tau_rmse, 4), fmtProb(r.mean_p_K1), fmtCount(r.mean_E_K)])));
    ui.readout.textContent = `${MODES[state.mode].label}, K* = ${state.K}, I = ${fmt(state.I, 1)}: RMSE ${fmt(Math.min(...rm), 4)} to ${fmt(Math.max(...rm), 4)} (spread ${fmt(Math.max(...rm) - Math.min(...rm), 4)}), while ${right.label} runs from ${right.fmt(Math.min(...rv))} to ${right.fmt(Math.max(...rv))}.`;
    ui.root.dataset.rmseSpread = String(Math.max(...rm) - Math.min(...rm));
    sCell.root.replaceWith(makeCell());
  };

  const sMode = segmented({ label: "Data", options: Object.entries(MODES).map(([value, v]) => ({ value, label: v.label })), value: state.mode, onChange: (v) => { state.mode = v; render(); } });
  const sRight = segmented({ label: "Partition shown as", options: [{ value: "collapse", label: "collapse" }, { value: "EK", label: "E K_J" }], value: state.right, onChange: (v) => { state.right = v; render(); } });
  const sSuite = segmented({ label: "Dominant cluster", options: Object.entries(SUITE).map(([value, label]) => ({ value, label })), value: state.suite, onChange: (v) => { state.suite = v; render(); } });
  let sCell = { root: h("span") };
  const makeCell = () => {
    const opts = cellsAvail().map(([K, I]) => ({ value: `${K}|${I}`, label: `K* = ${K}, I = ${fmt(I, 1)}` }));
    sCell = segmented({ label: "Cell", options: opts, value: `${state.K}|${state.I}`, onChange: (v) => { [state.K, state.I] = v.split("|").map(Number); render(); } });
    sSuite.root.hidden = state.mode !== "unequal";
    return sCell.root;
  };
  ui.controls.append(sMode.root, sRight.root, sSuite.root, sCell.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) { if (MODES[next.preset]) { state.mode = next.preset; sMode.set(next.preset); } if (next.K) state.K = Number(next.K); if (next.I) state.I = Number(next.I); render(); },
    get rows() { return rowsNow().map((r) => ({ key: r.key, rmse: r.mean_tau_rmse, collapse: r.mean_p_K1, EK: r.mean_E_K })); },
    destroy() { stop(); el.replaceChildren(); },
  };
}
