#!/usr/bin/env node
/**
 * Caption check for the evidence pages (Part 5; Step 9.11).
 *
 * The fixed wording of the evidence pages lives in js/widgets/app-captions.js (CAPTIONS):
 *   read      posterior results are read from the released tables, not recomputed;
 *   kj        K_J is the number of fitted components (occupied clusters) among the J units;
 *   retained  the simulation keeps its retained-fit denominators (8,607 of 9,000 in the 45 main
 *             cells, summed from headline_primary.json);
 *   ocrs      the replication package's OCRS application is not used on this site.
 * This check
 *   1. renders every docs/pages/applications/*.html in jsdom (scripts run, as in render_smoke)
 *      and requires the captions listed in RULES on each page, word for word; a page that mounts
 *      a widget must have a RULES entry, so a new evidence page cannot skip its captions;
 *   2. requires each caption to appear on at least one evidence page;
 *   3. scans the Part 5 widget sources: none may type a caption sentence itself (they call
 *      captionFor / captionList), so the wording cannot drift.
 *
 * Usage: node verification/check_captions.mjs [--self-test]     Exit: 0 pass, 1 fail
 * --self-test feeds a page without the kj caption and a source that types it, and expects both flagged.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PAGES = join(ROOT, "docs", "pages", "applications");
const require = createRequire(join(ROOT, "engine", "package.json"));
const { JSDOM, VirtualConsole } = require("jsdom");
const { CAPTIONS } = await import(pathToFileURL(join(ROOT, "js", "widgets", "app-captions.js")).href);

// captions each evidence page must show (widget captions, rendered at run time)
const RULES = {
  "star.html": ["read", "kj"],
  "bangert-drowns.html": ["read", "kj"],
  "vocabulary-rasch.html": ["read", "kj"],
  "simulation.html": ["read", "kj", "retained"],
  "partition-vs-effects.html": ["read", "kj"],
  "data.html": ["read", "kj", "retained", "ocrs"],
};
// the Part 5 widget files (A-01 to A-13); app-captions.js itself is the one place the wording lives
const WIDGETS = ["data-lineage-card", "unit-caterpillar", "app-prior-strip", "bd-forest", "rasch-kpmf", "rasch-density",
  "sim-dashboard", "effects-vs-partition-tiles", "misspecification", "design-size", "partition-vs-effects", "spec-sensitivity"];

const norm = (s) => s.replace(/\s+/g, " ");
async function pageText(file) {
  const vc = new VirtualConsole();
  const dom = await JSDOM.fromFile(file, {
    url: pathToFileURL(file).href,
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      window.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
      window.scrollTo = () => {};
      window.HTMLCanvasElement.prototype.getContext = () => null;
    },
  });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === "complete") resolve();
    else dom.window.addEventListener("load", resolve);
    setTimeout(resolve, 8000);
  });
  await new Promise((r) => setTimeout(r, 150));
  const doc = dom.window.document;
  const hosts = doc.querySelectorAll(".dpx-host").length;
  const text = norm((doc.querySelector("main") ?? doc.body).textContent);
  dom.window.close();
  return { hosts, text };
}

const found = (text) => Object.keys(CAPTIONS).filter((k) => norm(text).includes(norm(CAPTIONS[k])));
const probes = Object.fromEntries(Object.entries(CAPTIONS).map(([k, v]) => [k, norm(v).split(/[.:;]/)[0].trim()]));
const typed = (src) => Object.entries(probes).filter(([, probe]) => probe.length > 24 && norm(src).includes(probe)).map(([k]) => k);

if (process.argv.includes("--self-test")) {
  const page = `${CAPTIONS.read} Some widget text.`;
  const src = `ui.caption.textContent = "${CAPTIONS.kj}";`;
  const ok = !found(page).includes("kj") && found(page).includes("read") && typed(src).includes("kj") && typed("captionFor([\"kj\"])").length === 0;
  console.log(ok ? "captions self-test: PASS (missing caption and typed caption both flagged)" : "captions self-test: FAIL");
  process.exit(ok ? 0 : 1);
}

const problems = [];
const seen = new Set();
const lines = [];
for (const name of readdirSync(PAGES).filter((n) => n.endsWith(".html")).sort()) {
  const { hosts, text } = await pageText(join(PAGES, name));
  const need = RULES[name];
  if (!need) {
    if (hosts) problems.push(`${name}: mounts ${hosts} widget(s) but has no caption rule`);
    lines.push(`skip ${name} (no widgets)`);
    continue;
  }
  const got = found(text);
  got.forEach((k) => seen.add(k));
  const missing = need.filter((k) => !got.includes(k));
  if (missing.length) problems.push(`${name}: missing ${missing.join(", ")}`);
  lines.push(`${missing.length ? "FAIL" : "ok  "} ${name}: needs ${need.join(", ")}; found ${got.join(", ") || "none"}`);
}
for (const k of Object.keys(CAPTIONS)) if (!seen.has(k)) problems.push(`caption "${k}" appears on no evidence page`);

// sources: the caption sentences are typed only in app-captions.js
for (const w of WIDGETS) {
  for (const k of typed(readFileSync(join(ROOT, "js", "widgets", `${w}.js`), "utf8"))) problems.push(`${w}.js types the "${k}" caption instead of calling captionFor`);
}

lines.forEach((l) => console.log(l));
for (const p of problems) console.log(`  problem: ${p}`);
console.log(problems.length ? `captions: FAIL (${problems.length})` : `captions: PASS (${Object.keys(RULES).length} evidence pages; ${seen.size} captions found; ${WIDGETS.length} widget sources clean)`);
process.exit(problems.length ? 1 : 0);
