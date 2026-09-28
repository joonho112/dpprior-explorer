#!/usr/bin/env node
/**
 * After a rerun of the r-export scripts (r-export/README.md), compare every file they write under
 * verification/golden/ and data/ with the committed version (git HEAD). Two files count as the
 * same when they differ only in `generated_at` timestamps:
 *   - CSV: the generated_at column is dropped; golden_manifest.csv is compared as a set of rows
 *     (its row order follows the order in which the scripts were last run);
 *   - JSON and the .js twins (`export default {...};`): every `generated_at` key is dropped;
 *   - anything else: byte for byte.
 * New files that git does not track and tracked files that went missing are reported too.
 * Usage: node verification/compare_rerun.mjs [--self-test]     (exit 1 when a file differs)
 * Since 1.1.0 (the clean-clone reproduction test).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE = ["verification/golden", "data"];
const STAMP = "generated_at";

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
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvKey(text, asSet) {
  const rows = parseCsv(text);
  if (!rows.length) return "";
  const drop = rows[0].indexOf(STAMP);
  const kept = rows.map((r) => r.filter((_, j) => j !== drop).join("\u0001"));
  const body = kept.slice(1);
  if (asSet) body.sort();
  return [kept[0], ...body].join("\n");
}

function dropStamps(x) {
  if (Array.isArray(x)) return x.map(dropStamps);
  if (x && typeof x === "object") {
    const out = {};
    for (const k of Object.keys(x).sort()) if (k !== STAMP) out[k] = dropStamps(x[k]);
    return out;
  }
  return x;
}

function jsonKey(text, twin) {
  let body = text;
  if (twin) {
    const at = body.indexOf("export default");
    if (at < 0) return text;
    body = body.slice(at + "export default".length).trim().replace(/;\s*$/, "");
  }
  try {
    return JSON.stringify(dropStamps(JSON.parse(body)));
  } catch {
    return text;
  }
}

/** The comparison key of one file's content: equal keys mean "the same up to timestamps". */
export function contentKey(path, text) {
  if (path.endsWith(".csv")) return csvKey(text, path.endsWith("golden_manifest.csv"));
  if (path.endsWith(".json")) return jsonKey(text, false);
  if (path.endsWith(".js")) return jsonKey(text, true);
  return text;
}

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });

function compare() {
  const tracked = git("ls-files", "--", ...SCOPE).split("\n").filter(Boolean);
  const untracked = git("ls-files", "--others", "--exclude-standard", "--", ...SCOPE).split("\n").filter(Boolean);
  const changed = [];
  const missing = [];
  let stampOnly = 0;
  let identical = 0;
  for (const p of tracked) {
    const abs = join(ROOT, p);
    if (!existsSync(abs)) {
      missing.push(p);
      continue;
    }
    const now = readFileSync(abs, "utf8");
    const then = git("show", `HEAD:${p}`);
    if (now === then) identical += 1;
    else if (contentKey(p, now) === contentKey(p, then)) stampOnly += 1;
    else changed.push(p);
  }
  return { tracked: tracked.length, identical, stampOnly, changed, missing, untracked };
}

function selfTest() {
  const csvA = '"file","sha256","generated_at"\n"a.csv","1","2026-09-24T10:00:00-0400"\n"b.csv","2","2026-09-24T10:00:00-0400"\n';
  const csvB = '"file","sha256","generated_at"\n"b.csv","2","2026-09-25T11:00:00-0400"\n"a.csv","1","2026-09-25T11:00:00-0400"\n';
  const csvC = '"file","sha256","generated_at"\n"b.csv","3","2026-09-25T11:00:00-0400"\n"a.csv","1","2026-09-25T11:00:00-0400"\n';
  const jsA = '// generated; do not edit\nexport default {"generated_at": "x", "rows": [1, 2]};\n';
  const jsB = '// generated; do not edit\nexport default {"rows": [1, 2], "generated_at": "y"};\n';
  const jsC = '// generated; do not edit\nexport default {"rows": [1, 2.0001], "generated_at": "y"};\n';
  const checks = [
    ["manifest rows reordered, new timestamps: same", contentKey("g/golden_manifest.csv", csvA) === contentKey("g/golden_manifest.csv", csvB)],
    ["manifest sha changed: different", contentKey("g/golden_manifest.csv", csvA) !== contentKey("g/golden_manifest.csv", csvC)],
    ["ordinary CSV rows reordered: different", contentKey("g/x.csv", csvA) !== contentKey("g/x.csv", csvB)],
    ["twin with a new timestamp: same", contentKey("d/x.js", jsA) === contentKey("d/x.js", jsB)],
    ["twin with a changed number: different", contentKey("d/x.js", jsA) !== contentKey("d/x.js", jsC)],
  ];
  const bad = checks.filter(([, ok]) => !ok);
  for (const [name] of bad) console.log(`compare_rerun self-test FAILED: ${name}`);
  if (bad.length) process.exit(1);
  console.log(`compare_rerun self-test: PASS (${checks.length} of ${checks.length})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--self-test")) selfTest();
  const r = compare();
  for (const p of r.changed) console.log(`changed: ${p}`);
  for (const p of r.missing) console.log(`missing: ${p}`);
  for (const p of r.untracked) console.log(`new (untracked): ${p}`);
  const bad = r.changed.length + r.missing.length + r.untracked.length;
  console.log(
    `compare_rerun: ${r.tracked} tracked files under ${SCOPE.join(", ")}; ${r.identical} byte-identical, ${r.stampOnly} differ only in ${STAMP}; ` +
      `${r.changed.length} changed, ${r.missing.length} missing, ${r.untracked.length} new -> ${bad ? "FAIL" : "PASS"}`,
  );
  if (bad) process.exit(1);
}
