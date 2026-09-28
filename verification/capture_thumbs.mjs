#!/usr/bin/env node
/**
 * Screenshot pages from file:// with the local headless Chrome (throwaway profile).
 *
 *   node verification/capture_thumbs.mjs                 catalog thumbnails from catalog.json
 *   node verification/capture_thumbs.mjs --out DIR page[?query]::name.png[::WxH] ...
 *
 * Catalog mode shoots each entry's embed page (with its first preset query, light theme)
 * at 1200 x 760 and writes catalog/thumbs/<id>.png, resized to 640 px wide with sips (macOS; kept
 * at full size elsewhere). Chrome's --screenshot captures the viewport, so embed pages are the
 * right target (no site chrome). Entries without an embed use a fallback (Step 11.4): a video's
 * key still, the page an htmlwidget lives on, or the rendered site page. Every id gets a thumb;
 * verification/thumbs_report.md lists the source and size of each (target < 200 KB).
 */
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  console.log(`capture: SKIP (Chrome not found at ${CHROME})`);
  process.exit(0);
}
const profile = mkdtempSync(join(tmpdir(), "dpx-shot-"));
function shoot(page, out, width = 1200, height = 760) {
  // split "path?query#hash" so neither part is percent-encoded into the file name
  const [, file, query = "", hash = ""] = page.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const abs = resolve(ROOT, file);
  if (!existsSync(abs)) {
    console.error(`missing file ${abs}`);
    return Promise.resolve(false);
  }
  const url = pathToFileURL(abs).href + query + hash;
  return new Promise((done) => {
    const child = spawn(CHROME, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--use-mock-keychain",
      "--password-store=basic", "--disable-extensions", "--hide-scrollbars", `--user-data-dir=${profile}`,
      "--virtual-time-budget=4000", `--window-size=${width},${height}`, `--screenshot=${out}`, url,
    ], { stdio: "ignore" });
    const started = Date.now();
    const poll = setInterval(() => {
      const ready = existsSync(out) && statSync(out).mtimeMs >= started - 1000 && statSync(out).size > 0;
      if (ready || Date.now() - started > 45000) {
        clearInterval(poll);
        setTimeout(() => { child.kill("SIGKILL"); done(ready); }, 300);
      }
    }, 250);
    child.on("exit", () => { clearInterval(poll); done(existsSync(out)); });
  });
}

const args = process.argv.slice(2);
const jobs = [];
if (args[0] === "--out") {
  const dir = resolve(args[1]);
  mkdirSync(dir, { recursive: true });
  for (const spec of args.slice(2)) {
    const [page, name, size] = spec.split("::");
    const [w, hgt] = (size ?? "1200x760").split("x").map(Number);
    jobs.push({ page, out: join(dir, name), w, h: hgt });
  }
} else {
  const catalog = JSON.parse(readFileSync(join(ROOT, "catalog", "catalog.json"), "utf8"));
  mkdirSync(join(ROOT, "catalog", "thumbs"), { recursive: true });
  // entries without an embed page: a key still (copied) or a page screenshot
  const FALLBACK = {
    "P-16": { page: "docs/pages/dpm/index.html", how: "page screenshot (ladder hub)" },
    "P-17": { still: "media/stick_alpha_key.png", how: "video key still" },
    "A-14": { page: "docs/pages/applications/talk-fallbacks.html", how: "page screenshot (fallback stills)" },
    "A-15": { page: "../reveal-poc/deck.html#/paths", how: "deck slide (reveal-poc/deck.html, next to the repo)" },
    "A-16": { still: "media/crp_growth_key.png", how: "video key still" },
    "X-02": { page: "docs/apps/htmlwidgets/plotly-alpha-sweep.html", how: "htmlwidget page (plotly frames)" },
    "X-01": { page: "docs/pages/tools.html", how: "page screenshot (Tools: waiting for approval)" },
    "C-17": { page: "docs/pages/tools.html", how: "page screenshot (Tools: waiting for approval)" },
  };
  for (const e of catalog) {
    const out = join(ROOT, "catalog", "thumbs", `${e.id}.png`);
    if (e.embed) {
      const q = e.presets?.[0]?.query ?? "";
      const query = `${q ? q.replace(/^\?/, "") + "&" : ""}theme=light`;
      jobs.push({ page: `docs/${e.embed}?${query}`, out, id: e.id, how: `embed ${e.embed}${q ? ` ${q}` : ""}` });
    } else if (FALLBACK[e.id]?.still) {
      jobs.push({ still: FALLBACK[e.id].still, out, id: e.id, how: `${FALLBACK[e.id].how}: ${FALLBACK[e.id].still}` });
    } else if (FALLBACK[e.id]?.page) {
      jobs.push({ page: FALLBACK[e.id].page, out, id: e.id, how: `${FALLBACK[e.id].how}: ${FALLBACK[e.id].page.replace(/^docs\//, "")}` });
    } else {
      jobs.push({ missing: true, out, id: e.id, how: "no embed and no fallback" });
    }
  }
}
const hasSips = process.platform === "darwin" && existsSync("/usr/bin/sips");
const shrink = (file) => { if (hasSips) execFileSync("/usr/bin/sips", ["--resampleWidth", "640", file, "--out", file], { stdio: "ignore" }); };
let ok = 0;
const report = [];
for (const j of jobs) {
  if (existsSync(j.out)) rmSync(j.out);
  let done = false;
  if (j.missing) done = false;
  else if (j.still) { copyFileSync(join(ROOT, j.still), j.out); done = true; }
  else done = await shoot(j.page, j.out, j.w ?? 1200, j.h ?? 760);
  if (done && j.id) shrink(j.out);
  if (done) ok += 1;
  const kb = done ? statSync(j.out).size / 1024 : NaN;
  if (j.id) report.push({ id: j.id, how: j.how, kb, done });
  console.log(`${done ? "ok  " : "FAIL"} ${j.page ?? j.still ?? j.id} -> ${j.out.replace(ROOT + "/", "")}${j.id && done ? ` (${kb.toFixed(0)} KB)` : ""}`);
}
rmSync(profile, { recursive: true, force: true });
if (report.length) {
  const big = report.filter((r) => r.kb >= 200);
  const lines = [
    "# Catalog thumbnails",
    "",
    `Generated ${new Date().toISOString()} by \`node verification/capture_thumbs.mjs\` (catalog mode): ${report.filter((r) => r.done).length} of ${report.length} ids, ${hasSips ? "640 px wide (sips)" : "full size (no sips)"}, ${big.length} at or above 200 KB.`,
    "",
    "| id | source | size |",
    "|---|---|---:|",
    ...report.map((r) => `| ${r.id} | ${r.how.replace(/\|/g, "&#124;")} | ${r.done ? `${r.kb.toFixed(0)} KB` : "missing"} |`),
    "",
  ];
  writeFileSync(join(ROOT, "verification", "thumbs_report.md"), lines.join("\n"));
}
console.log(`capture: ${ok}/${jobs.length} screenshots`);
process.exit(ok === jobs.length ? 0 : 1);
