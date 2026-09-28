// Quarto post-render hook (runs under Quarto's bundled Deno).
// A full render empties docs/, which removes docs/.nojekyll; GitHub Pages needs it
// at the root of the publishing source (main:/docs). Recreate it every time.
const outDir = Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") ?? "docs";
Deno.writeTextFileSync(`${outDir}/.nojekyll`, "");
