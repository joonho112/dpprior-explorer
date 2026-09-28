#!/usr/bin/env bash
# Verification gate for DPprior Explorer (CONTRACT.md). Stops at the first failure.
#   bash verification/run_all.sh            full gate (rebuilds engine, bundles, site)
#   bash verification/run_all.sh --quick    skip the Quarto render and the Chrome file:// smoke
set -euo pipefail
cd "$(dirname "$0")/.."
QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1
start=$(date +%s)
step() { printf '\n== %s\n' "$1"; }

step "1/14 palette (WCAG AA + CVD separation, light and dark)"
node scripts/validate_palette.js | tail -1
step "2/14 engine unit tests"
(cd engine && node --test "tests/**/*.test.ts" 2>&1 | grep -E "^ℹ (tests|pass|fail)")
(cd engine && node --test "tests/**/*.test.ts" > /dev/null 2>&1)
step "3/14 parity against the R golden values"
node verification/run_parity.mjs
step "4/14 literal scan (engine/src and every widget file; numbers in code and in strings)"
node verification/run_literal_scan.mjs --self-test | tail -2
step "5/14 vocabulary scan (vocabulary_rules.json: pages, widget strings, catalog, embeds)"
node verification/scan_vocabulary.mjs --self-test
node verification/scan_vocabulary.mjs | tail -1
step "6/14 catalog and data contract"
node verification/check_catalog.mjs
node verification/check_catalog.mjs --self-test | tail -1
node verification/check_data_contract.mjs
node verification/check_data_contract.mjs --self-test | tail -1
step "7/14 build engine (ES + UMD + d.ts) and widget bundles; precomputed data"
(cd engine && npm run --silent build > /dev/null && npm run --silent bundles)
node scripts/extract_precomputed.mjs
if [[ $QUICK -eq 0 ]]; then
  step "8/14 site render (quarto)"
  quarto run scripts/pre-render.ts
  quarto render 2>&1 | grep -iE "warn|error" && { echo "quarto reported warnings or errors"; exit 1; } || true
  test -f docs/.nojekyll && test -f docs/js/dp-core.js && test -f docs/catalog/catalog.json
  for d in engine verification catalog/schema scripts r-export dev; do test ! -e "docs/$d" || { echo "docs/$d must not exist"; exit 1; }; done
else
  step "8/14 site render: skipped (--quick)"
fi
step "9/14 render smoke (jsdom)"
node verification/render_smoke.mjs | grep -v "^ok" | tail -6
step "10/14 evidence captions (app-captions.js wording on every evidence page)"
node verification/check_captions.mjs --self-test
node verification/check_captions.mjs | tail -1
step "11/14 calibration statuses (C-02, C-05, C-06 on the rendered embeds)"
node verification/check_states.mjs --self-test | tail -2
step "12/14 read-outs against their authorities (oracle, golden, closed form, released tables, paper)"
node verification/check_readouts.mjs --self-test | tail -2
if [[ $QUICK -eq 0 ]]; then
  step "13/14 file:// smoke (headless Chrome; skipped if Chrome is absent)"
  node verification/file_smoke.mjs | grep -v "^ok" | tail -6   # failing pages (if any) and the summary
else
  step "13/14 file:// smoke: skipped (--quick)"
fi
step "14/14 document numbers (README, home page, CONTRACT, CHANGELOG, CITATION, DEPLOY, folder READMEs against this run)"
node verification/check_docs.mjs --self-test
printf '\nrun_all: PASS (%ss)\n' "$(( $(date +%s) - start ))"
