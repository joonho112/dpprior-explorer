// P-14 "The EPPF and exchangeability" (after Broderick, MLSS 2016 part II and the 2012 tutorial;
// re-implemented from the mathematics). Owner of this file: Step 6.11.
//
// Seating customers one at a time by the Chinese restaurant rule gives the partition
// {{1, 2, 7, 8}, {3, 5, 6}, {4}} a probability that is a product of factors: alpha/(alpha + n - 1)
// when customer n opens a table, m/(alpha + n - 1) when it joins a table of m. Whatever the
// arrival order, the product is the exchangeable partition probability function
//   P(Pi_N) = alpha^K prod_C (|C| - 1)! / prod_{n=1}^{N} (alpha + n - 1).
import * as dp from "../dp-core.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, slider } from "./base.js";
import { labelOn, palette } from "./chart.js";
import { fmt, fmtAlpha, fmtCount } from "./format.js";

const EXAMPLE = [[1, 2, 7, 8], [3, 5, 6], [4]]; // Broderick's eight-customer example

/** Factors of the seating in the given arrival order. */
export function seatingFactors(blocks, order, alpha) {
  const blockOf = new Map();
  blocks.forEach((b, j) => b.forEach((c) => blockOf.set(c, j)));
  const size = new Map();
  return order.map((c, idx) => {
    const n = idx + 1;
    const j = blockOf.get(c);
    const m = size.get(j) ?? 0;
    size.set(j, m + 1);
    return { c, n, isNew: m === 0, m, value: (m === 0 ? alpha : m) / (alpha + n - 1) };
  });
}

/** The EPPF: alpha^K prod (|C| - 1)! / prod (alpha + n - 1), on the log scale. */
export function eppf(blocks, alpha) {
  const N = blocks.reduce((s, b) => s + b.length, 0);
  let l = blocks.length * Math.log(alpha);
  for (const b of blocks) l += dp.lgamma(b.length);
  l -= dp.logRising(alpha, N);
  return Math.exp(l);
}

export function mountWidget(el, spec = {}) {
  const state = { alpha: num(spec, "alpha", 1, 0.01, 20), seed: Math.round(num(spec, "seed", 1, 1, 1e9)) };
  let blocks = EXAMPLE.map((b) => [...b]);
  let order = blocks.flat().sort((a, b) => a - b);
  let rng = dp.makeRng(state.seed);
  const ui = frame(el, { label: "The EPPF: the probability of a seating is the same in every arrival order", className: "dpx-eppf" });
  const pSeat = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pEx = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pSeat, pEx);
  const seatTitle = h("p", { class: "dpx-panel-title" });
  const d3 = globalThis.d3;
  const svg = d3.create("svg").attr("role", "img");
  const factorsLine = h("p", { class: "dpx-factors", "aria-live": "polite" });
  const check = h("p", { class: "dpx-readout", style: "border-left-color: var(--dp-teal)" });
  pSeat.append(seatTitle, svg.node(), factorsLine, check);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part II; 2012 tutorial). Circles are customers in arrival order, coloured by the table they end up at. Under each customer is the probability of its choice given the customers before it.";
  let width = 720;

  // exercise box: E[K_N] = sum alpha / (alpha + n - 1)
  const exN = 8;
  const exBox = h("div");
  pEx.append(h("p", { class: "dpx-panel-title", text: "Exercise: the expected number of tables" }), exBox);

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const a = state.alpha;
    const fs = seatingFactors(blocks, order, a);
    const prod = fs.reduce((p, f) => p * f.value, 1);
    const closed = eppf(blocks, a);
    const blockOf = new Map();
    blocks.forEach((b, j) => b.forEach((cust) => blockOf.set(cust, j)));
    const W = width;
    const n = order.length;
    const step = Math.min(84, (W - 20) / n);
    const H = 118;
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    fs.forEach((f, i) => {
      const x = 10 + step * (i + 0.5);
      const col = c.brod[blockOf.get(f.c) % 6];
      svg.append("circle").attr("cx", x).attr("cy", 30).attr("r", 18).attr("fill", col).attr("stroke", c.stroke).attr("stroke-opacity", 0.5);
      svg.append("text").attr("x", x).attr("y", 36).attr("text-anchor", "middle").attr("font-size", 15).attr("font-weight", 700).attr("fill", labelOn(col, c)).text(f.c);
      svg.append("text").attr("x", x).attr("y", 72).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", c.fg)
        .text(f.isNew ? "alpha" : String(f.m));
      svg.append("line").attr("x1", x - 22).attr("x2", x + 22).attr("y1", 78).attr("y2", 78).attr("stroke", c.fg);
      svg.append("text").attr("x", x).attr("y", 94).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", c.fg).text(f.n === 1 ? "alpha" : `alpha + ${f.n - 1}`);
      svg.append("text").attr("x", x).attr("y", 112).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", c.muted).text(fmt(f.value, 3));
    });
    svg.attr("aria-label", `Arrival order ${order.join(", ")}; factors ${fs.map((f) => (f.isNew ? `alpha/(alpha+${f.n - 1})` : `${f.m}/(alpha+${f.n - 1})`)).join(" times ")}.`);
    seatTitle.textContent = `Arrival order ${order.join(", ")}: the partition ${blocks.map((b) => `{${[...b].sort((x, y) => x - y).join(", ")}}`).join(", ")}`;
    const den = (f) => (f.n === 1 ? "alpha" : `(alpha + ${f.n - 1})`);
    factorsLine.textContent = `P = ${fs.map((f) => `${f.isNew ? "alpha" : f.m}/${den(f)}`).join(" · ")} = ${prod.toExponential(6)} at alpha = ${fmtAlpha(a)}.`;
    const K = blocks.length;
    const sizes = blocks.map((b) => b.length);
    check.textContent = `EPPF: alpha^K prod (|C| - 1)! / prod (alpha + n - 1) with K = ${K} and table sizes ${sizes.join(", ")} gives ${closed.toExponential(6)}; |product - EPPF| = ${Math.abs(prod - closed).toExponential(1)}. Shuffle the arrival order: the factors change, the product does not.`;
    const ek = dp.condMean(exN, a);
    exBox.replaceChildren(
      h("p", { text: `Each new customer n opens a table with probability alpha/(alpha + n - 1). What is the expected number of tables after ${exN} customers at alpha = ${fmtAlpha(a)}?` }),
      h("details", {}, h("summary", { text: "Answer" }), h("p", { text: `E[K_${exN}] = sum over n = 1..${exN} of alpha/(alpha + n - 1) = ${Array.from({ length: exN }, (_, i) => fmt(a / (a + i), 3)).join(" + ")} = ${fmtCount(ek)}. At alpha = 1 this is the harmonic number H_${exN} = ${fmt(dp.condMean(exN, 1), 2)}; for large N it grows like alpha log N.` })),
    );
    ui.readout.textContent = `alpha = ${fmtAlpha(a)}: the seating has probability ${prod.toExponential(4)} in this order, and the same in any order (EPPF ${closed.toExponential(4)}). The probability depends only on the table sizes, not on who came first: the partition is exchangeable.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.prod = String(prod);
    ui.root.dataset.eppf = String(closed);
  };

  const shuffle = () => {
    const o = [...order];
    for (let i = o.length - 1; i > 0; i -= 1) { const j = Math.floor(rng.next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    order = o;
    render();
  };
  const sAlpha = slider({ label: "alpha", min: 0.01, max: 20, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { state.alpha = v; render(); } });
  const bShuffle = button({ label: "Shuffle arrival order", primary: true, onClick: shuffle });
  const bSort = button({ label: "Order 1 to 8", onClick: () => { order = blocks.flat().sort((x, y) => x - y); render(); } });
  const bNew = button({ label: "New seating", onClick: () => {
    const crp = new dp.Crp(state.alpha, rng);
    const tables = [];
    for (let i = 1; i <= 8; i += 1) { const s = crp.seat(); if (s.isNew) tables.push([i]); else tables[s.table].push(i); }
    blocks = tables;
    order = blocks.flat().sort((x, y) => x - y);
    render();
  } });
  const bExample = button({ label: "Broderick's example", onClick: () => { blocks = EXAMPLE.map((b) => [...b]); order = blocks.flat().sort((x, y) => x - y); render(); } });
  ui.controls.append(sAlpha.root, h("div", { class: "dpx-control dpx-buttons" }, bShuffle, bSort, bNew, bExample));
  const unbind = bindPrimaryKey(ui.root, shuffle);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.alpha !== undefined) { state.alpha = num(next, "alpha", state.alpha, 0.01, 20); sAlpha.set(state.alpha); }
      if (next.seed !== undefined) { state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9)); rng = dp.makeRng(state.seed); }
      render();
    },
    shuffle,
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}
