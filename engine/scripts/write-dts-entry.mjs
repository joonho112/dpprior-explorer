// tsc -p tsconfig.build.json writes one .d.ts per source file into ../js/types/.
// This writes the single entry ../js/dp-core.d.ts that re-exports them, so
// editors resolve `import ... from "../dp-core.js"` to typed declarations.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../js/dp-core.d.ts");
fs.writeFileSync(out, '// written by engine/scripts/write-dts-entry.mjs\nexport * from "./types/index.js";\n');
console.log(`wrote ${path.relative(process.cwd(), out)}`);
