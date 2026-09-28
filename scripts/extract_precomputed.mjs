// Extracts small precomputed tables from the R golden files for widgets that need
// values beyond the live cap (J > 500). Writes <name>.json and a <name>.js twin
// (export default {...}) so bundles inline the data and file:// never fetches.
//   data/precomputed/defaults_band_by_J.{json,js}  <- verification/golden/marginal_quantiles.csv
//   data/precomputed/kj_bands_J_gt_500.{json,js}   <- verification/golden/marginal_quantiles.csv (Step 5.9)
//   data/precomputed/tsmm_fits.{json,js}           <- verification/golden/tsmm_fits.csv (Step 8.3, C-01)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = join(ROOT, "verification", "golden");
const OUT = join(ROOT, "data", "precomputed");

function readCsv(file) {
  const [head, ...lines] = readFileSync(join(GOLDEN, file), "utf8").trim().split(/\r?\n/);
  const split = (l) => [...l.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, "").replace(/""/g, '"')).slice(0, -1);
  const cols = split(head);
  return lines.map((l) => Object.fromEntries(split(l).map((v, i) => [cols[i], v])));
}
function write(name, obj) {
  const json = JSON.stringify(obj, null, 1);
  writeFileSync(join(OUT, `${name}.json`), json + "\n");
  writeFileSync(join(OUT, `${name}.js`), `// written by scripts/extract_precomputed.mjs from ${obj.source}; do not edit\nexport default ${json};\n`);
  console.log(`wrote data/precomputed/${name}.json (+ .js twin)`);
}

const manifest = readCsv("golden_manifest.csv");
const shaOf = (f) => manifest.find((m) => m.file === f)?.sha256 ?? "unknown";
const q = readCsv("marginal_quantiles.csv");
const pick = (label) =>
  q.filter((r) => r.label === label && Number(r.J) > 500)
    .map((r) => ({ J: Number(r.J), q05: Number(r.q05), median: Number(r.median), q95: Number(r.q95) }))
    .sort((x, y) => x.J - y.J);
write("defaults_band_by_J", {
  source: "verification/golden/marginal_quantiles.csv",
  source_sha256: shaOf("marginal_quantiles.csv"),
  method: "DPprior 2.0.0 (load_all); integrate() on log-alpha panels; log-Stirling row extended beyond the package's J <= 500 cap",
  note: "90% band [q05, q95] of K_J for J > 500, where the browser does not compute the pmf live",
  priors: {
    vague: { a: 1, b: 1, rows: pick("Gamma(1,1) vague") },
    lit24: { a: 2, b: 4, rows: pick("Gamma(2,4) literature") },
    lit13: { a: 1, b: 3, rows: pick("Gamma(1,3) literature") },
    alpha1: { alpha: 1, rows: pick("alpha = 1 fixed") },
  },
});

// Every Gamma(a, b) row with J > 500: the 90% band, median and mode of K_J (M-07 tile 2).
// P(K_J = 1) is computed live for any J (a closed-form expectation), so it is kept only
// as a cross-check.
const bands = q.filter((r) => Number(r.J) > 500 && r.a !== "NA" && r.b !== "NA")
  .map((r) => ({ label: r.label, a: Number(r.a), b: Number(r.b), J: Number(r.J), mode: Number(r.mode), q05: Number(r.q05), median: Number(r.median), q95: Number(r.q95), p_K1: Number(r.p_K1), pmf_sum: Number(r.pmf_sum) }))
  .sort((x, y) => x.label.localeCompare(y.label) || x.J - y.J);
write("kj_bands_J_gt_500", {
  source: "verification/golden/marginal_quantiles.csv",
  source_sha256: shaOf("marginal_quantiles.csv"),
  method: "DPprior 2.0.0 (load_all); integrate() on log-alpha panels; log-Stirling row extended beyond the package's J <= 500 cap (pmf sums about .999)",
  note: "precomputed K_J summaries for J > 500, where the browser does not compute the pmf live; match rows by (a, b) within 1e-9",
  rows: bands,
});

// TSMM fits by DPprior_fit (C-01 re-solves each row live with dp-core and shows both)
const num = (v) => (v === "NA" || v === "" ? null : Number(v));
write("tsmm_fits", {
  source: "verification/golden/tsmm_fits.csv",
  source_sha256: shaOf("tsmm_fits.csv"),
  method: "DPprior 2.0.0 (load_all); DPprior_fit A2-MN (M = 160, verified at 320); moments re-checked by integrate(); profile bound alpha* by uniroot",
  rows: readCsv("tsmm_fits.csv").map((r) => ({
    case: r.case, route: r.route, J: Number(r.J), mu_K: Number(r.mu_K), sigma2: Number(r.sigma2), a: num(r.a), b: num(r.b),
    iter: num(r.iter), resid_M1: num(r.resid_M1), resid_V: num(r.resid_V), status: r.status, alpha_star: Number(r.alpha_star),
    min_var: Number(r.min_var), S50: num(r.S50), E_K: num(r.E_K),
  })),
});
