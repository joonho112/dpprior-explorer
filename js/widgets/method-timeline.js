// M-08 "Method timeline with one-line-error cards". Owner of this file: Step 7.4.
//
// Nine nodes from Antoniak (1974) to DPprior (2026), read from method_catalog.json
// (r-export/02_methods_catalog.R). Selecting a node (click, Enter or Space; arrow keys move
// between nodes) opens its card: what the rule assumes, what it implies for the count and for
// the weights, how it depends on J, its one-line error, the evidence and links to the explorers.
// Evidence for Gamma and fixed-alpha records is recomputed here with dp-core; the non-Gamma
// records (Jeffreys, Stirling-gamma) carry R values (integrate over the log-alpha line).
import * as dp from "../dp-core.js";
import mc from "../../data/precomputed/method_catalog.js";
import { dodge, draw, logTickLabels, palette, recordColor, srTable } from "./chart.js";
import { frame, h, observeWidth } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const NARROW = 560; // below this width the timeline is drawn vertically
const SVG_NS = "http://www.w3.org/2000/svg";
const J_GRID = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000]; // the card's E K_J-by-J chart
const J_TICKS = [10, 100, 1000, 5000];

/** E K_J along J_GRID for a record (Gamma and fixed alpha by dp-core; non-Gamma priors from R at J = 50, 100, 500). */
function ekCurve(rec) {
  if (rec.gamma) return J_GRID.map((J) => ({ J, e: dp.mixMoments(J, rec.a, rec.b).mean }));
  if (rec.prior?.type === "point") return J_GRID.map((J) => ({ J, e: dp.condMean(J, rec.prior.alpha) }));
  return Object.entries(rec.E_K).map(([J, e]) => ({ J: Number(J), e }));
}

const recordOf = (id) => mc.records.find((r) => r.id === id);

/** One evidence quantity: {value, label, kind, source}. `q` is E_K, P_K1, S50, S90 or design.<field>. */
export function evidenceValue(rec, q, J) {
  const design = q.startsWith("design.") ? rec.design?.find((d) => d.J === J) : null;
  const field = design ? q.slice("design.".length) : q;
  const labels = {
    E_K: `E K_${J}`, P_K1: `P(K_${J} = 1)`, S50: "Pr(W_SB > .5)", S90: "Pr(W_SB > .9)",
    KL: `KL at n = ${J}`,
  };
  const kind = field === "E_K" ? "count" : field === "KL" ? "kl" : "prob";
  let value;
  let source = "dp-core";
  if (rec.gamma) {
    const { a, b } = rec;
    if (field === "E_K") value = dp.mixMoments(J, a, b).mean;
    else if (field === "P_K1") value = dp.mixPK1(J, a, b);
    else if (field === "S50") value = dp.wsbTail(0.5, a, b);
    else if (field === "S90") value = dp.wsbTail(0.9, a, b);
    else if (field === "KL") value = dp.doroDivergence(J, design?.support_max ?? J, a, b).kl;
  } else if (rec.prior?.type === "point") {
    const al = rec.prior.alpha;
    if (field === "E_K") value = dp.condMean(J, al);
    else if (field === "P_K1") value = Math.exp(dp.lgamma(al + 1) + dp.lgamma(J) - dp.lgamma(al + J));
    else if (field === "S50") value = dp.wsbTailGivenAlpha(0.5, al);
    else if (field === "S90") value = dp.wsbTailGivenAlpha(0.9, al);
  }
  if (value === undefined) {
    source = "R";
    value = design ? design[field] : field === "S50" || field === "S90" ? rec[field] : rec[field]?.[J];
  }
  return { value, label: labels[field] ?? field, kind, source };
}

const fmtKind = (v, kind) => (kind === "count" ? fmtCount(v) : kind === "kl" ? fmt(v, 4) : fmtProb(v));

/** A record's label with its prior, without repeating a Gamma already in the label. */
function priorText(rec) {
  if (rec.gamma) return rec.label.includes("Gamma(") ? rec.label : `${rec.label}: ${fmtGamma(rec.a, rec.b)}`;
  return rec.prior.type === "point" ? rec.label : `${rec.label} (not a Gamma)`;
}

/** Link base: the site root, from the bundle's own URL (works on pages, embeds and file://). */
function siteRoot() {
  const s = typeof document !== "undefined" ? document.querySelector('script[src*="bundles/method-timeline"]') : null;
  if (!s) return "";
  return s.src.replace(/js\/bundles\/method-timeline\.js.*$/, "");
}

export function mountWidget(el, spec = {}) {
  const nodes = mc.timeline;
  const pick = String(spec.preset ?? spec.node ?? "");
  let current = Math.max(0, nodes.findIndex((n) => n.id === pick || n.year === pick));
  const ui = frame(el, { label: "Method timeline: nine ways to choose the Gamma hyperprior, each with a one-line error", className: "dpx-timeline" });
  const pLine = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pCard = h("div", { class: "dpx-panel dpx-tile", style: "grid-column: 1 / -1", id: `${el.id || "m08"}-card`, "aria-live": "polite" });
  ui.charts.append(pLine, pCard);
  ui.caption.textContent =
    "Each node is a published way to choose the Gamma(a, b) hyperprior on alpha. Select a node (click, Enter or Space; arrow keys move) to open its card. K_J is the number of fitted components among the J units. Gamma and fixed-alpha numbers are recomputed with dp-core; Jeffreys and Stirling-gamma values come from r-export/02_methods_catalog.R.";
  const root = siteRoot();
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Timeline of hyperprior rules, 1974 to 2026");
  pLine.append(h("p", { class: "dpx-panel-title", text: "From Antoniak (1974) to DPprior: select a year" }), svg);
  let width = 720;
  let groups = [];

  const nodeColor = (n, c) => recordColor(recordOf(n.records[0]), c);

  const drawLine = () => {
    const c = palette(ui.root);
    const W = width;
    const narrow = W < NARROW;
    const n = nodes.length;
    const pad = 44;
    const H = narrow ? 16 + n * 36 : 150;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.replaceChildren();
    const el2 = (tag, attrs, text) => {
      const e = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const pos = (i) => (narrow ? { x: 22, y: 24 + i * 36 } : { x: pad + (i * (W - 2 * pad)) / (n - 1), y: 62 });
    const first = pos(0);
    const last = pos(n - 1);
    svg.append(el2("line", { x1: first.x, y1: first.y, x2: last.x, y2: last.y, stroke: c.borderStrong, "stroke-width": 2 }));
    groups = nodes.map((node, i) => {
      const p = pos(i);
      const sel = i === current;
      const g = el2("g", {
        role: "button", tabindex: 0, "aria-pressed": String(sel), "aria-controls": pCard.id,
        "aria-label": `${node.year}, ${node.title}. ${node.one_line_error}`, class: "dpx-tl-node", style: "cursor: pointer",
      });
      g.append(el2("circle", { cx: p.x, cy: p.y, r: 17, fill: "transparent" })); // hit area
      g.append(el2("circle", { cx: p.x, cy: p.y, r: sel ? 11 : 8, fill: nodeColor(node, c), stroke: sel ? c.accentInk : c.stroke, "stroke-width": sel ? 3 : 1 }));
      const ring = el2("circle", { cx: p.x, cy: p.y, r: 15, fill: "none", stroke: c.accentInk, "stroke-width": 2, "stroke-dasharray": "3,2", visibility: "hidden" });
      g.append(ring);
      const weight = sel ? 700 : 400;
      if (narrow) {
        g.append(el2("text", { x: p.x + 22, y: p.y + 4, "font-size": 12, "font-weight": 700, fill: c.fg }, node.year));
        g.append(el2("text", { x: p.x + 84, y: p.y + 4, "font-size": 12, "font-weight": weight, fill: sel ? c.fg : c.muted }, node.short));
      } else {
        g.append(el2("text", { x: p.x, y: p.y - 22, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: c.fg }, node.year));
        const words = node.short.split(" ");
        words.forEach((w, k) => g.append(el2("text", { x: p.x, y: p.y + 32 + 14 * k, "text-anchor": "middle", "font-size": 12, "font-weight": weight, fill: sel ? c.fg : c.muted }, w)));
      }
      g.addEventListener("click", () => select(i, true));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); select(i, true); }
        else if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          const j = (i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : n - 1)) % n;
          groups[j].focus();
        }
      });
      g.addEventListener("focus", () => ring.setAttribute("visibility", "visible"));
      g.addEventListener("blur", () => ring.setAttribute("visibility", "hidden"));
      svg.append(g);
      return g;
    });
  };

  const drawCard = () => {
    const node = nodes[current];
    const ev = node.evidence.map((e) => ({ ...evidenceValue(recordOf(e.record), e.q, e.J), rec: recordOf(e.record) }));
    const jIcon = /invariant by design/.test(node.j_dependence) ? "═" : /solved per|depends on n|chosen for one n/.test(node.j_dependence) ? "↻" : "↗";
    const recs = node.records.map(recordOf);
    const src = recs.map((r) => r.source).filter((s, i, a) => a.indexOf(s) === i);
    pCard.replaceChildren(
      h("p", { class: "dpx-card-id" }, h("span", { text: node.year }), node.title),
      h("p", { class: "dpx-tile-big", text: node.one_line_error }),
      h("p", {}, h("span", { class: "dpx-badge", style: "margin-left: 0", title: "How the rule depends on the number of units J", text: `${jIcon} ${node.j_dependence}` })),
      h("dl", { class: "dpx-tl-facts" },
        h("dt", { text: "Assumes" }), h("dd", { text: node.assumption }),
        h("dt", { text: "Implied count" }), h("dd", { text: node.count }),
        h("dt", { text: "Implied weights" }), h("dd", { text: node.weight }),
        h("dt", { text: "Evidence" }), h("dd", {}, h("ul", {}, ...ev.map((e) => h("li", { text: `${e.label} = ${fmtKind(e.value, e.kind)} (${e.rec.label}${e.source === "R" ? "; R integration" : ""})` })))),
        h("dt", { text: "Priors" }), h("dd", { text: recs.map(priorText).join("; ") }),
        h("dt", { text: "Source" }), h("dd", { text: src.join("; ") })),
      pJ,
      h("p", { class: "dpx-card-links" }, "Explore: ", ...node.explorers.flatMap((x, k) => [k ? " · " : "", h("a", { href: `${root}${x.href}`, text: x.id })])),
    );
    drawJ(recs);
    ui.readout.textContent = `${node.year} ${node.short}: ${node.one_line_error} ${ev.map((e) => `${e.label} = ${fmtKind(e.value, e.kind)} (${e.rec.label})`).join("; ")}.`;
    ui.root.dataset.node = node.id;
  };

  // the card's small chart: how each listed prior's expected count moves with J
  const pJ = h("div", { class: "dpx-tl-jchart" });
  const drawJ = (recs) => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const series = recs.map((r) => ({ r, pts: ekCurve(r) })).filter((x) => x.pts.length);
    if (!series.length) { pJ.replaceChildren(); return; }
    const rows = series.flatMap((x) => x.pts.map((p) => ({ ...p, id: x.r.id, label: x.r.label })));
    const yMax = Math.max(...rows.map((d) => d.e)) * 1.12;
    const w = Math.min(width - 24, 560);
    const H = 150;
    const jEnd = J_GRID[J_GRID.length - 1];
    const ends = dodge(series.map((x) => ({ J: jEnd, e: x.pts[x.pts.length - 1].e, text: x.r.label, col: recordColor(x.r, c) })), "e", (yMax * 12) / (H - 50));
    draw(pJ, {
      width: w, height: H, marginLeft: 40, marginRight: Math.min(190, w / 3), marginBottom: 36,
      x: { type: "log", domain: [J_GRID[0], J_GRID[J_GRID.length - 1]], label: "J (log scale)", ticks: J_TICKS, tickFormat: () => "", labelOffset: 32 },
      y: { domain: [0, yMax], label: "E K_J", grid: true, ticks: 4 },
      marks: [
        ...series.map((x) => P.line(x.pts, { x: "J", y: "e", stroke: recordColor(x.r, c), strokeWidth: 2, strokeDasharray: x.r.gamma || x.r.prior?.type === "point" ? null : "4,3" })),
        ...series.map((x) => P.dot(x.pts, { x: "J", y: "e", r: 2, fill: recordColor(x.r, c) })),
        P.text(ends, { x: "J", y: "eLabel", text: "text", fill: c.fg, textAnchor: "start", dx: 6, fontSize: 10 }),
        P.dot(ends, { x: "J", y: "eLabel", r: 3, fill: "col", dx: 2, symbol: "square" }),
        logTickLabels(J_TICKS, c.muted),
      ],
    }, `Expected count E K_J against J (dashed: not a Gamma, values from R) for ${series.map((x) => `${x.r.label} (${fmtCount(x.pts[0].e)} at J = ${x.pts[0].J} to ${fmtCount(x.pts[x.pts.length - 1].e)} at J = ${x.pts[x.pts.length - 1].J})`).join("; ")}. The weight tail Pr(W_SB > .5) does not change with J.`);
    pJ.prepend(h("p", { class: "dpx-panel-title", text: "How the expected count moves with J (the weight tail does not)" }));
  };

  const render = () => {
    const t0 = performance.now();
    drawLine();
    drawCard();
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };
  function select(i, focus = false) {
    current = i;
    render();
    if (focus) groups[i]?.focus();
  }

  pLine.append(srTable("Hyperprior rules by year", ["year", "rule", "one-line error"], nodes.map((n) => [n.year, n.title, n.one_line_error])));
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      const key = String(next.preset ?? next.node ?? "");
      const i = nodes.findIndex((n) => n.id === key || n.year === key);
      if (i >= 0) current = i;
      render();
    },
    select: (id) => { const i = nodes.findIndex((n) => n.id === id); if (i >= 0) select(i); },
    get node() { return nodes[current].id; },
    destroy() { stop(); el.replaceChildren(); },
  };
}
