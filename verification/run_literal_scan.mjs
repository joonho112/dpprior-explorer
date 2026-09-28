#!/usr/bin/env node
/**
 * Literal scan: no result is typed into the engine or into any widget (CONTRACT.md section 6).
 * Rewritten in 1.1.0, after an audit showed that numbers inside strings and 11 unlisted widget
 * files were not scanned.
 *
 * Files: engine/src/*.ts and every js/widgets/*.js (a glob, so a new widget file is scanned at once).
 * Tokens come from the TypeScript compiler's parser, so comments, strings, templates and regular
 * expressions are told apart:
 *   code    numeric literals in code;
 *   string  numbers inside string literals and the text parts of template literals: what a reader
 *           sees in captions, labels, tooltips and read-outs. Numbers inside URLs, catalog ids
 *           (P-05, M-19, ...) and identifiers such as K_50 are not numbers a reader is told.
 * The structural integers 0-10 are exempt in both scopes. Every other (file, scope, value) must
 * have a row in verification/literal_allowlist.csv (file, line, kind, value, reason, scope) with a
 * reason: a numerical-method coefficient, a paper constant (the .5 majority threshold, the .40
 * trigger), a CONTRACT rule, a preset input, an interval level, a citation year, a layout value.
 * A result (a posterior mean, a fitted (a, b), a computed probability) has no admissible reason:
 * it must be computed by dp-core or read from a released table. Literals that equal a golden value
 * to three decimals are reported so that a transcribed result cannot hide behind a row.
 * Matching is by (file, scope, value); `line` is informational (the first occurrence when the row
 * was written). Rows whose literal is gone are reported as stale and fail the scan.
 *
 * Usage: node verification/run_literal_scan.mjs [--self-test] [--list [--all]]
 *   --self-test  plants four mistakes in memory (a number in scanned code, a result in a string, a
 *                new widget file, a result in a formerly unscanned file) and requires each to fail
 * Exit: 0 clean, 1 any literal outside the allowlist, a stale row, or a failed self-test
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "engine", "src");
const WIDGET_DIR = join(ROOT, "js", "widgets");
const ALLOW = join(HERE, "literal_allowlist.csv");
const GOLDEN = join(HERE, "golden");
const LIST = process.argv.includes("--list");
const LIST_ALL = process.argv.includes("--all");
const SELF_TEST = process.argv.includes("--self-test");
const require = createRequire(join(ROOT, "engine", "package.json"));
const ts = require("typescript");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const canon = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? String(Number(x.toPrecision(17))) : v;
};
// numbers a reader can see in text: not part of an identifier (K_50), a decimal chain or a hex id
const TEXT_NUM = /(?<![\w.$-])(\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?![\w.])/g;
const URL_SPAN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const CATALOG_ID = /\b[PMCAX]-\d{2}\b/g;

/** All numeric tokens of one source file: [{scope, line, raw, value}]. */
function tokens(file, text) {
  const kind = file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return; // module specifiers
    if (ts.isNumericLiteral(node)) {
      out.push({ scope: "code", line: lineOf(node.getStart(sf)), raw: node.getText(sf), value: canon(node.text) });
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const masked = node.text.replace(URL_SPAN, (m) => " ".repeat(m.length)).replace(CATALOG_ID, (m) => " ".repeat(m.length));
      for (const m of masked.matchAll(TEXT_NUM)) out.push({ scope: "string", line: lineOf(node.getStart(sf)), raw: m[0], value: canon(m[0]) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function sourceFiles() {
  const files = new Map();
  for (const n of readdirSync(SRC).filter((f) => f.endsWith(".ts")).sort()) files.set(`engine/src/${n}`, readFileSync(join(SRC, n), "utf8"));
  for (const n of readdirSync(WIDGET_DIR).filter((f) => f.endsWith(".js")).sort()) files.set(`js/widgets/${n}`, readFileSync(join(WIDGET_DIR, n), "utf8"));
  return files;
}

// golden values to three decimals (collision report)
const golden = new Set();
for (const f of readdirSync(GOLDEN).filter((f) => f.endsWith(".csv") && f !== "golden_manifest.csv")) {
  for (const m of readFileSync(join(GOLDEN, f), "utf8").matchAll(/-?\d+\.\d+(?:[eE][-+]?\d+)?/g)) {
    const x = Number(m[0]);
    if (Math.abs(x) > 0.001 && !(Number.isInteger(Number(x.toFixed(3))) && Math.abs(x) <= 100)) golden.add(x.toFixed(3));
  }
}

const allow = existsSync(ALLOW) ? parseCsv(readFileSync(ALLOW, "utf8")) : [];
const scopeOf = (a) => (a.scope === "string" ? "string" : "code");
const allowed = new Set(allow.map((a) => `${a.file}|${scopeOf(a)}|${canon(a.value)}`));

function scan(files) {
  const hits = [];
  const used = new Set();
  for (const [file, text] of files) {
    for (const t of tokens(file, text)) {
      const x = Number(t.value);
      if (Number.isInteger(x) && x >= 0 && x <= 10) continue; // structural
      const key = `${file}|${t.scope}|${t.value}`;
      const ok = allowed.has(key);
      if (ok) used.add(key);
      hits.push({ file, ...t, allowed: ok, collides: Number.isFinite(x) && Math.abs(x) > 0.001 && golden.has(x.toFixed(3)) });
    }
  }
  const stale = allow.filter((a) => !used.has(`${a.file}|${scopeOf(a)}|${canon(a.value)}`));
  return { hits, bad: hits.filter((h) => !h.allowed), stale };
}

const files = sourceFiles();
const widgetCount = [...files.keys()].filter((f) => f.startsWith("js/widgets/")).length;

if (LIST) {
  const seen = new Set();
  console.log("file,scope,line,value,raw,allowed,golden_collision");
  for (const h of scan(files).hits) {
    const k = `${h.file}|${h.scope}|${h.value}`;
    if (seen.has(k) && !LIST_ALL) continue;
    seen.add(k);
    console.log(`${h.file},${h.scope},${h.line},${h.value},${h.raw},${h.allowed},${h.collides}`);
  }
  process.exit(0);
}

const { hits, bad, stale } = scan(files);
const collisions = [...new Map(hits.filter((h) => h.collides).map((h) => [`${h.file}|${h.scope}|${h.value}`, h])).values()];
const nCode = hits.filter((h) => h.scope === "code").length;
console.log(`literal scan: ${hits.length} literal occurrences (${nCode} in code, ${hits.length - nCode} in strings) in engine/src and all ${widgetCount} widget files (structural 0-10 excluded); ${allow.length} allowlist rows`);
if (process.argv.includes("--notes")) for (const c of collisions) console.log(`  note: ${c.file}:${c.line} ${c.scope} ${c.raw} equals a golden value to 3 decimals (allowlisted: ${c.allowed})`);
else console.log(`  ${collisions.length} allowlisted literals equal a golden value to 3 decimals (list them with --notes)`);
for (const s of stale) console.error(`  STALE allowlist row (literal no longer present): ${s.file} ${scopeOf(s)} ${s.value}`);
for (const b of bad) console.error(`  NOT ALLOWLISTED ${b.file}:${b.line} ${b.scope} ${b.raw}`);

let selfOk = true;
if (SELF_TEST) {
  // each mistake must produce a hit that is not allowlisted
  const sentinel = "999.123";
  const planted = [
    ["a number in scanned code", (m) => m.set("js/widgets/app-captions.js", `${m.get("js/widgets/app-captions.js")}\nconst REVIEW_SENTINEL = ${sentinel};\n`)],
    ["a result inside a string", (m) => m.set("js/widgets/app-captions.js", `${m.get("js/widgets/app-captions.js")}\nconst REVIEW_SENTINEL = "STAR posterior ${sentinel}";\n`)],
    ["a new widget file", (m) => m.set("js/widgets/review-sentinel.js", `export const x = ${sentinel};\n`)],
    ["a result in a formerly unscanned file", (m) => m.set("js/widgets/worked-example.js", `${m.get("js/widgets/worked-example.js")}\nconst REVIEW_SENTINEL = \`E K = ${sentinel}\`;\n`)],
  ];
  let caught = 0;
  for (const [label, plant] of planted) {
    const m = new Map(files);
    plant(m);
    const hit = scan(m).bad.some((b) => b.value === canon(sentinel));
    if (hit) caught += 1;
    else console.error(`  self-test: not caught: ${label}`);
  }
  selfOk = caught === planted.length;
  console.log(`literal self-test: ${selfOk ? "PASS" : "FAIL"} (${caught} of ${planted.length} planted mistakes caught)`);
}

const failed = bad.length || stale.length || !selfOk;
console.log(failed ? `literal scan: FAIL (${bad.length} outside the allowlist, ${stale.length} stale rows)` : "literal scan: PASS (0 literals outside the allowlist, 0 stale rows)");
process.exit(failed ? 1 : 0);
