// Quarto pre-render hook (runs under Quarto's bundled Deno).
// Builds the catalog cards from catalog/catalog.json into _catalog-cards.md (included by
// catalog.qmd). Quarto resolves includes before this hook runs, so the generated file is
// committed; run `quarto run scripts/pre-render.ts` after editing catalog.json, or render
// twice. Rendering the cards at build time, instead of reading the JSON in the
// browser, keeps the catalog readable from file:// (Chrome blocks fetch there).
type Entry = {
  id: string; name: string; axis: string; concept: string; does: string; sees: string;
  engine: string; page: string; embed: string | null; step: string; thumb: string | null;
  status: string; media?: string | null; section: string; rung: number | null; audience: string[];
};
// catalog filter labels (Step 11.6); the rung titles come from RUNGS below
const SECTIONS: [string, string][] = [
  ["dpm", "1 · Learn the DPM"], ["bridge", "2 · CRP bridge"], ["problems", "3 · Default problems"],
  ["dpprior", "4 · DPprior"], ["applications", "5 · Evidence"], ["tools", "Tools"],
];
const AUDIENCES: [string, string][] = [["beginner", "Beginners"], ["researcher", "Researchers"], ["course", "A course"]];
const RUNG_TITLES = ["Why nonparametric Bayes?", "Beta", "Dirichlet", "Paintbox", "Stick-breaking", "Hoppe urn", "Chinese restaurant process", "DP mixture and atoms", "Collapsed Gibbs sampler"];
const AXES: [string, string][] = [
  ["dpm", "1 · Learn the DPM (P-)"],
  ["problems", "3 · Problems with default hyperpriors (M-)"],
  ["dpprior", "4 · The DPprior principle (C-)"],
  ["evidence", "5 · Evidence and real data (A-)"],
  ["complementary", "Complementary tools (X-)"],
];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const entries: Entry[] = JSON.parse(Deno.readTextFileSync("catalog/catalog.json"));
let html = "```{=html}\n";
const built = entries.filter((e) => e.status === "done").length;
const allText = `${entries.length} visualizations (${built} built, ${entries.length - built} planned).`;
const opt = (v: string, t: string) => `<option value="${esc(v)}">${esc(t)}</option>`;
html += `<form class="dpx-catalog-filter" aria-label="Filter the catalog" onsubmit="return false">
<label>Section <select id="f-section">${opt("", "all sections")}${SECTIONS.map(([v, t]) => opt(v, t)).join("")}</select></label>
<label>Ladder rung <select id="f-rung">${opt("", "all")}${RUNG_TITLES.map((t, i) => opt(String(i), `${i} · ${t}`)).join("")}</select></label>
<label>Audience <select id="f-audience">${opt("", "everyone")}${AUDIENCES.map(([v, t]) => opt(v, t)).join("")}</select></label>
<button type="button" id="f-reset" class="dpx-btn">Show all</button>
</form>\n`;
html += `<p class="dpx-catalog-count" id="f-count" aria-live="polite" data-all="${esc(allText)}">${esc(allText)}</p>\n`;
for (const [axis, title] of AXES) {
  const group = entries.filter((e) => e.axis === axis).sort((a, b) => a.id.localeCompare(b.id));
  if (!group.length) continue;
  html += `<h2 class="anchored" id="axis-${axis}">${esc(title)}</h2>\n<div class="dpx-cards">\n`;
  for (const e of group) {
    const thumb = e.thumb
      ? `<img src="${esc(e.thumb)}" alt="Thumbnail of ${esc(e.id)} ${esc(e.name)}" loading="lazy">`
      : `<div class="dpx-thumb-empty" aria-hidden="true">${esc(e.id)}</div>`;
    const links = [`<a href="${esc(e.page)}">page</a>`];
    if (e.embed) links.push(`<a href="${esc(e.embed)}">standalone</a>`);
    if (e.media) links.push(`<a href="${esc(e.media)}">video</a>`);
    html += `<article class="dpx-card" id="${esc(e.id)}" data-section="${esc(e.section)}" data-rung="${e.rung === null ? "" : e.rung}" data-audience="${esc(e.audience.join(" "))}" data-status="${esc(e.status)}">
  <div class="dpx-card-thumb">${thumb}</div>
  <div class="dpx-card-body">
    <p class="dpx-card-id"><span>${esc(e.id)}</span> ${esc(e.step)} · ${esc(e.status)}</p>
    <h3>${esc(e.name)}</h3>
    <p class="dpx-card-concept">${esc(e.concept)}</p>
    <p><strong>You do:</strong> ${esc(e.does)}</p>
    <p><strong>You see:</strong> ${esc(e.sees)}</p>
    <p class="dpx-card-engine">${esc(e.engine)}</p>
    <p class="dpx-card-links">${links.join(" · ")}</p>
  </div>
</article>\n`;
  }
  html += "</div>\n";
}
// the filter: plain script (works from file://); ?section=, ?rung=, ?audience= preselect it
html += `<script>
(function () {
  var byId = function (id) { return document.getElementById(id); };
  var keys = ["section", "rung", "audience"];
  var cards = Array.prototype.slice.call(document.querySelectorAll(".dpx-card"));
  function apply() {
    var s = byId("f-section").value, r = byId("f-rung").value, a = byId("f-audience").value, n = 0;
    cards.forEach(function (c) {
      var ok = (!s || c.dataset.section === s) && (!r || c.dataset.rung === r) && (!a || c.dataset.audience.split(" ").indexOf(a) >= 0);
      c.hidden = !ok;
      if (ok) n += 1;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".dpx-cards"), function (g) {
      var any = Array.prototype.some.call(g.children, function (c) { return !c.hidden; });
      g.hidden = !any;
      var h = g.previousElementSibling;
      if (h && h.tagName === "H2") h.hidden = !any;
    });
    var count = byId("f-count");
    count.textContent = n === cards.length ? count.dataset.all : "Showing " + n + " of " + cards.length + " visualizations.";
  }
  keys.forEach(function (k) { byId("f-" + k).addEventListener("change", apply); });
  byId("f-reset").addEventListener("click", function () { keys.forEach(function (k) { byId("f-" + k).value = ""; }); apply(); });
  var q = new URLSearchParams(location.search);
  keys.forEach(function (k) { if (q.get(k) !== null) byId("f-" + k).value = q.get(k); });
  apply();
})();
</script>\n`;
html += "```\n";
Deno.writeTextFileSync("_catalog-cards.md", html);

// (The render-time data cards of Step 5.1 became the A-13 widget in Step 9.1; their generator
// and _data-cards.md, which no page included any more, were removed in 1.1.0.)

// DPM ladder hub (catalog P-16, Step 6.10): pages/dpm/_ladder.md (inline SVG, included by
// pages/dpm/index.qmd) and pages/dpm/ladder.svg (the same drawing, standalone). A rung's
// badge comes from catalog.json: "done" when every catalog id it lists is done, "k of n done"
// when some are, "planned" otherwise. Colours are token variables with fallbacks.
const RUNGS = [
  { n: 0, title: "Why nonparametric Bayes?", ids: ["P-00"], page: "why-nonparametric.html" },
  { n: 1, title: "Beta", ids: ["P-01"], page: "beta-dirichlet.html" },
  { n: 2, title: "Dirichlet", ids: ["P-02"], page: "beta-dirichlet.html" },
  { n: 3, title: "Paintbox: components and clusters", ids: ["P-03", "P-04"], page: "paintbox.html" },
  { n: 4, title: "Stick-breaking (GEM)", ids: ["P-05", "P-17"], page: "stick-breaking.html" },
  { n: 5, title: "Hoppe urn", ids: ["P-06"], page: "urn-to-sticks.html" },
  { n: 6, title: "Chinese restaurant process", ids: ["P-07", "P-08", "P-14", "P-15"], page: "crp.html" },
  { n: 7, title: "DP mixture and DP atoms", ids: ["P-09", "P-10", "P-11", "P-12"], page: "dpmm.html" },
  { n: 8, title: "Collapsed Gibbs sampler", ids: ["P-13"], page: "crp-gibbs.html" },
];
const statusOf = new Map(entries.map((e) => [e.id, e.status]));
const W = 720;
const RH = 48;
const GAP = 14;
const TOP = 16;
const H = TOP * 2 + RUNGS.length * (RH + GAP) - GAP;
const v = (name: string, fallback: string) => `var(--${name}, ${fallback})`;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" font-family="system-ui, sans-serif">\n`;
svg += `<line x1="28" y1="4" x2="28" y2="${H - 4}" style="stroke:${v("border-strong", "#7a8a93")};stroke-width:4"/>\n`;
svg += `<line x1="${W - 28}" y1="4" x2="${W - 28}" y2="${H - 4}" style="stroke:${v("border-strong", "#7a8a93")};stroke-width:4"/>\n`;
[...RUNGS].reverse().forEach((r, j) => {
  const y = TOP + j * (RH + GAP);
  const done = r.ids.filter((id) => statusOf.get(id) === "done").length;
  const badge = done === r.ids.length ? "done" : done > 0 ? `${done} of ${r.ids.length} done` : "planned";
  const full = badge === "done";
  const bw = 12 + badge.length * 7;
  svg += `<a href="${r.page}"><title>Rung ${r.n}: ${esc(r.title)} (${r.ids.join(", ")}; ${badge})</title>
  <rect x="40" y="${y}" width="${W - 80}" height="${RH}" rx="10" style="fill:${v("bg-raised", "#f7f9fa")};stroke:${v("border-strong", "#7a8a93")};stroke-width:1.5"/>
  <circle cx="68" cy="${y + RH / 2}" r="15" style="fill:${v("accent-ink", "#11707c")}"/>
  <text x="68" y="${y + RH / 2 + 5}" text-anchor="middle" font-size="15" font-weight="700" style="fill:${v("bg", "#ffffff")}">${r.n}</text>
  <text x="94" y="${y + RH / 2 - 3}" font-size="15" font-weight="700" style="fill:${v("fg", "#132026")}">${esc(r.title)}</text>
  <text x="94" y="${y + RH / 2 + 14}" font-size="11.5" style="fill:${v("fg-muted", "#40515c")}">${r.ids.join(" · ")}</text>
  <rect x="${W - 52 - bw}" y="${y + RH / 2 - 11}" width="${bw}" height="22" rx="11" style="fill:${full ? v("accent-ink", "#11707c") : v("warn-bg", "#fff4e5")}"/>
  <text x="${W - 52 - bw / 2}" y="${y + RH / 2 + 4}" text-anchor="middle" font-size="11.5" font-weight="700" style="fill:${full ? v("bg", "#ffffff") : v("warn-fg", "#7a4100")}">${badge}</text>
</a>\n`;
});
svg += "</svg>\n";
Deno.writeTextFileSync("pages/dpm/ladder.svg", svg);
Deno.writeTextFileSync("pages/dpm/_ladder.md",
  "```{=html}\n<nav class=\"dpx-ladder\" aria-label=\"The ladder, rung 0 at the bottom to rung 8 at the top; each rung links to its page\">\n" + svg + "</nav>\n```\n");
