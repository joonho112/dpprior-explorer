#!/usr/bin/env node
/**
 * Catalog check (CONTRACT.md section 3): catalog/catalog.json against
 * catalog/schema/catalog.schema.json rules, plus files that must exist.
 *
 *   - array of objects with exactly the schema's properties; required fields present
 *   - id matches ^[PMCAX]-NN$, unique, and its prefix matches the axis
 *   - does / sees are one sentence each (>= 10 characters, end with a period)
 *   - page source exists (pages/x/y.html <- pages/x/y.qmd, or a top-level .qmd)
 *   - embed exists under embed/ when not null; thumb exists when not null
 *   - step looks like "Step N.M"; status in planned | in-progress | done
 *
 * Usage: node verification/check_catalog.mjs [catalog.json] [--self-test]
 * --self-test injects a duplicate id and a missing field and expects both to fail.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(ROOT, "catalog", "schema", "catalog.schema.json"), "utf8"));
const item = schema.items;
const AXIS_BY_PREFIX = { P: "dpm", M: "problems", C: "dpprior", A: "evidence", X: "complementary" };
// the ladder hub's rungs (scripts/pre-render.ts RUNGS), so the catalog rung and the hub drawing agree
const RUNG_OF = new Map();
for (const m of readFileSync(join(ROOT, "scripts", "pre-render.ts"), "utf8").matchAll(/\{ n: (\d+), title: "[^"]*", ids: \[([^\]]*)\]/g)) {
  for (const id of m[2].match(/[PMCAX]-\d{2}/g) ?? []) RUNG_OF.set(id, Number(m[1]));
}

export function checkCatalog(entries) {
  const errors = [];
  if (!Array.isArray(entries)) return ["catalog.json must be an array"];
  const seen = new Set();
  entries.forEach((e, i) => {
    const where = `entry ${i}${e && e.id ? ` (${e.id})` : ""}`;
    if (!e || typeof e !== "object") {
      errors.push(`${where}: not an object`);
      return;
    }
    for (const req of item.required) if (!(req in e)) errors.push(`${where}: missing required field "${req}"`);
    for (const k of Object.keys(e)) if (!(k in item.properties)) errors.push(`${where}: unknown field "${k}"`);
    if (typeof e.id !== "string" || !new RegExp(item.properties.id.pattern).test(e.id)) errors.push(`${where}: bad id`);
    else {
      if (seen.has(e.id)) errors.push(`${where}: duplicate id ${e.id}`);
      seen.add(e.id);
      if (AXIS_BY_PREFIX[e.id[0]] !== e.axis) errors.push(`${where}: id prefix ${e.id[0]} does not match axis "${e.axis}"`);
    }
    if (!item.properties.axis.enum.includes(e.axis)) errors.push(`${where}: bad axis`);
    if (!item.properties.status.enum.includes(e.status)) errors.push(`${where}: bad status`);
    for (const f of ["does", "sees", "concept"]) {
      if (typeof e[f] !== "string" || e[f].trim().length < 10) errors.push(`${where}: "${f}" must be a sentence`);
      else if (!/[.!?]$/.test(e[f].trim())) errors.push(`${where}: "${f}" should end with a period`);
    }
    if (typeof e.step !== "string" || !/^Step [0-9]+\.[0-9]+$/.test(e.step)) errors.push(`${where}: bad step`);
    if (typeof e.page === "string") {
      const src = e.page.replace(/\.html$/, ".qmd");
      if (!existsSync(join(ROOT, src))) errors.push(`${where}: page source ${src} not found`);
    }
    if (e.embed !== null && e.embed !== undefined) {
      if (!/^embed\/[a-z0-9-]+\.html$/.test(e.embed)) errors.push(`${where}: bad embed path`);
      else if (!existsSync(join(ROOT, e.embed))) errors.push(`${where}: embed ${e.embed} not found`);
    }
    if (e.thumb !== null && e.thumb !== undefined) {
      if (!new RegExp(item.properties.thumb.pattern).test(e.thumb)) errors.push(`${where}: bad thumb path`);
      else if (!existsSync(join(ROOT, e.thumb))) errors.push(`${where}: thumb ${e.thumb} not found`);
      else if (!e.thumb.endsWith(`${e.id}.png`)) errors.push(`${where}: thumb file name must be ${e.id}.png`);
    }
    if (e.media) {
      if (!existsSync(join(ROOT, e.media))) errors.push(`${where}: media ${e.media} not found`);
    }
    // Step 11.5: section, rung, audience
    if (!item.properties.section.enum.includes(e.section)) errors.push(`${where}: bad section "${e.section}"`);
    else if (typeof e.page === "string" && e.page.startsWith("pages/") && !["tools"].includes(e.section)) {
      const dir = e.page.split("/")[1];
      if (dir !== e.section && !(dir === "media.html" && e.section === "applications")) errors.push(`${where}: section "${e.section}" does not match page ${e.page}`);
    }
    if (!Array.isArray(e.audience) || !e.audience.length || e.audience.some((a) => !item.properties.audience.items.enum.includes(a))) errors.push(`${where}: audience must list beginner / researcher / course`);
    if (e.rung !== null && (!Number.isInteger(e.rung) || e.rung < 0 || e.rung > 8)) errors.push(`${where}: rung must be 0-8 or null`);
    if (typeof e.id === "string" && e.id.startsWith("P-") && e.id !== "P-16" && e.rung === null) errors.push(`${where}: a ladder entry needs its rung`);
    if (typeof e.id === "string" && !e.id.startsWith("P-") && e.rung !== null) errors.push(`${where}: only P ids sit on the ladder`);
    if (typeof e.id === "string" && RUNG_OF.has(e.id) && RUNG_OF.get(e.id) !== e.rung) errors.push(`${where}: rung ${e.rung} differs from the ladder hub (scripts/pre-render.ts: ${RUNG_OF.get(e.id)})`);
  });
  return errors;
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  const ok = {
    id: "M-99", name: "Self test", axis: "problems", concept: "A concept sentence.", does: "The viewer does a thing.",
    sees: "The viewer sees a thing.", engine: "dp-core", page: "index.html", embed: null, step: "Step 3.2", thumb: null, status: "planned",
    section: "problems", rung: null, audience: ["researcher"],
  };
  const dup = checkCatalog([ok, { ...ok }]);
  const missing = checkCatalog([{ ...ok, does: undefined }].map((e) => { delete e.does; return e; }));
  const clean = checkCatalog([ok]);
  const pass = dup.some((m) => m.includes("duplicate id")) && missing.some((m) => m.includes('missing required field "does"')) && clean.length === 0;
  console.log(`catalog self-test: duplicate -> ${dup.length} error(s); missing does -> ${missing.length} error(s); clean -> ${clean.length}`);
  console.log(pass ? "catalog self-test: PASS" : "catalog self-test: FAIL");
  process.exit(pass ? 0 : 1);
}
const file = args.find((a) => !a.startsWith("--")) ?? join(ROOT, "catalog", "catalog.json");
const entries = JSON.parse(readFileSync(file, "utf8"));
const errors = checkCatalog(entries);
console.log(`catalog: ${Array.isArray(entries) ? entries.length : 0} entries`);
for (const e of errors) console.error(`  FAIL ${e}`);
if (!args.some((a) => !a.startsWith("--")) && Array.isArray(entries)) {
  // verification/catalog_report.md (Step 11.5): completeness at a glance
  const count = (f) => entries.reduce((m, e) => { for (const k of [].concat(f(e) ?? [])) m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const fmtCounts = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(", ");
  // the report must not crash on an entry the checks above already failed
  const rows = entries.map((e) => `| ${e.id ?? "?"} | ${String(e.name ?? "(missing)").replace(/\|/g, "&#124;")} | ${e.section ?? "?"} | ${e.rung ?? ""} | ${[].concat(e.audience ?? []).join(", ")} | ${e.status ?? "?"} | ${e.step ?? "?"} | ${e.embed ? "yes" : "no"} | ${e.thumb && existsSync(join(ROOT, e.thumb)) ? "yes" : "no"} |`);
  writeFileSync(join(ROOT, "verification", "catalog_report.md"), [
    "# Catalog report",
    "",
    `Generated ${new Date().toISOString()} by \`node verification/check_catalog.mjs\`: ${entries.length} entries, ${errors.length ? `${errors.length} problem(s)` : "no problems"} (schema fields, unique ids, id prefix and axis, sentences, page / embed / thumb / media files, section against the page, audience, rung against the ladder hub).`,
    "",
    `By status: ${fmtCounts(count((e) => e.status))}. By section: ${fmtCounts(count((e) => e.section))}. By audience: ${fmtCounts(count((e) => e.audience))}.`,
    "",
    "| id | name | section | rung | audience | status | step | embed | thumb |",
    "|---|---|---|---:|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n"));
}
console.log(errors.length ? `catalog: FAIL (${errors.length})` : "catalog: PASS");
process.exit(errors.length ? 1 : 0);
