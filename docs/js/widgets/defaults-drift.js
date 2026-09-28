// M-01 "Same default, different J" and M-02 "'Conservative' defaults" (paper Fig. 2).
//
// A fixed Gamma(a, b) default lets the expected number of clusters E K_J drift upward
// with J (roughly E(alpha) log J), while the weight tail Pr(W_SB > .5) = (b/(b + log 2))^a
// does not depend on J at all. Defaults with a smaller E(alpha), such as Gamma(1, 3) or
// Gamma(2, 4), imply fewer clusters but MORE majority-mass dominance (.812, .726 vs .591).
// Numbers: dp-core (live for J <= 500); the 90% band for J > 500 is precomputed in R
// (data/precomputed/defaults_band_by_J.json).
import * as dp from "../dp-core.js";
import band from "../../data/precomputed/defaults_band_by_J.js";
import { dodge, draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, segmented, slider, toggle } from "./base.js";
import { fmtCount, fmtGamma, fmtProb } from "./format.js";

const PRIORS = [
  { key: "vague", label: "Gamma(1, 1) “vague”", short: "Gamma(1,1)", a: 1, b: 1, token: "--m-vague", dash: null },
  { key: "lit24", label: "Gamma(2, 4)", short: "Gamma(2,4)", a: 2, b: 4, token: "--dp-blue", dash: "7,3" },
  { key: "lit13", label: "Gamma(1, 3)", short: "Gamma(1,3)", a: 1, b: 3, token: "--dp-red", dash: "9,3,2,3" },
  { key: "alpha1", label: "alpha = 1 fixed", short: "alpha = 1", alpha: 1, token: "--m-neutral", dash: "2,3" },
  { key: "custom", label: "Custom Gamma(a, b)", short: "custom", a: 1.6, b: 1.22, token: "--dp-teal", dash: null },
];
const GUIDES = [
  { J: 48, label: "BD 48", anchor: "end", dx: -3 },
  { J: 79, label: "STAR 79", anchor: "start", dx: 3 },
  { J: 500, label: "Vocab 500", anchor: "start", dx: 3 },
];
const J_MIN = 10;
const J_MAX = 5000;
const J_BAND_LIVE = [10, 20, 30, 48, 79, 100, 150, 200, 300, 500];
const READ_J = [50, 100, 2000, 5000];

function jGrid() {
  const out = new Set([48, 50, 79, 100, 500, 1000, 2000, 5000]);
  for (let i = 0; i <= 60; i += 1) out.add(Math.round(J_MIN * (J_MAX / J_MIN) ** (i / 60)));
  return [...out].sort((x, y) => x - y);
}
const J_GRID = jGrid();

function makeModel(p) {
  if (p.alpha !== undefined) {
    return {
      mean: (J) => dp.condMean(J, p.alpha),
      pmf: (J) => dp.condPmf(J, p.alpha),
      wsb: (t) => dp.wsbTailGivenAlpha(t, p.alpha),
      density: () => null,
    };
  }
  const grid = dp.alphaGrid(p.a, p.b);
  return {
    mean: (J) => dp.mixExpect(grid, (al) => dp.condMeanDigamma(J, al), 1),
    pmf: (J) => dp.mixPmf(J, p.a, p.b, grid),
    wsb: (t) => dp.wsbTail(t, p.a, p.b),
    density: (w) => dp.wsbDensity(w, p.a, p.b),
  };
}

export function mountWidget(el, spec = {}) {
  const custom = PRIORS.find((p) => p.key === "custom");
  const hasAB = spec.a !== undefined || spec.b !== undefined;
  custom.a = num(spec, "a", 1.6, 0.05, 50);
  custom.b = num(spec, "b", 1.22, 0.05, 50);
  const state = {
    show: { vague: true, lit24: true, lit13: true, alpha1: spec.preset === "conservative" ? false : true, custom: hasAB },
    focus: hasAB ? "custom" : spec.preset === "conservative" ? "lit13" : "vague",
    band: true,
    guides: true,
  };
  const ui = frame(el, { label: "Same default, different J: expected clusters drift with J while the weight tail stays flat", className: "dpx-defaults-drift" });
  const pA = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pB = h("div", { class: "dpx-panel" });
  const pC = h("div", { class: "dpx-panel" });
  ui.charts.append(pA, pB, pC);
  ui.caption.textContent =
    "K_J is the number of fitted components (occupied clusters) among J units. Band: 90% prior interval [q05, q95], live for J ≤ 500; J > 500 precomputed in R. W_SB is the share of the cluster a randomly chosen unit joins (size-biased weight), not the largest weight.";

  // curves are cheap (digamma path); the live band needs one pmf per J, so it is
  // computed only for the focus prior and cached
  const cache = new Map();
  const modelOf = (p) => {
    const key = p.alpha !== undefined ? `alpha${p.alpha}` : `${p.a}|${p.b}`;
    if (!cache.has(key)) {
      const m = makeModel(p);
      const curve = J_GRID.map((J) => ({ J, EK: m.mean(J) }));
      const preRows = band.priors[p.key]?.rows ?? [];
      const pre = preRows.map((r) => ({ J: r.J, lo: r.q05, hi: r.q95, pre: true }));
      let live = null;
      const entry = {
        m, curve, pre, s50: m.wsb(0.5),
        get live() {
          if (!live) live = J_BAND_LIVE.map((J) => {
            const s = dp.pmfSummary(m.pmf(J));
            return { J, lo: s.q05, hi: s.q95, pre: false };
          });
          return live;
        },
      };
      cache.set(key, entry);
      if (cache.size > 40) cache.delete(cache.keys().next().value);
    }
    return cache.get(key);
  };

  let width = 720;
  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const visible = PRIORS.filter((p) => state.show[p.key]);
    const focus = PRIORS.find((p) => p.key === state.focus) ?? PRIORS[0];
    const lines = [];
    const labels = [];
    for (const p of visible) {
      const mod = modelOf(p);
      for (const d of mod.curve) lines.push({ ...d, key: p.key, label: p.short });
      const last = mod.curve[mod.curve.length - 1];
      labels.push({ J: last.J, EK: last.EK, text: `${p.short}: ${fmtCount(last.EK)}`, key: p.key });
    }
    const col = (key) => getComputedStyle(ui.root).getPropertyValue(PRIORS.find((p) => p.key === key).token).trim();
    const half = width >= 680 ? Math.floor((width - 16) / 2) : width;
    const fm = modelOf(focus);
    const marks = [];
    if (state.band) {
      marks.push(globalThis.Plot.areaY(fm.live, { x: "J", y1: "lo", y2: "hi", fill: col(focus.key), fillOpacity: 0.16, curve: "step-after" }));
      if (fm.pre.length) {
        const bridge = [fm.live[fm.live.length - 1], ...fm.pre];
        marks.push(globalThis.Plot.areaY(bridge, { x: "J", y1: "lo", y2: "hi", fill: col(focus.key), fillOpacity: 0.08, curve: "step-after" }));
        marks.push(globalThis.Plot.lineY(bridge, { x: "J", y: "hi", stroke: col(focus.key), strokeOpacity: 0.6, strokeDasharray: "3,3", curve: "step-after" }));
      }
    }
    if (state.guides) {
      marks.push(globalThis.Plot.ruleX(GUIDES, { x: "J", stroke: c.borderStrong, strokeDasharray: "2,3" }));
      for (const g of GUIDES) marks.push(globalThis.Plot.text([g], { x: "J", frameAnchor: "top", text: "label", dy: 4, fill: c.faint, fontSize: 10, textAnchor: g.anchor, dx: g.dx }));
    }
    for (const p of visible) {
      marks.push(globalThis.Plot.lineY(lines.filter((d) => d.key === p.key), {
        x: "J", y: "EK", stroke: col(p.key), strokeWidth: p.key === state.focus ? 2.6 : 1.6, strokeDasharray: p.dash ?? undefined,
      }));
    }
    const yMax = Math.max(12, ...lines.map((d) => d.EK), ...(state.band ? [...fm.live, ...fm.pre].map((d) => d.hi) : [0])) * 1.05;
    const H_A = 300;
    marks.push(globalThis.Plot.text(dodge(labels, "EK", (yMax * 13) / (H_A - 60)), { x: "J", y: "EKLabel", text: "text", fill: (d) => col(d.key), textAnchor: "start", dx: 6, fontSize: 11, fontWeight: 600 }));
    marks.push(logTickLabels([10, 20, 50, 100, 200, 500, 1000, 2000, 5000], c.muted));
    marks.push(globalThis.Plot.tip(lines, globalThis.Plot.pointerX({ x: "J", y: "EK", title: (d) => `${d.label}\nJ = ${d.J}\nE K_J = ${fmtCount(d.EK)}` })));
    const altA = `Line chart of the expected number of clusters E K_J against J from 10 to 5000 (log scale) for ${visible.map((p) => p.short).join(", ")}. ${focus.short}: ${READ_J.map((J) => `${fmtCount(fm.m.mean(J))} at J = ${J}`).join(", ")}.`;
    draw(pA, {
      width, height: H_A, marginRight: 110, marginLeft: 44, marginBottom: 42,
      x: { type: "log", domain: [J_MIN, J_MAX], label: "J (number of units, log scale)", labelOffset: 38, ticks: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000], tickFormat: () => "" },
      y: { domain: [0, yMax], label: "E K_J (expected clusters)", grid: true },
      marks,
    }, altA);
    pA.prepend(h("p", { class: "dpx-panel-title", text: "A. Expected number of clusters drifts with J" }));

    // B: the majority-mass tail is flat in J
    const flat = visible.map((p) => ({ key: p.key, label: p.short, s: modelOf(p).s50 }));
    const flatLines = flat.flatMap((f) => [{ ...f, J: J_MIN }, { ...f, J: J_MAX }]);
    const altB = `Pr(W_SB > .5) against J: horizontal lines at ${flat.map((f) => `${f.label} ${fmtProb(f.s)}`).join(", ")}; the value does not change with J.`;
    draw(pB, {
      width: half, height: 240, marginLeft: 44, marginRight: 50, marginBottom: 42,
      x: { type: "log", domain: [J_MIN, J_MAX], label: "J (log scale)", labelOffset: 38, ticks: [10, 100, 1000, 5000], tickFormat: () => "" },
      y: { domain: [0, 1], label: "Pr(W_SB > .5)", grid: true, tickFormat: (d) => fmtProb(d) },
      marks: [
        ...visible.map((p) => globalThis.Plot.lineY(flatLines.filter((d) => d.key === p.key), { x: "J", y: "s", stroke: col(p.key), strokeWidth: p.key === state.focus ? 2.6 : 1.6, strokeDasharray: p.dash ?? undefined })),
        globalThis.Plot.text(dodge(flat, "s", 13 / (240 - 60)), { x: J_MAX, y: "sLabel", text: (d) => fmtProb(d.s), fill: (d) => col(d.key), textAnchor: "start", dx: 6, fontSize: 11, fontWeight: 600 }),
        logTickLabels([10, 100, 1000, 5000], c.muted),
      ],
    }, altB);
    pB.prepend(h("p", { class: "dpx-panel-title", text: "B. Majority-mass tail Pr(W_SB > .5) is the same at every J" }));

    // C: W_SB density of the three Gamma defaults, >.5 shaded for the focus prior
    const dens = [];
    const shown = PRIORS.filter((p) => p.alpha === undefined && (state.show[p.key] || p.key === focus.key));
    for (const p of shown) {
      const m = modelOf(p).m;
      for (let i = 0; i <= 200; i += 1) {
        const w = Math.min(dp.W_DENSITY_MAX, i / 200);
        dens.push({ key: p.key, label: p.short, w, d: Math.min(m.density(w), 3) });
      }
    }
    const focusDens = dens.filter((d) => d.key === focus.key && d.w >= 0.5);
    const cMarks = [];
    if (focus.alpha === undefined) cMarks.push(globalThis.Plot.areaY(focusDens, { x: "w", y: "d", fill: col(focus.key), fillOpacity: 0.28 }));
    for (const p of shown) cMarks.push(globalThis.Plot.lineY(dens.filter((d) => d.key === p.key), { x: "w", y: "d", stroke: col(p.key), strokeWidth: p.key === state.focus ? 2.6 : 1.4, strokeDasharray: p.dash ?? undefined }));
    cMarks.push(globalThis.Plot.ruleX([0.5], { stroke: c.fg, strokeDasharray: "3,3" }));
    const altC = `Density of the size-biased weight W_SB for ${shown.map((p) => p.short).join(", ")}; the area above .5 is ${fmtProb(fm.s50)} for ${focus.short}.`;
    draw(pC, {
      width: half, height: 240, marginLeft: 44,
      x: { domain: [0, 1], label: "W_SB (size-biased weight)", tickFormat: (d) => fmtProb(d) },
      y: { domain: [0, 3], label: "density (clipped at 3)", grid: true },
      marks: cMarks,
    }, altC);
    pC.prepend(h("p", { class: "dpx-panel-title", text: focus.alpha === undefined ? `C. W_SB density: area above .5 = ${fmtProb(fm.s50)} for ${focus.short}` : "C. W_SB density (Gamma priors)" }));
    pA.append(srTable(`E K_J by J for ${focus.short}`, ["J", "E K_J", "90% interval"], READ_J.map((J) => {
      const b = [...fm.live, ...fm.pre].find((r) => r.J === J);
      return [J, fmtCount(fm.m.mean(J)), b ? `[${b.lo}, ${b.hi}]` : "n/a"];
    })));

    const at = (J) => fmtCount(fm.m.mean(J));
    ui.readout.textContent =
      `${focus.alpha === undefined ? fmtGamma(focus.a, focus.b) : "alpha = 1 fixed"}: E K_J = ${at(50)} at J = 50, ${at(100)} at 100, ${at(2000)} at 2000, ${at(5000)} at 5000. ` +
      `Pr(W_SB > .5) = ${fmtProb(fm.s50)} at every J. At the application sizes: BD (J = 48) ${at(48)}, STAR (79) ${at(79)}, Vocab (500) ${at(500)}.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  // controls
  const showToggles = PRIORS.map((p) => toggle({ label: p.label, checked: state.show[p.key], onChange: (v) => { state.show[p.key] = v; if (!v && state.focus === p.key) state.focus = PRIORS.find((q) => state.show[q.key])?.key ?? "vague"; focusSeg.set(state.focus); render(); } }));
  const focusSeg = segmented({
    label: "Focus",
    options: PRIORS.map((p) => ({ value: p.key, label: p.short })),
    value: state.focus,
    onChange: (v) => { state.focus = v; if (!state.show[v]) { state.show[v] = true; showToggles[PRIORS.findIndex((p) => p.key === v)].set(true); } render(); },
  });
  const useCustom = () => { state.show.custom = true; showToggles[4].set(true); state.focus = "custom"; focusSeg.set("custom"); };
  const sa = slider({ label: "custom a", min: 0.05, max: 50, value: custom.a, log: true, format: (v) => v.toFixed(2), onInput: (v) => { custom.a = v; useCustom(); render(); } });
  const sb = slider({ label: "custom b", min: 0.05, max: 50, value: custom.b, log: true, format: (v) => v.toFixed(2), onInput: (v) => { custom.b = v; useCustom(); render(); } });
  const bandT = toggle({ label: "90% band (focus prior)", checked: state.band, onChange: (v) => { state.band = v; render(); } });
  const guideT = toggle({ label: "J guides (48, 79, 500)", checked: state.guides, onChange: (v) => { state.guides = v; render(); } });
  const togglesBox = h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Priors shown" }, h("span", { class: "dpx-seg-label", text: "Priors shown" }), ...showToggles.map((t) => t.root));
  ui.controls.append(togglesBox, focusSeg.root, sa.root, sb.root, bandT.root, guideT.root);

  const stop = observeWidth(pA, (w) => { width = w; render(); });
  render();
  return {
    update(next = {}) {
      if (next.a !== undefined || next.b !== undefined) {
        custom.a = num(next, "a", custom.a, 0.05, 50);
        custom.b = num(next, "b", custom.b, 0.05, 50);
        sa.set(custom.a);
        sb.set(custom.b);
        state.show.custom = true;
        showToggles[4].set(true);
      }
      if (next.focus && PRIORS.some((p) => p.key === next.focus)) { state.focus = next.focus; focusSeg.set(state.focus); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}
