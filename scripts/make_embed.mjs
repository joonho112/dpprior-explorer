// Generates embed/<name>.html from embed/_template.html (CONTRACT.md section 2), so embed
// pages never drift from the template. Edit embed/embeds.json, then run:
//   node scripts/make_embed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(join(ROOT, "embed", "_template.html"), "utf8");
const specs = JSON.parse(readFileSync(join(ROOT, "embed", "embeds.json"), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
for (const e of specs) {
  const bundle = e.bundle ?? e.name;
  let html = template
    .replace(/<!-- Template for embed[\s\S]*?-->\n/, `<!-- ${e.ids.join(", ")} (catalog). Written by scripts/make_embed.mjs from embed/_template.html; edit embed/embeds.json. -->\n`)
    .replace("<title>Prior number of clusters (pipeline check) · DPprior Explorer</title>", `<title>${esc(e.title)} · DPprior Explorer</title>`)
    .replace('<h1 class="dpx-embed-title">Prior number of clusters (pipeline check)</h1>', `<h1 class="dpx-embed-title">${esc(e.title)}</h1>`)
    .replace(/<p class="dpx-caption">[\s\S]*?<\/p>/, `<p class="dpx-caption">${esc(e.caption)}</p>`)
    .replace(/(<p class="dpx-attrib">[\s\S]*?Lee \(2026\)<\/a>)<\/p>/, `$1${e.attribution ? ` · ${esc(e.attribution)}` : ""}</p>`)
    .replaceAll("smoke-pmf", bundle);
  if (e.spec) html = html.replace("spec = {};", `spec = ${JSON.stringify(e.spec)};`);
  if (html.includes("pipeline check") || !html.includes(`bundles/${bundle}.js`) || (e.spec && !html.includes(JSON.stringify(e.spec)))) throw new Error(`template substitution failed for ${e.name}`);
  writeFileSync(join(ROOT, "embed", `${e.name}.html`), html);
  console.log(`wrote embed/${e.name}.html`);
}
