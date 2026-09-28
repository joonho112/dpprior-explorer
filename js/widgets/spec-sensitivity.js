// A-12 "The specification matters too" (paper Figure 7 layout). Owner of this file: Step 9.10.
//
// The Figure 7 summaries of an application (Project STAR or Bangert-Drowns) under the five priors
// (Vague, DORO-Unif as external reference, TSMM, Dual-Anchor, the hard bound as sensitivity only):
// E(K_J | y) with its 95% interval, the largest observed allocation share and the largest population
// atom weight (with a .5 guide; the two are distinct estimands and are not merged). The
// specification toggle replaces the primary scale-aligned fits with (a) the joint wide-scale
// sensitivity (grand-mean prior N(0, 100); both applications) or (b) the schoolwise OLS/HC3
// uncertainty input (STAR only); the primary values stay as grey rings with a connector, and the
// tiles and caption report the change: the structural summaries and the unit posterior means (RMS
// shift, intervals excluding zero, changed decisions). Everything is read from app_sensitivity.json.
import sens from "../../data/released/app_sensitivity.js";
import appPriors from "../../data/released/app_priors.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const PRIORS = ["Vague", "DORO-Unif", "TSMM", "Dual-Anchor", "Dual-Anchor (hard)"];
const TOKEN = { Vague: "vague", "DORO-Unif": "doro", TSMM: "tsmm", "Dual-Anchor": "da", "Dual-Anchor (hard)": "hard" };
const LABEL = { "DORO-Unif": "DORO-Unif (external reference)", "Dual-Anchor (hard)": "hard bound (sensitivity only)" };
const SHORT = { "Dual-Anchor (hard)": "hard bound" }; // narrow screens
// J (the number of units) is read from the released rows
const APPS = Object.fromEntries([["star", { key: "STAR", name: "Project STAR", units: "schools" }], ["bd", { key: "Bangert-Drowns", name: "Bangert-Drowns", units: "studies" }]]
  .map(([app, a]) => [app, { ...a, J: sens.find((r) => r.app === app).units }]));
const SPECS = { primary: "primary (scale-aligned)", wide_scale: "wide scale, N(0, 100)", hc3: "OLS/HC3 input (STAR)" };

export function mountWidget(el, spec = {}) {
  const state = { app: APPS[spec.app] ? spec.app : "star", spec: SPECS[spec.preset] ? spec.preset : "primary" };
  if (state.app === "bd" && state.spec === "hc3") state.spec = "primary";
  const ui = frame(el, { label: "Specification sensitivity: the Figure 7 summaries under the primary fits, the wide-scale grand-mean prior and the HC3 input", className: "dpx-spec" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const panels = h("div", { class: "dpx-spec-panels", style: "grid-column: 1 / -1" });
  const tbl = h("div", { style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, panels, tbl);
  let width = ui.charts.getBoundingClientRect().width || 720; // real width first: the panel grid uses pixel columns

  // rows for the current application: the primary values come from any comparison row (identical)
  const rowsFor = (app, sp) => PRIORS.map((p) => {
    const r = sens.find((x) => x.app === app && x.prior === p && x.spec === (sp === "primary" ? "wide_scale" : sp));
    const pick = (side) => ({ EK: r[`${side}_E_K`], lo: r[`${side}_q025_K`], hi: r[`${side}_q975_K`], p1: r[`${side}_p_K1`], share: r[`${side}_observed_largest_share`], atom: r[`${side}_population_largest_atom_weight`], excl: r[`${side}_intervals_excluding_zero`] });
    return { prior: p, label: LABEL[p] ?? p, ref: pick("ref"), cur: sp === "primary" ? pick("ref") : pick("sens"), rms: sp === "primary" ? 0 : r.rms_unit_shift, maxShift: sp === "primary" ? 0 : r.max_abs_unit_shift, changed: sp === "primary" ? 0 : r.interval_decisions_changed, admitted: r.admitted, fits: r.fits };
  });

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const A = APPS[state.app];
    const rows = rowsFor(state.app, state.spec);
    const moved = state.spec !== "primary";
    const col = (p) => c.methods[TOKEN[p]];
    const da = rows.find((r) => r.prior === "Dual-Anchor");
    const priorRms = appPriors.find((r) => r.app === A.key && r.prior === "Dual-Anchor").rms_unit_shift_from_vague;
    const rmsLo = Math.min(...rows.map((r) => r.rms));
    const rmsHi = Math.max(...rows.map((r) => r.rms));
    const chLo = Math.min(...rows.map((r) => r.changed));
    const chHi = Math.max(...rows.map((r) => r.changed));
    const ratio = moved ? [rmsLo / priorRms, rmsHi / priorRms] : null;
    const arrow = (a, b, f) => (moved ? `${f(a)} → ${f(b)}` : f(a));
    tiles.replaceChildren(
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `Dual-Anchor, ${A.name}: posterior mean K_J` }), h("p", { class: "dpx-tile-big", text: arrow(da.ref.EK, da.cur.EK, fmtCount) }), h("p", { class: "dpx-tile-note", text: moved ? `95% interval [${da.ref.lo}, ${da.ref.hi}] → [${da.cur.lo}, ${da.cur.hi}]` : `95% interval [${da.ref.lo}, ${da.ref.hi}]; pick a specification to compare` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "Dual-Anchor: collapse Pr(K_J = 1 | y)" }), h("p", { class: "dpx-tile-big", text: arrow(da.ref.p1, da.cur.p1, fmtProb) }), h("p", { class: "dpx-tile-note", text: `largest atom ${arrow(da.ref.atom, da.cur.atom, fmtProb)}` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "Unit posterior means: RMS change from the primary fit" }), h("p", { class: "dpx-tile-big", text: moved ? `${fmt(rmsLo, 3)} to ${fmt(rmsHi, 3)}` : "0" }), h("p", { class: "dpx-tile-note", text: moved ? (ratio[0] >= 2 ? `about ${Math.round(ratio[0])} to ${Math.round(ratio[1])} times the Dual-Anchor vs Vague difference (${fmt(priorRms, 4)})` : `smaller than the Dual-Anchor vs Vague difference (${fmt(priorRms, 4)})`) : `for comparison, Dual-Anchor vs Vague: ${fmt(priorRms, 4)}` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `95% unit intervals excluding 0 (Dual-Anchor, of ${A.J})` }), h("p", { class: "dpx-tile-big", text: arrow(da.ref.excl, da.cur.excl, String) }), h("p", { class: "dpx-tile-note", text: moved ? `${chLo === chHi ? chLo : `${chLo} to ${chHi}`} decisions change across the five priors` : `under Vague: ${rows[0].ref.excl}` })),
    );

    // three Figure 7 panels, one Plot each (they have different x scales), sharing the prior order
    const w = Math.max(240, Math.floor((Math.min(width, 900) - 24) / (width > 700 ? 3 : 1)));
    const wide = width > 700;
    const ylab = (p) => (wide ? LABEL[p] ?? p : SHORT[p] ?? p);
    const y = { domain: PRIORS.map(ylab), label: null };
    const ml = wide ? 0 : 96;
    const panel = (title, key, dom, withCI, guide, fmtV, xLabel) => {
      const box = h("div", { class: "dpx-panel" });
      const data = rows.map((r) => ({ ...r, label: ylab(r.prior), a: r.ref[key], b: r.cur[key], alo: r.ref.lo, ahi: r.ref.hi, blo: r.cur.lo, bhi: r.cur.hi }));
      draw(box, {
        width: w, height: 250, marginLeft: ml || (key === "EK" ? 196 : 12), marginRight: 16, marginBottom: 38,
        x: { domain: dom, label: xLabel, labelOffset: 30, grid: true, ...(key === "EK" ? {} : { ticks: [0, 0.25, 0.5, 0.75, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 2)) }) },
        y: { ...y, axis: key === "EK" || ml ? "left" : null },
        marks: [
          ...(guide ? [P.ruleX([guide], { stroke: c.muted, strokeDasharray: "3,3" })] : []),
          ...(withCI && moved ? [P.ruleY(data, { y: "label", x1: "alo", x2: "ahi", stroke: c.faint, strokeWidth: 5, strokeOpacity: 0.55 })] : []),
          ...(withCI ? [P.ruleY(data, { y: "label", x1: "blo", x2: "bhi", stroke: (d) => col(d.prior), strokeWidth: 2 })] : []),
          ...(moved ? [P.link(data, { x1: "a", x2: "b", y1: "label", y2: "label", stroke: c.fg, strokeWidth: 1.2, markerEnd: "arrow" }), P.dot(data, { x: "a", y: "label", r: 5, stroke: c.muted, strokeWidth: 1.5, fill: "none" })] : []),
          P.dot(data, { x: "b", y: "label", r: 5, fill: (d) => col(d.prior), stroke: c.fg, strokeWidth: 0.7, title: (d) => `${d.label}: ${moved ? `${fmtV(d.a)} → ${fmtV(d.b)}` : fmtV(d.b)}${withCI ? ` [${d.blo}, ${d.bhi}]` : ""}` }),
        ],
      }, `${title} under each prior, ${A.name}, ${SPECS[state.spec]}: ${data.map((d) => `${d.label} ${moved ? `${fmtV(d.a)} → ` : ""}${fmtV(d.b)}`).join(", ")}.`);
      box.prepend(h("p", { class: "dpx-panel-title", text: title }));
      return box;
    };
    const kMax = Math.max(...rows.flatMap((r) => [r.ref.hi, r.cur.hi])) + 1;
    panels.replaceChildren(
      panel("A. posterior mean K_J and 95% interval", "EK", [0, kMax], true, null, fmtCount, "K_J"),
      panel("B. largest observed allocation share", "share", [0, 1], false, 0.5, fmtProb, "share of the J units"),
      panel("C. largest population atom weight", "atom", [0, 1], false, 0.5, fmtProb, "population weight"),
    );
    panels.style.display = "grid";
    panels.style.gridTemplateColumns = width > 700 ? `repeat(3, ${w}px)` : "1fr";
    panels.style.gap = "12px";

    const note = state.spec === "hc3"
      ? `Schoolwise OLS/HC3 uncertainty input instead of the multilevel primary input (STAR only). This is a specification sensitivity, not a robustness confirmation: the unit posterior means move by RMS ${fmt(rmsLo, 3)} to ${fmt(rmsHi, 3)} and ${da.cur.excl} of ${A.J} intervals exclude zero.`
      : state.spec === "wide_scale"
        ? `Joint wide-scale sensitivity (grand-mean prior N(0, 100) with the matching scale): the structural summaries move (Dual-Anchor ${fmtCount(da.ref.EK)} → ${fmtCount(da.cur.EK)}, collapse ${fmtProb(da.ref.p1)} → ${fmtProb(da.cur.p1)}), the unit means much less.`
        : "Primary scale-aligned fits, as in the paper's Figure 7.";
    ui.caption.textContent = `${A.name}, J = ${A.J} ${A.units}; ${SPECS[state.spec]}. ${note} Grey rings: the primary fit. DORO-Unif is an external reference and the hard bound is a sensitivity only. The replication package admits ${Math.min(...rows.map((r) => r.admitted))} of its ${rows[0].fits} application fits after the diagnostics. ${captionFor(["read", "kj"])}`;
    ui.readout.textContent = `${A.name}, ${SPECS[state.spec]}: ${rows.map((r) => `${r.label} E K_J ${moved ? `${fmtCount(r.ref.EK)} → ` : ""}${fmtCount(r.cur.EK)}, collapse ${moved ? `${fmtProb(r.ref.p1)} → ` : ""}${fmtProb(r.cur.p1)}`).join("; ")}.${moved ? ` Unit means: RMS change ${fmt(rmsLo, 3)} to ${fmt(rmsHi, 3)}.` : ""}`;
    tbl.replaceChildren(srTable(`${A.name}, ${SPECS[state.spec]}: Figure 7 summaries by prior`, ["prior", "E K_J [95%]", "collapse", "largest observed share", "largest atom", "RMS unit change", "intervals excluding 0", "changed decisions"],
      rows.map((r) => [r.label, `${fmtCount(r.cur.EK)} [${r.cur.lo}, ${r.cur.hi}]`, fmtProb(r.cur.p1), fmtProb(r.cur.share), fmtProb(r.cur.atom), moved ? fmt(r.rms, 4) : "0", r.cur.excl, r.changed])));
    ui.root.dataset.spec = state.spec;
    // the HC3 input exists for STAR only
    sSpec.root.querySelectorAll("button").forEach((b) => {
      const off = state.app === "bd" && b.textContent === SPECS.hc3;
      b.disabled = off;
      b.title = off ? "The OLS/HC3 input exists for Project STAR only" : "";
    });
  };

  const sApp = segmented({ label: "Application", options: Object.entries(APPS).map(([value, a]) => ({ value, label: `${a.name} (${a.J} ${a.units})` })), value: state.app, onChange: (v) => { state.app = v; if (v === "bd" && state.spec === "hc3") { state.spec = "primary"; sSpec.set("primary"); } render(); } });
  const sSpec = segmented({ label: "Specification", options: Object.entries(SPECS).map(([value, label]) => ({ value, label })), value: state.spec, onChange: (v) => { state.spec = v; render(); } });
  ui.controls.append(sApp.root, sSpec.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (APPS[next.app]) { state.app = next.app; sApp.set(next.app); }
      if (SPECS[next.preset] && !(state.app === "bd" && next.preset === "hc3")) { state.spec = next.preset; sSpec.set(next.preset); }
      render();
    },
    rows() { return rowsFor(state.app, state.spec); },
    destroy() { stop(); el.replaceChildren(); },
  };
}
