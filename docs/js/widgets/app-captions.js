// Shared captions of the evidence pages (Part 5). Owner of this file: Step 9.1.
//
// Every evidence widget (A-01 to A-13) takes its fixed wording from here, so the rules hold in
// one place and verification/check_captions.mjs can find the same sentences on every page:
//   read     posterior results are read from the released tables, never recomputed;
//   kj       K_J is the number of fitted components among the J units;
//   retained the simulation keeps its retained-fit denominators (summed from the released
//            headline table: 8,607 of 9,000 planned fits in the 45 main cells);
//   ocrs     the replication package's OCRS application is a descriptive school-level contrast,
//            not the original blocked intent-to-treat analysis, and is not used here.
import headline from "../../data/released/headline_primary.js";
import { h } from "./base.js";

const planned = headline.reduce((s, r) => s + r.n_manifest, 0);
const retained = headline.reduce((s, r) => s + r.n_scientific_eligible, 0);
const n = (x) => x.toLocaleString("en-US");

/** Retained and planned fits of the main simulation cells, from headline_primary.json. */
export const RETAINED = { retained, planned, cells: headline.length };

export const CAPTIONS = {
  read: "Posterior results come from the replication package's released tables (CC BY 4.0): read, not recomputed in the browser.",
  kj: "K_J is the number of fitted components (occupied clusters) among the J units.",
  retained: `Simulation summaries keep the retained-fit denominators: ${n(retained)} of ${n(planned)} planned fits in the ${headline.length} main cells.`,
  ocrs: "The replication package's OCRS application is a descriptive school-level contrast, not the original blocked intent-to-treat analysis; it is not used on this site.",
};

/** The captions for `keys`, as one paragraph element for a widget's caption area. */
export function captionFor(keys) {
  return keys.map((k) => CAPTIONS[k]).join(" ");
}

/** A small block listing the captions, one per line (for the lineage cards and the hub). */
export function captionList(keys) {
  return h("ul", { class: "dpx-app-captions" }, ...keys.map((k) => h("li", { "data-caption": k, text: CAPTIONS[k] })));
}
