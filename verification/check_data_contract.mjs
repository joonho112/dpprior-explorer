#!/usr/bin/env node
/**
 * Data contract check (CONTRACT.md section 9) for data/released/.
 *
 *   - every data/released/*.json (except data_contract.json) is declared in the contract,
 *     and every declared file exists;
 *   - rows and the exact column set of every row match the contract; sha256 matches;
 *   - license is "CC BY 4.0" and a caption string is present;
 *   - rights (since 1.1.0): every file has a license_scope defined in the contract's
 *     license_scopes and a rights_record; a scope other than "author" needs upstream.source,
 *     upstream.terms and upstream.fields (columns of the file); application and Rasch tables may
 *     not claim the "author" scope; school- and study-level tables list tau_hat, se and n_j as
 *     upstream fields (they come straight from the source data);
 *   - no column name matches a forbidden individual-level pattern (student, pupil,
 *     respondent, person, ...), except the columns a file is explicitly allowlisted for
 *     (only rasch_respondents.json, Step 5.12);
 *   - a file whose level is respondent-, person-, pupil- or student-level must be in
 *     respondent_level_allowlist, and an allowlisted file may carry only its listed columns;
 *   - rasch_respondents.json agrees with the score-group table rasch_wle.json (Dual-Anchor):
 *     the same count per raw score, WLE and SE within 1e-6, perfect exactly at the top score;
 *   - each .js twin exports exactly the same data (also data_contract.js); total size stays under the limit;
 *   - data/precomputed/*.json are also scanned for forbidden column names.
 * Usage: node verification/check_data_contract.mjs [--self-test]
 * --self-test runs negative controls: a dropped column, a forbidden field, an extra column
 * in the allowlisted file, an undeclared respondent-level file, a perturbed WLE, and three rights
 * mistakes (bd_units.json without upstream, with the "author" scope, with an upstream field that
 * is not one of its columns).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REL = join(ROOT, "data", "released");
const PRE = join(ROOT, "data", "precomputed");

function keysOf(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { out.add(k); keysOf(v, out); }
  return out;
}

export function checkContract(contract, readJson, readRaw, readTwin, listFiles) {
  const errors = [];
  const forbidden = contract.forbidden_field_patterns.map((p) => new RegExp(p, "i"));
  const allow = contract.respondent_level_allowlist ?? {};
  const declared = Object.keys(contract.files);
  for (const f of listFiles()) if (!declared.includes(f)) errors.push(`${f}: present in data/released but not declared`);
  let total = 0;
  for (const [file, spec] of Object.entries(contract.files)) {
    const raw = readRaw(file);
    if (raw === null) { errors.push(`${file}: declared but missing`); continue; }
    total += Buffer.byteLength(raw);
    const data = readJson(file);
    if (!Array.isArray(data)) { errors.push(`${file}: not an array of rows`); continue; }
    if (data.length !== spec.rows) errors.push(`${file}: ${data.length} rows, contract says ${spec.rows}`);
    const want = [...spec.columns].sort().join("|");
    data.forEach((row, i) => {
      const got = Object.keys(row).sort().join("|");
      if (got !== want && i < 3) errors.push(`${file}: row ${i} columns [${Object.keys(row).join(", ")}] differ from the contract`);
    });
    if (spec.license !== "CC BY 4.0") errors.push(`${file}: license "${spec.license}"`);
    errors.push(...checkRights(file, spec, contract.license_scopes ?? {}));
    if (!spec.caption || spec.caption.length < 20) errors.push(`${file}: missing caption`);
    const sha = createHash("sha256").update(raw).digest("hex");
    if (spec.sha256 && sha !== spec.sha256) errors.push(`${file}: sha256 ${sha.slice(0, 12)} differs from the contract ${spec.sha256.slice(0, 12)}`);
    const listed = Array.isArray(allow) ? null : allow[file];
    const allowed = new Set(listed ?? []);
    if (INDIVIDUAL_LEVEL.test(spec.level ?? "") && !listed) errors.push(`${file}: level "${spec.level}" but not in respondent_level_allowlist`);
    for (const col of keysOf(data)) {
      if (listed && !allowed.has(col)) errors.push(`${file}: column "${col}" is not in the respondent-level allowlist`);
      if (allowed.has(col)) continue;
      if (forbidden.some((re) => re.test(col))) errors.push(`${file}: forbidden individual-level field "${col}"`);
    }
    const twin = readTwin(file);
    if (twin === null) errors.push(`${file}: missing .js twin`);
    else if (JSON.stringify(twin) !== JSON.stringify(data)) errors.push(`${file}: .js twin differs from the JSON`);
  }
  if (total > contract.max_total_bytes) errors.push(`released JSON total ${total} bytes exceeds ${contract.max_total_bytes}`);
  if (contract.files["rasch_respondents.json"] && contract.files["rasch_wle.json"]) {
    errors.push(...checkRespondents(readJson("rasch_respondents.json"), readJson("rasch_wle.json")));
  }
  return { errors, total };
}

const INDIVIDUAL_LEVEL = /respondent|person|pupil|student|individual/i;

const UPSTREAM_SCOPED = /^(star|bd|app)_|^rasch_/; // tables built on STAR, Bangert-Drowns or IRW data
const UNIT_INPUTS = ["tau_hat", "se", "n_j"]; // per-unit inputs taken from the source data

/** The rights statement of one file (license_scope, upstream, rights_record). */
export function checkRights(file, spec, scopes) {
  const errors = [];
  if (!scopes[spec.license_scope]) errors.push(`${file}: license_scope "${spec.license_scope}" is not defined in license_scopes`);
  if (!spec.rights_record) errors.push(`${file}: no rights_record`);
  if (spec.license_scope === "author") {
    if (UPSTREAM_SCOPED.test(file)) errors.push(`${file}: built on upstream data but claims the "author" scope`);
    if (spec.upstream) errors.push(`${file}: "author" scope with an upstream block`);
    return errors;
  }
  const up = spec.upstream;
  if (!up || !up.source || !up.terms || !Array.isArray(up.fields)) {
    errors.push(`${file}: scope "${spec.license_scope}" needs upstream.source, upstream.terms and upstream.fields`);
    return errors;
  }
  for (const f of up.fields) if (!spec.columns.includes(f)) errors.push(`${file}: upstream field "${f}" is not a column`);
  if (/^(school|study)$/.test(spec.level ?? "")) {
    for (const c of UNIT_INPUTS) if (spec.columns.includes(c) && !up.fields.includes(c)) errors.push(`${file}: per-unit input "${c}" is not listed in upstream.fields`);
  }
  return errors;
}

/** rasch_respondents.json against the Dual-Anchor score groups of rasch_wle.json. */
function checkRespondents(rows, wle) {
  const errors = [];
  const groups = wle.filter((g) => g.role === "Dual-Anchor");
  if (!groups.length) return ["rasch_wle.json: no Dual-Anchor score groups"];
  const top = Math.max(...groups.map((g) => g.raw_score));
  for (const g of groups) {
    const mine = rows.filter((r) => r.raw_score === g.raw_score);
    if (mine.length !== g.n) errors.push(`rasch_respondents.json: ${mine.length} rows at raw score ${g.raw_score}, rasch_wle.json says ${g.n}`);
    for (const r of mine.slice(0, 1).concat(mine.slice(-1))) {
      if (Math.abs(r.wle - g.wle) > 1e-6 || Math.abs(r.se - g.standard_error) > 1e-6) {
        errors.push(`rasch_respondents.json: raw score ${g.raw_score} WLE/SE ${r.wle}/${r.se} vs score group ${g.wle}/${g.standard_error}`);
      }
    }
  }
  if (rows.some((r) => r.perfect !== (r.raw_score === top))) errors.push("rasch_respondents.json: perfect flag disagrees with the top raw score");
  const ids = rows.map((r) => r.row_id);
  if (ids.some((id, i) => id !== i + 1)) errors.push("rasch_respondents.json: row_id is not 1..N in file order");
  return errors;
}

const readRaw = (f) => (existsSync(join(REL, f)) ? readFileSync(join(REL, f), "utf8") : null);
const readJson = (f) => JSON.parse(readRaw(f));
const readTwin = (f) => {
  const p = join(REL, f.replace(/\.json$/, ".js"));
  if (!existsSync(p)) return null;
  const text = readFileSync(p, "utf8");
  const start = text.indexOf("export default ");
  return JSON.parse(text.slice(start + "export default ".length).replace(/;\s*$/, ""));
};
const listFiles = () => readdirSync(REL).filter((f) => f.endsWith(".json") && f !== "data_contract.json");
const contract = JSON.parse(readFileSync(join(REL, "data_contract.json"), "utf8"));

if (process.argv.includes("--self-test")) {
  // negative controls: drop a column from one row; add a forbidden field; allowlist rescues it
  const first = Object.keys(contract.files)[0];
  const drop = checkContract(contract, (f) => { const d = readJson(f); if (f === first) delete d[0][Object.keys(d[0])[0]]; return d; }, readRaw, readTwin, listFiles);
  const add = checkContract(contract, (f) => { const d = readJson(f); if (f === first) d[0].student_id = 1; return d; }, readRaw, readTwin, listFiles);
  const RESP = "rasch_respondents.json";
  const extra = checkContract(contract, (f) => { const d = readJson(f); if (f === RESP) d[0].age = 30; return d; }, readRaw, readTwin, listFiles);
  const undeclared = checkContract({ ...contract, files: { ...contract.files, [first]: { ...contract.files[first], level: "respondent" } } }, readJson, readRaw, readTwin, listFiles);
  const perturbed = checkContract(contract, (f) => { const d = readJson(f); if (f === RESP) d[0].wle += 1e-3; return d; }, readRaw, readTwin, listFiles);
  const hasResp = Boolean(contract.files[RESP]);
  // rights mistakes on bd_units.json
  const BD = "bd_units.json";
  const up = contract.files[BD]?.upstream ?? { fields: [] };
  const withBd = (patch) => ({ ...contract, files: { ...contract.files, [BD]: { ...contract.files[BD], ...patch } } });
  const noUpstream = checkContract(withBd({ upstream: undefined }), readJson, readRaw, readTwin, listFiles);
  const asAuthor = checkContract(withBd({ license_scope: "author", upstream: undefined }), readJson, readRaw, readTwin, listFiles);
  const strayField = checkContract(withBd({ upstream: { ...up, fields: [...up.fields, "not_a_column"] } }), readJson, readRaw, readTwin, listFiles);
  const rightsOk = noUpstream.errors.some((e) => e.includes("needs upstream")) && asAuthor.errors.some((e) => e.includes('claims the "author" scope')) &&
    strayField.errors.some((e) => e.includes("is not a column"));
  const ok = drop.errors.some((e) => e.includes("columns")) && add.errors.some((e) => e.includes("forbidden")) &&
    undeclared.errors.some((e) => e.includes("not in respondent_level_allowlist")) && rightsOk &&
    (!hasResp || (extra.errors.some((e) => e.includes("not in the respondent-level allowlist")) && perturbed.errors.some((e) => e.includes("WLE/SE"))));
  console.log(`data contract self-test: dropped column -> ${drop.errors.length} error(s); forbidden field -> ${add.errors.length} error(s); ` +
    `extra respondent column -> ${extra.errors.length}; undeclared respondent level -> ${undeclared.errors.length}; perturbed WLE -> ${perturbed.errors.length}; ` +
    `rights: no upstream -> ${noUpstream.errors.length}, "author" scope -> ${asAuthor.errors.length}, stray upstream field -> ${strayField.errors.length}`);
  console.log(ok ? "data contract self-test: PASS" : "data contract self-test: FAIL");
  process.exit(ok ? 0 : 1);
}

const { errors, total } = checkContract(contract, readJson, readRaw, readTwin, listFiles);
// the contract's own .js twin (Step 9.1: the A-13 cards import it so they work from file://)
const contractTwin = readTwin("data_contract.json");
if (contractTwin === null) errors.push("data_contract.json: missing .js twin (data_contract.js)");
else if (JSON.stringify(contractTwin) !== JSON.stringify(contract)) errors.push("data_contract.json: .js twin differs from the JSON");
// precomputed grids: forbidden-field scan only
const forbidden = contract.forbidden_field_patterns.map((p) => new RegExp(p, "i"));
for (const f of existsSync(PRE) ? readdirSync(PRE).filter((x) => x.endsWith(".json")) : []) {
  for (const col of keysOf(JSON.parse(readFileSync(join(PRE, f), "utf8")))) if (forbidden.some((re) => re.test(col))) errors.push(`precomputed/${f}: forbidden field "${col}"`);
}
const nFiles = Object.keys(contract.files).length;
console.log(`data contract: ${nFiles} released files, ${(total / 1e6).toFixed(2)} MB; respondent-level allowlist: ${Object.keys(contract.respondent_level_allowlist ?? {}).join(", ") || "none"}`);
for (const e of errors) console.error(`  FAIL ${e}`);
const scopes = Object.values(contract.files).reduce((m, s) => ({ ...m, [s.license_scope]: (m[s.license_scope] ?? 0) + 1 }), {});
console.log(errors.length ? `data contract: FAIL (${errors.length})` : `data contract: PASS (no individual-level fields outside the allowlist; licence scopes ${Object.entries(scopes).map(([k, v]) => `${k} ${v}`).join(", ")})`);
process.exit(errors.length ? 1 : 0);
