// M-17 "Dominance ribbon" and M-18 "Order of appearance versus size". Owner of this file:
// Step 5.6 (after Broderick's stick-breaking rows, MLSS 2016; re-implemented).
//
// Each row draws alpha from the hyperprior and then one GEM(alpha) stick (breaking stops
// when less than 1e-3 remains; the rest is grey). Ribbon mode (M-17): 50 rows with the
// first piece, the size-biased weight W_SB, in full colour and the later pieces faded; rows
// whose first piece is above one half are marked, and their share estimates
// S(.5) = Pr(W_SB > .5). sb-vs-ranked mode (M-18): the first 20 of the same draws, each
// shown in the order the pieces broke off and again sorted by size; rows where the first
// piece is not the largest are marked. A first piece above one half is always the largest,
// because the other pieces share less than one half.
import * as dp from "../dp-core.js";
import worked from "../../data/precomputed/worked_example_j50.js";
import { palette } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtAlpha, fmtGamma, fmtProb } from "./format.js";

const DA = worked.stages.find((s) => s.key === "da");
const PRESETS = [
  { key: "g11", label: "Gamma(1, 1)", a: 1, b: 1 },
  { key: "g13", label: "Gamma(1, 3)", a: 1, b: 3 },
  { key: "da", label: `Dual-Anchor ${fmtGamma(DA.a, DA.b)}`, a: DA.a, b: DA.b },
];
const ROWS = { ribbon: 50, "sb-vs-ranked": 20 };
const GUTTER = 18;

/** n rows: alpha ~ Gamma(a, b), then one GEM(alpha) draw each. */
export function drawRows(a, b, n, seed) {
  const rng = dp.makeRng(seed);
  const rows = [];
  for (let r = 0; r < n; r += 1) {
    const alpha = dp.rgamma(rng, a) / b;
    const g = dp.rgem(rng, alpha);
    let maxIdx = 0;
    for (let k = 1; k < g.w.length; k += 1) if (g.w[k] > g.w[maxIdx]) maxIdx = k;
    rows.push({ r, alpha, w: g.w, rest: g.rest, first: g.w[0], max: g.w[maxIdx], maxIdx });
  }
  return rows;
}

export function mountWidget(el, spec = {}) {
  const preset = PRESETS.find((p) => p.key === spec.preset) ?? PRESETS[0];
  const state = {
    mode: spec.mode === "sb-vs-ranked" ? "sb-vs-ranked" : "ribbon",
    a: num(spec, "a", preset.a, 0.05, 50),
    b: num(spec, "b", preset.b, 0.05, 50),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    sel: 0,
  };
  const tally = { draws: 0, rows: 0, above: 0 };
  let rows = [];
  const ui = frame(el, {
    label: state.mode === "ribbon"
      ? "Dominance ribbon: 50 stick-breaking draws under a hyperprior, first piece highlighted"
      : "Order of appearance versus size: the same stick-breaking draws, first piece versus largest piece",
    className: "dpx-ribbon",
  });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const title = h("p", { class: "dpx-panel-title" });
  const canvas = h("canvas", { role: "img" });
  const legend = h("p", { class: "dpx-legend" });
  const hover = h("p", { class: "dpx-caption-note", "aria-live": "polite" });
  const rowPick = slider({ label: "Inspect row", min: 1, max: ROWS.ribbon, step: 1, value: 1, format: (v) => String(Math.round(v)), onInput: (v) => pick(Math.round(v) - 1) });
  panel.append(title, canvas, legend, rowPick.root, hover);
  ui.charts.append(panel);
  let width = 720;

  const nRows = () => ROWS[state.mode];
  const name = () => PRESETS.find((p) => p.a === state.a && p.b === state.b)?.label ?? fmtGamma(state.a, state.b);

  const redraw = (count) => {
    rows = drawRows(state.a, state.b, ROWS.ribbon, state.seed);
    if (count) {
      tally.draws += 1;
      tally.rows += rows.length;
      tally.above += rows.filter((d) => d.first > dp.MAJORITY_T).length;
    }
  };

  const describe = (d) =>
    `Row ${d.r + 1}: alpha = ${fmtAlpha(d.alpha)}; first piece (W_SB) ${fmt(d.first, 3)}; largest piece ${fmt(d.max, 3)}${d.maxIdx === 0 ? " (the first)" : ` (piece ${d.maxIdx + 1} to break off)`}; ${d.w.length} pieces before less than 1e-3 was left.`;

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const n = nRows();
    const shown = rows.slice(0, n);
    const ribbon = state.mode === "ribbon";
    const W = width;
    const barW = Math.max(120, W - GUTTER - 8);
    const rowH = ribbon ? 7 : 16;
    const gap = ribbon ? 2 : 6;
    const H = n * (rowH + gap);
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const S5 = dp.wsbTail(dp.MAJORITY_T, state.a, state.b);
    const Wm = dp.wmaxTail(dp.MAJORITY_T, state.a, state.b);
    const above = shown.filter((d) => d.first > dp.MAJORITY_T).length;
    const notMax = shown.filter((d) => d.maxIdx !== 0).length;
    const ctx = canvas.getContext?.("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const bar = (list, y, hgt, fade, ring) => {
        let cum = 0;
        for (const p of list) {
          ctx.globalAlpha = fade(p.k) ? 0.28 : 1;
          ctx.fillStyle = c.brod[p.k % 6];
          ctx.fillRect(GUTTER + cum * barW, y, Math.max(0.3, p.w * barW), hgt);
          if (ring === p.k) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = c.fg;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(GUTTER + cum * barW + 0.75, y + 0.75, Math.max(0.5, p.w * barW - 1.5), hgt - 1.5);
          }
          cum += p.w;
        }
        ctx.globalAlpha = 1;
        return cum;
      };
      shown.forEach((d, i) => {
        const y = i * (rowH + gap);
        const list = d.w.map((w, k) => ({ w, k }));
        let cum;
        if (ribbon) {
          cum = bar(list, y, rowH, (k) => k !== 0, null);
        } else {
          const half = (rowH - 1) / 2;
          cum = bar(list, y, half, () => false, d.maxIdx !== 0 ? d.maxIdx : null);
          bar([...list].sort((p, q) => q.w - p.w), y + half + 1, half, () => false, d.maxIdx !== 0 ? 0 : null);
        }
        ctx.fillStyle = c.unused;
        ctx.fillRect(GUTTER + cum * barW, y, Math.max(0.5, d.rest * barW), rowH);
        const flag = ribbon ? d.first > dp.MAJORITY_T : d.maxIdx !== 0;
        if (flag) {
          ctx.fillStyle = c.marker;
          ctx.beginPath();
          ctx.arc(GUTTER / 2, y + rowH / 2, Math.min(4, rowH / 2), 0, 2 * Math.PI);
          ctx.fill();
        }
        if (state.sel === i) {
          ctx.strokeStyle = c.fg;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(GUTTER - 2, y - 1, barW + 4, rowH + 2);
        }
      });
      ctx.strokeStyle = c.marker;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(GUTTER + dp.MAJORITY_T * barW, 0);
      ctx.lineTo(GUTTER + dp.MAJORITY_T * barW, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const avg = tally.rows ? tally.above / tally.rows : NaN;
    if (ribbon) {
      title.textContent = `${n} draws under ${name()}: first piece in colour, red dot when it is above one half`;
      canvas.setAttribute("aria-label", `${n} stick-breaking rows under ${name()}; in ${above} the first piece is above one half.`);
      legend.replaceChildren(
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.brod[0]};height:0.6rem` }), "first piece (W_SB)"),
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.brod[1]};opacity:.28;height:0.6rem` }), "later pieces"),
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.unused};height:0.6rem` }), "rest below 1e-3"),
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `border-left:2px dashed ${c.marker};height:0.8rem;width:0` }), "one half"),
      );
      ui.readout.textContent =
        `${name()}: in ${above} of ${n} rows the first piece is above one half (${fmtProb(above / n)}); ` +
        `over ${tally.draws} ${tally.draws === 1 ? "draw" : "draws"} (${tally.rows} rows) ${fmtProb(avg)}. Exact Pr(W_SB > .5) = ${fmtProb(S5)}.`;
    } else {
      title.textContent = `${n} draws under ${name()}: each row in breaking order (top) and sorted by size (bottom)`;
      canvas.setAttribute("aria-label", `${n} stick-breaking rows under ${name()}, each shown in breaking order and sorted by size; in ${notMax} rows the first piece is not the largest.`);
      legend.replaceChildren(
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.brod[0]};height:0.6rem` }), "first piece to break off (blue)"),
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `border:1.5px solid ${c.fg};height:0.6rem` }), "outlined: the largest piece (top) and where the first piece ranks (bottom)"),
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.marker};height:0.5rem;width:0.5rem;border-radius:50%` }), "first piece is not the largest"),
      );
      ui.readout.textContent =
        `${name()}: in ${notMax} of ${n} rows the first piece is not the largest. In the ${shown.filter((d) => d.first > dp.MAJORITY_T).length} rows where it is above one half it is always the largest. ` +
        `So Pr(W_SB > .5) = ${fmtProb(S5)} never exceeds Pr(W_max > .5) = ${fmtProb(Wm)}.`;
    }
    if (state.sel >= n) state.sel = n - 1;
    rowPick.input.max = String(n);
    rowPick.set(state.sel + 1);
    hover.textContent = describe(shown[state.sel]);
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.above = String(above / n);
    ui.root.dataset.average = String(avg);
    ui.root.dataset.notMax = String(notMax);
  };

  const pick = (i) => {
    state.sel = Math.max(0, Math.min(nRows() - 1, i));
    render();
  };
  canvas.addEventListener("pointermove", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const per = rect.height / nRows();
    const i = Math.floor((ev.clientY - rect.top) / per);
    if (i >= 0 && i < nRows() && i !== state.sel) pick(i);
  });

  const presetSeg = segmented({ label: "Hyperprior", options: PRESETS.map((p) => ({ value: p.key, label: p.label })), value: PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null,
    onChange: (v) => { const p = PRESETS.find((q) => q.key === v); state.a = p.a; state.b = p.b; Object.assign(tally, { draws: 0, rows: 0, above: 0 }); redraw(true); render(); } });
  const modeSeg = segmented({ label: "Show", options: [{ value: "ribbon", label: "first piece (M-17)" }, { value: "sb-vs-ranked", label: "breaking order vs size (M-18)" }], value: state.mode,
    onChange: (v) => { state.mode = v; render(); } });
  const seedOut = h("span", { class: "dpx-value", text: `seed ${state.seed}` });
  const again = button({ label: "Redraw", primary: true, onClick: () => { state.seed += 1; seedOut.textContent = `seed ${state.seed}`; redraw(true); render(); } });
  ui.controls.append(presetSeg.root, modeSeg.root, h("div", { class: "dpx-control dpx-buttons" }, again, seedOut));
  ui.caption.textContent =
    "After Broderick (MLSS 2016; 2012 tutorial). Every row draws its own alpha from the hyperprior, then breaks a unit stick: V_k ~ Beta(1, alpha), w_k = V_k x (what is left). Pieces keep the colour of their breaking order (blue, orange, green, purple, red, yellow, repeating). The first piece is W_SB, the share of a randomly chosen unit's cluster; the largest piece is W_max.";
  const unbind = bindPrimaryKey(ui.root, () => again.click());
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  redraw(true);
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.preset !== undefined) {
        const p = PRESETS.find((q) => q.key === next.preset);
        if (p) { state.a = p.a; state.b = p.b; }
      }
      if (next.a !== undefined) state.a = num(next, "a", state.a, 0.05, 50);
      if (next.b !== undefined) state.b = num(next, "b", state.b, 0.05, 50);
      if (next.mode !== undefined) state.mode = next.mode === "sb-vs-ranked" ? "sb-vs-ranked" : "ribbon";
      if (next.seed !== undefined) { state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9)); seedOut.textContent = `seed ${state.seed}`; }
      presetSeg.set(PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null);
      modeSeg.set(state.mode);
      Object.assign(tally, { draws: 0, rows: 0, above: 0 });
      redraw(true);
      render();
    },
    redraw: () => again.click(),
    pick,
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}
