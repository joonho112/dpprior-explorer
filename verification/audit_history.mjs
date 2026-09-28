#!/usr/bin/env node
/**
 * History licence audit (since 1.1.0). A push publishes every commit that
 * the pushed branch reaches, not only the current tree, so a licence check of the working tree
 * says nothing about the first public history. This audit reads every commit on the given refs:
 *
 *   - third-party files: every path under a vendored-library folder (js/vendor/,
 *     apps/htmlwidgets/lib/, docs/site_libs/, and their docs/ copies) is matched to its package,
 *     version and licence (RULES below; the licences come from the packages' own DESCRIPTION
 *     files in the local R library, their LICENSE files and the file headers), with the commits
 *     that contain it and whether the current tree still does;
 *   - copyleft: files whose licence is GPL-family are flagged, with the commit that added them
 *     and the commit that removed them;
 *   - content scan: every blob ever committed is searched for a copyleft licence header
 *     ("GNU GENERAL PUBLIC LICENSE Version", "This program is free software; you can
 *     redistribute it", an SPDX or @license GPL tag); a header outside the vendored folders is
 *     reported as unexplained;
 *   - guards: no path of the reference folders (Broderick, Giordano, bnp_tutorial) and no
 *     node_modules path was ever committed.
 *
 * This is a factual inventory, not a legal opinion.
 * Usage: node verification/audit_history.mjs [--ref <ref>]... [--out <file.md>] [--require-clean]
 *   default: every ref (git rev-list --all) and verification/history_audit.md;
 *   --require-clean exits 1 when a copyleft file or an unexplained header is reachable from the
 *   refs (use it on the branch that is about to be pushed).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const refs = [];
let out = join(ROOT, "verification", "history_audit.md");
let requireClean = false;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--ref") refs.push(args[(i += 1)]);
  else if (args[i] === "--out") out = args[(i += 1)];
  else if (args[i] === "--require-clean") requireClean = true;
}
const refArgs = refs.length ? refs : ["--all"];
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 });

// ------------------------------------------------------------------ rules ---
// [path pattern, package, licence, copyleft, licence evidence]; the version comes from the folder name
const R_LIB = "DESCRIPTION in the local R library";
const RULES = [
  [/(^|\/)js\/vendor\/d3\.(min\.js|LICENSE)$/, "D3 7.9.0", "ISC", false, "js/vendor/d3.LICENSE"],
  [/(^|\/)js\/vendor\/plot\.(min\.js|LICENSE)$/, "Observable Plot 0.6.17", "ISC", false, "js/vendor/plot.LICENSE"],
  [/apps\/htmlwidgets\/lib\/ggiraphjs-([\d.]+)\//, "ggiraph JavaScript (R package ggiraph)", "GPL-3", true, `ggiraph ${R_LIB}`],
  [/apps\/htmlwidgets\/lib\/girafe-binding-([\d.]+)\//, "ggiraph htmlwidgets binding (R package ggiraph)", "GPL-3", true, `ggiraph ${R_LIB}`],
  [/apps\/htmlwidgets\/lib\/htmltools-fill-([\d.]+)\//, "htmltools fill.css (R package htmltools)", "GPL (>= 2)", true, `htmltools ${R_LIB}`],
  [/apps\/htmlwidgets\/lib\/crosstalk-([\d.]+)\//, "crosstalk (R package)", "MIT", false, `crosstalk ${R_LIB}`],
  [/apps\/htmlwidgets\/lib\/htmlwidgets-([\d.]+)\//, "htmlwidgets (R package)", "MIT", false, `htmlwidgets ${R_LIB}`],
  [/apps\/htmlwidgets\/lib\/jquery-([\d.]+)\//, "jQuery", "MIT", false, "jquery-AUTHORS.txt; jquerylib DESCRIPTION"],
  [/apps\/htmlwidgets\/lib\/plotly-binding-([\d.]+)\//, "plotly htmlwidgets binding (R package plotly)", "MIT", false, `plotly ${R_LIB}`],
  [/apps\/htmlwidgets\/lib\/plotly-htmlwidgets-css-([\d.]+)\//, "plotly htmlwidgets CSS (R package plotly)", "MIT", false, `plotly ${R_LIB}`],
  [/apps\/htmlwidgets\/lib\/plotly-main-([\d.]+)\//, "plotly.js", "MIT", false, "file header; plotly DESCRIPTION"],
  [/apps\/htmlwidgets\/lib\/typedarray-([\d.]+)\//, "typedarray.js (as shipped in the R package plotly)", "MIT", false, "plotly/htmlwidgets/lib/typedarray/LICENSE"],
  [/(^|\/)site_libs\/bootstrap\/bootstrap-icons/, "Bootstrap Icons (Quarto)", "MIT", false, "file header"],
  [/(^|\/)site_libs\/bootstrap\//, "Bootstrap (Quarto)", "MIT", false, "file header"],
  [/(^|\/)site_libs\/clipboard\//, "clipboard.js (Quarto)", "MIT", false, "file header"],
  [/(^|\/)site_libs\/quarto-html\/tippy/, "tippy.js (Quarto)", "MIT", false, "Quarto COPYRIGHT"],
  [/(^|\/)site_libs\/quarto-html\/popper/, "Popper (Quarto)", "MIT", false, "file header"],
  [/(^|\/)site_libs\/quarto-html\/anchor/, "AnchorJS (Quarto)", "MIT", false, "file header (@license magnet, Expat)"],
  [/(^|\/)site_libs\/quarto-nav\/headroom/, "Headroom.js (Quarto)", "MIT", false, "file header"],
  [/(^|\/)site_libs\/quarto-search\/fuse/, "Fuse.js (Quarto)", "Apache-2.0", false, "file header"],
  [/(^|\/)site_libs\/quarto-search\/autocomplete/, "Algolia Autocomplete (Quarto)", "MIT", false, "file header"],
  [/(^|\/)site_libs\//, "Quarto site library", "MIT", false, "Quarto share/COPYING.md"],
];
const VENDORED = /(^|\/)(js\/vendor|apps\/htmlwidgets\/lib|site_libs)\//;
const AUTHOR_NOTE = /(^|\/)js\/vendor\/VENDOR\.md$/; // the author's own note on the vendored files
const SELF = "verification/audit_history.mjs";
const GUARDS = [
  ["reference folders (Broderick, Giordano, bnp_tutorial)", /Tamara Broderick|bnp_tutorial|giordano/i],
  ["node_modules", /(^|\/)node_modules\//],
];
const HEADER = /GNU (?:LESSER |LIBRARY |AFFERO )?GENERAL PUBLIC LICENSE\s+Version|This (?:program|library) is free software; you can redistribute it|SPDX-License-Identifier:\s*\(?(?:A|L)?GPL|@license\s+(?:A|L)?GPL/i;

// ---------------------------------------------------------------- history ---
const commits = git("rev-list", "--reverse", ...refArgs).split("\n").filter(Boolean);
const info = new Map(git("log", "--format=%H%x09%h%x09%ad%x09%s", "--date=short", ...refArgs).split("\n").filter(Boolean)
  .map((l) => { const [H, h, d, s] = l.split("\t"); return [H, { h, d, s }]; }));
const head = new Set(git("ls-tree", "-r", "-z", "--name-only", "HEAD").split("\0").filter(Boolean));
const paths = new Map(); // path -> {blobs, idx}
commits.forEach((c, i) => {
  for (const rec of git("ls-tree", "-r", "-z", "--full-tree", c).split("\0")) {
    if (!rec) continue;
    const tab = rec.indexOf("\t");
    const [, type, blob] = rec.slice(0, tab).split(" ");
    if (type !== "blob") continue;
    const p = rec.slice(tab + 1);
    let e = paths.get(p);
    if (!e) paths.set(p, (e = { blobs: new Set(), idx: [] }));
    e.blobs.add(blob);
    e.idx.push(i);
  }
});

// ---------------------------------------------------------- content scan ---
const blobPaths = new Map();
for (const [p, e] of paths) for (const b of e.blobs) (blobPaths.get(b) ?? blobPaths.set(b, []).get(b)).push(p);
const blobs = [...blobPaths.keys()];
const cat = spawnSync("git", ["cat-file", "--batch"], { cwd: ROOT, input: blobs.join("\n") + "\n", maxBuffer: 2 ** 31 });
const buf = cat.stdout;
const headerHits = new Map(); // path -> marker
let pos = 0;
let scanned = 0;
let bytes = 0;
while (pos < buf.length) {
  const nl = buf.indexOf(10, pos);
  const [sha, , size] = buf.subarray(pos, nl).toString("utf8").split(" ");
  const n = Number(size);
  const body = buf.subarray(nl + 1, nl + 1 + n);
  pos = nl + 1 + n + 1;
  bytes += n;
  if (body.subarray(0, 8000).includes(0)) continue; // binary
  scanned += 1;
  const m = body.toString("utf8").match(HEADER);
  if (m) for (const p of blobPaths.get(sha) ?? []) headerHits.set(p, m[0].replace(/\s+/g, " "));
}

// -------------------------------------------------------------- classify ---
const range = (idx) => ({ first: commits[idx[0]], last: commits[idx[idx.length - 1]], n: idx.length, next: commits[idx[idx.length - 1] + 1] ?? null });
const short = (c) => (c ? `\`${info.get(c)?.h ?? c.slice(0, 7)}\`` : "-");
const packages = new Map(); // key -> {pkg, version, licence, copyleft, evidence, paths:[], idx:Set}
const copyleftFiles = [];
const unexplained = [];
for (const [p, e] of paths) {
  if (AUTHOR_NOTE.test(p)) continue;
  const rule = RULES.find(([re]) => re.test(p));
  if (!rule && VENDORED.test(p)) unexplained.push({ p, why: "vendored folder without a rule" });
  if (!rule) {
    // this script's own source quotes the markers it looks for
    if (headerHits.has(p) && p !== SELF) unexplained.push({ p, why: `copyleft header outside the vendored folders: "${headerHits.get(p)}"` });
    continue;
  }
  const [, pkg, licence, copyleft, evidence] = rule;
  const version = p.match(/-(\d[\d.]*)\//)?.[1] ?? ""; // from the folder name (ggiraphjs-0.9.4/)
  const key = `${pkg}|${version}`;
  const k = packages.get(key) ?? packages.set(key, { pkg, version, licence, copyleft, evidence, paths: [], idx: new Set() }).get(key);
  k.paths.push(p);
  e.idx.forEach((i) => k.idx.add(i));
  if (copyleft) copyleftFiles.push({ p, licence, pkg, ...range(e.idx), inHead: head.has(p), header: headerHits.get(p) ?? "" });
}
const guardHits = GUARDS.map(([name, re]) => [name, [...paths.keys()].filter((p) => re.test(p))]);

// ---------------------------------------------------------------- report ---
const pkgRows = [...packages.values()].sort((a, b) => Number(b.copyleft) - Number(a.copyleft) || a.pkg.localeCompare(b.pkg));
const L = [];
L.push("# History licence audit", "");
L.push(`Written by \`verification/audit_history.mjs\` on ${new Date().toISOString().slice(0, 10)}. Refs: ${refs.length ? refs.map((r) => `\`${r}\``).join(", ") : "all (`git rev-list --all`)"}. ` +
  `${commits.length} commits (${short(commits[0])} ${info.get(commits[0])?.d ?? ""} to ${short(commits[commits.length - 1])} ${info.get(commits[commits.length - 1])?.d ?? ""}), ${paths.size} distinct paths, ${blobs.length} distinct blobs (${(bytes / 1e6).toFixed(1)} MB; ${scanned} text blobs scanned for copyleft headers).`);
L.push("", "A factual inventory before a push (`DEPLOY.md`), not a legal opinion.", "");
const clean = copyleftFiles.length === 0 && unexplained.length === 0;
L.push(`**Result:** ${clean ? "no copyleft file and no unexplained licence header is reachable from these refs." : `${copyleftFiles.length} copyleft file(s) and ${unexplained.length} unexplained item(s) are reachable from these refs.`}`, "");
L.push("## Third-party packages ever committed", "");
L.push("| package | version | licence | copyleft | paths | commits containing it | first | last | in the current tree |", "|---|---|---|---|---:|---:|---|---|---|");
for (const k of pkgRows) {
  const idx = [...k.idx].sort((a, b) => a - b);
  const inHead = k.paths.filter((p) => head.has(p)).length;
  L.push(`| ${k.pkg} | ${k.version || "-"} | ${k.licence} | ${k.copyleft ? "**yes**" : "no"} | ${k.paths.length} | ${idx.length} | ${short(commits[idx[0]])} | ${short(commits[idx[idx.length - 1]])} | ${inHead ? `yes (${inHead} paths)` : "no"} |`);
}
L.push("", "Licence evidence: " + [...new Set(pkgRows.map((k) => `${k.pkg}: ${k.evidence}`))].join("; ") + ".", "");
L.push("## Copyleft files", "");
if (!copyleftFiles.length) L.push("None.", "");
else {
  L.push("| path | licence | added in | last commit with it | removed in | commits | in the current tree |", "|---|---|---|---|---|---:|---|");
  for (const f of copyleftFiles.sort((a, b) => a.p.localeCompare(b.p))) {
    L.push(`| \`${f.p}\` | ${f.licence} | ${short(f.first)} | ${short(f.last)} | ${f.inHead ? "(still present)" : short(f.next)} | ${f.n} | ${f.inHead ? "**yes**" : "no"} |`);
  }
  const adders = [...new Set(copyleftFiles.map((f) => f.first))];
  const removers = [...new Set(copyleftFiles.filter((f) => !f.inHead).map((f) => f.next))];
  L.push("", `Added by ${adders.map((c) => `${short(c)} (${info.get(c)?.s ?? ""})`).join("; ")}. Removed by ${removers.map((c) => `${short(c)} (${info.get(c)?.s ?? ""})`).join("; ") || "-"}.`, "");
}
L.push("## Content scan", "");
L.push(`${scanned} text blobs searched for a copyleft licence header. Headers found in vendored files: ${[...headerHits.keys()].filter((p) => VENDORED.test(p)).length}; outside the vendored folders: ${[...headerHits.keys()].filter((p) => !VENDORED.test(p) && p !== SELF).length} (not counting this audit's own source, which quotes the markers).`, "");
L.push("## Unexplained", "");
L.push(unexplained.length ? unexplained.map((u) => `- \`${u.p}\`: ${u.why}`).join("\n") : "None.", "");
L.push("## Guards", "");
for (const [name, hits] of guardHits) L.push(`- ${name}: ${hits.length ? `**${hits.length} path(s) committed**: ${hits.slice(0, 5).map((p) => `\`${p}\``).join(", ")}` : "never committed"}`);
L.push("");
writeFileSync(out, L.join("\n"));

const guardBad = guardHits.some(([, h]) => h.length);
console.log(`history audit: ${commits.length} commits, ${paths.size} paths, ${blobs.length} blobs; third-party packages ${packages.size}; copyleft files ${copyleftFiles.length} ` +
  `(${copyleftFiles.filter((f) => f.inHead).length} in the current tree); unexplained ${unexplained.length}; guards ${guardBad ? "FAIL" : "ok"} -> ${out}`);
if (guardBad || (requireClean && !clean)) {
  console.log(`history audit: ${requireClean ? "NOT CLEAN" : "FAIL"} for ${refs.length ? refs.join(", ") : "all refs"}`);
  process.exit(1);
}
if (requireClean) console.log(`history audit: CLEAN for ${refs.length ? refs.join(", ") : "all refs"}`);
