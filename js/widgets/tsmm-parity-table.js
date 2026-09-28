// C-01 "TSMM parity table: R and the browser side by side". Owner of this file: Step 8.3.
//
// Each row of tsmm_fits.json (DPprior 2.0.0 DPprior_fit, A2-MN) is solved again in the browser by
// dp-core tsmmFit, and the two (a, b) are shown with their largest difference, the iterations and
// the status. The infeasible target ([3, 10] at 95% at J = 100) gets a "no solution" badge with the
// profile bound it falls below. Selecting a row shows the browser's Newton path for that target.
import * as dp from "../dp-core.js";
import fits from "../../data/precomputed/tsmm_fits.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth } from "./base.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const TOL = 5e-3; // the parity tolerance for (a, b) (parity_spec.csv, tsmm_fits.csv)

const fmt4 = (x) => (Number.isFinite(x) ? x.toFixed(4) : "–");

export function mountWidget(el, spec = {}) {
  const rows = fits.rows.map((r) => {
    const t0 = performance.now();
    const js = dp.tsmmFit(r.J, r.mu_K, r.sigma2);
    return { r, js, ms: performance.now() - t0, diff: r.status === "ok" ? Math.max(Math.abs(js.a - r.a), Math.abs(js.b - r.b)) : null };
  });
  let current = Math.max(0, rows.findIndex((x) => x.r.case === spec.preset));
  const ui = frame(el, { label: "TSMM parity: the R package and the browser engine solve the same calibration targets", className: "dpx-tsmm-parity" });
  const pTable = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pPath = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1", "aria-live": "polite" });
  ui.charts.append(pTable, pPath);
  ui.caption.textContent =
    "R: DPprior 2.0.0 DPprior_fit (A2-MN; verification/golden/tsmm_fits.csv). Browser: dp-core tsmmFit, solved when the page loads. Rows in green agree within 5e-3 on both a and b; the infeasible target is refused before any Newton step because its variance is below the smallest variance any Gamma prior with that mean can give.";
  let width = 720;

  const table = h("table", { class: "dpx-parity" });
  const head = h("tr", {}, ...["target", "J", "mu_K", "sigma^2", "R (a, b)", "browser (a, b)", "max |R - browser|", "Newton steps (R / browser)", "status"].map((t) => h("th", { scope: "col", text: t })));
  const body = h("tbody");
  table.append(h("thead", {}, head), body);
  pTable.append(h("p", { class: "dpx-panel-title", text: "Ten calibration targets, solved twice" }), h("div", { class: "dpx-table-scroll", tabindex: 0, role: "region", "aria-label": "TSMM parity table (scrolls sideways on narrow screens)" }, table));

  const renderTable = () => {
    body.replaceChildren(...rows.map((x, i) => {
      const ok = x.r.status === "ok";
      const pass = ok ? x.diff < TOL : x.js.status === "infeasible";
      const badge = ok
        ? h("span", { class: `dpx-pill ${pass ? "dpx-pill-ok" : "dpx-pill-bad"}`, text: pass ? `agree (${x.diff.toExponential(1)})` : `differ (${x.diff.toExponential(1)})` })
        : h("span", { class: "dpx-pill dpx-pill-bad", text: `no solution: min variance ${fmt(x.js.minVar, 2)} at alpha* = ${fmt(x.js.alphaStar, 3)}` });
      const btn = h("button", { type: "button", class: "dpx-row-btn", "aria-pressed": String(i === current), onclick: () => { current = i; renderTable(); renderPath(); } }, x.r.case);
      return h("tr", { class: i === current ? "dpx-row-current" : "" },
        h("th", { scope: "row" }, btn, h("span", { class: "dpx-row-note", text: x.r.route })),
        h("td", { text: String(x.r.J) }), h("td", { text: String(x.r.mu_K) }), h("td", { text: x.r.sigma2.toFixed(3) }),
        h("td", { class: "dpx-nowrap", text: ok ? `(${fmt4(x.r.a)}, ${fmt4(x.r.b)})` : "–" }),
        h("td", { class: "dpx-nowrap", text: x.js.status === "ok" ? `(${fmt4(x.js.a)}, ${fmt4(x.js.b)})` : "–" }),
        h("td", {}, badge),
        h("td", { text: ok ? `${x.r.iter} / ${x.js.iter}` : "0 / 0" }),
        h("td", { text: x.js.status }));
    }));
  };

  const renderPath = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const x = rows[current];
    if (x.js.status !== "ok") {
      // the profile bound across mu_K at this J: no Gamma prior lies below the curve
      const J = x.r.J;
      const curve = [];
      for (let i = 0; i <= 40; i += 1) {
        const mu = 1.2 + (i * (Math.min(J - 1, 3 * x.r.mu_K) - 1.2)) / 40;
        curve.push({ mu, v: dp.profileBound(J, mu).minVar });
      }
      const others = rows.filter((y) => y.r.J === J && y.r.mu_K === x.r.mu_K && y !== x);
      const pts = [{ mu: x.r.mu_K, v: x.r.sigma2, label: `${x.r.route}: no solution`, bad: true }, ...others.map((y) => ({ mu: y.r.mu_K, v: y.r.sigma2, label: `${y.r.route}: feasible`, bad: false }))];
      draw(pPath, {
        width: Math.min(width, 560), height: 230, marginLeft: 44, marginBottom: 42,
        x: { label: "mu_K (target mean)", labelOffset: 36 },
        y: { label: "sigma^2 (target variance)", grid: true, domain: [0, Math.max(...curve.map((d) => d.v), ...pts.map((d) => d.v)) * 1.1] },
        marks: [
          P.areaY(curve, { x: "mu", y: "v", fill: c.red, fillOpacity: 0.12 }),
          P.line(curve, { x: "mu", y: "v", stroke: c.red, strokeWidth: 2 }),
          P.dot(pts, { x: "mu", y: "v", r: 6, fill: (d) => (d.bad ? c.red : c.methods.tsmm), stroke: c.fg }),
          P.text(pts, { x: "mu", y: "v", text: "label", dx: 10, textAnchor: "start", fill: c.fg, stroke: c.raised, strokeWidth: 4, paintOrder: "stroke", fontSize: 11, fontWeight: 600 }),
        ],
      }, `At J = ${J} no Gamma prior has a count variance below the red curve v_J(alpha*(mu_K)); the target (${x.r.mu_K}, ${x.r.sigma2.toFixed(2)}) lies below it (minimum ${fmt(x.js.minVar, 2)}), ${others.length ? `while ${others.map((y) => `(${y.r.mu_K}, ${y.r.sigma2.toFixed(2)})`).join(", ")} lies above` : "so it has no solution"}.`);
      pPath.prepend(h("p", { class: "dpx-panel-title", text: `${x.r.case}: below the smallest variance any Gamma prior can give` }));
      pPath.append(h("p", { text: `At J = ${x.r.J} a prior with E K_J = ${x.r.mu_K} cannot have Var K_J below ${fmt(x.js.minVar, 3)}, the variance of the point mass alpha* = ${fmt(x.js.alphaStar, 3)} with kappa_J(alpha*) = ${x.r.mu_K}. The target asks for ${x.r.sigma2.toFixed(3)} (${x.r.route}), so the engine reports "infeasible" without starting Newton. Widening the interval or lowering the coverage (for example [3, 10] at 80%, sigma^2 = ${dp.intervalToMoments(3, 10, 0.8).varK.toFixed(3)}) makes it feasible.` }));
      ui.readout.textContent = `${x.r.case}: infeasible in R and in the browser; minimum variance ${fmt(x.js.minVar, 3)} at alpha* = ${fmt(x.js.alphaStar, 3)} against the requested ${x.r.sigma2.toFixed(3)}.`;
      return;
    }
    const tr = x.js.trace.map((s) => ({ iter: s.iter, r: Math.max(s.residual, 1e-16) }));
    const e0 = Math.floor(Math.log10(Math.min(...tr.map((d) => d.r))));
    const e1 = Math.ceil(Math.log10(Math.max(...tr.map((d) => d.r))));
    const yTicks = [];
    for (let e = e1; e >= e0; e -= 2) yTicks.push(10 ** e);
    draw(pPath, {
      width: Math.min(width, 560), height: 210, marginLeft: 52, marginTop: 28,
      x: { label: "Newton step", ticks: tr.length, tickFormat: (d) => (Number.isInteger(d) ? String(d) : "") },
      y: { type: "log", label: "|F| = |(M1 - mu_K, V - sigma^2)|", grid: true, ticks: yTicks, tickFormat: (d) => { const e = Math.round(Math.log10(d)); return e === 0 ? "1" : `1e${e}`; } },
      marks: [
        P.line(tr, { x: "iter", y: "r", stroke: c.methods.tsmm, strokeWidth: 2 }),
        P.dot(tr, { x: "iter", y: "r", r: 4, fill: c.methods.tsmm }),
      ],
    }, `Browser Newton path for ${x.r.case}: |F| from ${tr[0].r.toExponential(1)} at the A1 start to ${tr[tr.length - 1].r.toExponential(1)} after ${x.js.iter} steps.`);
    pPath.prepend(h("p", { class: "dpx-panel-title", text: `${x.r.case}: the browser's Newton path (A1 start (${fmt4(x.js.start.a0)}, ${fmt4(x.js.start.b0)})${x.js.start.projected ? ", projected" : ""})` }));
    pPath.append(srTable(`Newton path for ${x.r.case}`, ["step", "a", "b", "E K", "Var K", "|F|"], x.js.trace.map((s) => [s.iter, fmt4(s.a), fmt4(s.b), fmtCount(s.M1), fmtCount(s.V), s.residual.toExponential(2)])));
    const S50 = dp.wsbTail(0.5, x.js.a, x.js.b);
    ui.readout.textContent = `${x.r.case} (J = ${x.r.J}, mu_K = ${x.r.mu_K}, sigma^2 = ${x.r.sigma2.toFixed(3)}): R Gamma(${fmt4(x.r.a)}, ${fmt4(x.r.b)}), browser Gamma(${fmt4(x.js.a)}, ${fmt4(x.js.b)}), largest difference ${x.diff.toExponential(1)}; ${x.js.iter} Newton steps in ${fmt(x.ms, 1)} ms; Pr(W_SB > .5) = ${fmtProb(S50)}.`;
  };

  const render = () => { const t0 = performance.now(); renderTable(); renderPath(); ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1); };
  pTable.append(srTable("TSMM parity summary", ["target", "largest difference"], rows.map((x) => [x.r.case, x.diff === null ? `infeasible (${x.js.status})` : x.diff.toExponential(2)])));
  ui.root.dataset.maxDiff = String(Math.max(...rows.filter((x) => x.diff !== null).map((x) => x.diff)));
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) renderPath(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      const i = rows.findIndex((x) => x.r.case === next.preset);
      if (i >= 0) current = i;
      render();
    },
    get rows() { return rows.map((x) => ({ case: x.r.case, diff: x.diff, status: x.js.status })); },
    destroy() { stop(); el.replaceChildren(); },
  };
}
