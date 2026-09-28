// P-05 GEM stick-breaking staircase (after Broderick, MLSS 2016 part I, slides 9-10;
// re-implemented from the mathematics, no code from her GPL-3 demos).
//
// V_k ~ Beta(1, alpha), w_k = V_k * prod_{j<k} (1 - V_j). A small alpha breaks off most
// of the stick at once (E[w_1] = 1/(1 + alpha), Pr(w_1 > .5) = 0.5^alpha); a large alpha
// crumbles it into many small pieces. Breaking stops when less than 1e-3 remains; the rest
// is drawn as one grey piece. SVG for the live draw, Canvas for the 20 ghost rows.
import * as dp from "../dp-core.js";
import { palette } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, reducedMotion, segmented, slider, toggle } from "./base.js";
import { fmt, fmtAlpha, fmtProb } from "./format.js";

const PRESETS = [0.5, 1, 2, 10, 100];
const STAIR_ROWS = 10;
const GHOSTS = 20;
const COLLAPSE_W = 0.9;

export function mountWidget(el, spec = {}) {
  const state = {
    alpha: num(spec, "alpha", 2, 0.02, 200),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    order: spec.order === "ranked" ? "ranked" : "size-biased",
    ghosts: Boolean(spec.ghosts ?? false),
    shown: STAIR_ROWS, // staircase rows revealed (Step mode reveals one at a time)
  };
  let draw = dp.rgem(dp.makeRng(state.seed), state.alpha);
  const ui = frame(el, { label: "Stick-breaking: how the concentration alpha splits a unit stick into cluster weights", className: "dpx-stick" });
  const svgWrap = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const ghostWrap = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const canvas = h("canvas", { role: "img", "aria-label": "Twenty more independent stick-breaking draws with the same alpha" });
  ghostWrap.append(h("p", { class: "dpx-panel-title", text: "20 more draws with the same alpha (each row is one stick)" }), canvas);
  ui.charts.append(svgWrap, ghostWrap);
  const badge = h("span", { class: "dpx-badge", text: "collapse: one piece > .9", hidden: true });
  ui.caption.textContent =
    "After Broderick (MLSS 2016; 2012 tutorial). Pieces are coloured in the order they are broken off (blue, orange, green, purple, red, yellow, repeating); grey is the leftover below 1e-3. The first piece is the size-biased weight W_SB of a randomly chosen unit's cluster.";

  let width = 720;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("role", "img");
  svgWrap.append(h("p", { class: "dpx-panel-title", text: "One stick, broken piece by piece (staircase: first 10 breaks)" }), svg);

  const pieces = () => {
    const list = draw.w.map((w, i) => ({ w, v: draw.v[i], k: i + 1, color: i % 6 }));
    if (state.order === "ranked") list.sort((x, y) => y.w - x.w);
    return list;
  };

  function renderSvg(animateRow = -1) {
    const c = palette(ui.root);
    const d3 = globalThis.d3;
    const W = width;
    const left = 12;
    const right = 130;
    const barW = Math.max(120, W - left - right);
    const rowH = 18;
    const topH = 46;
    const rows = Math.min(STAIR_ROWS, draw.w.length);
    const H = topH + 14 + rows * (rowH + 6) + 8;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    const x = (u) => left + u * barW;
    const sel = d3.select(svg);
    sel.selectAll("*").remove();
    // top bar: all pieces in the chosen order, plus the grey rest
    const list = pieces();
    let cum = 0;
    const top = sel.append("g").attr("aria-hidden", "true");
    for (const p of list) {
      top.append("rect").attr("x", x(cum)).attr("y", 8).attr("width", Math.max(0.3, p.w * barW)).attr("height", 30)
        .attr("fill", c.brod[p.color]).attr("stroke", c.stroke).attr("stroke-opacity", p.w * barW > 3 ? 0.55 : 0).attr("stroke-width", 0.8);
      cum += p.w;
    }
    top.append("rect").attr("x", x(cum)).attr("y", 8).attr("width", Math.max(0.5, draw.rest * barW)).attr("height", 30).attr("fill", c.unused);
    top.append("rect").attr("x", x(0)).attr("y", 8).attr("width", barW).attr("height", 30).attr("fill", "none").attr("stroke", c.fg).attr("stroke-width", 1);
    top.append("text").attr("x", x(1) + 8).attr("y", 28).attr("fill", c.fg).attr("font-size", 12).attr("font-weight", 700)
      .text(`${draw.w.length} ${draw.w.length === 1 ? "piece" : "pieces"}`);
    // staircase (size-biased order, as broken)
    const stair = sel.append("g");
    let before = 0;
    for (let k = 0; k < rows; k += 1) {
      const y = topH + 14 + k * (rowH + 6);
      const w = draw.w[k];
      const visible = k < state.shown;
      const g = stair.append("g").attr("opacity", visible ? 1 : 0);
      // what is left before break k (white stick with outline), then the piece
      g.append("rect").attr("x", x(before)).attr("y", y).attr("width", Math.max(0.5, (1 - before) * barW)).attr("height", rowH)
        .attr("fill", c.rest).attr("stroke", c.borderStrong);
      const piece = g.append("rect").attr("x", x(before)).attr("y", y).attr("height", rowH).attr("fill", c.brod[k % 6])
        .attr("stroke", c.stroke).attr("stroke-opacity", 0.6).attr("stroke-width", 0.8);
      if (k === animateRow && !reducedMotion()) {
        piece.attr("width", 0).transition().duration(450).attr("width", Math.max(0.5, w * barW));
      } else piece.attr("width", Math.max(0.5, w * barW));
      g.append("text").attr("x", x(1) + 8).attr("y", y + rowH - 5).attr("fill", c.muted).attr("font-size", 11)
        .text(`V${k + 1} = ${fmt(draw.v[k], 2)}, w${k + 1} = ${fmt(w, 3)}`);
      before += w;
    }
    const maxW = Math.max(...draw.w);
    svg.setAttribute("aria-label",
      `One stick-breaking draw with alpha = ${fmtAlpha(state.alpha)}: ${draw.w.length} pieces; first piece ${fmt(draw.w[0], 3)}; largest piece ${fmt(maxW, 3)}.`);
  }

  function renderGhosts() {
    ghostWrap.hidden = !state.ghosts;
    if (!state.ghosts) return;
    const c = palette(ui.root);
    const W = width;
    const rowH = 9;
    const gap = 3;
    const H = GHOSTS * (rowH + gap);
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext?.("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const left = 12;
    const barW = Math.max(120, W - left - 130);
    const rng = dp.makeRng(state.seed * 7919 + 17);
    for (let r = 0; r < GHOSTS; r += 1) {
      const g = dp.rgem(rng, state.alpha);
      const list = g.w.map((w, i) => ({ w, color: i % 6 }));
      if (state.order === "ranked") list.sort((a, b) => b.w - a.w);
      let cum = 0;
      const y = r * (rowH + gap);
      for (const p of list) {
        ctx.fillStyle = c.brod[p.color];
        ctx.fillRect(left + cum * barW, y, Math.max(0.3, p.w * barW), rowH);
        cum += p.w;
      }
      ctx.fillStyle = c.unused;
      ctx.fillRect(left + cum * barW, y, Math.max(0.5, g.rest * barW), rowH);
    }
  }

  function readout() {
    const a = state.alpha;
    const maxW = Math.max(...draw.w);
    badge.hidden = !(maxW > COLLAPSE_W);
    ui.readout.textContent =
      `alpha = ${fmtAlpha(a)}: E[w1] = 1/(1 + alpha) = ${fmtProb(1 / (1 + a))}, Pr(w1 > .5) = 0.5^alpha = ${fmtProb(0.5 ** a)}. ` +
      `This draw (seed ${state.seed}): ${draw.w.length} ${draw.w.length === 1 ? "piece" : "pieces"} before less than .001 is left; first piece ${fmt(draw.w[0], 3)}, largest ${fmt(maxW, 3)}.`;
    ui.readout.append(badge);
  }

  function renderAll(animateRow = -1) {
    const t0 = performance.now();
    renderSvg(animateRow);
    renderGhosts();
    readout();
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  }

  const newDraw = () => {
    state.seed += 1;
    draw = dp.rgem(dp.makeRng(state.seed), state.alpha);
    state.shown = STAIR_ROWS;
    renderAll();
  };
  const stepOnce = () => {
    if (state.shown >= Math.min(STAIR_ROWS, draw.w.length)) {
      state.seed += 1;
      draw = dp.rgem(dp.makeRng(state.seed), state.alpha);
      state.shown = 0;
    }
    state.shown += 1;
    renderAll(state.shown - 1);
  };
  const setAlpha = (a) => {
    state.alpha = a;
    draw = dp.rgem(dp.makeRng(state.seed), state.alpha);
    state.shown = STAIR_ROWS;
    renderAll();
  };

  const sAlpha = slider({ label: "alpha (concentration)", min: 0.02, max: 200, value: state.alpha, log: true, format: (v) => fmtAlpha(v), onInput: (v) => { presetSeg.set(null); setAlpha(v); } });
  const presetSeg = segmented({
    label: "Presets",
    options: PRESETS.map((a) => ({ value: a, label: String(a) })),
    value: PRESETS.includes(state.alpha) ? state.alpha : null,
    onChange: (v) => { sAlpha.set(v); setAlpha(v); },
  });
  const orderSeg = segmented({
    label: "Order",
    options: [{ value: "size-biased", label: "as broken (size-biased)" }, { value: "ranked", label: "ranked by size" }],
    value: state.order,
    onChange: (v) => { state.order = v; renderAll(); },
  });
  const ghostT = toggle({ label: "x20 rows", checked: state.ghosts, onChange: (v) => { state.ghosts = v; renderAll(); } });
  ui.controls.append(
    sAlpha.root, presetSeg.root,
    h("div", { class: "dpx-control dpx-buttons" }, button({ label: "Break again", primary: true, onClick: newDraw, title: "Enter" }), button({ label: "Step", onClick: stepOnce, title: "Reveal the staircase one break at a time" })),
    orderSeg.root, ghostT.root,
  );
  const unbind = bindPrimaryKey(ui.root, newDraw);
  ui.root.setAttribute("tabindex", "-1");
  const stop = observeWidth(ui.charts, (w) => { width = w; renderAll(); });
  renderAll();
  return {
    update(next = {}) {
      if (next.seed !== undefined) state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9));
      if (next.order) state.order = next.order === "ranked" ? "ranked" : "size-biased";
      if (next.ghosts !== undefined) { state.ghosts = Boolean(next.ghosts); ghostT.set(state.ghosts); }
      if (next.alpha !== undefined) {
        const a = num(next, "alpha", state.alpha, 0.02, 200);
        sAlpha.set(a);
        presetSeg.set(PRESETS.includes(a) ? a : null);
        setAlpha(a);
        return;
      }
      draw = dp.rgem(dp.makeRng(state.seed), state.alpha);
      renderAll();
    },
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}
