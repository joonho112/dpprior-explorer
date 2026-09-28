#!/usr/bin/env node
/**
 * Render smoke (jsdom): opens every rendered page under docs/ (site pages and embed
 * pages), runs its scripts, and checks
 *   - exactly one <h1>;
 *   - every widget host mounted a .dpx-widget with a non-empty read-out;
 *   - no "NaN", "undefined" or "[object Object]" in the visible text;
 *   - every chart (svg[role=img]) has an aria-label; every control has an accessible name;
 *   - no script errors other than jsdom's "Not implemented" notices.
 * A browser-free complement to file_smoke.mjs (which drives real Chrome from file://).
 *
 * Usage: node verification/render_smoke.mjs     (writes verification/render_smoke_report.md)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DOCS = join(ROOT, "docs");
const require = createRequire(join(ROOT, "engine", "package.json"));
const { JSDOM, VirtualConsole, ResourceLoader } = require("jsdom");

// docs/apps/ holds pages written by R htmlwidgets (Step 10.4: plotly, ggiraph). They are not site
// pages and jsdom cannot run plotly, so they are neither walked nor loaded into iframes here; the
// browser check in the Phase 10 log covers them.
class SiteOnly extends ResourceLoader {
  fetch(url, options) {
    if (/\/docs\/apps\//.test(url)) return Promise.resolve(Buffer.from(""));
    return super.fetch(url, options);
  }
}

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n !== "site_libs" && !(n === "apps" && dir === DOCS)) walk(p, out);
    } else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}
const pages = walk(DOCS).filter((p) => !p.endsWith("_template.html")).sort();

function polyfill(window) {
  window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
}

async function check(file) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    const msg = String(e.message || e);
    if (!/Not implemented/.test(msg)) errors.push(msg.split("\n")[0]);
  });
  vc.on("error", (...args) => errors.push(args.map(String).join(" ").split("\n")[0]));
  const dom = await JSDOM.fromFile(file, {
    url: pathToFileURL(file).href,
    runScripts: "dangerously",
    resources: new SiteOnly(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse: polyfill,
  });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === "complete") resolve();
    else dom.window.addEventListener("load", resolve);
    setTimeout(resolve, 8000);
  });
  await new Promise((r) => setTimeout(r, 150));
  const doc = dom.window.document;
  const problems = [];
  const h1 = doc.querySelectorAll("h1").length;
  if (h1 !== 1) problems.push(`${h1} h1 elements`);
  const hosts = [...doc.querySelectorAll(".dpx-host")];
  for (const host of hosts) {
    const w = host.querySelector(".dpx-widget");
    if (!w) {
      problems.push(`host #${host.id || "?"} did not mount`);
      continue;
    }
    const ro = w.querySelector(".dpx-readout");
    if (!ro || !ro.textContent.trim()) problems.push(`host #${host.id || "?"}: empty read-out`);
    if (!w.getAttribute("aria-label")) problems.push(`host #${host.id || "?"}: widget has no aria-label`);
  }
  const main = doc.querySelector("main") ?? doc.body;
  const text = main.textContent;
  for (const bad of ["NaN", "undefined", "[object Object]"]) if (new RegExp(`\\b${bad.replace(/[[\]]/g, "\\$&")}\\b`).test(text)) problems.push(`"${bad}" in text`);
  // textContent has entities decoded, so any literal "gt;" etc. is a markup fragment
  if (/\b(?:gt|lt|amp|quot);/.test(doc.body.textContent)) problems.push("stray HTML entity fragment (gt; / lt; / amp;) in text");
  if (doc.querySelectorAll("p p").length) problems.push("nested <p> (broken markup)");
  for (const svg of doc.querySelectorAll('svg[role="img"]')) if (!svg.getAttribute("aria-label")) problems.push("chart without aria-label");
  for (const c of main.querySelectorAll("input, select, button")) {
    const named = c.getAttribute("aria-label") || (c.id && doc.querySelector(`label[for="${c.id}"]`)) || c.textContent.trim() || c.closest("label");
    if (!named) problems.push(`unnamed control <${c.tagName.toLowerCase()} type=${c.getAttribute("type")}>`);
  }
  const charts = doc.querySelectorAll('svg[role="img"]').length;
  dom.window.close();
  return { file: relative(ROOT, file), hosts: hosts.length, charts, errors, problems };
}

const results = [];
for (const p of pages) results.push(await check(p));
const failed = results.filter((r) => r.errors.length || r.problems.length);
const lines = [
  "# Render smoke report (jsdom)",
  "",
  `Generated ${new Date().toISOString()} by \`verification/render_smoke.mjs\` (jsdom ${require("jsdom/package.json").version}, node ${process.version}).`,
  "",
  `**Result: ${failed.length ? "FAIL" : "PASS"}**; ${results.length} pages, ${results.reduce((s, r) => s + r.hosts, 0)} widget hosts, ${results.reduce((s, r) => s + r.charts, 0)} charts.`,
  "",
  "| page | widget hosts | charts | script errors | problems |",
  "|---|---:|---:|---|---|",
  ...results.map((r) => `| ${r.file} | ${r.hosts} | ${r.charts} | ${r.errors.length ? r.errors.join("; ") : "0"} | ${r.problems.length ? r.problems.join("; ") : "none"} |`),
  "",
];
writeFileSync(join(HERE, "render_smoke_report.md"), lines.join("\n"));
for (const r of results) console.log(`${r.errors.length || r.problems.length ? "FAIL" : "ok  "} ${r.file}: hosts ${r.hosts}, charts ${r.charts}${r.errors.length ? `, errors: ${r.errors.join(" | ")}` : ""}${r.problems.length ? `, problems: ${r.problems.join(" | ")}` : ""}`);
console.log(failed.length ? `render smoke: FAIL (${failed.length}/${results.length})` : `render smoke: PASS (${results.length} pages)`);
process.exit(failed.length ? 1 : 0);
