// Builds one classic-script IIFE bundle per widget (CONTRACT.md section 1):
//   js/widgets/<name>.js  ->  js/bundles/<name>.js, which sets window.DPX["<name>"] = {mountWidget}
// Helper modules (base.js, chart.js, format.js) are not entries. Widgets use the globals
// Plot and d3 from js/vendor/, so those are not bundled.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const widgets = join(root, "js", "widgets");
const out = join(root, "js", "bundles");
const HELPERS = new Set(["base.js", "chart.js", "format.js", "app-captions.js"]);
mkdirSync(out, { recursive: true });

const names = readdirSync(widgets).filter((f) => f.endsWith(".js") && !HELPERS.has(f)).map((f) => f.slice(0, -3));
const manifest = [];
for (const name of names) {
  const result = await build({
    stdin: {
      contents: `import { mountWidget } from "./${name}.js";\n(globalThis.DPX = globalThis.DPX || {})[${JSON.stringify(name)}] = { mountWidget };\n`,
      resolveDir: widgets,
      sourcefile: `${name}.entry.js`,
      loader: "js",
    },
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
    banner: { js: `/* DPprior Explorer widget bundle: ${name} (built by engine/scripts/build-bundles.mjs from js/widgets/${name}.js; do not edit) */` },
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  writeFileSync(join(out, `${name}.js`), code);
  manifest.push({ name, bytes: code.length, sha256: createHash("sha256").update(code).digest("hex") });
}
writeFileSync(join(out, "bundles.json"), JSON.stringify(manifest, null, 2) + "\n");
for (const m of manifest) console.log(`bundle ${m.name.padEnd(28)} ${String(m.bytes).padStart(7)} bytes`);
if (!manifest.length) console.log("bundle: no widget entries yet");
// source hash, so run_all.sh can tell whether bundles are stale
const srcHash = createHash("sha256");
for (const f of readdirSync(widgets).sort()) srcHash.update(readFileSync(join(widgets, f)));
writeFileSync(join(out, ".source-hash"), srcHash.digest("hex") + "\n");
