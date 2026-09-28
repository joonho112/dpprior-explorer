# Deploying DPprior Explorer

The site is the `docs/` folder of this repository, served by GitHub Pages from `main:/docs`
at https://joonho112.github.io/dpprior-explorer/. Building and checking are local; creating the
repository, pushing and switching Pages on are done by the maintainer.

## 1. Check locally

```bash
bash verification/run_all.sh
```

All fourteen steps must pass (palette, unit tests, parity, literal scan, vocabulary scan,
catalog and data contract, build, render, jsdom smoke, evidence captions, calibration statuses,
read-outs, headless-Chrome `file://` smoke, document numbers). Commit whatever the gate rebuilt,
so that `git status --short` prints nothing.

Before a push, list what the history will publish: every third-party file that any commit holds,
with its licence (a factual inventory, not a legal opinion). It must end with `CLEAN`:

```bash
node verification/audit_history.mjs --require-clean --out /tmp/dpprior-history-audit.md
```

## 2. Create the repository and push (maintainer)

If the repository does not exist yet:

```bash
gh repo create joonho112/dpprior-explorer --public --source=. --remote=origin --description "Interactive visualizations for design-conditional prior elicitation in Dirichlet process mixtures"
```

If it already exists and is empty, add it as the remote instead:

```bash
git remote add origin https://github.com/joonho112/dpprior-explorer.git
```

```bash
git push -u origin main
```

## 3. Turn on GitHub Pages from main:/docs (maintainer)

```bash
gh api -X POST repos/joonho112/dpprior-explorer/pages -f "source[branch]=main" -f "source[path]=/docs"
```

If Pages already exists, update it instead:

```bash
gh api -X PUT repos/joonho112/dpprior-explorer/pages -f "source[branch]=main" -f "source[path]=/docs"
```

## 4. Confirm

The first build takes a minute or two. Each of these should print `200`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://joonho112.github.io/dpprior-explorer/
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://joonho112.github.io/dpprior-explorer/embed/defaults-drift.html
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://joonho112.github.io/dpprior-explorer/js/bundles/defaults-drift.js
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://joonho112.github.io/dpprior-explorer/catalog.html
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://joonho112.github.io/dpprior-explorer/catalog/thumbs/A-11.png
```

## 5. Re-deploy after changes

```bash
bash verification/run_all.sh
```

```bash
git add -A && git commit -m "Rebuild the site" && git push
```

GitHub Pages republishes `main:/docs` on every push; no workflow file is needed (Pages is served
from the branch, not from Actions).

## 6. Tag release 1.1.0 (maintainer)

After the first push and a 200 from the Pages checks above:

```bash
git tag -a v1.1.0 -m "DPprior Explorer 1.1.0: 72 visualizations in five parts (70 built, 2 waiting for tool installs), catalog filters, learning paths, 14-step verification gate (17,351 parity comparisons against DPprior 2.0.0 and base-R oracles, 0 failures). See CHANGELOG.md."
```

```bash
git push origin v1.1.0
```

Optional, a GitHub release from the tag with the changelog as notes:

```bash
gh release create v1.1.0 --title "DPprior Explorer 1.1.0" --notes-file CHANGELOG.md
```

## Notes

- `docs/.nojekyll` is recreated on every render by `scripts/post-render.ts`.
- All links are relative, so the site works under `/dpprior-explorer/`, from a local
  `file://` copy of `docs/`, and from a local server.
- Never commit `engine/node_modules/` (ignored) or the reference folders the teaching material
  is drawn from (see `ATTRIBUTION.md`).
