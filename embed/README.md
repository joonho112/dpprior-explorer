# embed/

One standalone page per widget view, copied verbatim to `docs/embed/` (never rendered by
Quarto). `scripts/make_embed.mjs` writes each page from `_template.html` and the entry in
`embeds.json`: `name` (the page, and by default the bundle), `ids` (catalog ids), `title`,
`caption`, and optionally `attribution`, `bundle` (another widget's bundle, for a second
view of the same widget) and `spec` (fixed initial spec, for example
`{"mode": "sb-vs-ranked"}`). Edit `embeds.json`, then run `node scripts/make_embed.mjs`.

Query parameters set the initial state (see `CONTRACT.md` section 2):

| Parameter | Meaning |
|---|---|
| `a`, `b` | Gamma(a, b) hyperprior on alpha (shape, rate) |
| `J` | number of units (sites, studies, respondents) |
| `K` | number of components of a finite mixture or Dirichlet |
| `alpha` | a fixed concentration value |
| `t` | weight threshold for tail read-outs |
| `n` | a node or draw count (for example the alpha nodes of C-12) |
| `seed` | random seed of the simulation widgets |
| `mu`, `var` | a count target: mean mu_K and variance sigma^2 (the TSMM calibrator, C-02) |
| `preset` | a widget-defined named preset |
| `theme` | `light` or `dark` (default: the viewer's `prefers-color-scheme`) |

Example: `embed/unintended-prior.html?a=1&b=1&J=100&theme=light`.

The pages load only classic scripts (`../js/vendor/d3.min.js`,
`../js/vendor/plot.min.js`, `../js/bundles/<name>.js`), so they open from `file://`,
from GitHub Pages and inside an iframe in the reveal.js deck.
