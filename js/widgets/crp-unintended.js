// M-05 "The unintended prior, restaurant by restaurant". Owner of this file: Step 5.5.
//
// Each restaurant draws its own alpha from Gamma(a, b) and seats J customers by the Chinese
// restaurant process (seeded). Over 1000 restaurants the histogram of occupied tables
// approaches the exact marginal pmf of K_J (dp-core mixing), and the histogram of the
// largest table's share shows how often one table seats more than half of the customers.
// The caption keeps two quantities apart: Pr(W_SB > .5), the chance that a random
// customer's table holds more than half of the population, and Pr(W_max > .5), the chance
// that the largest table does (both exact, dp-core weights).
import * as dp from "../dp-core.js";
import { draw, labelOn, palette, srTable } from "./chart.js";
import { tableLayout } from "./crp.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, reducedMotion, slider } from "./base.js";
import { fmt, fmtAlpha, fmtCount, fmtGamma, fmtPct, fmtProb } from "./format.js";

const N_REST = 1000;
const BATCH = 50; // restaurants added per animation frame
const BIN = 0.05; // right-closed share bins (x, x + BIN], so a share of exactly .5 is not a majority
const WALL_COLS = 50;

/** Seat J customers in each of n restaurants, alpha ~ Gamma(a, b) per restaurant. */
export function simulateRestaurants(a, b, J, n, seed) {
  const rng = dp.makeRng(seed);
  const out = [];
  for (let r = 0; r < n; r += 1) {
    const alpha = dp.rgamma(rng, a) / b;
    const crp = new dp.Crp(alpha, rng);
    for (let i = 0; i < J; i += 1) crp.seat();
    const counts = [...crp.counts];
    out.push({ r, alpha, counts, K: counts.length, share: Math.max(...counts) / J });
  }
  return out;
}

export function mountWidget(el, spec = {}) {
  const state = {
    a: num(spec, "a", 1.6, 0.05, 50),
    b: num(spec, "b", 1.22, 0.05, 50),
    J: Math.round(num(spec, "J", 50, 10, 200)),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    shown: N_REST,
    sel: 0,
  };
  let rest = [];
  let raf = 0;
  const ui = frame(el, { label: "The unintended prior in restaurants: 1000 simulated restaurants, their table counts and their largest tables", className: "dpx-crp-unintended" });
  const pK = h("div", { class: "dpx-panel" });
  const pS = h("div", { class: "dpx-panel" });
  const pWall = h("div", { class: "dpx-panel" });
  const pOne = h("div", { class: "dpx-panel" });
  ui.charts.append(pK, pS, pWall, pOne);
  const canvas = h("canvas", { role: "img" });
  const wallTitle = h("p", { class: "dpx-panel-title" });
  const restPick = slider({ label: "Open restaurant", min: 1, max: N_REST, step: 1, value: 1, format: (v) => String(Math.round(v)), onInput: (v) => pick(Math.round(v) - 1) });
  pWall.append(wallTitle, canvas, restPick.root);
  const oneTitle = h("p", { class: "dpx-panel-title" });
  const oneSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  oneSvg.setAttribute("role", "img");
  pOne.append(oneTitle, oneSvg);
  const twoQuantities = h("p", { class: "dpx-readout", style: "border-left-color: var(--dp-red)" });
  ui.root.insertBefore(twoQuantities, ui.caption);
  let width = 720;

  const half = () => (width >= 640 ? Math.floor((width - 16) / 2) : width);

  const drawHistograms = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { a, b, J } = state;
    const m = state.shown;
    const shown = rest.slice(0, m);
    const exact = dp.mixPmf(J, a, b);
    const kObs = Math.max(1, ...shown.map((d) => d.K));
    let cum = 0;
    let q99 = J;
    for (let k = 1; k <= J; k += 1) { cum += exact[k]; if (cum >= 0.99) { q99 = k; break; } }
    const kmax = Math.min(J, Math.max(12, kObs, q99));
    const counts = new Array(kmax + 1).fill(0);
    for (const d of shown) if (d.K <= kmax) counts[d.K] += 1;
    const bars = [];
    for (let k = 1; k <= kmax; k += 1) bars.push({ k, p: counts[k] / Math.max(1, m), e: exact[k] });
    let l1 = 0;
    const full = new Array(J + 1).fill(0);
    for (const d of shown) full[d.K] += 1;
    for (let k = 1; k <= J; k += 1) l1 += Math.abs(full[k] / Math.max(1, m) - exact[k]);
    const meanK = shown.reduce((s, d) => s + d.K, 0) / Math.max(1, m);
    const mom = dp.mixMoments(J, a, b);
    draw(pK, {
      width: half(), height: 256, marginLeft: 44, marginBottom: 40,
      x: { type: "band", label: `occupied tables among J = ${J} customers`, labelOffset: 34, tickFormat: (d) => (d === 1 || d % 5 === 0 ? d : "") },
      y: { label: "share of restaurants", grid: true },
      marks: [
        P.barY(bars, { x: "k", y: "p", fill: c.slate, fillOpacity: 0.55 }),
        P.dot(bars, { x: "k", y: "e", r: 3.5, fill: c.teal, stroke: c.fg, strokeWidth: 1 }),
        P.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `Histogram of occupied tables in ${m} simulated restaurants (mean ${fmtCount(meanK)}) against the exact marginal pmf of K_${J} (dots, mean ${fmtCount(mom.mean)}); L1 distance ${fmt(l1, 3)}.`);
    pK.prepend(h("p", { class: "dpx-panel-title", text: `Tables per restaurant (bars) vs exact pmf of K_${J} (dots)` }));
    pK.append(srTable(`Occupied tables in ${m} restaurants and the exact pmf`, ["tables", "share of restaurants", "exact"], bars.map((d) => [d.k, fmtProb(d.p), fmtProb(d.e)])));

    const nb = Math.round(1 / BIN);
    const sh = new Array(nb).fill(0);
    let maj = 0;
    for (const d of shown) {
      sh[Math.min(nb - 1, Math.max(0, Math.ceil(d.share / BIN - 1e-9) - 1))] += 1;
      if (d.share > dp.MAJORITY_T) maj += 1;
    }
    const sBars = sh.map((n, i) => ({ x1: i * BIN, x2: (i + 1) * BIN, p: n / Math.max(1, m), major: i * BIN >= dp.MAJORITY_T - 1e-9 }));
    const fracMaj = maj / Math.max(1, m);
    draw(pS, {
      width: half(), height: 250, marginLeft: 44,
      x: { domain: [0, 1], label: "largest table's share of the J customers", ticks: [0, 0.25, 0.5, 0.75, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 2)) },
      y: { label: "share of restaurants", grid: true },
      marks: [
        P.rectY(sBars, { x1: "x1", x2: "x2", y: "p", fill: (d) => (d.major ? c.red : c.slate), fillOpacity: (d) => (d.major ? 0.75 : 0.45), inset: 0.5 }),
        P.ruleX([dp.MAJORITY_T], { stroke: c.red, strokeDasharray: "4,3" }),
        P.text([{ x: dp.MAJORITY_T }], { x: "x", frameAnchor: "top", dy: 6, dx: 4, textAnchor: "start", fill: c.red, fontWeight: 700, fontSize: 11, text: () => `> half: ${fmtProb(fracMaj)}` }),
        P.ruleY([0], { stroke: c.borderStrong }),
      ],
    }, `Histogram of the largest table's share in ${m} restaurants; in ${maj} of them (${fmtProb(fracMaj)}) the largest table seats more than half of the customers.`);
    pS.prepend(h("p", { class: "dpx-panel-title", text: "Largest table's share (more than half shaded)" }));
    pS.append(srTable("Largest table's share", ["share bin", "share of restaurants"], sBars.map((d) => [`(${fmt(d.x1, 2)}, ${fmt(d.x2, 2)}]`, fmtProb(d.p)])));

    ui.readout.textContent =
      `${m} restaurants, J = ${J}, alpha ~ ${fmtGamma(a, b)} (seed ${state.seed}): mean ${fmtCount(meanK)} occupied tables (exact E K_J = ${fmtCount(mom.mean)}); L1 distance between the histogram and the exact pmf ${fmt(l1, 3)}. ` +
      `In ${maj} of ${m} restaurants (${fmtProb(fracMaj)}) one table seats more than half of the customers.`;
    ui.root.dataset.meanK = String(meanK);
    ui.root.dataset.l1 = String(l1);
    ui.root.dataset.majority = String(fracMaj);
    return { maj, m };
  };

  const drawWall = () => {
    const c = palette(ui.root);
    const W = half();
    const cell = Math.max(3, Math.floor((W - 2) / WALL_COLS));
    const rows = Math.ceil(N_REST / WALL_COLS);
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = WALL_COLS * cell * dpr;
    canvas.height = rows * cell * dpr;
    canvas.style.width = `${WALL_COLS * cell}px`;
    canvas.style.height = `${rows * cell}px`;
    const ctx = canvas.getContext?.("2d");
    let maj = 0;
    for (const d of rest.slice(0, state.shown)) if (d.share > dp.MAJORITY_T) maj += 1;
    wallTitle.textContent = `${state.shown} restaurants, one square each: red when one table seats more than half`;
    canvas.setAttribute("aria-label", `${state.shown} restaurants as squares; ${maj} are red because one table seats more than half of the customers.`);
    restPick.set(state.sel + 1);
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, WALL_COLS * cell, rows * cell);
    rest.slice(0, state.shown).forEach((d, i) => {
      const x = (i % WALL_COLS) * cell;
      const y = Math.floor(i / WALL_COLS) * cell;
      ctx.fillStyle = d.share > dp.MAJORITY_T ? c.red : c.slate;
      ctx.globalAlpha = d.share > dp.MAJORITY_T ? 0.85 : 0.3;
      ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    });
    ctx.globalAlpha = 1;
    if (state.sel < state.shown) {
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2;
      ctx.strokeRect((state.sel % WALL_COLS) * cell + 1, Math.floor(state.sel / WALL_COLS) * cell + 1, cell - 2, cell - 2);
    }
  };

  const drawOne = () => {
    const c = palette(ui.root);
    const d3 = globalThis.d3;
    const W = half();
    const d = rest[state.sel];
    if (!d) return;
    const { pos, H } = tableLayout(d.counts, W, { newTable: false, rMax: 40 });
    oneSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    oneSvg.setAttribute("width", W);
    oneSvg.setAttribute("height", H);
    const sel = d3.select(oneSvg);
    sel.selectAll("*").remove();
    const big = Math.max(...d.counts);
    for (const p of pos) {
      sel.append("circle").attr("cx", p.cx).attr("cy", p.cy).attr("r", p.r).attr("fill", c.brod[p.i % 6])
        .attr("stroke", p.c === big && d.share > dp.MAJORITY_T ? c.fg : c.stroke).attr("stroke-width", p.c === big && d.share > dp.MAJORITY_T ? 2.5 : 1).attr("stroke-opacity", 0.8);
      if (p.r >= 11) sel.append("text").attr("x", p.cx).attr("y", p.cy + 4).attr("text-anchor", "middle").attr("font-size", Math.min(14, p.r * 0.7)).attr("font-weight", 700).attr("fill", labelOn(c.brod[p.i % 6], c)).text(p.c);
    }
    const verdict = d.share > dp.MAJORITY_T ? "more than half" : "not more than half";
    oneTitle.textContent = `Restaurant ${d.r + 1}: alpha = ${fmtAlpha(d.alpha)}, ${d.K} ${d.K === 1 ? "table" : "tables"}, largest ${big} of ${state.J} (${fmtPct(d.share, 0)}, ${verdict})`;
    oneSvg.setAttribute("aria-label", `Restaurant ${d.r + 1}: alpha ${fmtAlpha(d.alpha)}; table sizes ${d.counts.join(", ")}.`);
  };

  const drawCaption = () => {
    const { a, b } = state;
    const sb = dp.wsbTail(dp.MAJORITY_T, a, b);
    const wm = dp.wmaxTail(dp.MAJORITY_T, a, b);
    twoQuantities.textContent =
      `Two different quantities under ${fmtGamma(a, b)}: Pr(W_SB > .5) = ${fmtProb(sb)} is the chance that a randomly chosen customer's table holds more than half of the population; ` +
      `Pr(W_max > .5) = ${fmtProb(wm)} is the chance that the largest table does. The red share above is a finite-J version of the second (${state.J} customers, not the population).`;
  };

  const renderAll = () => {
    const t0 = performance.now();
    drawHistograms();
    drawWall();
    drawOne();
    drawCaption();
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  const simulate = (animate) => {
    globalThis.cancelAnimationFrame?.(raf);
    rest = simulateRestaurants(state.a, state.b, state.J, N_REST, state.seed);
    state.sel = Math.min(state.sel, N_REST - 1);
    if (!animate || reducedMotion() || typeof requestAnimationFrame !== "function") {
      state.shown = N_REST;
      renderAll();
      return;
    }
    state.shown = BATCH;
    const step = () => {
      renderAll();
      if (state.shown < N_REST) {
        state.shown = Math.min(N_REST, state.shown + BATCH);
        raf = requestAnimationFrame(step);
      }
    };
    step();
  };

  const pick = (i) => {
    state.sel = Math.max(0, Math.min(state.shown - 1, i));
    drawWall();
    drawOne();
  };
  canvas.addEventListener("pointermove", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const cell = rect.width / WALL_COLS;
    const i = Math.floor((ev.clientY - rect.top) / cell) * WALL_COLS + Math.floor((ev.clientX - rect.left) / cell);
    if (i >= 0 && i < state.shown && i !== state.sel) pick(i);
  });

  const run = button({ label: `Simulate ${N_REST} restaurants`, primary: true, onClick: () => { state.seed += 1; seedOut.textContent = `seed ${state.seed}`; simulate(true); } });
  const seedOut = h("span", { class: "dpx-value", text: `seed ${state.seed}` });
  const sa = slider({ label: "a (shape)", min: 0.05, max: 50, value: state.a, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.a = v; simulate(false); } });
  const sb = slider({ label: "b (rate)", min: 0.05, max: 50, value: state.b, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.b = v; simulate(false); } });
  const sJ = slider({ label: "J (customers per restaurant)", min: 10, max: 200, step: 1, value: state.J, format: (v) => String(Math.round(v)), onInput: (v) => { state.J = Math.round(v); simulate(false); } });
  ui.controls.append(sa.root, sb.root, sJ.root, h("div", { class: "dpx-control dpx-buttons" }, run, seedOut));
  ui.caption.textContent =
    "Each restaurant draws alpha from the Gamma prior, then seats customers one by one: an occupied table with probability proportional to its size, a new table with probability proportional to alpha. Seeded draws; K_J is the number of fitted components (occupied clusters) among the J units.";
  const unbind = bindPrimaryKey(ui.root, () => run.click());
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) renderAll(); });
  simulate(false);
  ready = true;
  return {
    update(next = {}) {
      if (next.a !== undefined) { state.a = num(next, "a", state.a, 0.05, 50); sa.set(state.a); }
      if (next.b !== undefined) { state.b = num(next, "b", state.b, 0.05, 50); sb.set(state.b); }
      if (next.J !== undefined) { state.J = Math.round(num(next, "J", state.J, 10, 200)); sJ.set(state.J); }
      if (next.seed !== undefined) { state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9)); seedOut.textContent = `seed ${state.seed}`; }
      simulate(false);
    },
    pick,
    destroy() { globalThis.cancelAnimationFrame?.(raf); stop(); unbind(); el.replaceChildren(); },
  };
}
