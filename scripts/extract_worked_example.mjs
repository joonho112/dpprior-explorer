// Extracts the paper's J = 50 worked example (Sec. 3.5) from the replication package's
// released calibration tables (CC BY 4.0) into data/precomputed/worked_example_j50.{json,js}.
// The widget recomputes every displayed number with dp-core; this file supplies the exact
// (a, b) of each stage, the Newton trace and the policy constants, with provenance.
//   REPL_DIR (default ../../../DPprior-paper-replication, a sibling of the pool folder)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPL = process.env.REPL_DIR ?? join(ROOT, "..", "..", "..", "DPprior-paper-replication");
const CAL = join(REPL, "data-derived", "calibration");
const read = (f) => {
  const text = readFileSync(join(CAL, f), "utf8");
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const split = (l) => [...l.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, "")).slice(0, -1);
  const cols = split(head);
  return { rows: lines.map((l) => Object.fromEntries(split(l).map((v, i) => [cols[i], v]))), sha256: createHash("sha256").update(text).digest("hex") };
};
const grid = read("dual_anchor_grid.csv");
const trace = read("newton_trace.csv");
const hard = read("hard_sensitivity.csv");
const tsmm = grid.rows.find((r) => Number(r.lambda) === 1);
const da = grid.rows.find((r) => r.selected === "TRUE");
const hr = hard.rows.find((r) => r.prior === "Dual-Anchor (hard)");
const out = {
  source: "joonho112/DPprior-paper-replication, data-derived/calibration/{dual_anchor_grid,newton_trace,hard_sensitivity}.csv (CC BY 4.0)",
  source_sha256: { dual_anchor_grid: grid.sha256, newton_trace: trace.sha256, hard_sensitivity: hard.sha256 },
  target: { J: 50, mu_K: 5, var_K: 10, confidence: "medium (VIF 2.5)" },
  policy: { t: 0.5, trigger: 0.4, soft_target: 0.25, hard_bound: 0.25 },
  initializer: { a: Number(trace.rows[0].a), b: Number(trace.rows[0].b), paper: "(2.667, 2.608)" },
  newton: trace.rows.map((r) => ({ iter: Number(r.iter), a: Number(r.a), b: Number(r.b), mean: Number(r.M1), var: Number(r.V), residual: Number(r.residual) })),
  stages: [
    { key: "tsmm", label: "TSMM (count only)", a: Number(tsmm.a), b: Number(tsmm.b), paper: "(1.4082, 1.0770)" },
    { key: "da", label: `Dual-Anchor (lambda = ${Number(da.lambda).toFixed(2)})`, lambda: Number(da.lambda), a: Number(da.a), b: Number(da.b), paper: "(2.3158, 1.4204)" },
    { key: "hard", label: "Hard bound (sensitivity)", a: Number(hr.a), b: Number(hr.b), paper: "(5.2745, 2.3059)" },
  ],
  lambda_grid: grid.rows.map((r) => ({ lambda: Number(r.lambda), a: Number(r.a), b: Number(r.b), wsb_gt_50: Number(r.achieved_weight), selected: r.selected === "TRUE" })),
};
const json = JSON.stringify(out, null, 1);
writeFileSync(join(ROOT, "data", "precomputed", "worked_example_j50.json"), json + "\n");
writeFileSync(join(ROOT, "data", "precomputed", "worked_example_j50.js"), `// written by scripts/extract_worked_example.mjs; do not edit\nexport default ${json};\n`);
console.log(`worked example: init (${out.initializer.a.toFixed(4)}, ${out.initializer.b.toFixed(4)}), ${out.newton.length} Newton rows, stages ${out.stages.map((s) => `${s.key} (${s.a.toFixed(4)}, ${s.b.toFixed(4)})`).join(", ")}, ${out.lambda_grid.length} lambda points`);
