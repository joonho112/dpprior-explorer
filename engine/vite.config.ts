import { defineConfig } from "vite";

// dp-core is a library, not an app: one entry, two formats.
//   ../js/dp-core.js      ES module (http pages, OJS cells, node tests of widgets)
//   ../js/dp-core.umd.js  UMD, global `dpCore` (classic <script>, works from file://)
// emptyOutDir stays false: ../js also holds widgets/, bundles/ and vendor/.
export default defineConfig({
  build: {
    outDir: "../js",
    emptyOutDir: false,
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    reportCompressedSize: true,
    lib: {
      entry: "src/index.ts",
      name: "dpCore",
      formats: ["es", "umd"],
      fileName: (format) => (format === "es" ? "dp-core.js" : "dp-core.umd.js"),
    },
  },
});
