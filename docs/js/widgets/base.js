// Widget base: DOM helpers and accessible controls for mountWidget(el, spec) widgets
// (CONTRACT.md sections 1 and 4). No top-level DOM access, so node can import it.

let counter = 0;
/** Unique id with a prefix. */
export const uid = (prefix = "dpx") => `${prefix}-${(counter += 1)}`;

/** Create an element: h("div", {class: "x", onclick: fn}, child, ...). */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

/** True when the reader asked for less motion. */
export function reducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Standard frame: title (optional), controls, charts, read-out, caption. */
export function frame(el, { label, className = "" } = {}) {
  el.replaceChildren();
  const root = h("section", { class: `dpx-widget ${className}`.trim(), "aria-label": label });
  const controls = h("div", { class: "dpx-controls" });
  const charts = h("div", { class: "dpx-charts" });
  const readout = h("p", { class: "dpx-readout", "aria-live": "polite" });
  const caption = h("p", { class: "dpx-caption-note" });
  root.append(controls, charts, readout, caption);
  el.append(root);
  return { root, controls, charts, readout, caption };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Labelled range slider. With `log: true` the thumb moves on log10(value) in steps of
 * `logStep` (default 0.002). The slider keeps the exact current value (so a preset such as
 * a = 1.60 is shown and used as 1.60, not the nearest thumb position).
 * Shift + arrow moves 10 steps. Returns {root, input, get(), set(v)}.
 */
export function slider({ label, min, max, step = 0.01, logStep = 0.002, value, log = false, format = String, onInput, name }) {
  const id = uid("sl");
  const toPos = (v) => (log ? Math.log10(v) : v);
  const fromPos = (p) => (log ? 10 ** p : p);
  let current = clamp(value, min, max);
  // choose a log step that divides the span exactly, so the thumb can reach both ends
  const span = toPos(max) - toPos(min);
  const posStep = log ? span / Math.max(1, Math.round(span / logStep)) : step;
  const input = h("input", {
    id, type: "range", name,
    min: toPos(min), max: toPos(max), step: posStep,
    value: toPos(current),
  });
  const out = h("output", { for: id, class: "dpx-value" });
  const show = () => {
    out.textContent = format(current);
    input.setAttribute("aria-valuetext", `${label} ${format(current)}`);
  };
  input.addEventListener("input", () => {
    current = clamp(fromPos(Number(input.value)), min, max);
    show();
    onInput?.(current);
  });
  input.addEventListener("keydown", (e) => {
    if (!e.shiftKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1;
    const s = Number(input.step) || 1;
    input.value = String(clamp(Number(input.value) + dir * 10 * s, Number(input.min), Number(input.max)));
    input.dispatchEvent(new Event("input"));
  });
  show();
  const root = h("div", { class: "dpx-control dpx-slider" }, h("label", { for: id, text: label }), input, out);
  return {
    root, input,
    get: () => current,
    set(v) {
      current = clamp(v, min, max);
      input.value = String(toPos(current));
      show();
    },
  };
}

/** Button; `primary` marks the action bound to Enter. */
export function button({ label, onClick, primary = false, title }) {
  return h("button", { type: "button", class: primary ? "dpx-btn dpx-btn-primary" : "dpx-btn", onclick: onClick, title }, label);
}

/** Checkbox toggle. Returns {root, input, get(), set(bool)}. */
export function toggle({ label, checked = false, onChange }) {
  const id = uid("tg");
  const input = h("input", { id, type: "checkbox", checked });
  input.addEventListener("change", () => onChange?.(input.checked));
  const root = h("div", { class: "dpx-control dpx-toggle" }, input, h("label", { for: id, text: label }));
  return { root, input, get: () => input.checked, set: (v) => (input.checked = Boolean(v)) };
}

/** Segmented choice (buttons with aria-pressed). options: [{value, label}]. */
export function segmented({ label, options, value, onChange }) {
  const group = h("div", { class: "dpx-control dpx-segmented", role: "group", "aria-label": label });
  const title = h("span", { class: "dpx-seg-label", text: label });
  let current = value;
  const buttons = options.map((o) =>
    h("button", {
      type: "button", class: "dpx-seg", "aria-pressed": String(o.value === value),
      onclick: () => {
        current = o.value;
        buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(options[i].value === current)));
        onChange?.(current);
      },
    }, o.label),
  );
  group.append(title, ...buttons);
  return {
    root: group,
    get: () => current,
    set(v) {
      current = v;
      buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(options[i].value === current)));
    },
  };
}

/**
 * Labelled number field. onInput(v) fires while typing, but only for a finite v in [min, max];
 * anything else marks the field aria-invalid and leaves the widget as it was.
 * Returns {root, input, get(), set(v), setDisabled(bool)}.
 */
export function numberField({ label, value, min = -Infinity, max = Infinity, step = "any", onInput }) {
  const id = uid("nf");
  const input = h("input", {
    id, type: "number", inputmode: "decimal", step,
    min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined,
    value: String(value), "aria-invalid": "false",
  });
  input.addEventListener("input", () => {
    const v = Number(input.value);
    const ok = input.value.trim() !== "" && Number.isFinite(v) && v >= min && v <= max;
    input.setAttribute("aria-invalid", String(!ok));
    if (ok) onInput?.(v);
  });
  const root = h("div", { class: "dpx-control dpx-number" }, h("label", { for: id, text: label }), input);
  return {
    root, input,
    get: () => Number(input.value),
    set(v) { input.value = String(v); input.setAttribute("aria-invalid", "false"); },
    setDisabled(d) { input.disabled = Boolean(d); },
  };
}

/** Select box. options: [{value, label}]. */
export function select({ label, options, value, onChange }) {
  const id = uid("se");
  const input = h("select", { id }, ...options.map((o) => h("option", { value: o.value, selected: o.value === value }, o.label)));
  input.addEventListener("change", () => onChange?.(input.value));
  const root = h("div", { class: "dpx-control dpx-select" }, h("label", { for: id, text: label }), input);
  return { root, input, get: () => input.value, set: (v) => (input.value = v) };
}

/** Enter (outside text fields and buttons) triggers the widget's primary action. */
export function bindPrimaryKey(root, action) {
  const handler = (e) => {
    if (e.key !== "Enter") return;
    const t = e.target;
    if (t instanceof HTMLButtonElement || t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type !== "range")) return;
    e.preventDefault();
    action();
  };
  root.addEventListener("keydown", handler);
  return () => root.removeEventListener("keydown", handler);
}

/** Calls cb(width) on resize; returns a disconnect function. */
export function observeWidth(el, cb) {
  if (typeof ResizeObserver === "undefined") {
    cb(el.clientWidth || 640);
    return () => {};
  }
  let last = -1;
  const ro = new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (w > 0 && Math.abs(w - last) > 4) {
      last = w;
      cb(w);
    }
  });
  ro.observe(el);
  return () => ro.disconnect();
}

/** Parse numeric spec values, clamp to [lo, hi], fall back to a default. */
export function num(spec, key, fallback, lo = -Infinity, hi = Infinity) {
  const v = Number(spec?.[key]);
  return Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
}
