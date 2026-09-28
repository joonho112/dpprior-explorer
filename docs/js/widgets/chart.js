// Chart helpers: Observable Plot (global `Plot`, vendored UMD) with colours read from
// styles/tokens.css, and a text alternative on every chart (CONTRACT.md section 4).

/**
 * Colour slots for clusters that come and go (since 1.1.0). Slot s is drawn in colour s % 6, filled for s < 6 and as a ring for 6 <= s < 12. A new
 * cluster takes the lowest free slot; a cluster with a filled colour keeps it for as long as it
 * lives; a ringed (or later) cluster moves down to the lowest free slot as soon as one opens below
 * it. So up to six living clusters never share a colour and up to twelve never look alike.
 */
export function colourSlots() {
  const slots = new Map();
  const lowestFree = () => {
    const used = new Set(slots.values());
    let s = 0;
    while (used.has(s)) s += 1;
    return s;
  };
  return {
    /** Forget the dead, seat the newborn, move ringed clusters down; `ids` are the living clusters. */
    refresh(ids) {
      const alive = new Set(ids);
      for (const id of [...slots.keys()]) if (!alive.has(id)) slots.delete(id);
      for (const id of ids) if (!slots.has(id)) slots.set(id, lowestFree());
      for (const [id, s] of [...slots.entries()].filter(([, v]) => v >= 6).sort((p, q) => p[1] - q[1])) {
        const f = lowestFree();
        if (f < s) slots.set(id, f);
      }
    },
    slot(id) {
      if (!slots.has(id)) slots.set(id, lowestFree());
      return slots.get(id);
    },
    clear() {
      slots.clear();
    },
  };
}

/** Value of a CSS custom property as seen from `el`. */
export function cssVar(el, name) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

// The paper's role styles (replication exhibits/style.R): colour token, dash, symbol.
export const METHOD_STYLE = {
  vague: { token: "--m-vague", dash: null, symbol: "circle", label: "Vague Gamma(1, 1)" },
  doro: { token: "--m-doro", dash: "6,3", symbol: "triangle", label: "DORO-Unif" },
  tsmm: { token: "--m-tsmm", dash: null, symbol: "square", label: "TSMM" },
  da: { token: "--m-da", dash: null, symbol: "triangle2", label: "Dual-Anchor" },
  hard: { token: "--m-hard", dash: "2,3", symbol: "square2", label: "Dual-Anchor (hard)" },
  ssi: { token: "--m-ssi", dash: null, symbol: "diamond2", label: "SSI-Weight" },
  lit: { token: "--m-lit", dash: "8,3,2,3", symbol: "cross", label: "Literature default" },
  neutral: { token: "--m-neutral", dash: "2,2", symbol: "circle", label: "Reference" },
};

// Families of method_catalog.json records (Phase 7): a method role where the paper has one,
// otherwise a Broderick fill (index into palette().brod) or a DPprior identity colour.
export const FAMILY_STYLE = {
  "fixed-alpha": { role: "neutral", label: "Fixed alpha" },
  vague: { role: "vague", label: "Vague Gamma(1, 1)" },
  "literature-default": { role: "lit", label: "Literature default" },
  "k-diffuse": { brod: 2, label: "K_n-diffuse" },
  doro: { role: "doro", label: "DORO" },
  "doro-unif": { role: "doro", label: "DORO-Unif" },
  scal: { brod: 3, label: "SCAL" },
  "scal-shortcut": { brod: 3, label: "SCAL shortcut" },
  ssi: { role: "ssi", label: "SSI-Weight" },
  "ssi-vicentini": { role: "ssi", label: "SSI (Vicentini and Jermyn)" },
  "quasi-degenerate": { brod: 4, label: "Quasi-degenerate Gamma(eps, eps)" },
  jeffreys: { identity: "slate", label: "Jeffreys" },
  "stirling-gamma": { identity: "teal", label: "Stirling-gamma" },
  dpprior: { role: "da", label: "DPprior" },
};

/** Colour of a method_catalog record: TSMM and Dual-Anchor keep their paper roles. */
export function recordColor(rec, c) {
  if (rec.id?.startsWith("tsmm")) return c.methods.tsmm;
  const s = FAMILY_STYLE[rec.family] ?? { role: "neutral" };
  if (s.role) return c.methods[s.role];
  if (s.brod !== undefined) return c.brod[s.brod];
  return c[s.identity];
}

/** Resolved palette for one widget root. */
export function palette(el) {
  const v = (n) => cssVar(el, n);
  const methods = Object.fromEntries(Object.entries(METHOD_STYLE).map(([k, s]) => [k, v(s.token)]));
  return {
    fg: v("--fg"), muted: v("--fg-muted"), faint: v("--fg-faint"), bg: v("--bg"), raised: v("--bg-raised"),
    border: v("--border"), borderStrong: v("--border-strong"), accent: v("--accent"), accentInk: v("--accent-ink"),
    teal: v("--dp-teal"), blue: v("--dp-blue"), green: v("--dp-green"), gold: v("--dp-gold"), red: v("--dp-red"),
    slate: v("--dp-slate"), shade: v("--shade"),
    methods,
    brod: [1, 2, 3, 4, 5, 6].map((i) => v(`--b-${i}`)),
    unused: v("--b-unused"), rest: v("--b-rest"), marker: v("--b-marker"), stroke: v("--b-stroke"),
    labelLight: v("--label-light"), labelDark: v("--label-dark"),
  };
}

/** WCAG relative luminance of "#rrggbb" (NaN for other formats). */
function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return Number.NaN;
  const lin = [0, 2, 4].map((i) => {
    const x = Number.parseInt(m[1].slice(i, i + 2), 16) / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Colour for a number drawn on a filled shape: --label-light or --label-dark, whichever has
 * the higher contrast with the fill (validate_palette checks >= 4.5:1 on every Broderick fill).
 */
export function labelOn(fill, c) {
  const f = luminance(fill);
  const ratio = (x) => (Math.max(f, x) + 0.05) / (Math.min(f, x) + 0.05);
  if (!Number.isFinite(f)) return c.labelLight;
  return ratio(luminance(c.labelLight)) >= ratio(luminance(c.labelDark)) ? c.labelLight : c.labelDark;
}

/**
 * Render a Plot figure into `container` (replacing its content). `alt` is required:
 * it becomes the figure's accessible name (role="img").
 */
export function draw(container, options, alt) {
  const P = globalThis.Plot;
  if (!P) throw new Error("Observable Plot is not loaded (js/vendor/plot.min.js)");
  const fig = P.plot({
    style: { background: "transparent", color: "currentColor", fontSize: "12px", fontFamily: "inherit", overflow: "visible" },
    ...options,
  });
  fig.setAttribute("role", "img");
  fig.setAttribute("aria-label", alt);
  container.replaceChildren(fig);
  return fig;
}

/** Visually hidden data table used as a text alternative for a chart. */
export function srTable(caption, columns, rows) {
  // The visually hidden class sits on a wrapper div: a table ignores width: 1px when its
  // cells are wider (nowrap), and long cells then widened the page (M-08 at 375 px).
  const wrap = document.createElement("div");
  wrap.className = "dpx-sr-only";
  const table = document.createElement("table");
  const cap = document.createElement("caption");
  cap.textContent = caption;
  const head = document.createElement("tr");
  for (const c of columns) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = c;
    head.append(th);
  }
  const thead = document.createElement("thead");
  thead.append(head);
  const tbody = document.createElement("tbody");
  for (const r of rows) {
    const tr = document.createElement("tr");
    for (const cell of r) {
      const td = document.createElement("td");
      td.textContent = String(cell);
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(cap, thead, tbody);
  wrap.append(table);
  return wrap;
}

/**
 * Spread end-of-line labels vertically so they do not overlap: `items` have a data-space
 * value `key`; returns copies with `keyLabel` moved apart by at least `minGap` data units.
 */
export function dodge(items, key, minGap) {
  const sorted = [...items].sort((a, b) => a[key] - b[key]).map((d) => ({ ...d, [`${key}Label`]: d[key] }));
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1][`${key}Label`];
    if (sorted[i][`${key}Label`] - prev < minGap) sorted[i][`${key}Label`] = prev + minGap;
  }
  return sorted;
}

/**
 * Powers of ten covering [lo, hi] (every `step` decades) for a log axis, with a plain label:
 * "0.01", "1", "100", and "1e-6" style outside [.001, 1e5). Plot's default log labels use SI
 * prefixes ("10m", "100µ"), which read badly for alpha.
 */
export function decadeTicks(lo, hi, step = 1) {
  const e0 = Math.floor(Math.log10(lo));
  const e1 = Math.ceil(Math.log10(hi));
  const out = [];
  for (let e = e0; e <= e1; e += step) out.push(10 ** e);
  return out;
}
export const decadeLabel = (d) => {
  const e = Math.round(Math.log10(d));
  return e < -3 || e >= 5 ? `1e${e}` : String(10 ** e >= 1 ? 10 ** e : Number((10 ** e).toFixed(-e)));
};

/**
 * Tick labels for a log x axis. Plot 0.6.17 blanks the labels of 5 x 10^k ticks on log
 * scales whatever tickFormat says, so log axes set tickFormat: () => "" and add this mark.
 * `format` turns a tick value into its label (default String).
 */
export function logTickLabels(ticks, fill, format = String) {
  return globalThis.Plot.text(ticks, { x: (d) => d, text: (d) => format(d), frameAnchor: "bottom", dy: 9, lineAnchor: "top", fill, fontSize: 11 });
}
