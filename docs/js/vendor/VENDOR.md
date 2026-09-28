# Vendored libraries

Loaded as classic `<script>` files so every page works from `file://` with no network
(CONTRACT.md section 1). Load order: `d3.min.js`, then `plot.min.js` (Plot's UMD build
reads the global `d3`).

| File | Package | Version | Source | sha256 | Licence |
|---|---|---|---|---|---|
| `d3.min.js` | `d3` | 7.9.0 | npm package `d3@7.9.0`, file `dist/d3.min.js` (copied from a local, already installed `node_modules`; no download) | `f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539` | ISC (`d3.LICENSE`) |
| `plot.min.js` | `@observablehq/plot` | 0.6.17 | npm package `@observablehq/plot@0.6.17`, file `dist/plot.umd.min.js` (same local copy) | `4358086467740777dd788d6b27a95cebdbaefdd50c730a3060117073bd7134cb` | ISC (`plot.LICENSE`) |

Check: `shasum -a 256 js/vendor/d3.min.js js/vendor/plot.min.js` must print the hashes above.
The same files are what `https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js` and
`https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/dist/plot.umd.min.js` serve; the
pages never request them from a CDN.
