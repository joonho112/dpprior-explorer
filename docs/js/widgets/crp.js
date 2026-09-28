// P-07 Chinese restaurant process (after Broderick, MLSS 2016 part II; 2012 tutorial;
// re-implemented from the mathematics).
//
// Customer n + 1 joins an occupied table k with probability n_k / (alpha + n) and opens a
// new table with probability alpha / (alpha + n): alpha acts as a pseudo-count for the
// tables not seen yet. Tables are circles whose area grows with occupancy; the dashed
// circle is the next new table. The probability bar shows the next customer's options
// (the alpha piece highlighted); the factor strip multiplies the probabilities of the
// realised seating (the EPPF). At J = 79 (the STAR schools) the new-table probability is
// alpha / (alpha + 78): 1.3% at alpha = 1, 6.0% at alpha = 5.
import * as dp from "../dp-core.js";
import { labelOn, palette } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, reducedMotion, segmented, select, slider, toggle } from "./base.js";
import { fmt, fmtAlpha, fmtPct } from "./format.js";

const PRESETS = [0.01, 0.5, 1, 2];
const MAX_N = 1000;
const FACTORS_SHOWN = 8;
const J_STAR = 79;
const SPEEDS = { slow: 700, normal: 300, fast: 80 };

/**
 * Table circles for a restaurant (shared with M-05 crp-unintended.js): area grows with
 * occupancy, rows wrap at width W. With newTable the last circle is the dashed "new" table.
 */
export function tableLayout(counts, W, { newTable = true, rMax: rCap = 46 } = {}) {
  const n = counts.reduce((a, b) => a + b, 0) || 1;
  const maxC = Math.max(1, ...counts);
  const rMax = Math.min(rCap, Math.max(16, W / 12));
  const scale = (c) => 5 + (rMax - 5) * Math.sqrt(c / maxC);
  const pos = [];
  let x = 8;
  let y = 8;
  let rowH = 0;
  const all = newTable ? [...counts, 0] : counts;
  all.forEach((c, i) => {
    const r = i < counts.length ? scale(c) : Math.max(10, scale(maxC) * 0.45);
    if (x + 2 * r > W - 8 && x > 8) {
      x = 8;
      y += rowH + 10;
      rowH = 0;
    }
    pos.push({ cx: x + r, cy: y + r, r, c, i, isNew: i === counts.length });
    x += 2 * r + 10;
    rowH = Math.max(rowH, 2 * r);
  });
  return { pos, H: y + rowH + 12, n };
}

export function mountWidget(el, spec = {}) {
  const state = {
    alpha: num(spec, "alpha", 1, 0.01, 10),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    sites: spec.terms === "sites",
    playing: false,
    speed: "normal",
  };
  let crp;
  let steps = []; // CrpStep per customer
  const reset = () => {
    crp = new dp.Crp(state.alpha, dp.makeRng(state.seed));
    steps = [];
  };
  reset();

  const ui = frame(el, { label: "Chinese restaurant process: customers choose tables with probability proportional to occupancy, new tables with probability proportional to alpha", className: "dpx-crp" });
  const pRoom = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pBar = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const factors = h("p", { class: "dpx-factors", style: "grid-column: 1 / -1", "aria-label": "Probability factors of the realised seating" });
  ui.charts.append(pRoom, pBar, factors);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part II; 2012 tutorial). Circle area is proportional to the number seated; colours follow the order in which tables opened. Draws are seeded: the same seed and alpha give the same seating.";

  const ns = "http://www.w3.org/2000/svg";
  const room = document.createElementNS(ns, "svg");
  room.setAttribute("role", "img");
  const bar = document.createElementNS(ns, "svg");
  bar.setAttribute("role", "img");
  pRoom.append(h("p", { class: "dpx-panel-title" }), room);
  pBar.append(h("p", { class: "dpx-panel-title" }), bar);
  let width = 720;

  const words = () => (state.sites ? { cust: "site", custs: "sites", table: "cluster", tables: "clusters" } : { cust: "customer", custs: "customers", table: "table", tables: "tables" });

  function renderRoom(animateLast) {
    const c = palette(ui.root);
    const d3 = globalThis.d3;
    const w = words();
    const { pos, H } = tableLayout(crp.counts, width);
    room.setAttribute("viewBox", `0 0 ${width} ${H}`);
    room.setAttribute("width", width);
    room.setAttribute("height", H);
    const sel = d3.select(room);
    sel.selectAll("*").remove();
    for (const p of pos) {
      const g = sel.append("g");
      if (p.isNew) {
        g.append("circle").attr("cx", p.cx).attr("cy", p.cy).attr("r", p.r).attr("fill", "none").attr("stroke", c.fg).attr("stroke-dasharray", "4,3");
        g.append("text").attr("x", p.cx).attr("y", p.cy + 4).attr("text-anchor", "middle").attr("font-size", 10).attr("fill", c.muted).text("new");
        continue;
      }
      const circ = g.append("circle").attr("cx", p.cx).attr("cy", p.cy).attr("fill", c.brod[p.i % 6]).attr("stroke", c.stroke).attr("stroke-opacity", 0.5);
      const last = steps[steps.length - 1];
      if (animateLast && last && last.table === p.i && !reducedMotion()) {
        circ.attr("r", last.isNew ? 0 : Math.max(0, p.r - 4)).transition().duration(260).attr("r", p.r);
      } else circ.attr("r", p.r);
      if (p.r >= 11) g.append("text").attr("x", p.cx).attr("y", p.cy + 4).attr("text-anchor", "middle").attr("font-size", Math.min(14, p.r * 0.7)).attr("font-weight", 700).attr("fill", labelOn(c.brod[p.i % 6], c)).text(p.c);
    }
    pRoom.querySelector(".dpx-panel-title").textContent = `The restaurant: ${crp.n} ${w.custs} at ${crp.tables} ${crp.tables === 1 ? w.table : w.tables}`;
    room.setAttribute("aria-label", `${crp.n} ${w.custs} seated at ${crp.tables} ${w.tables}; occupancies ${crp.counts.join(", ") || "none"}.`);
  }

  function renderBar() {
    const c = palette(ui.root);
    const d3 = globalThis.d3;
    const w = words();
    const probs = crp.nextProbs();
    const H = 46;
    const left = 8;
    const W = Math.max(200, width - 16);
    bar.setAttribute("viewBox", `0 0 ${width} ${H}`);
    bar.setAttribute("width", width);
    bar.setAttribute("height", H);
    const sel = d3.select(bar);
    sel.selectAll("*").remove();
    let x0 = left;
    probs.forEach((p, i) => {
      const isNew = i === probs.length - 1;
      const wpx = Math.max(isNew ? 2 : 0.5, p * W);
      sel.append("rect").attr("x", x0).attr("y", 4).attr("width", wpx).attr("height", 22)
        .attr("fill", isNew ? c.rest : c.brod[i % 6]).attr("stroke", isNew ? c.marker : c.stroke)
        .attr("stroke-width", isNew ? 2 : 0.6).attr("stroke-dasharray", isNew ? "4,2" : null);
      x0 += wpx;
    });
    const pNew = probs[probs.length - 1];
    sel.append("text").attr("x", left).attr("y", 42).attr("font-size", 11).attr("fill", c.muted)
      .text(width < 560 // one SVG line: the long sentence was clipped on phones (the aria-label keeps it all)
        ? `#${crp.n + 1}: new ${w.table} alpha/(alpha + ${crp.n}) = ${fmtPct(pNew, 1)} (dashed)`
        : `next ${w.cust} (#${crp.n + 1}): join a ${w.table} with probability n_k/(alpha + ${crp.n}), open a new one with probability alpha/(alpha + ${crp.n}) = ${fmtPct(pNew, 1)} (red dashed)`);
    pBar.querySelector(".dpx-panel-title").textContent = "Where can the next one sit?";
    bar.setAttribute("aria-label", `Next ${w.cust}: new ${w.table} with probability ${fmtPct(pNew, 1)}; existing ${w.tables} with probabilities proportional to ${crp.counts.join(", ") || "none"}.`);
  }

  function renderFactors() {
    const a = state.alpha;
    const shown = steps.slice(0, FACTORS_SHOWN);
    if (!shown.length) {
      factors.textContent = "Seat customers to build the probability of the seating, one factor per arrival.";
      return;
    }
    const parts = shown.map((s) => {
      const denom = s.n - 1;
      // numerator: alpha for a new table, else the occupancy n_k before this arrival
      const numer = s.isNew ? "alpha" : String(Math.round(s.probs[s.table] * (a + denom)));
      const value = s.isNew ? s.probs[s.probs.length - 1] : s.probs[s.table];
      return `${numer}/(alpha${denom ? ` + ${denom}` : ""}) = ${fmt(value, 3)}`;
    });
    let logP = 0;
    for (const s of steps) logP += Math.log(s.isNew ? s.probs[s.probs.length - 1] : s.probs[s.table]);
    const more = steps.length > FACTORS_SHOWN ? ` × … (${steps.length - FACTORS_SHOWN} more)` : "";
    factors.textContent = `Probability of this seating = ${parts.join(" × ")}${more} = ${steps.length <= FACTORS_SHOWN ? fmt(Math.exp(logP), 4) : `10^${(logP / Math.LN10).toFixed(1)}`}.`;
  }

  function readout() {
    const w = words();
    const a = state.alpha;
    const p79 = a / (a + J_STAR - 1);
    const pNext = a / (a + crp.n);
    ui.readout.textContent =
      `alpha = ${fmtAlpha(a)}: ${crp.n} ${w.custs} at ${crp.tables} ${crp.tables === 1 ? w.table : w.tables}. ` +
      `The next ${w.cust} opens a new ${w.table} with probability ${fmtPct(pNext, 1)}; ` +
      `at J = ${J_STAR} (the STAR schools) the ${J_STAR}th ${w.cust} does so with probability alpha/(alpha + ${J_STAR - 1}) = ${fmtPct(p79, 1)}. ` +
      `Expected ${w.tables} after ${J_STAR}: ${fmt(dp.condMean(J_STAR, a), 2)}.`;
  }

  const renderAll = (animateLast = false) => {
    renderRoom(animateLast);
    renderBar();
    renderFactors();
    readout();
  };

  const seat = (k) => {
    for (let i = 0; i < k && crp.n < MAX_N; i += 1) steps.push(crp.seat());
    renderAll(k === 1);
  };
  let timer = null;
  const stopPlay = () => {
    if (timer) clearInterval(timer);
    timer = null;
    state.playing = false;
    playBtn.textContent = "Play";
  };
  const startPlay = () => {
    if (reducedMotion()) {
      seat(10);
      return;
    }
    state.playing = true;
    playBtn.textContent = "Pause";
    timer = setInterval(() => {
      if (crp.n >= MAX_N) stopPlay();
      else seat(1);
    }, SPEEDS[state.speed]);
  };
  const playBtn = button({ label: "Play", onClick: () => (state.playing ? stopPlay() : startPlay()) });
  const setAlpha = (a) => {
    stopPlay();
    state.alpha = a;
    reset();
    renderAll();
  };
  const sAlpha = slider({ label: "alpha (concentration)", min: 0.01, max: 10, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { presetSeg.set(null); setAlpha(v); } });
  const presetSeg = segmented({ label: "Presets", options: PRESETS.map((a) => ({ value: a, label: String(a) })), value: PRESETS.includes(state.alpha) ? state.alpha : null, onChange: (v) => { sAlpha.set(v); setAlpha(v); } });
  const seedInput = h("input", { type: "number", min: 1, step: 1, value: state.seed, id: `seed-${Math.random().toString(36).slice(2, 7)}`, style: "width: 6rem" });
  seedInput.addEventListener("change", () => { stopPlay(); state.seed = Math.max(1, Math.round(Number(seedInput.value) || 1)); reset(); renderAll(); });
  const seedBox = h("div", { class: "dpx-control" }, h("label", { for: seedInput.id, text: "seed" }), seedInput);
  const speedSel = select({ label: "speed", options: [{ value: "slow", label: "slow" }, { value: "normal", label: "normal" }, { value: "fast", label: "fast" }], value: state.speed, onChange: (v) => { state.speed = v; if (state.playing) { stopPlay(); startPlay(); } } });
  const termT = toggle({ label: "say sites and clusters", checked: state.sites, onChange: (v) => { state.sites = v; renderAll(); } });
  ui.controls.append(
    sAlpha.root, presetSeg.root,
    h("div", { class: "dpx-control dpx-buttons" },
      button({ label: "Seat 1", primary: true, onClick: () => seat(1), title: "Enter" }),
      button({ label: "Seat 10", onClick: () => seat(10) }),
      button({ label: "Seat 100", onClick: () => seat(100) }),
      playBtn,
      button({ label: "Reset", onClick: () => { stopPlay(); reset(); renderAll(); } })),
    speedSel.root, seedBox, termT.root,
  );
  const unbind = bindPrimaryKey(ui.root, () => seat(1));
  const stop = observeWidth(ui.charts, (wd) => { width = wd; renderAll(); });
  // start with n customers seated (the embed page passes it as J, e.g. ?J=79 for STAR)
  const n0 = Math.round(num(spec, "n", num(spec, "J", 0, 0, MAX_N), 0, MAX_N));
  if (n0 > 0) seat(n0);
  renderAll();
  return {
    update(next = {}) {
      if (next.seed !== undefined) { state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9)); seedInput.value = state.seed; }
      if (next.alpha !== undefined) {
        const a = num(next, "alpha", state.alpha, 0.01, 10);
        sAlpha.set(a);
        presetSeg.set(PRESETS.includes(a) ? a : null);
        setAlpha(a);
      }
      if (next.n !== undefined) { reset(); seat(Math.round(num(next, "n", 0, 0, MAX_N))); }
      renderAll();
    },
    destroy() { stopPlay(); stop(); unbind(); el.replaceChildren(); },
    /** for tests: occupancies and customer count */
    get counts() { return [...crp.counts]; },
  };
}
