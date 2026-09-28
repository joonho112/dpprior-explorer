#!/usr/bin/env node
/**
 * Page sweep with real viewport emulation (since 1.1.0). Starts the local
 * headless Chrome with a throwaway profile, and for each page x width x theme sets the viewport
 * through the DevTools Protocol (Emulation.setDeviceMetricsOverride, so window.innerWidth is the
 * requested width; `--window-size` alone does not go below 500 px), opens the page from file://,
 * waits for the widgets, and records
 *   innerWidth, document scrollWidth (horizontal overflow), console errors and exceptions,
 *   widget hosts without a mounted widget or read-out, charts (svg[role=img] and canvas),
 * plus a screenshot when --shots is given.
 *
 * Usage:
 *   node verification/page_sweep.mjs [--all] [--pages p1 p2 ...] [--widths 1280,375]
 *        [--themes light,dark] [--out DIR] [--shots] [--json FILE]
 *   pages are paths under docs/ with an optional query (e.g. embed/crp.html?alpha=1);
 *   --all takes every docs page (site pages, not embeds or apps).
 * Exit 1 when any page has overflow, a script error or an empty widget.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  console.log(`page sweep: SKIP (Chrome not found at ${CHROME})`);
  process.exit(0);
}

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const list = (name) => { const i = args.indexOf(name); if (i < 0) return []; const out = []; for (let k = i + 1; k < args.length && !args[k].startsWith("--"); k += 1) out.push(args[k]); return out; };
const widths = opt("--widths", "1280,375").split(",").map(Number);
const themes = opt("--themes", "light").split(",");
const outDir = opt("--out", null);
const shots = args.includes("--shots");
const jsonOut = opt("--json", null);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (!["site_libs", "embed", "apps", "js", "data", "catalog", "media", "styles"].includes(n)) walk(p, out);
    } else if (n.endsWith(".html")) out.push(relative(DOCS, p));
  }
  return out;
}
let pages = list("--pages");
if (args.includes("--all")) pages = walk(DOCS).sort();
if (!pages.length) {
  console.log("page sweep: no pages (use --all or --pages)");
  process.exit(0);
}
if (shots && outDir) mkdirSync(outDir, { recursive: true });

// ---- Chrome and the DevTools Protocol
const profile = mkdtempSync(join(tmpdir(), "dpx-sweep-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
const portFile = join(profile, "DevToolsActivePort");
for (let i = 0; i < 100 && !existsSync(portFile); i += 1) await new Promise((r) => setTimeout(r, 100));
const port = readFileSync(portFile, "utf8").split("\n")[0];
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method) events.push(msg);
});
const send = (method, params = {}) => new Promise((resolve) => { const id = (seq += 1); pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable");
await send("Runtime.enable");

const probe = `(() => {
  const hosts = [...document.querySelectorAll(".dpx-host")];
  const empty = hosts.filter((h) => { const w = h.querySelector(".dpx-widget"); const r = w && w.querySelector(".dpx-readout"); return !w || !r || !r.textContent.trim(); }).length;
  const wide = innerWidth < 700 ? [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "visible")
    .slice(0, 5).map((e) => e.tagName.toLowerCase() + "." + [...e.classList].join(".") + "[" + Math.round(e.getBoundingClientRect().width) + "]") : [];
  return JSON.stringify({ innerWidth, scrollWidth: document.documentElement.scrollWidth, hosts: hosts.length, empty, wide,
    charts: document.querySelectorAll('svg[role="img"], canvas').length, dataTheme: document.documentElement.getAttribute("data-theme") || "" }); // the page's own theme; row.theme is the emulated scheme
})()`;

const results = [];
for (const p of pages) {
  const [path, query = ""] = p.split("?");
  const file = join(DOCS, path);
  if (!existsSync(file)) { results.push({ page: p, error: "missing" }); continue; }
  for (const theme of themes) {
    for (const width of widths) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: width < 700 ? 812 : 900, deviceScaleFactor: 1, mobile: width < 700 });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }] });
      events.length = 0;
      const url = `${pathToFileURL(file).href}${query ? `?${query}` : ""}`;
      await send("Page.navigate", { url });
      for (let i = 0; i < 60 && !events.some((e) => e.method === "Page.loadEventFired"); i += 1) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 900)); // widgets mount and first resize observers fire
      const r = await send("Runtime.evaluate", { expression: probe, returnByValue: true });
      const info = JSON.parse(r.result.result.value);
      const errors = events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"))
        .map((e) => (e.params.exceptionDetails?.exception?.description ?? e.params.exceptionDetails?.text ?? e.params.args?.map((a) => a.value ?? a.description).join(" ") ?? "").split("\n")[0]);
      const row = { page: p, width, theme, ...info, overflow: info.scrollWidth - info.innerWidth, errors };
      if (shots && outDir) {
        const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        const name = `${p.replace(/[/?=&.]+/g, "_")}-${width}-${theme}.png`;
        writeFileSync(join(outDir, name), Buffer.from(s.result.data, "base64"));
        row.shot = name;
      }
      results.push(row);
      const bad = row.overflow > 0 || row.errors.length || row.empty || row.innerWidth !== width;
      console.log(`${bad ? "FAIL" : "ok  "} ${p} @${width} ${theme}: innerWidth ${row.innerWidth}, overflow ${row.overflow}, hosts ${row.hosts} (empty ${row.empty}), charts ${row.charts}${row.errors.length ? `, errors: ${row.errors.join(" | ")}` : ""}${bad && row.wide.length ? `, wide: ${row.wide.join(" ")}` : ""}`);
    }
  }
}
ws.close();
const exited = new Promise((r) => chrome.once("exit", r));
chrome.kill();
await exited;
rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 1));
const failed = results.filter((r) => r.error || r.overflow > 0 || r.errors?.length || r.empty || r.innerWidth !== r.width);
console.log(failed.length ? `page sweep: FAIL (${failed.length}/${results.length})` : `page sweep: PASS (${results.length} page views)`);
process.exit(failed.length ? 1 : 0);
