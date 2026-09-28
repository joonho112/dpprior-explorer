// A-13 "Data lineage and licence cards". Owner of this file: Step 9.1 (the render-time cards of
// Step 5.1 became this widget).
//
// One card per table in data/released/data_contract.json: its source file in the replication
// package, level, rows, columns, licence and what it covers (license_scope, upstream source and
// terms, the columns taken from the upstream data; since 1.1.0), fixed caption and sha256,
// with a badge for the individual-level rule (only rasch_respondents.json is on the
// respondent-level allowlist). A bar
// chart shows the size of every table; a filter narrows the cards to one family. The shared
// captions of the evidence pages (app-captions.js) close the widget. spec.dataBase is the path
// from the host page to data/released/ for the JSON links.
import contract from "../../data/released/data_contract.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented } from "./base.js";
import { CAPTIONS, RETAINED, captionList } from "./app-captions.js";

const FAMILY = {
  applications: { label: "applications", test: (f) => /^(star|bd|app)_\w+\.json$/.test(f) }, // star_units, bd_units, bd_moderator, app_priors, app_sensitivity
  simulation: { label: "simulation", test: (f) => /^(cell_summary|headline_primary|misspecification|design_size|unequal_weights|fixed_lambda)\.json$/.test(f) },
  calibration: { label: "calibration", test: (f) => /^(newton_trace|dual_anchor_grid|confidence_levels)\.json$/.test(f) },
  rasch: { label: "Rasch vocabulary", test: (f) => /^rasch_/.test(f) },
};
const familyOf = (f) => Object.keys(FAMILY).find((k) => FAMILY[k].test(f)) ?? "other";
const SCOPE_SHORT = { author: "whole file", "author-contribution": "the author's contribution", "irw-derived": "IRW derived licence" };
const scopeOf = (f) => SCOPE_SHORT[f.license_scope] ?? f.license_scope ?? "not stated";

export function mountWidget(el, spec = {}) {
  const base = typeof spec.dataBase === "string" ? spec.dataBase : "../../data/released/";
  const files = Object.entries(contract.files).map(([name, e]) => ({ name, ...e, family: familyOf(name) }));
  const allow = contract.respondent_level_allowlist ?? {};
  const state = { family: FAMILY[spec.preset] ? spec.preset : "all" };
  const ui = frame(el, { label: "Released data: lineage and licence of every table the evidence pages read", className: "dpx-lineage" });
  const pChart = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const cards = h("div", { class: "dpx-cards dpx-lineage-cards", style: "grid-column: 1 / -1" });
  const caps = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pChart, cards, caps);
  ui.caption.textContent = `${contract.schema}; written by ${contract.generated_by}; source ${contract.source_repository}; licence ${contract.license}.`;
  let width = 720;

  const card = (f) => {
    const listed = allow[f.name];
    const badge = listed
      ? h("span", { class: "dpx-pill dpx-pill-note", text: `respondent-level allowlist: ${listed.join(", ")}` })
      : h("span", { class: "dpx-pill dpx-pill-ok", text: "no individual-level fields" });
    const up = f.upstream;
    const upBadge = up
      ? h("span", { class: "dpx-pill dpx-pill-note", text: up.fields.length ? `upstream terms kept for ${up.fields.join(", ")}` : "upstream terms kept for the source data" })
      : null;
    const rights = [
      h("p", {}, h("strong", { text: "Licence scope: " }), contract.license_scopes?.[f.license_scope] ?? scopeOf(f)),
      ...(up ? [
        h("p", {}, h("strong", { text: "Upstream source: " }), up.source),
        h("p", {}, h("strong", { text: "Upstream terms: " }), up.terms),
        h("p", {}, h("strong", { text: "Columns from the upstream data: " }), up.fields.length ? up.fields.join(", ") : "none"),
      ] : []),
      h("p", {}, h("strong", { text: "Rights record: " }), f.rights_record ?? "not stated"),
    ];
    return h("article", { class: "dpx-card", "data-file": f.name },
      h("div", { class: "dpx-card-body" },
        h("p", { class: "dpx-card-id" }, h("span", { text: f.name }), ` ${f.level} · ${f.rows.toLocaleString("en-US")} rows · ${f.license} (${scopeOf(f)})`),
        h("p", { class: "dpx-card-concept", text: f.caption }),
        h("p", {}, badge, upBadge ? " " : "", upBadge ?? ""),
        h("details", {},
          h("summary", { text: "licence scope, source, columns and checksum" }),
          ...rights,
          h("p", {}, h("strong", { text: "Source: " }), f.source),
          h("p", {}, h("strong", { text: `Columns (${f.columns.length}): ` }), f.columns.join(", ")),
          h("p", { class: "dpx-card-engine", text: `sha256 ${f.sha256.slice(0, 16)}…` })),
        h("p", { class: "dpx-card-links" }, h("a", { href: base + f.name, text: "JSON" }))));
  };

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const shown = files.filter((f) => state.family === "all" || f.family === state.family);
    cards.replaceChildren(...shown.map(card));
    const col = { applications: c.methods.da, simulation: c.methods.tsmm, calibration: c.gold, rasch: c.blue, other: c.slate };
    const rows = [...files].sort((p, q) => q.rows - p.rows).map((f) => ({ ...f, on: state.family === "all" || f.family === state.family }));
    draw(pChart, {
      width: Math.min(width, 760), height: 26 + 20 * rows.length, marginLeft: 150, marginRight: 60, marginBottom: 32,
      x: { type: "log", label: "rows (log scale)", labelOffset: 28, domain: [1, Math.max(...rows.map((r) => r.rows)) * 2] },
      y: { domain: rows.map((r) => r.name), label: null, tickSize: 0 },
      marks: [
        P.barX(rows, { x1: 1, x2: "rows", y: "name", fill: (r) => col[r.family], fillOpacity: (r) => (r.on ? 0.9 : 0.25), insetTop: 3, insetBottom: 3 }),
        P.text(rows, { x: "rows", y: "name", text: (r) => r.rows.toLocaleString("en-US"), dx: 5, textAnchor: "start", fill: c.fg, fontSize: 11 }),
      ],
    }, `Rows in each of the ${files.length} released tables: ${rows.map((r) => `${r.name} ${r.rows}`).join(", ")}.`);
    pChart.prepend(h("p", { class: "dpx-panel-title", text: `${files.length} released tables (${state.family === "all" ? "all families" : FAMILY[state.family].label} highlighted)` }));
    pChart.append(h("p", { class: "dpx-legend" }, ...Object.entries(FAMILY).map(([k, v]) => h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${col[k]}` }), v.label))));
    ui.readout.textContent = `${shown.length} of ${files.length} tables shown${state.family === "all" ? "" : ` (${FAMILY[state.family].label})`}; ${files.filter((f) => allow[f.name]).length} on the respondent-level allowlist; ${RETAINED.retained.toLocaleString("en-US")} of ${RETAINED.planned.toLocaleString("en-US")} simulation fits retained in the ${RETAINED.cells} main cells.`;
    ui.root.dataset.cards = String(shown.length);
  };

  caps.append(h("p", { class: "dpx-panel-title", text: "The fixed captions of the evidence pages" }), captionList(["read", "kj", "retained", "ocrs"]));
  caps.append(srTable("Released tables", ["table", "level", "rows", "columns", "licence", "licence covers", "columns from the upstream data"],
    files.map((f) => [f.name, f.level, f.rows, f.columns.length, f.license, scopeOf(f), f.upstream?.fields?.join(", ") || "none"])));
  const sFam = segmented({ label: "Show", options: [{ value: "all", label: "all" }, ...Object.entries(FAMILY).map(([value, v]) => ({ value, label: v.label }))], value: state.family,
    onChange: (k) => { state.family = k; render(); } });
  ui.controls.append(sFam.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) { if (next.preset && (FAMILY[next.preset] || next.preset === "all")) { state.family = next.preset; sFam.set(state.family); } render(); },
    get files() { return files.map((f) => ({ name: f.name, rows: f.rows, family: f.family })); },
    captions: CAPTIONS,
    destroy() { stop(); el.replaceChildren(); },
  };
}
