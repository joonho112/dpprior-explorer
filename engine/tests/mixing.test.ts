import { test } from "node:test";
import assert from "node:assert/strict";
import { alphaGrid, concentratedGrid, DEGENERATE_A, mixMoments, mixPK1, mixPmf, mixSummary, POINT_MASS_A, prAlphaBelow } from "../src/mixing.ts";
import { condMean, condPmf, condVar, pmfSummary } from "../src/count.ts";
import { pgamma } from "../src/gamma.ts";
import { num, readGolden } from "./golden.ts";

const pointMassLabel = "[point mass alpha = a/b]";

test("marginal moments match golden: abs 1e-4 (all rows, incl. J > 500 digamma); a > 1e4 on the concentrated grid", () => {
  let worst = 0;
  let worstRow = "";
  let conc = 0;
  for (const row of readGolden("marginal_moments.csv")) {
    const J = num(row, "J");
    const [a, b] = [num(row, "a"), num(row, "b")];
    // point-mass rows describe K_J given alpha = a / b; the engine itself integrates the true Gamma
    const m = row.method === "point_mass" ? { mean: condMean(J, a / b), var: condVar(J, a / b) } : mixMoments(J, a, b);
    const e = Math.max(Math.abs(m.mean - num(row, "mean")), Math.abs(m.var - num(row, "var")) / Math.max(1, num(row, "var")));
    if (a > POINT_MASS_A && row.method !== "point_mass") conc = Math.max(conc, e);
    if (e > worst) {
      worst = e;
      worstRow = `${row.label} J=${J}`;
    }
  }
  assert.ok(worst < 1e-4, `worst ${worst} at ${worstRow}`);
  assert.ok(conc < 1e-9, `concentrated grid vs the true Gamma: ${conc}`);
});

test("marginal pmf J = 50, 100, 500 matches golden (abs 1e-8); a > 1e4 matches the true Gamma to 1e-10", () => {
  const rows = readGolden("marginal_pmf_J50_J100_J500.csv");
  const cache = new Map<string, Float64Array>();
  let worst = 0;
  let where = "";
  let conc = 0;
  for (const row of rows) {
    const [a, b, J, k] = [num(row, "a"), num(row, "b"), num(row, "J"), num(row, "k")];
    const key = `${row.method === "point_mass" ? "pm" : "g"}|${a}|${b}|${J}`;
    if (!cache.has(key)) cache.set(key, row.method === "point_mass" ? condPmf(J, a / b) : mixPmf(J, a, b));
    const e = Math.abs(cache.get(key)![k] - num(row, "pmf"));
    if (a > POINT_MASS_A && row.method !== "point_mass") conc = Math.max(conc, e);
    if (e > worst) {
      worst = e;
      where = `${row.label} J=${J} k=${k}`;
    }
  }
  assert.ok(worst < 1e-8, `worst ${worst} at ${where}`);
  assert.ok(conc < 1e-10, `concentrated grid vs the true Gamma: ${conc}`);
});

test("the concentrated grid joins the general grid (a = 1e3 ... 1e4) and keeps E[1] = 1", () => {
  for (const a of [1e3, 3e3, 9e3, 1e4]) {
    const b = a / 1.7;
    for (const J of [50, 500, 5000]) {
      const g1 = mixMoments(J, a, b, alphaGrid(a, b));
      const g2 = mixMoments(J, a, b, concentratedGrid(a, b));
      assert.ok(Math.abs(g1.mean - g2.mean) < 1e-8 && Math.abs(g1.var - g2.var) < 1e-7, `a=${a} J=${J}`);
    }
    const w = concentratedGrid(a, b).weight.reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(w - 1) < 1e-14);
  }
  // a true point mass only from DEGENERATE_A on
  assert.equal(alphaGrid(2e6, 1e6).pointMass, null);
  assert.equal(alphaGrid(DEGENERATE_A, DEGENERATE_A / 2).pointMass, 2);
});

test("Pr(alpha < t) above 1e4: Wilson-Hilferty within 1e-4 of the incomplete gamma", () => {
  for (const a of [2e4, 1e5]) {
    const b = a / 2;
    for (const t of [1.95, 1.99, 2, 2.01, 2.05]) {
      const exact = pgamma(t, a, b);
      assert.ok(Math.abs(prAlphaBelow(t, a, b) - exact) < 1e-4, `a=${a} t=${t}: ${prAlphaBelow(t, a, b)} vs ${exact}`);
    }
  }
});

test("marginal quantiles and P(K = 1) match golden for J <= 500", () => {
  for (const row of readGolden("marginal_quantiles.csv")) {
    const J = num(row, "J");
    const a = num(row, "a");
    if (J > 500 || !Number.isFinite(a) || String(row.label).includes(pointMassLabel)) continue;
    const s = pmfSummary(mixPmf(J, a, num(row, "b")));
    assert.equal(s.q05, num(row, "q05"), `${row.label} J=${J} q05`);
    assert.equal(s.median, num(row, "median"), `${row.label} J=${J} median`);
    assert.equal(s.q95, num(row, "q95"), `${row.label} J=${J} q95`);
    assert.ok(Math.abs(s.pK1 - num(row, "p_K1")) < 1e-8, `${row.label} J=${J} P(K=1)`);
  }
});

test("Step 2.3 headline values", () => {
  const g11 = mixSummary(100, 1, 1);
  const m11 = mixMoments(100, 1, 1);
  assert.ok(Math.abs(m11.mean - 4.837) < 1e-3 && Math.abs(m11.var - 13.2) < 0.05);
  assert.equal(g11.q05, 1);
  assert.equal(g11.q95, 12);
  assert.ok(Math.abs(g11.prAlphaBelow01 - 0.095) < 1e-3);
  const fig1 = mixSummary(50, 1.6, 1.22);
  assert.ok(Math.abs(mixMoments(50, 1.6, 1.22).mean - 5.045) < 1e-3);
  assert.equal(fig1.median, 4);
  assert.ok(Math.abs(mixPmf(100, 0.037, 0.037)[1] - 0.8336) < 2e-3);
  assert.ok(Math.abs(mixMoments(100, 0.445, 0.003).mean - 53.4) < 0.1);
  // exact hard-bound solution (replication data-frozen/rasch/priors.csv): nearly a point mass at alpha = 2
  assert.ok(Math.abs(mixMoments(79, 3268991.12646551, 1634495.21665859).mean - 7.93) < 1e-3);
  assert.equal(prAlphaBelow(0.1, 3268991.12646551, 1634495.21665859), 0);
});

test("doubling the nodes moves moments by < 1e-4", () => {
  for (const [a, b] of [[1, 1], [0.037, 0.037], [0.445, 0.003], [20.2967503116458, 14.5088544096694], [9000, 4500]]) {
    for (const J of [50, 500, 5000]) {
      const m1 = mixMoments(J, a, b, alphaGrid(a, b, 1));
      const m2 = mixMoments(J, a, b, alphaGrid(a, b, 2));
      assert.ok(Math.abs(m1.mean - m2.mean) < 1e-4 && Math.abs(m1.var - m2.var) < 1e-4, `a=${a} b=${b} J=${J}`);
    }
  }
});

test("mixPK1 (closed-form P(K_J = 1), any J) matches golden p_K1 (abs 1e-8) and the live pmf", () => {
  let worst = 0;
  let where = "";
  for (const row of readGolden("marginal_quantiles.csv")) {
    if (!Number.isFinite(num(row, "a")) || !Number.isFinite(num(row, "b"))) continue;
    const J = num(row, "J");
    const e = Math.abs(mixPK1(J, num(row, "a"), num(row, "b")) - num(row, "p_K1"));
    if (e > worst) {
      worst = e;
      where = `${row.label} J=${J}`;
    }
  }
  assert.ok(worst < 1e-8, `worst ${worst} at ${where}`);
  for (const [J, a, b] of [[50, 1.6, 1.22], [100, 0.037, 0.037], [500, 2, 4]]) {
    assert.ok(Math.abs(mixPK1(J, a, b) - mixPmf(J, a, b)[1]) < 1e-10);
  }
  assert.equal(mixPK1(1, 1, 1), 1);
});

