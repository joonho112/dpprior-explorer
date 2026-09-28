#!/usr/bin/env node
/**
 * Vocabulary scan (Step 11.2). Applies verification/vocabulary_rules.json, the terminology of
 * pages/vocabulary.qmd, to what a reader sees:
 *   - page prose: pages/**\/*.qmd, index.qmd, catalog.qmd, learning-paths.qmd (front matter kept,
 *     fenced blocks dropped: they hold code and widget mounts, not prose);
 *   - widget strings: string literals and template text in js/widgets/*.js (comments and ${...}
 *     expressions dropped);
 *   - catalog entries (name, concept, does, sees) and embed titles and captions, unit = id.
 * Rule kinds: forbidden (never, with an optional exception), scoped (only in the listed paths,
 * catalog ids "id:P-" or embeds "embed:name"), misuse (a wrong claim, e.g. W_SB called the largest).
 * Writes verification/scan_report.md with this scan and the literal scan's summary line.
 *
 * Usage: node verification/scan_vocabulary.mjs [--self-test]     Exit: 0 clean, 1 violations
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const RULES = JSON.parse(readFileSync(join(HERE, "vocabulary_rules.json"), "utf8"));

function walk(dir, ext, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (n.endsWith(ext)) out.push(p);
  }
  return out;
}
/** Page prose: drop fenced blocks (``` ... ```), keep front matter and text. */
function prose(text) {
  return text.replace(/^```[\s\S]*?^```[ \t]*$/gm, (m) => "\n".repeat(m.split("\n").length - 1));
}
/** Visible strings of a JS file: string literals and template text; comments and ${} dropped. */
function jsStrings(src) {
  const out = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "\n") line += 1;
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i += 1; continue; }
    if (c === "/" && d === "*") { const j = src.indexOf("*/", i + 2); line += src.slice(i, j).split("\n").length - 1; i = j + 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      const start = line;
      let buf = "";
      i += 1;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") { buf += src[i + 1] ?? ""; i += 2; continue; }
        if (q === "`" && src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          i += 2;
          const exprStart = i;
          while (i < n && depth) { if (src[i] === "{") depth += 1; else if (src[i] === "}") depth -= 1; i += 1; }
          for (const s of jsStrings(src.slice(exprStart, i - 1))) out.push({ line: start + s.line - 1, text: s.text });
          buf += " … ";
          continue;
        }
        if (src[i] === "\n") line += 1;
        buf += src[i];
        i += 1;
      }
      out.push({ line: start, text: buf });
      i += 1;
      continue;
    }
    i += 1;
  }
  return out;
}

function units() {
  const list = [];
  const pages = [...walk(join(ROOT, "pages"), ".qmd"), ...["index.qmd", "catalog.qmd", "learning-paths.qmd"].map((f) => join(ROOT, f)).filter(existsSync)];
  for (const p of pages) list.push({ where: relative(ROOT, p), scope: relative(ROOT, p), text: prose(readFileSync(p, "utf8")) });
  for (const p of walk(join(ROOT, "js", "widgets"), ".js")) {
    const rel = relative(ROOT, p);
    for (const s of jsStrings(readFileSync(p, "utf8"))) list.push({ where: `${rel}:${s.line}`, scope: rel, text: s.text });
  }
  for (const e of JSON.parse(readFileSync(join(ROOT, "catalog", "catalog.json"), "utf8"))) {
    list.push({ where: `catalog ${e.id}`, scope: `id:${e.id}`, text: [e.name, e.concept, e.does, e.sees].join(" \n") });
  }
  for (const e of JSON.parse(readFileSync(join(ROOT, "embed", "embeds.json"), "utf8"))) {
    list.push({ where: `embed ${e.name}`, scope: `embed:${e.name}`, ids: e.ids ?? [], text: [e.title, e.caption].join(" \n") });
  }
  return list;
}

function check(list, rules = RULES) {
  const hits = [];
  const flags = (r) => (r.case ? "g" : "gi");
  const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;
  const allowedFor = (r, u) => r.allowed.some((a) => u.scope.startsWith(a) || (a.startsWith("id:") && (u.ids ?? []).some((id) => `id:${id}`.startsWith(a))));
  for (const u of list) {
    for (const r of rules.forbidden) {
      for (const m of u.text.matchAll(new RegExp(r.pattern, flags(r)))) {
        const around = u.text.slice(m.index, m.index + 40);
        if (r.except && new RegExp(`^(?:${r.except})`, "i").test(around)) continue;
        hits.push({ rule: r.id, where: u.where, line: lineOf(u.text, m.index), found: m[0], why: r.why });
      }
    }
    for (const r of rules.scoped) {
      if (allowedFor(r, u)) continue;
      for (const m of u.text.matchAll(new RegExp(r.pattern, flags(r)))) hits.push({ rule: r.id, where: u.where, line: lineOf(u.text, m.index), found: m[0], why: r.why });
    }
    for (const r of rules.misuse) {
      for (const m of u.text.matchAll(new RegExp(r.pattern, flags(r)))) hits.push({ rule: r.id, where: u.where, line: lineOf(u.text, m.index), found: m[0], why: r.why });
    }
  }
  return hits;
}

if (process.argv.includes("--self-test")) {
  const fake = [
    { where: "t1", scope: "pages/problems/x.qmd", text: "The effect is significant (p-value .03)." },
    { where: "t2", scope: "pages/applications/y.qmd", text: "with a true number of clusters of 5; K_N grows" },
    { where: "t3", scope: "js/widgets/z.js", text: "W_SB, the largest weight" },
    { where: "t4", scope: "pages/dpm/crp.qmd", text: "K_N, the count; 3 significant digits; W_SB is not the largest" },
  ];
  const hits = check(fake);
  const got = hits.map((h) => `${h.where}:${h.rule}`).sort().join(",");
  const want = ["t1:p-value", "t1:significance", "t2:K_N", "t2:true-number-of-clusters", "t3:W_SB-is-largest"].sort().join(",");
  console.log(got === want ? "vocabulary self-test: PASS (5 planted violations found, 0 false alarms)" : `vocabulary self-test: FAIL (${got})`);
  process.exit(got === want ? 0 : 1);
}

const list = units();
const hits = check(list);
let literal = "not run";
try {
  literal = execFileSync(process.execPath, [join(HERE, "run_literal_scan.mjs")], { encoding: "utf8" }).trim().split("\n").pop();
} catch (e) {
  literal = String(e.stdout ?? e.message).trim().split("\n").pop();
}
const counts = { pages: list.filter((u) => u.scope.endsWith(".qmd")).length, strings: list.filter((u) => u.scope.startsWith("js/")).length, catalog: list.filter((u) => u.scope.startsWith("id:")).length, embeds: list.filter((u) => u.scope.startsWith("embed:")).length };
const report = [
  "# Scan report",
  "",
  `Generated ${new Date().toISOString()} by \`verification/scan_vocabulary.mjs\` (Step 11.2).`,
  "",
  "## Literal scan",
  "",
  `\`run_literal_scan.mjs\`: ${literal}`,
  "",
  "## Vocabulary scan",
  "",
  `Rules: ${RULES.forbidden.length} forbidden, ${RULES.scoped.length} scoped, ${RULES.misuse.length} misuse (\`vocabulary_rules.json\`). Scanned ${counts.pages} pages, ${counts.strings} widget strings, ${counts.catalog} catalog entries, ${counts.embeds} embed captions.`,
  "",
  `**Result: ${hits.length ? `FAIL (${hits.length})` : "PASS"}**`,
  "",
  ...(hits.length ? ["| rule | where | line | found | why |", "|---|---|---:|---|---|", ...hits.map((h) => `| ${h.rule} | ${h.where} | ${h.line} | ${h.found.replace(/\|/g, "&#124;")} | ${h.why} |`)] : ["No violations."]),
  "",
];
writeFileSync(join(HERE, "scan_report.md"), report.join("\n"));
for (const h of hits) console.log(`  ${h.rule}: ${h.where} (line ${h.line}) "${h.found}"`);
console.log(hits.length ? `vocabulary scan: FAIL (${hits.length})` : `vocabulary scan: PASS (${counts.pages} pages, ${counts.strings} widget strings, ${counts.catalog} catalog entries, ${counts.embeds} embeds)`);
process.exit(hits.length ? 1 : 0);
