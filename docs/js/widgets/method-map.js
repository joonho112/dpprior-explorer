// M-15 "The method map: (E K_J, Pr(W_SB > .5)) for every catalog prior". Owner of this file:
// Step 7.12.
//
// Every record of method_catalog.json is placed by its expected count at the chosen J (x, log
// scale, recomputed with dp-core; R values for the non-Gamma Jeffreys and Stirling-gamma records)
// and its majority-mass probability Pr(W_SB > .5) (y, J-free for fixed (a, b)). The shaded box is
// what the vocabulary target asks for (E K_J between 2 and 10) with the Dual-Anchor weight bound
// (Pr(W_SB > .5) <= .40); the dashed line is the hard bound .25. Moving J slides every point
// sideways (E K_J grows like E(alpha) log J) and none up or down. Hover or pick a prior to open
// its strip: the pmf of K_J, the W_SB density and a link that sends (a, b, J) to the M-07
// dashboard. TSMM and Dual-Anchor are the paper's J = 100 calibrations, kept fixed across J.
import * as dp from "../dp-core.js";
import mc from "../../data/precomputed/method_catalog.js";
import { dodge, draw, logTickLabels, palette, recordColor, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented, select, toggle } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const J_SET = mc.J_set; // 50, 100, 500
const X_MIN = 1;
const X_MAX = 200;
const X_TICKS = [1, 2, 5, 10, 20, 50, 100, 200];
const BOX = { x1: 2, x2: 10, y: 0.4 }; // "about 5, between 2 and 10" and the soft weight bound
const HARD = 0.25;
const HEADLINE = {
  vague: "Vague Gamma(1, 1)", gamma_2_4: "Gamma(2, 4)", doro_unif_mu5_J100: "DORO-Unif", scal_published_m100: "SCAL",
  ssi_weight: "SSI-Weight", tsmm_J100: "TSMM", dual_anchor_J100: "Dual-Anchor",
};
const M07_RANGE = [0.01, 50]; // the M-07 dashboard's (a, b) slider range
const M07_J = [50, 100, 500];
const CELL_MIN = 336;
const NARROW = 560; // below this width the box label is shortened

/** Position of a record at J: Gamma and fixed alpha by dp-core, the rest from R. */
function place(rec, J) {
  if (rec.gamma) return { x: dp.mixMoments(J, rec.a, rec.b).mean, y: dp.wsbTail(0.5, rec.a, rec.b), live: true };
  if (rec.prior?.type === "point") return { x: dp.condMean(J, rec.prior.alpha), y: dp.wsbTailGivenAlpha(0.5, rec.prior.alpha), live: true };
  return { x: rec.E_K[J], y: rec.S50, live: false };
}

/** Site root from the bundle's own URL, so links work on pages, embeds and file://. */
function siteRoot() {
  const s = typeof document !== "undefined" ? document.querySelector('script[src*="bundles/method-map"]') : null;
  return s ? s.src.replace(/js\/bundles\/method-map\.js.*$/, "") : "";
}

export function mountWidget(el, spec = {}) {
  const state = {
    J: J_SET.includes(Number(spec.J)) ? Number(spec.J) : 100,
    all: spec.preset !== "headline",
    pick: mc.records.some((r) => r.id === spec.preset) ? spec.preset : "dual_anchor_J100",
  };
  const ui = frame(el, { label: "Method map: expected number of clusters against the majority-mass probability for every catalog prior", className: "dpx-map" });
  const pMap = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pStrip = h("div", { class: "dpx-panel dpx-tile", style: "grid-column: 1 / -1", "aria-live": "polite" });
  ui.charts.append(pMap, pStrip);
  ui.caption.textContent =
    "Each point is one prior of the method catalog at the chosen J: x is E K_J, the expected number of fitted components among the J units (log scale), y is Pr(W_SB > .5), the chance that a randomly chosen unit sits in a cluster holding more than half the units. Shaded: E K_J between 2 and 10 with Pr(W_SB > .5) at most .40; dashed: the hard bound .25. Hollow points are not Gamma priors (values from R). TSMM and Dual-Anchor are the paper's J = 100 calibrations.";
  const root = siteRoot();
  let width = 720;
  let fig = null;

  const points = () => mc.records.filter((r) => state.all || HEADLINE[r.id]).map((r) => ({ rec: r, id: r.id, label: HEADLINE[r.id] ?? r.label, head: Boolean(HEADLINE[r.id]), ...place(r, state.J) }));

  const renderStrip = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const rec = mc.records.find((r) => r.id === state.pick);
    const pos = place(rec, state.J);
    const cols = Math.min(2, Math.max(1, Math.floor((width - 24 + 16) / CELL_MIN)));
    const w = Math.floor((width - 24 - 16 * (cols - 1)) / cols);
    const pmfBox = h("div", { class: "dpx-panel" });
    const wBox = h("div", { class: "dpx-panel" });
    const grid = h("div", { class: "dpx-charts" }, pmfBox, wBox);
    const col = recordColor(rec, c);
    if (rec.gamma && state.J <= dp.LIVE_J_MAX) {
      const pmf = dp.mixPmf(state.J, rec.a, rec.b);
      const s = dp.pmfSummary(pmf);
      const kmax = Math.min(state.J, Math.max(12, s.q95 + 3));
      const bars = Array.from({ length: kmax }, (_, i) => ({ k: i + 1, p: pmf[i + 1] }));
      draw(pmfBox, {
        width: w, height: 170, marginLeft: 44,
        x: { domain: [0.5, kmax + 0.5], label: `k (clusters among J = ${state.J})` },
        y: { label: "probability", grid: true },
        marks: [P.rectY(bars, { x1: (d) => d.k - 0.4, x2: (d) => d.k + 0.4, y: "p", fill: col, fillOpacity: 0.85 }), P.ruleY([0], { stroke: c.borderStrong })],
      }, `pmf of K_${state.J} under ${rec.label}: P(K = 1) = ${fmtProb(pmf[1])}, 90% interval [${s.q05}, ${s.q95}].`);
      pmfBox.prepend(h("p", { class: "dpx-panel-title", text: `Count: K_${state.J}` }));
      const ws = Array.from({ length: 121 }, (_, i) => { const x = (i / 120) * dp.W_DENSITY_MAX; return { w: x, f: dp.wsbDensity(x, rec.a, rec.b) }; });
      const top = Math.min(6, Math.max(...ws.map((d) => d.f)) * 1.1);
      draw(wBox, {
        width: w, height: 170, marginLeft: 44,
        x: { domain: [0, 1], label: "W_SB" },
        y: { domain: [0, top], label: "density", grid: true },
        marks: [
          P.areaY(ws.filter((d) => d.w >= 0.5), { x: "w", y: (d) => Math.min(d.f, top), fill: col, fillOpacity: 0.3 }),
          P.line(ws, { x: "w", y: (d) => Math.min(d.f, top), stroke: col, strokeWidth: 2 }),
          P.ruleX([0.5], { stroke: c.muted, strokeDasharray: "3,3" }),
        ],
      }, `W_SB density of ${rec.label}: Pr(W_SB > .5) = ${fmtProb(pos.y)} (shaded).`);
      wBox.prepend(h("p", { class: "dpx-panel-title", text: "Weights: W_SB" }));
    } else {
      pmfBox.append(h("p", { class: "dpx-tile-note", text: rec.gamma ? `The pmf is drawn for J <= ${dp.LIVE_J_MAX}.` : "Not a Gamma prior: the pmf and density at this J come from R and are shown on the objective-priors and Stirling-gamma pages." }));
    }
    const inRange = rec.gamma && rec.a >= M07_RANGE[0] && rec.a <= M07_RANGE[1] && rec.b >= M07_RANGE[0] && rec.b <= M07_RANGE[1];
    const link = inRange && M07_J.includes(state.J)
      ? h("a", { href: `${root}pages/bridge/gamma11.html?a=${rec.a}&b=${rec.b}&J=${state.J}`, text: `Open ${fmtGamma(rec.a, rec.b)} at J = ${state.J} in the dashboard (M-07)` })
      : h("span", { class: "dpx-tile-note", text: rec.gamma ? "(a, b) outside the dashboard's slider range (0.01 to 50)" : "" });
    pStrip.replaceChildren(
      h("p", { class: "dpx-card-id" }, h("span", { text: rec.family }), rec.label),
      h("p", { class: "dpx-tile-big", text: `${rec.gamma ? fmtGamma(rec.a, rec.b) : "not a Gamma"}: E K_${state.J} = ${fmtCount(pos.x)}, Pr(W_SB > .5) = ${fmtProb(pos.y)}` }),
      h("p", { text: rec.one_line_error }),
      grid,
      h("p", { class: "dpx-card-links" }, link),
      h("p", { class: "dpx-tile-note", text: `Source: ${rec.source}${rec.via ? ` (via ${rec.via})` : ""}.` }),
    );
  };

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const pts = points();
    const H = 380;
    const plotH = H - 70;
    const heads = pts.filter((d) => d.head);
    const labels = dodge(heads.map((d) => ({ ...d, lx: Math.min(X_MAX * 0.7, d.x * 1.9) })), "y", 13 / plotH);
    const inBox = pts.filter((d) => d.x >= BOX.x1 && d.x <= BOX.x2 && d.y <= BOX.y);
    fig = draw(pMap, {
      width, height: H, marginLeft: 48, marginRight: 16, marginBottom: 44,
      x: { type: "log", domain: [X_MIN, X_MAX], label: `E K_${state.J} (expected clusters, log scale)`, ticks: X_TICKS, tickFormat: () => "", labelOffset: 38 },
      y: { domain: [0, 1], label: "Pr(W_SB > .5)", grid: true },
      marks: [
        P.rect([BOX], { x1: "x1", x2: "x2", y1: 0, y2: "y", fill: c.accent, fillOpacity: 0.1, stroke: c.accent, strokeOpacity: 0.5 }),
        P.text([{ x: BOX.x1, y: 0 }], { x: "x", y: "y", text: () => (width < NARROW ? "target box" : "E K in [2, 10], Pr(W_SB > .5) <= .40"), dx: 4, dy: -8, textAnchor: "start", fill: c.accentInk, fontSize: 11, fontWeight: 600 }),
        P.ruleY([HARD], { stroke: c.muted, strokeDasharray: "6,4" }),
        P.text([{ x: X_MIN, y: HARD }], { x: "x", y: "y", text: () => "hard bound .25", dx: 4, dy: -7, textAnchor: "start", fill: c.muted, fontSize: 10 }),
        P.dot(pts.filter((d) => !d.head), { x: "x", y: "y", r: 3.5, fill: (d) => (d.live ? recordColor(d.rec, c) : "none"), stroke: (d) => recordColor(d.rec, c), strokeWidth: 1.2, fillOpacity: 0.7 }),
        P.link(labels, { x1: "x", y1: "y", x2: "lx", y2: "yLabel", stroke: c.muted, strokeOpacity: 0.6 }),
        P.dot(heads, { x: "x", y: "y", r: 6, fill: (d) => recordColor(d.rec, c), stroke: c.fg, strokeWidth: 1.2 }),
        P.text(labels, { x: "lx", y: "yLabel", text: "label", dx: 4, textAnchor: "start", fill: c.fg, stroke: c.raised, strokeWidth: 3, paintOrder: "stroke", fontSize: 11, fontWeight: 700 }),
        P.tip(pts, P.pointer({ x: "x", y: "y", title: (d) => `${d.label}\n${d.rec.gamma ? fmtGamma(d.rec.a, d.rec.b) : "not a Gamma"}\nE K_${state.J} = ${fmtCount(d.x)}\nPr(W_SB > .5) = ${fmtProb(d.y)}` })),
        logTickLabels(X_TICKS, c.muted),
      ],
    }, `Method map at J = ${state.J}: ${heads.map((d) => `${d.label} (${fmtCount(d.x)}, ${fmtProb(d.y)})`).join("; ")}. Inside the shaded box: ${inBox.map((d) => d.label).join("; ") || "none"}.`);
    fig.addEventListener("input", () => {
      const v = fig.value;
      if (v && v.id && v.id !== state.pick) { state.pick = v.id; sPick.set(v.id); renderStrip(); }
    });
    pMap.prepend(h("p", { class: "dpx-panel-title", text: `Every catalog prior at J = ${state.J}: few clusters and little dominance is a small corner` }));
    pMap.append(srTable(`Catalog priors at J = ${state.J}`, ["prior", "family", `E K_${state.J}`, "Pr(W_SB > .5)"], pts.map((d) => [d.label, d.rec.family, fmtCount(d.x), fmtProb(d.y)])));
    renderStrip();
    ui.readout.textContent = `J = ${state.J}: ${heads.map((d) => `${d.label} ${fmtCount(d.x)} and ${fmtProb(d.y)}`).join("; ")}. Inside the box (E K in [2, 10], Pr(W_SB > .5) <= .40): ${inBox.map((d) => d.label).join("; ") || "none"}. Changing J moves points sideways only.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.inBox = inBox.map((d) => d.id).join(",");
  };

  const sJ = segmented({ label: "J", options: J_SET.map((j) => ({ value: j, label: String(j) })), value: state.J, onChange: (v) => { state.J = v; render(); } });
  const tAll = toggle({ label: "all catalog priors (off: the seven labelled ones)", checked: state.all, onChange: (v) => { state.all = v; render(); } });
  const sPick = select({ label: "Strip for", options: mc.records.map((r) => ({ value: r.id, label: r.label })), value: state.pick,
    onChange: (v) => { state.pick = v; renderStrip(); } });
  ui.controls.append(sJ.root, tAll.root, sPick.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (J_SET.includes(Number(next.J))) { state.J = Number(next.J); sJ.set(state.J); }
      if (next.preset && mc.records.some((r) => r.id === next.preset)) { state.pick = next.preset; sPick.set(next.preset); }
      render();
    },
    pick(id) { state.pick = id; sPick.set(id); renderStrip(); },
    positions() { return Object.fromEntries(points().map((d) => [d.id, [d.x, d.y]])); },
    destroy() { stop(); el.replaceChildren(); },
  };
}
