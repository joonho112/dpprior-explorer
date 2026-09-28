// C-14 "Reporting checklist and paragraph generator". Owner of this file: Step 8.14.
//
// The paper's eight-item reporting checklist (R1, Sec. 6): (1) J and why it is fixed; (2) the
// elicited statement, the conversion route and (mu_K, sigma^2) with a justification; (3) the
// calibrated (a, b) and the software; (4) the prior median and central interval of K_J; (5)
// Pr(W_SB > .5), Pr(W_SB > .9), the ranked-weight result and E(rho); (6) the Dual-Anchor details
// when triggered; (7) the separate hard-bound result; (8) a posterior sensitivity variant. Items
// 4 and 5, and whether the .40 trigger fires, are computed with dp-core from J and (a, b). The
// paragraph updates as the form is filled; missing items are listed in an aria-live warning and
// marked in the text. "Copy" uses the Clipboard API, with a select-and-copy fallback.
import * as dp from "../dp-core.js";
import we from "../../data/precomputed/worked_example_j50.js";
import { draw, palette } from "./chart.js";
import { button, frame, h } from "./base.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const TRIGGER = we.policy.trigger;
const SOFT = we.policy.soft_target;
const HARD = we.policy.hard_bound;
/** The fixed lambda grid (worked_example_j50.json), written with runs: "0.01 to 0.20 in steps of 0.01, ...". */
function gridText(lams) {
  const xs = [...lams].sort((p, q) => p - q);
  const parts = [];
  let i = 0;
  while (i < xs.length) {
    let j = i + 1;
    const step = xs[i + 1] - xs[i];
    while (j + 1 < xs.length && Math.abs(xs[j + 1] - xs[j] - step) < 1e-9) j += 1;
    if (j - i >= 2) { parts.push(`${xs[i].toFixed(2)} to ${xs[j].toFixed(2)} in steps of ${step.toFixed(2)}`); i = j + 1; }
    else { parts.push(xs[i].toFixed(2)); i += 1; }
  }
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}` : parts[0];
}
const GRID_TEXT = gridText(we.lambda_grid.map((r) => r.lambda));
const RULE_TEXT = `the largest lambda whose prior has Pr(W_SB > .5) at or below ${fmt(TRIGGER, 2)}`;
const g4 = (a, b) => `Gamma(${a.toFixed(4)}, ${b.toFixed(4)})`;
const g4c = (a, b) => `Gamma(${a.toFixed(4)},${b.toFixed(4)})`;

function example() {
  const st = Object.fromEntries(we.stages.map((s) => [s.key, s]));
  return {
    J: String(we.target.J), jWhy: "the number of sites is fixed by the design",
    statement: "about 5 clusters, with medium confidence", route: "vif", mu: String(we.target.mu_K), v: String(we.target.var_K),
    muWhy: "a pilot suggested a handful of distinct effect patterns",
    a: st.tsmm.a.toFixed(4), b: st.tsmm.b.toFixed(4), software: "DPprior 2.0.0 (R) and DPprior Explorer",
    lambda: String(st.da.lambda), daA: st.da.a.toFixed(4), daB: st.da.b.toFixed(4), fields: "converged, usable, independently verified, interior",
    hardA: st.hard.a.toFixed(4), hardB: st.hard.b.toFixed(4),
    sens: "the model refitted under the TSMM prior and under Gamma(1, 1)",
  };
}

export function mountWidget(el, spec = {}) {
  const ui = frame(el, { label: "Reporting checklist: eight items and a paragraph to copy", className: "dpx-report" });
  const form = h("form", { class: "dpx-report-form", style: "grid-column: 1 / -1", onsubmit: (e) => e.preventDefault() });
  const warn = h("div", { class: "dpx-report-warn", role: "status", "aria-live": "polite", style: "grid-column: 1 / -1" });
  const outBox = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const meter = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(meter, form, warn, outBox);
  ui.caption.textContent =
    `The eight items follow the paper's reporting checklist. Items 4 and 5 and the trigger decision are computed with dp-core from J and (a, b); the rest is what you type. Trigger ${fmt(TRIGGER, 2)}, soft target ${fmt(SOFT, 2)} and hard bound ${fmt(HARD, 2)} are the paper's fixed policy.`;

  // form controls
  const fields = {};
  const text = (key, label, placeholder = "", wide = true) => {
    const id = `rg-${key}-${Math.random().toString(36).slice(2, 7)}`;
    const input = h("input", { id, type: "text", placeholder, class: wide ? "dpx-report-wide" : "", oninput: update });
    fields[key] = input;
    return h("div", { class: "dpx-control dpx-report-field" }, h("label", { for: id, text: label }), input);
  };
  const number = (key, label, placeholder = "") => {
    const id = `rg-${key}-${Math.random().toString(36).slice(2, 7)}`;
    const input = h("input", { id, type: "number", step: "any", inputmode: "decimal", placeholder, oninput: update });
    fields[key] = input;
    return h("div", { class: "dpx-control dpx-number" }, h("label", { for: id, text: label }), input);
  };
  const select = (key, label, options) => {
    const id = `rg-${key}-${Math.random().toString(36).slice(2, 7)}`;
    const input = h("select", { id, onchange: update }, ...options.map(([v, t]) => h("option", { value: v, text: t })));
    fields[key] = input;
    return h("div", { class: "dpx-control dpx-select" }, h("label", { for: id, text: label }), input);
  };
  const auto = {};
  const autoLine = (key) => { auto[key] = h("p", { class: "dpx-report-auto" }); return auto[key]; };
  const marks = [];
  const item = (n, title, ...kids) => {
    const mark = h("span", { class: "dpx-report-mark", "aria-hidden": "true" });
    marks[n] = mark;
    return h("fieldset", { class: "dpx-report-item", "data-item": String(n) }, h("legend", {}, mark, `${n}. ${title}`), ...kids);
  };
  form.append(
    item(1, "Design size J", number("J", "J (units)", "50"), text("jWhy", "why J is treated as fixed", "e.g. the number of sites is fixed by the design")),
    item(2, "Elicited statement and conversion", text("statement", "the statement about K_J", "e.g. about 5 clusters, with medium confidence"),
      select("route", "route", [["", "choose"], ["interval", "interval with a probability"], ["vif", "confidence level (VIF)"], ["cv", "coefficient of variation"]]),
      number("mu", "mu_K"), number("v", "sigma^2"), text("muWhy", "substantive justification", "why this many clusters")),
    item(3, "Calibrated prior (TSMM) and software", number("a", "a (shape)"), number("b", "b (rate)"), text("software", "software and version", "e.g. DPprior 2.0.0", false)),
    item(4, "Prior median and 90% interval of K_J (computed)", autoLine("k")),
    item(5, "Weight diagnostics (computed)", autoLine("w")),
    item(6, "Dual-Anchor refinement", autoLine("trig"), number("lambda", "selected lambda"), number("daA", "refined a"), number("daB", "refined b"),
      text("fields", "software status fields", "convergence, usability, verification, boundary")),
    item(7, `Hard bound ${fmt(HARD, 2)} (sensitivity)`, number("hardA", "hard a"), number("hardB", "hard b")),
    item(8, "Posterior sensitivity variant", text("sens", "what else was fitted", "e.g. the model refitted under Gamma(1, 1)")),
  );
  const para = h("p", { class: "dpx-report-para", tabindex: 0, "aria-label": "Generated reporting paragraph" });
  const copyNote = h("span", { class: "dpx-report-copied", role: "status", "aria-live": "polite" });
  outBox.append(h("p", { class: "dpx-panel-title", text: "The reporting paragraph" }), para);

  let last = null;
  function compute() {
    const val = (k) => (fields[k].value ?? "").trim();
    const numv = (k) => { const x = Number(val(k)); return val(k) !== "" && Number.isFinite(x) ? x : null; };
    const J = numv("J");
    const a = numv("a");
    const b = numv("b");
    const okJ = J !== null && Number.isInteger(J) && J >= 2 && J <= dp.LIVE_J_MAX;
    const okAB = a !== null && b !== null && a > 0 && b > 0;
    const r = { J, a, b, okJ, okAB, missing: [] };
    if (okJ && okAB) {
      const pmf = dp.mixPmf(J, a, b);
      r.sum = dp.pmfSummary(pmf);
      r.S5 = dp.wsbTail(0.5, a, b);
      r.S9 = dp.wsbTail(0.9, a, b);
      r.rho = dp.meanRho(a, b);
      r.wmax = dp.wmaxTail(0.5, a, b);
      r.bounds = dp.wmaxBounds(0.5, a, b);
      r.fires = r.S5 > TRIGGER;
    }
    const lam = numv("lambda");
    const daA = numv("daA");
    const daB = numv("daB");
    if (r.fires && okJ && lam !== null && daA > 0 && daB > 0) {
      r.da = { lambda: lam, a: daA, b: daB, S5: dp.wsbTail(0.5, daA, daB), EK: dp.mixMoments(J, daA, daB).mean, EK0: dp.mixMoments(J, a, b).mean };
    }
    const hA = numv("hardA");
    const hB = numv("hardB");
    if (okJ && hA > 0 && hB > 0) {
      const pm = hA > dp.POINT_MASS_A;
      r.hard = { a: hA, b: hB, pm, S5: dp.wsbTail(0.5, hA, hB), EK: dp.mixMoments(J, hA, hB).mean };
    }
    // completeness, item by item
    const need = [
      [1, okJ && val("jWhy") !== "", !okJ ? "J (a whole number from 2 to 500)" : "why J is fixed"],
      [2, val("statement") !== "" && val("route") !== "" && numv("mu") !== null && numv("v") !== null && val("muWhy") !== "", "the statement, route, mu_K, sigma^2 and a justification"],
      [3, okAB && val("software") !== "", !okAB ? "a and b" : "the software and version"],
      [4, Boolean(r.sum), "J, a and b (then this is computed)"],
      [5, Boolean(r.sum), "J, a and b (then this is computed)"],
      [6, r.sum ? (r.fires ? Boolean(r.da) && val("fields") !== "" : true) : false, r.sum ? "the selected lambda, the refined (a, b) and the software status fields" : "items 1 and 3 first"],
      [7, Boolean(r.hard), "the hard-bound (a, b)"],
      [8, val("sens") !== "", "at least one posterior sensitivity variant"],
    ];
    need.forEach(([n, ok, what]) => { if (!ok) r.missing.push({ n, what }); });
    r.val = val;
    r.numv = numv;
    return r;
  }

  function paragraph(r) {
    const gap = (n) => `[item ${n} missing]`;
    const has = (n) => !r.missing.some((m) => m.n === n);
    const out = [];
    out.push(has(1) ? `We treat the design size as fixed at J = ${r.J} (${r.val("jWhy")}).` : gap(1));
    if (has(2)) {
      const route = { interval: "an interval with a stated probability", vif: "a confidence level (sigma^2 = VIF (mu_K - 1))", cv: "a coefficient of variation" }[r.val("route")];
      out.push(`The elicited statement, "${r.val("statement")}", was converted through ${route} to mu_K = ${r.numv("mu")} and sigma_K^2 = ${r.numv("v")}; ${r.val("muWhy")}.`);
    } else out.push(gap(2));
    out.push(has(3) ? `Two-stage moment matching gave ${g4(r.a, r.b)} (shape, rate; ${r.val("software")}).` : gap(3));
    out.push(has(4) ? `The implied K_${r.J} has prior median ${r.sum.median} and 90% interval [${r.sum.q05}, ${r.sum.q95}].` : gap(4));
    out.push(has(5) ? `Its weight diagnostics are Pr(W_SB > .5) = ${fmtProb(r.S5)} and Pr(W_SB > .9) = ${fmtProb(r.S9)}; the largest weight exceeds one half with probability ${fmtProb(r.wmax)} (bounds ${fmtProb(r.bounds.lower)} to ${fmtProb(r.bounds.upper)}), and E(rho) = ${fmtProb(r.rho)}.` : gap(5));
    if (has(6)) {
      if (r.fires) out.push(`Because Pr(W_SB > .5) exceeded the prespecified ${fmt(TRIGGER, 2)} trigger, we applied the Dual-Anchor refinement (soft target ${fmt(SOFT, 2)}; lambda grid ${GRID_TEXT}; selection rule: ${RULE_TEXT}) and selected lambda = ${fmt(r.da.lambda, 2)}, giving ${g4(r.da.a, r.da.b)} with Pr(W_SB > .5) = ${fmtProb(r.da.S5)}; E K_${r.J} moved from ${fmtCount(r.da.EK0)} to ${fmtCount(r.da.EK)} (software status: ${r.val("fields")}).`);
      else out.push(`Pr(W_SB > .5) did not exceed the ${fmt(TRIGGER, 2)} trigger, so the TSMM prior was kept.`);
    } else out.push(gap(6));
    if (has(7)) out.push(`As a separately reported sensitivity analysis, the hard bound Pr(W_SB > .5) <= ${fmt(HARD, 2)} gave ${r.hard.pm ? `${g4(r.hard.a, r.hard.b)}, nearly a point mass at alpha = ${(r.hard.a / r.hard.b).toFixed(3)}` : g4(r.hard.a, r.hard.b)} (Pr(W_SB > .5) = ${fmtProb(r.hard.S5)}, E K_${r.J} = ${fmtCount(r.hard.EK)}).`);
    else out.push(gap(7));
    out.push(has(8) ? `Posterior sensitivity: ${r.val("sens")}.` : gap(8));
    // one-line summary of the prior used, for tables
    if (r.sum) {
      const fin = r.fires && r.da ? r.da : null;
      out.push(fin ? `Summary: J=${r.J}, ${g4c(fin.a, fin.b)}, S(.5)=${fmtProb(fin.S5)}, lambda=${fmt(fin.lambda, 2)}.` : `Summary: J=${r.J}, ${g4c(r.a, r.b)}, S(.5)=${fmtProb(r.S5)}, TSMM${r.fires ? " (refinement pending)" : ""}.`);
    }
    return out.join(" ");
  }

  function update() {
    const t0 = performance.now();
    const r = compute();
    last = r;
    auto.k.textContent = r.sum ? `median ${r.sum.median}, 90% interval [${r.sum.q05}, ${r.sum.q95}] (mean ${fmtCount(dp.mixMoments(r.J, r.a, r.b).mean)})` : "Enter J (item 1) and a, b (item 3).";
    auto.w.textContent = r.sum ? `Pr(W_SB > .5) = ${fmtProb(r.S5)}, Pr(W_SB > .9) = ${fmtProb(r.S9)}, Pr(W_max > .5) = ${fmtProb(r.wmax)} (bounds ${fmtProb(r.bounds.lower)} to ${fmtProb(r.bounds.upper)}), E(rho) = ${fmtProb(r.rho)}` : "Enter J (item 1) and a, b (item 3).";
    auto.trig.textContent = r.sum ? (r.fires ? `Triggered: Pr(W_SB > .5) = ${fmtProb(r.S5)} > ${fmt(TRIGGER, 2)}. Report the selected lambda and the refined prior.` : `Not triggered: ${fmtProb(r.S5)} <= ${fmt(TRIGGER, 2)}; the TSMM prior is kept and nothing more is needed here.`) : "The trigger is checked once items 1 and 3 are filled.";
    auto.trig.classList.toggle("dpx-report-hot", Boolean(r.fires));
    for (let n = 1; n <= 8; n += 1) {
      const miss = r.missing.find((m) => m.n === n);
      marks[n].textContent = miss ? "missing" : "done";
      marks[n].className = `dpx-report-mark ${miss ? "dpx-pill dpx-pill-bad" : "dpx-pill dpx-pill-ok"}`;
    }
    // completeness strip: one cell per checklist item
    const c = palette(ui.root);
    const cells = Array.from({ length: 8 }, (_, i) => ({ n: i + 1, done: !r.missing.some((m) => m.n === i + 1) }));
    draw(meter, {
      width: Math.min(560, Math.max(300, meter.clientWidth || 560)), height: 64, marginLeft: 8, marginRight: 8, marginTop: 4, marginBottom: 24,
      x: { domain: cells.map((d) => d.n), label: null, tickFormat: (d) => `item ${d}`, tickSize: 0 }, y: { axis: null },
      marks: [globalThis.Plot.cell(cells, { x: "n", fill: (d) => (d.done ? c.green : c.red), fillOpacity: (d) => (d.done ? 0.85 : 0.25), inset: 2, rx: 4 }),
        globalThis.Plot.text(cells, { x: "n", text: (d) => (d.done ? "done" : "missing"), fill: (d) => (d.done ? c.bg : c.red), fontSize: 10, fontWeight: 700 })],
    }, `Checklist completeness: ${8 - r.missing.length} of 8 items complete${r.missing.length ? `; missing items ${r.missing.map((m) => m.n).join(", ")}` : ""}.`);
    meter.prepend(h("p", { class: "dpx-panel-title", text: `${8 - r.missing.length} of 8 checklist items complete` }));
    warn.replaceChildren(r.missing.length
      ? h("p", {}, h("strong", { text: `${r.missing.length} of 8 items incomplete: ` }), r.missing.map((m) => `item ${m.n} (${m.what})`).join("; "), ".")
      : h("p", { text: "All eight items are complete." }));
    warn.classList.toggle("dpx-report-warn-on", r.missing.length > 0);
    para.textContent = paragraph(r);
    ui.readout.textContent = r.missing.length ? `${8 - r.missing.length} of 8 items complete.` : "All eight items complete; the paragraph is ready to copy.";
    ui.root.dataset.missing = String(r.missing.length);
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  }

  const copy = async () => {
    const textOut = para.textContent;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(textOut); ok = true; }
    } catch { ok = false; }
    if (!ok) {
      // fallback for pages opened from file:// (no Clipboard API): a temporary, off-screen textarea
      const tmp = h("textarea", { class: "dpx-sr-only", readonly: true });
      tmp.value = textOut;
      document.body.append(tmp);
      tmp.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      tmp.remove();
    }
    ui.root.dataset.copied = textOut;
    copyNote.textContent = ok ? "Copied." : "Copy failed: select the paragraph and copy it by hand.";
  };
  const fill = (vals) => { for (const [k, v] of Object.entries(vals)) if (fields[k]) fields[k].value = v; update(); };
  const bFill = button({ label: `Fill in the J = ${we.target.J} example`, primary: true, onClick: () => fill(example()) });
  const bClear = button({ label: "Clear", onClick: () => fill(Object.fromEntries(Object.keys(fields).map((k) => [k, ""]))) });
  const bCopy = button({ label: "Copy the paragraph", onClick: copy });
  ui.controls.append(h("div", { class: "dpx-control dpx-buttons" }, bFill, bClear, bCopy, copyNote));

  if (spec.preset === "j50") fill(example());
  else update();
  return {
    update(next = {}) { if (next.preset === "j50") fill(example()); else update(); },
    fill,
    copy,
    get paragraph() { return para.textContent; },
    get missing() { return last ? last.missing.map((m) => m.n) : []; },
    destroy() { el.replaceChildren(); },
  };
}
