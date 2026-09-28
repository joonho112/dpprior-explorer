// Minimal reader for the R golden CSVs (write.csv with quoted fields, "NA" for missing).
import fs from "node:fs";
import path from "node:path";

export const GOLDEN_DIR = path.resolve(import.meta.dirname, "../../verification/golden");

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export type GoldenRow = Record<string, number | string>;

const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$|^-?Inf$/;

export function readGolden(file: string): GoldenRow[] {
  const text = fs.readFileSync(path.join(GOLDEN_DIR, file), "utf8").trim();
  const [head, ...lines] = text.split(/\r?\n/);
  const cols = splitCsvLine(head);
  return lines.map((line) => {
    const cells = splitCsvLine(line);
    const row: GoldenRow = {};
    cols.forEach((c, i) => {
      const v = cells[i];
      if (v === "NA") row[c] = Number.NaN;
      else if (v === "TRUE" || v === "FALSE") row[c] = v;
      else if (NUMERIC.test(v)) row[c] = v === "Inf" ? Infinity : v === "-Inf" ? -Infinity : Number(v);
      else row[c] = v;
    });
    return row;
  });
}

export const num = (row: GoldenRow, key: string): number => row[key] as number;

export function relErr(a: number, b: number): number {
  if (a === b) return 0;
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
}
