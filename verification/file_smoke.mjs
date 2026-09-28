#!/usr/bin/env node
/**
 * file:// smoke test with the locally installed Google Chrome (headless, throwaway
 * profile). Opens each page as file://, lets scripts run, dumps the DOM, and checks
 * that every widget host has a read-out without "NaN" / "undefined" and at least one
 * chart with role="img". Skips (exit 0 with a notice) when Chrome is not installed.
 *
 * Usage: node verification/file_smoke.mjs [page ...]   (paths relative to dpprior-explorer/)
 * Default pages: every docs/embed/*.html (except _template.html) and docs/pages/**.html
 * that contain a "dpx-host".
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  console.log(`file smoke: SKIP (Chrome not found at ${CHROME}; set CHROME_BIN)`);
  process.exit(0);
}

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith(".html")) out.push(p);
  }
  return out;
}
let pages = process.argv.slice(2).map((p) => join(ROOT, p));
if (!pages.length) {
  const docs = join(ROOT, "docs");
  pages = walk(docs).filter((p) => {
    const text = readFileSync(p, "utf8");
    return text.includes("dpx-host") && !p.endsWith("_template.html");
  });
}

// virtual time Chrome gives a page before it dumps the DOM: the heaviest pages (A-05, A-11) could miss
// 3 s on a busy machine and leave a read-out empty, so the budget is 8 s (the dump comes earlier
// when the page is idle)
const BUDGET_MS = 8000;
const profile = mkdtempSync(join(tmpdir(), "dpx-chrome-"));
function dump(url) {
  return new Promise((resolve) => {
    const args = [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--use-mock-keychain",
      "--password-store=basic", "--disable-extensions", "--disable-background-networking",
      `--user-data-dir=${profile}`, `--virtual-time-budget=${BUDGET_MS}`, "--window-size=1200,900", "--dump-dom", url,
    ];
    const child = spawn(CHROME, args, { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    const finish = () => {
      clearTimeout(timer);
      child.kill("SIGKILL");
      resolve(out);
    };
    // Chrome sometimes keeps running after --dump-dom; stop once the document is complete
    child.stdout.on("data", (d) => {
      out += d;
      if (out.includes("</html>")) finish();
    });
    child.on("exit", () => resolve(out));
    const timer = setTimeout(finish, 45000);
  });
}

let failures = 0;
for (const page of pages) {
  const [, file, query = "", hash = ""] = page.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const url = pathToFileURL(file).href + query + hash;
  const dom = await dump(url);
  const rel = relative(ROOT, page);
  const hosts = (dom.match(/class="[^"]*\bdpx-host\b[^"]*"/g) || []).length;
  const readouts = [...dom.matchAll(/<p class="dpx-readout"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
  const figures = (dom.match(/role="img"/g) || []).length;
  const bad = /\bNaN\b|\bundefined\b|\[object Object\]/.test(readouts.join(" "));
  const ok = dom.length > 0 && hosts > 0 && readouts.length >= hosts && readouts.every((r) => r.trim().length > 0) && figures > 0 && !bad;
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${rel}: hosts ${hosts}, read-outs ${readouts.length}, charts ${figures}${readouts[0] ? ` | ${readouts[0].slice(0, 110)}` : ""}`);
}
rmSync(profile, { recursive: true, force: true });
console.log(failures ? `file smoke: FAIL (${failures}/${pages.length})` : `file smoke: PASS (${pages.length} pages from file://)`);
process.exit(failures ? 1 : 0);
