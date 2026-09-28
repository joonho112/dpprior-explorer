#!/usr/bin/env node
/**
 * Document numbers (since 1.1.0): the counts that README, the home page, CONTRACT, the current
 * CHANGELOG entry, CITATION, DEPLOY and the two folder READMEs quote (and an output snippet, when
 * one is present) must equal what this gate run measured. Before 1.1.0 three had drifted (17,013
 * comparisons, "at most 20 steps", a script list without 08 and 10-13).
 *
 * Facts, measured here or read from this run's reports:
 *   comparisons, groups              verification/parity_report.md (gate step 3)
 *   tests                            test(...) calls in engine/tests/*.test.ts
 *   steps                            the step count in verification/run_all.sh
 *   widgetFiles                      js/widgets/*.js
 *   catalogEntries, built            catalog/catalog.json (status "done")
 *   pages                            index, catalog, learning paths and pages/**.qmd
 *   releasedFiles, releasedMB        data/released/data_contract.json and the files' sizes
 *   readoutNumbers, readoutCases,    verification/readouts_report.md (gate step 12)
 *   readoutWidgets, readoutSitePages,
 *   paperChecks
 * Every phrase below that quotes one of them is compared; only the newest CHANGELOG entry is read.
 * Usage: node verification/check_docs.mjs [--self-test]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const W = `(\\d+|${WORDS.join("|")})`;
const toNumber = (s) => (WORDS.includes(s.toLowerCase()) ? WORDS.indexOf(s.toLowerCase()) : Number(s.replace(/,/g, "")));

/** [fact, pattern with one capture group]; words may wrap across lines (\s+). */
const RULES = [
  ["comparisons", /(\d[\d,]*)\s+(?:automated\s+|parity\s+)?comparisons/g],
  ["groups", /comparisons\s+in\s+(\d+)\s+groups/g],
  ["groups", /parity_spec\.csv`\s+\((\d+)\s+groups/g],
  ["tests", /(\d+)\s+(?:engine|unit)\s+tests/g],
  ["tests", /engine\s+unit\s+tests\s+\((?:`engine\/tests\/`,\s+)?(\d+)/g],
  ["steps", new RegExp(`\\b${W}-step\\s+(?:verification\\s+)?gate`, "gi")],
  ["steps", new RegExp(`\\b(?:runs|has|All|all)\\s+${W}\\s+steps`, "g")],
  ["widgetFiles", /(\d+)\s+widget\s+files/g],
  ["catalogEntries", /(\d+)\s+catalog\s+entries/g],
  ["catalogEntries", /(\d+)\s+(?:interactive(?:,\s+offline-capable)?\s+)?visualizations/g],
  ["built", /(\d+)\s+built\b/g],
  ["pages", /\((\d+)\s+pages\)/g],
  ["releasedFiles", /(\d+)\s+released\s+(?:summary\s+)?tables/g],
  ["releasedMB", /released\s+(?:summary\s+)?tables\s+\((\d+\.\d+)\s+MB\)/g],
  ["readoutNumbers", /(\d+)\s+displayed\s+numbers/g],
  ["readoutCases", /displayed\s+numbers\s+in\s+(\d+)\s+cases/g],
  ["readoutWidgets", /in\s+\d+\s+cases\s+on\s+(\d+)\s+widgets/g],
  ["readoutSitePages", /widgets\s+and\s+(\d+)\s+site\s+pages/g],
  ["paperChecks", new RegExp(`${W}\\s+(?:paper\\s+cross-checks|table\\s+values)`, "g")],
];

const DOCS = ["README.md", "index.qmd", "CONTRACT.md", "CHANGELOG.md", "CITATION.cff", "DEPLOY.md", "IES_OUTPUT_SNIPPET.md",
  "r-export/README.md", "verification/README.md"];

/** The newest CHANGELOG entry: from the first "## " heading to the next. */
export function newestEntry(text) {
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.startsWith("## "));
  if (first < 0) return text;
  const next = lines.findIndex((l, i) => i > first && l.startsWith("## "));
  return lines.slice(0, next < 0 ? lines.length : next).join("\n");
}

/** Problems in one document: every quoted count that differs from the fact. */
export function checkText(name, text, facts) {
  const problems = [];
  const found = [];
  const lineOf = (idx) => text.slice(0, idx).split("\n").length;
  for (const [fact, re] of RULES) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const got = toNumber(m[1]);
      const want = facts[fact];
      found.push(fact);
      const same = typeof want === "number" && fact === "releasedMB" ? Math.abs(got - want) < 1e-9 : got === want;
      if (!same) problems.push(`${name}:${lineOf(m.index)}: "${m[0].replace(/\s+/g, " ")}" quotes ${fact} = ${m[1]}, the gate measured ${want}`);
    }
  }
  return { problems, found };
}

function measure() {
  const parity = read("verification/parity_report.md");
  const comparisons = Number(parity.match(/(\d+) comparisons/)?.[1]);
  const groups = parity.split("\n").filter((l) => /^\| \S+\.csv \|/.test(l)).length;
  const tests = readdirSync(join(ROOT, "engine", "tests")).filter((f) => f.endsWith(".test.ts"))
    .reduce((s, f) => s + (read(`engine/tests/${f}`).match(/^\s*(?:test|it)\(/gm) ?? []).length, 0);
  const steps = Math.max(...[...read("verification/run_all.sh").matchAll(/step "\d+\/(\d+) /g)].map((m) => Number(m[1])));
  const widgetFiles = readdirSync(join(ROOT, "js", "widgets")).filter((f) => f.endsWith(".js")).length;
  const catalog = JSON.parse(read("catalog/catalog.json"));
  const qmd = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true })
    .reduce((s, e) => s + (e.isDirectory() ? qmd(join(dir, e.name)) : e.name.endsWith(".qmd") ? 1 : 0), 0);
  const pages = ["index.qmd", "catalog.qmd", "learning-paths.qmd"].filter((f) => existsSync(join(ROOT, f))).length + qmd("pages");
  const contract = JSON.parse(read("data/released/data_contract.json"));
  const names = Object.keys(contract.files);
  const bytes = names.reduce((s, f) => s + statSync(join(ROOT, "data", "released", f)).size, 0);
  const ro = read("verification/readouts_report.md").match(/(\d+) displayed numbers in (\d+) cases on (\d+) widgets(?: and (\d+) site pages)?; (\d+) paper cross-checks/);
  return {
    comparisons, groups, tests, steps, widgetFiles,
    catalogEntries: catalog.length, built: catalog.filter((e) => e.status === "done").length, pages,
    releasedFiles: names.length, releasedMB: Number((bytes / 1e6).toFixed(2)),
    readoutNumbers: Number(ro?.[1]), readoutCases: Number(ro?.[2]), readoutWidgets: Number(ro?.[3]), readoutSitePages: Number(ro?.[4] ?? 0), paperChecks: Number(ro?.[5]),
  };
}

function selfTest(facts) {
  const good = `${facts.comparisons.toLocaleString("en-US")} comparisons in ${facts.groups} groups; ${facts.tests} engine tests; the gate runs ${WORDS[facts.steps] ?? facts.steps} steps.`;
  const cases = [
    ["a correct paragraph passes", checkText("t", good, facts).problems.length === 0],
    ["an old comparison count fails", checkText("t", good.replace(/^[\d,]+/, "17,013"), facts).problems.length === 1],
    ["an old step count in words fails", checkText("t", "All eleven steps must pass.", facts).problems.length === 1],
    ["a wrong widget-file count fails", checkText("t", `no result typed into ${facts.widgetFiles - 11} widget files`, facts).problems.length === 1],
    ["an older CHANGELOG entry is not read", checkText("t", newestEntry(`# Changelog\n\n## new\n\n${good}\n\n## 1.0.0\n\n17,013 comparisons\n`), facts).problems.length === 0],
  ];
  const bad = cases.filter(([, ok]) => !ok);
  for (const [name] of bad) console.log(`docs self-test FAILED: ${name}`);
  console.log(`docs self-test: ${bad.length ? "FAIL" : "PASS"} (${cases.length - bad.length} of ${cases.length})`);
  return bad.length === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const facts = measure();
  const missing = Object.entries(facts).filter(([, v]) => !Number.isFinite(v)).map(([k]) => k);
  if (missing.length) {
    console.log(`docs: FAIL (could not measure ${missing.join(", ")}; run the parity and read-out checks first)`);
    process.exit(1);
  }
  const selfOk = process.argv.includes("--self-test") ? selfTest(facts) : true;
  const problems = [];
  let quoted = 0;
  const seen = new Set();
  for (const d of DOCS) {
    if (!existsSync(join(ROOT, d))) continue;
    const text = d === "CHANGELOG.md" ? newestEntry(read(d)) : read(d);
    const r = checkText(d, text, facts);
    problems.push(...r.problems);
    quoted += r.found.length;
    r.found.forEach((f) => seen.add(f));
  }
  for (const p of problems) console.log(`  FAIL ${p}`);
  const brief = `comparisons ${facts.comparisons}, groups ${facts.groups}, tests ${facts.tests}, steps ${facts.steps}, widget files ${facts.widgetFiles}, ` +
    `catalog ${facts.catalogEntries} (${facts.built} built), pages ${facts.pages}, released ${facts.releasedFiles} (${facts.releasedMB.toFixed(2)} MB), ` +
    `read-outs ${facts.readoutNumbers}/${facts.readoutCases}/${facts.readoutWidgets}+${facts.readoutSitePages}, paper ${facts.paperChecks}`;
  console.log(`docs: ${problems.length || !selfOk ? "FAIL" : "PASS"} (${quoted} quoted counts in ${DOCS.length} documents; ${seen.size} of ${Object.keys(facts).length} facts quoted; ${brief})`);
  process.exit(problems.length || !selfOk ? 1 : 0);
}
