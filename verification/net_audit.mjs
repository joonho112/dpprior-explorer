#!/usr/bin/env node
/**
 * Network audit: opens a page (file:// or http) in headless Chrome with --log-net-log,
 * lets it load, and lists every URL the browser requested, grouped into
 *   local   file:, data:, blob:, chrome-extension: and 127.0.0.1 / localhost
 *   infra   Chrome's own background services (updates, safe browsing, ...)
 *   remote  everything else  <- the number that must be 0 for an offline talk
 * Usage: node verification/net_audit.mjs <page[?query][#hash]> [--allow host,...] [--out report.json]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const page = args[0];
const allow = (args[args.indexOf("--allow") + 1] && args.includes("--allow") ? args[args.indexOf("--allow") + 1] : "").split(",").filter(Boolean);
const outFile = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
const INFRA = /(^|\.)(google\.com|googleapis\.com|gstatic\.com|gvt1\.com|googleusercontent\.com|chrome\.com|doubleclick\.net|googlezip\.net)$/;

let url = page;
if (!/^https?:/.test(page)) {
  const [, file, query = "", hash = ""] = page.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  const abs = resolve(ROOT, file);
  if (!existsSync(abs)) throw new Error(`missing ${abs}`);
  url = pathToFileURL(abs).href + query + hash;
}
const dir = mkdtempSync(join(tmpdir(), "dpx-net-"));
const netlog = join(dir, "netlog.json");
const child = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--use-mock-keychain",
  "--password-store=basic", "--disable-extensions", "--disable-background-networking", "--disable-component-update",
  "--disable-sync", "--disable-default-apps", "--metrics-recording-only", `--user-data-dir=${join(dir, "profile")}`,
  `--log-net-log=${netlog}`, "--net-log-capture-mode=Default", "--virtual-time-budget=5000", "--dump-dom", url,
], { stdio: ["ignore", "pipe", "ignore"] });
let dom = "";
await new Promise((done) => {
  const t = setTimeout(() => { child.kill("SIGTERM"); done(); }, 45000);
  child.stdout.on("data", (d) => {
    dom += d;
    if (dom.includes("</html>")) { setTimeout(() => { child.kill("SIGTERM"); clearTimeout(t); done(); }, 1500); }
  });
  child.on("exit", () => { clearTimeout(t); done(); });
});
await new Promise((r) => setTimeout(r, 1500)); // let Chrome flush the net log
let text = existsSync(netlog) ? readFileSync(netlog, "utf8") : "";
if (text && !text.trim().endsWith("}")) text = text.trim().replace(/,$/, "") + "]}"; // log cut off at kill
const urls = new Set();
try {
  const log = JSON.parse(text);
  for (const ev of log.events ?? []) if (ev.params?.url) urls.add(ev.params.url);
} catch {
  for (const m of text.matchAll(/"url":"([^"]+)"/g)) urls.add(m[1]);
}
const groups = { local: [], infra: [], allowed: [], remote: [] };
for (const u of [...urls].sort()) {
  let host = "";
  try { host = new URL(u).hostname; } catch { /* data: etc. */ }
  if (/^(file|data|blob|chrome|chrome-extension|about):/.test(u) || host === "127.0.0.1" || host === "localhost") groups.local.push(u);
  else if (INFRA.test(host)) groups.infra.push(u);
  else if (allow.some((a) => host === a || host.endsWith(`.${a}`))) groups.allowed.push(u);
  else groups.remote.push(u);
}
rmSync(dir, { recursive: true, force: true });
const report = { page: url, when: new Date().toISOString(), counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])), ...groups };
if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");
console.log(`net audit ${page}`);
console.log(`  local ${groups.local.length}, allowed ${groups.allowed.length}${allow.length ? ` (${allow.join(", ")})` : ""}, Chrome infra ${groups.infra.length}, remote ${groups.remote.length}`);
for (const u of groups.allowed) console.log(`  allowed: ${u}`);
for (const u of groups.remote) console.log(`  REMOTE: ${u}`);
console.log(groups.remote.length ? "net audit: FAIL" : "net audit: PASS (no remote requests outside the allow list)");
process.exit(groups.remote.length ? 1 : 0);
