// M-06 "Collapse: prior mass near alpha = 0 seats everyone at the first table". Owner of this
// file: Step 5.8.
//
// A Gamma(a, b) prior keeps some mass near alpha = 0, and there the Chinese restaurant
// process almost never opens a second table: P(K_J = 1 | alpha) = prod_{i<J} i / (i + alpha).
// Panel A shades Pr(alpha < .1) on the density of log alpha (area = probability); panel B
// gives the prior collapse probability P(K_J = 1) at J = 50, 79, 100 and 500; panel C seats
// 79 customers at a small alpha (P-07 table layout). The caption separates prior collapse,
// P(K_J = 1), from posterior collapse, Pr(K_J = 1 | data), which is read from the released
// STAR summaries (app_priors.js), never recomputed.
import * as dp from "../dp-core.js";
import appPriors from "../../data/released/app_priors.js";
import levels from "../../data/released/confidence_levels.js";
import { draw, labelOn, logTickLabels, palette, srTable } from "./chart.js";
import { tableLayout } from "./crp.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, reducedMotion, segmented, slider } from "./base.js";
import { fmt, fmtAlpha, fmtGamma, fmtProb } from "./format.js";

const VIF5 = levels.find((r) => r.VIF === 5);
const PRESETS = [
  { key: "g11", label: "Gamma(1, 1)", a: 1, b: 1 },
  { key: "vif5", label: `TSMM, VIF 5 ${fmtGamma(VIF5.a, VIF5.b)}`, a: VIF5.a, b: VIF5.b },
  { key: "g13", label: "Gamma(1, 3)", a: 1, b: 3 },
];
const SMALL = 0.1; // "alpha near 0" threshold of the paper's Table 2 (Pr(alpha < .1))
const J_BARS = [50, 79, 100, 500];
const J_SEAT = 79; // the STAR schools
const SEAT_ALPHAS = [0.02, 0.1, 1];
const SEAT_MS = 35;
const STAR_VAGUE = appPriors.find((r) => r.app === "STAR" && r.prior === "Vague");

export function mountWidget(el, spec = {}) {
  const preset = PRESETS.find((p) => p.key === spec.preset) ?? PRESETS[0];
  const state = {
    a: num(spec, "a", preset.a, 0.05, 50),
    b: num(spec, "b", preset.b, 0.05, 50),
    seatAlpha: SEAT_ALPHAS.includes(Number(spec.alpha)) ? Number(spec.alpha) : SEAT_ALPHAS[0],
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
  };
  let crp = null;
  let timer = 0;
  const ui = frame(el, { label: "Collapse: prior mass near alpha = 0 and the prior probability that all units share one cluster", className: "dpx-collapse" });
  const pA = h("div", { class: "dpx-panel" });
  const pB = h("div", { class: "dpx-panel" });
  const pC = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pA, pB, pC);
  const seatTitle = h("p", { class: "dpx-panel-title" });
  const seatSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  seatSvg.setAttribute("role", "img");
  const seatNote = h("p", { class: "dpx-caption-note", "aria-live": "polite" });
  const priorPost = h("p", { class: "dpx-readout", style: "border-left-color: var(--dp-red)" });
  ui.root.insertBefore(priorPost, ui.caption);
  let width = 720;
  const name = () => PRESETS.find((p) => p.a === state.a && p.b === state.b)?.label ?? fmtGamma(state.a, state.b);
  const half = () => (width >= 640 ? Math.floor((width - 16) / 2) : width);

  const renderPrior = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { a, b } = state;
    const lo = Math.max(1e-4, Math.min(1e-3, dp.qgamma(0.001, a, b)));
    const hi = Math.max(10, dp.qgamma(0.999, a, b));
    const dens = [];
    for (let i = 0; i <= 240; i += 1) {
      const x = Math.exp(Math.log(lo) + ((Math.log(hi) - Math.log(lo)) * i) / 240);
      dens.push({ x, d: Math.exp(dp.dgammaLog(x, a, b)) * x });
    }
    const small = dp.prAlphaBelow(SMALL, a, b);
    const ticks = [0.001, 0.01, 0.1, 1, 10, 100].filter((t) => t >= lo && t <= hi);
    draw(pA, {
      width: half(), height: 250, marginLeft: 44, marginBottom: 42,
      x: { type: "log", domain: [lo, hi], label: "alpha (log scale)", labelOffset: 38, ticks, tickFormat: () => "" },
      y: { label: "density of log alpha", grid: true },
      marks: [
        P.areaY(dens.filter((d) => d.x <= SMALL), { x: "x", y: "d", fill: c.red, fillOpacity: 0.35 }),
        P.lineY(dens, { x: "x", y: "d", stroke: c.fg, strokeWidth: 1.6 }),
        P.ruleX([SMALL], { stroke: c.red, strokeDasharray: "4,3" }),
        P.text([{ x: SMALL }], { x: "x", frameAnchor: "top", dy: 6, dx: -4, textAnchor: "end", fill: c.red, fontWeight: 700, fontSize: 12, text: () => `Pr(alpha < .1) = ${fmtProb(small)}` }),
        logTickLabels(ticks, c.muted),
      ],
    }, `Prior density of log alpha under ${name()}; the shaded area left of alpha = .1 is Pr(alpha < .1) = ${fmtProb(small)}.`);
    pA.prepend(h("p", { class: "dpx-panel-title", text: `A. Prior mass near alpha = 0 under ${name()}` }));

    const bars = J_BARS.map((J) => ({ J: `J = ${J}`, p: dp.mixPmf(J, a, b)[1] }));
    draw(pB, {
      width: half(), height: 250, marginLeft: 44, marginBottom: 42,
      x: { type: "band", domain: bars.map((d) => d.J), label: null },
      y: { domain: [0, Math.max(0.3, ...bars.map((d) => d.p)) * 1.12], label: "P(K_J = 1)", grid: true },
      marks: [
        P.barY(bars, { x: "J", y: "p", fill: c.red, fillOpacity: 0.75 }),
        P.text(bars, { x: "J", y: "p", text: (d) => fmtProb(d.p), dy: -8, fill: c.fg, fontWeight: 700, fontSize: 12 }),
        P.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `Prior collapse probability P(K_J = 1) under ${name()}: ${bars.map((d) => `${fmtProb(d.p)} at ${d.J}`).join(", ")}.`);
    pB.prepend(h("p", { class: "dpx-panel-title", text: "B. Prior collapse: P(K_J = 1), all units in one cluster" }));
    pB.append(srTable(`P(K_J = 1) under ${name()}`, ["J", "P(K_J = 1)"], bars.map((d) => [d.J, fmtProb(d.p)])));

    ui.readout.textContent = `${name()}: Pr(alpha < .1) = ${fmtProb(small)}; prior collapse P(K_J = 1) = ${bars.map((d) => `${fmtProb(d.p)} at ${d.J}`).join(", ")}.`;
    const priorStar = dp.mixPmf(J_SEAT, 1, 1)[1];
    priorPost.textContent =
      `Prior collapse is P(K_J = 1) before any data (panel B). Posterior collapse is Pr(K_J = 1 | data) after fitting: for STAR (J = ${J_SEAT} schools) under Gamma(1, 1) the prior value is ${fmtProb(priorStar)} and the released posterior value is ${fmtProb(STAR_VAGUE.post_pK1)} (read, not recomputed). The two are different statements.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.small = String(small);
    ui.root.dataset.pk1_100 = String(bars[2].p);
  };

  const renderSeats = () => {
    const c = palette(ui.root);
    const d3 = globalThis.d3;
    const W = width;
    const counts = crp ? crp.counts : [];
    const { pos, H } = tableLayout(counts, W, { newTable: false, rMax: 60 });
    const Hh = Math.max(H, 60);
    seatSvg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    seatSvg.setAttribute("width", W);
    seatSvg.setAttribute("height", Hh);
    const sel = d3.select(seatSvg);
    sel.selectAll("*").remove();
    for (const p of pos) {
      sel.append("circle").attr("cx", p.cx).attr("cy", p.cy).attr("r", p.r).attr("fill", c.brod[p.i % 6]).attr("stroke", c.stroke).attr("stroke-opacity", 0.5);
      if (p.r >= 11) sel.append("text").attr("x", p.cx).attr("y", p.cy + 4).attr("text-anchor", "middle").attr("font-size", Math.min(16, p.r * 0.6)).attr("font-weight", 700).attr("fill", labelOn(c.brod[p.i % 6], c)).text(p.c);
    }
    const n = crp ? crp.n : 0;
    const k = crp ? crp.tables : 0;
    const pOne = dp.condPmf(J_SEAT, state.seatAlpha)[1];
    seatTitle.textContent = `C. ${J_SEAT} customers at alpha = ${fmtAlpha(state.seatAlpha)}: ${n} seated at ${k} ${k === 1 ? "table" : "tables"}`;
    seatSvg.setAttribute("aria-label", `${n} customers seated at ${k} tables with alpha ${fmtAlpha(state.seatAlpha)}; table sizes ${counts.join(", ") || "none"}.`);
    seatNote.textContent = n === J_SEAT
      ? `All ${J_SEAT} seated: ${k} ${k === 1 ? "table" : "tables"}. At alpha = ${fmtAlpha(state.seatAlpha)}, P(K_${J_SEAT} = 1 | alpha) = ${fmtProb(pOne)}.`
      : `At alpha = ${fmtAlpha(state.seatAlpha)} a new table opens with probability alpha / (alpha + n); P(K_${J_SEAT} = 1 | alpha) = ${fmtProb(pOne)}. Press Play.`;
  };

  const stopSeating = () => { clearTimeout(timer); timer = 0; };
  const play = () => {
    stopSeating();
    crp = new dp.Crp(state.seatAlpha, dp.makeRng(state.seed));
    if (reducedMotion()) {
      for (let i = 0; i < J_SEAT; i += 1) crp.seat();
      renderSeats();
      return;
    }
    const tick = () => {
      crp.seat();
      renderSeats();
      if (crp.n < J_SEAT) timer = setTimeout(tick, SEAT_MS);
      else timer = 0;
    };
    tick();
  };

  pC.append(seatTitle, seatSvg, seatNote);
  const presetSeg = segmented({ label: "Prior", options: PRESETS.map((p) => ({ value: p.key, label: p.label })), value: PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null,
    onChange: (v) => { const p = PRESETS.find((q) => q.key === v); state.a = p.a; state.b = p.b; sa.set(p.a); sb.set(p.b); renderPrior(); } });
  const sa = slider({ label: "a (shape)", min: 0.05, max: 50, value: state.a, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.a = v; presetSeg.set(null); renderPrior(); } });
  const sb = slider({ label: "b (rate)", min: 0.05, max: 50, value: state.b, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.b = v; presetSeg.set(null); renderPrior(); } });
  const alphaSeg = segmented({ label: "Restaurant alpha", options: SEAT_ALPHAS.map((x) => ({ value: x, label: fmtAlpha(x) })), value: state.seatAlpha,
    onChange: (v) => { state.seatAlpha = v; stopSeating(); crp = null; renderSeats(); } });
  const playBtn = button({ label: `Play ${J_SEAT} customers`, primary: true, onClick: () => { play(); state.seed += 1; } });
  ui.controls.append(presetSeg.root, sa.root, sb.root, alphaSeg.root, h("div", { class: "dpx-control dpx-buttons" }, playBtn));
  ui.caption.textContent =
    "K_J is the number of fitted components (occupied clusters) among the J units. Panel A plots the density of log alpha, so shaded area is probability. Seating is seeded; each Play uses the next seed.";
  const unbind = bindPrimaryKey(ui.root, () => playBtn.click());
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) { renderPrior(); renderSeats(); } });
  renderPrior();
  renderSeats();
  ready = true;
  return {
    update(next = {}) {
      if (next.preset !== undefined) {
        const p = PRESETS.find((q) => q.key === next.preset);
        if (p) { state.a = p.a; state.b = p.b; }
      }
      if (next.a !== undefined) state.a = num(next, "a", state.a, 0.05, 50);
      if (next.b !== undefined) state.b = num(next, "b", state.b, 0.05, 50);
      sa.set(state.a);
      sb.set(state.b);
      presetSeg.set(PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null);
      renderPrior();
    },
    play,
    destroy() { stopSeating(); stop(); unbind(); el.replaceChildren(); },
  };
}
