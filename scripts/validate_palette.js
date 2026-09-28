// Palette validator for styles/tokens.css.
//
// Adapted from the IRW reliability webapp (scripts/validate_palette.js): same
// OKLab distance and embedded full-severity Brettel/Vienot CVD matrices, with
// the checks this project's CONTRACT.md fixes:
//
//   FAIL  text tokens below WCAG 2.1 AA 4.5:1 on --bg and --bg-raised
//   FAIL  focus ring / slider track / accent below 3:1 on --bg (WCAG 1.4.11)
//   FAIL  any categorical family whose closest pair, under normal vision or a
//         simulated protan/deutan/tritan view, is < 40 in sRGB 0-255 distance
//   FAIL  the two copies of the dark block differ
//   WARN  a series colour below 3:1 on --bg (legal only with relief: outlines,
//         direct labels, linetype/shape redundancy, text alternative)
//
// The CVD simulation is a regression floor for hue separation, not a claim
// that hue alone is accessible (CONTRACT.md requires redundant encodings).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(repoRoot, "styles/tokens.css"), "utf8");

const RGB_FLOOR = 40;
const TEXT_AA = 4.5;
const UI_AA = 3.0;

const families = {
  methods: ["m-vague", "m-doro", "m-tsmm", "m-da", "m-hard", "m-ssi", "m-lit"],
  broderick: ["b-1", "b-2", "b-3", "b-4", "b-5", "b-6"],
  // status colours that co-occur in badges; --dp-blue/--dp-slate are text/secondary lines
  dpprior: ["dp-teal", "dp-green", "dp-gold", "dp-red"],
};
const textPairs = [
  ["fg", "bg"], ["fg", "bg-raised"], ["fg-muted", "bg"], ["fg-muted", "bg-raised"],
  ["fg-faint", "bg"], ["fg-faint", "bg-raised"], ["accent-ink", "bg"], ["accent-ink", "bg-raised"],
  ["warn-fg", "warn-bg"],
];
const uiPairs = [["focus", "bg"], ["border-strong", "bg"], ["accent", "bg"], ["b-marker", "bg"]];

function declarations(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map(([, name, hex]) => [
      name.toLowerCase(),
      hex.toLowerCase(),
    ]),
  );
}

function blockAfter(marker) {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`token block not found: ${marker}`);
  const open = css.indexOf("{", start + marker.length - 1);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated block: ${marker}`);
}

const lightBlock = blockAfter(":root {");
const mediaDark = blockAfter(':root:not([data-theme="light"]) {');
const forcedDark = blockAfter(':root[data-theme="dark"] {');
const schemes = { light: declarations(lightBlock), dark: declarations(mediaDark) };
const forced = declarations(forcedDark);

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`FAIL ${msg}`);
};

// 1. the two dark copies must match exactly
const darkKeys = new Set([...Object.keys(schemes.dark), ...Object.keys(forced)]);
for (const key of darkKeys) {
  if (schemes.dark[key] !== forced[key]) fail(`dark copies differ at --${key}: ${schemes.dark[key]} vs ${forced[key]}`);
}

function srgbToLinear(value) {
  const x = value / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(x) {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
}
function hexToRgb(hex) {
  return [1, 3, 5].map((o) => Number.parseInt(hex.slice(o, o + 2), 16));
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function multiply(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}
function oklab(lin) {
  const lms = multiply(
    [
      [0.4122214708, 0.5363325363, 0.0514459929],
      [0.2119034982, 0.6806995451, 0.1073969566],
      [0.0883024619, 0.2817188376, 0.6299787005],
    ],
    lin,
  ).map(Math.cbrt);
  return multiply(
    [
      [0.2104542553, 0.793617785, -0.0040720468],
      [1.9779984951, -2.428592205, 0.4505937099],
      [0.0259040371, 0.7827717662, -0.808675766],
    ],
    lms,
  );
}
const simulations = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
function simulate(hex, matrix) {
  const lin = multiply(matrix, hexToRgb(hex).map(srgbToLinear)).map((v) => Math.max(0, Math.min(1, v)));
  return { rgb: lin.map(linearToSrgb), lab: oklab(lin) };
}

console.log(
  `palette runtime: node ${process.version}; sRGB 0-255 distance floor ${RGB_FLOOR}; ` +
    "OKLab dE x100 reported; embedded full-severity CVD matrices",
);

for (const [scheme, tokens] of Object.entries(schemes)) {
  // 2. text contrast
  for (const [fgName, bgName] of textPairs) {
    const [fg, bg] = [tokens[fgName], tokens[bgName]];
    if (!fg || !bg) fail(`${scheme}: missing --${fgName} or --${bgName}`);
    else {
      const ratio = contrast(fg, bg);
      const tag = ratio >= TEXT_AA ? "ok  " : "FAIL";
      console.log(`${scheme} text ${tag} --${fgName} on --${bgName}: ${ratio.toFixed(2)}:1`);
      if (ratio < TEXT_AA) fail(`${scheme}: --${fgName} on --${bgName} ${ratio.toFixed(2)} < ${TEXT_AA}`);
    }
  }
  // 3. UI contrast
  for (const [fgName, bgName] of uiPairs) {
    const ratio = contrast(tokens[fgName], tokens[bgName]);
    const tag = ratio >= UI_AA ? "ok  " : "FAIL";
    console.log(`${scheme} ui   ${tag} --${fgName} on --${bgName}: ${ratio.toFixed(2)}:1`);
    if (ratio < UI_AA) fail(`${scheme}: --${fgName} on --${bgName} ${ratio.toFixed(2)} < ${UI_AA}`);
  }
  // 3b. number labels on Broderick fills: the better of --label-light / --label-dark
  for (const n of families.broderick) {
    const ratio = Math.max(contrast(tokens["label-light"], tokens[n]), contrast(tokens["label-dark"], tokens[n]));
    const tag = ratio >= TEXT_AA ? "ok  " : "FAIL";
    console.log(`${scheme} text ${tag} best label on --${n}: ${ratio.toFixed(2)}:1`);
    if (!(ratio >= TEXT_AA)) fail(`${scheme}: best label on --${n} ${ratio.toFixed(2)} < ${TEXT_AA}`);
  }
  // 4. categorical families
  for (const [family, names] of Object.entries(families)) {
    const missing = names.filter((n) => !tokens[n]);
    if (missing.length) {
      fail(`${scheme} ${family}: missing ${missing.join(", ")}`);
      continue;
    }
    const parts = [];
    for (const [vision, matrix] of Object.entries(simulations)) {
      const sims = Object.fromEntries(names.map((n) => [n, simulate(tokens[n], matrix)]));
      let worstRgb = { value: Infinity, pair: "" };
      let worstLab = Infinity;
      for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
          const a = sims[names[i]];
          const b = sims[names[j]];
          const d = Math.hypot(...a.rgb.map((v, k) => v - b.rgb[k]));
          const e = 100 * Math.hypot(...a.lab.map((v, k) => v - b.lab[k]));
          if (d < worstRgb.value) worstRgb = { value: d, pair: `${names[i]}/${names[j]}` };
          worstLab = Math.min(worstLab, e);
        }
      }
      parts.push(`${vision} ${worstRgb.value.toFixed(0)} (${worstRgb.pair}; dE ${worstLab.toFixed(1)})`);
      if (worstRgb.value < RGB_FLOOR) fail(`${scheme} ${family} ${vision}: ${worstRgb.pair} ${worstRgb.value.toFixed(1)} < ${RGB_FLOOR}`);
    }
    console.log(`${scheme} ${family}: ${parts.join("; ")}`);
    // 5. series contrast warnings
    const low = names
      .map((n) => [n, contrast(tokens[n], tokens.bg)])
      .filter(([, r]) => r < UI_AA)
      .map(([n, r]) => `--${n} ${r.toFixed(2)}`);
    if (low.length) console.log(`${scheme} ${family}: WARN below 3:1 on --bg (relief required): ${low.join(", ")}`);
  }
}

if (failed) {
  console.error("palette: FAIL");
  process.exit(1);
}
console.log(`palette: PASS (text >= ${TEXT_AA}:1, ui >= ${UI_AA}:1, categorical >= ${RGB_FLOOR} sRGB under normal/protan/deutan/tritan, light and dark)`);
