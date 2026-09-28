# verification

Golden values and the checks of the gate. Not rendered into the site. Run everything with

```bash
bash verification/run_all.sh          # fourteen steps; --quick skips the render and the Chrome smoke
```

`CONTRACT.md` section 12 lists the steps, section 7 the parity tolerances.

## What the numbers are checked against

| Source | Files | Written by |
|---|---|---|
| DPprior 2.0.0 (source, `pkgload::load_all`) | `golden/*.csv` except the three below, with `golden/golden_manifest.csv` (sha256, rows, method, R version) | `r-export/01`–`03`, `05`, `13` |
| base-R oracles (no package code; integrals over u = F(alpha), not log alpha) | `golden/oracle_u_space.csv`, `golden/oracle_wmax.csv`, and the oracle columns of `golden/tsmm_boundary.csv` | `r-export/14`, `15` |
| released tables of the replication package | `../data/released/*.json` and `data_contract.json` | `r-export/07`, `09`–`12` |
| the paper (arXiv v3) | the values of six paper cross-checks in `check_readouts.mjs` | typed from the paper, with the table or section |

## Checks

| File | What it checks | Report |
|---|---|---|
| `run_parity.mjs` + `parity_spec.csv` | the engine (`engine/src`, bundled fresh) against every golden row, per-group tolerances; manifest checksums; a spec row that compares nothing fails | `parity_report.md` |
| `run_literal_scan.mjs` + `literal_allowlist.csv` | no result typed into `engine/src` or any widget file, in code or in strings (TypeScript scanner); allowlist rows by file, scope and value, stale rows fail; `--self-test` | stdout |
| `scan_vocabulary.mjs` + `vocabulary_rules.json` | the site's terminology on pages, widget strings, catalog and embeds; `--self-test` | `scan_report.md` |
| `check_catalog.mjs` | `catalog/catalog.json` against its schema and the built files; `--self-test` | `catalog_report.md` |
| `check_data_contract.mjs` | every released table: declared, rows, columns, checksum, `.js` twin, no individual-level fields outside the allowlist, rights statement (licence scope, upstream source, terms and fields); `--self-test` | stdout |
| `render_smoke.mjs` | every rendered page and embed mounts its widgets in jsdom with a read-out | `render_smoke_report.md` |
| `check_captions.mjs` | the fixed wording of the evidence pages; `--self-test` | stdout |
| `check_states.mjs` | C-02, C-05 and C-06 show each reachable TSMM status (ok, point-mass, infeasible, support, no-convergence) as the engine returns it; `--self-test` | stdout |
| `check_readouts.mjs` | numbers displayed on the embed pages and in the prose of chosen site pages against the u-space oracle, golden values (including the independent TSMM solver of `tsmm_boundary.csv`), closed forms and released tables, and six paper cross-checks of the released tables; `--self-test` | `readouts_report.md` |
| `file_smoke.mjs` | every page from `file://` in headless Chrome (skipped without Chrome) | stdout |
| `check_docs.mjs` | the counts quoted in README, the home page, CONTRACT, the newest CHANGELOG entry, CITATION, DEPLOY and the folder READMEs equal this run's; `--self-test` | stdout |

Tools outside the gate: `audit_history.mjs` (every third-party file any commit has held, with its
licence, and the copyleft files; `--require-clean` before a push; report
`history_audit.md`, not committed), `compare_rerun.mjs` (after rerunning `r-export/`, the outputs must equal
the committed files up to `generated_at`), `page_sweep.mjs` (pages at chosen widths and themes
with real viewport emulation), `capture_thumbs.mjs` (catalog thumbnails), `net_audit.mjs` (every
URL a page requests). Audit records: `a11y_audit.md`, `responsive_audit.md`, `a11y/`,
`screenshots/`, `thumbs_report.md`.
