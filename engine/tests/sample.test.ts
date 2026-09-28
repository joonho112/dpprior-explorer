import { test } from "node:test";
import assert from "node:assert/strict";
import { Crp, lrgamma, makeRng, rbeta, rcrpTables, rdirichlet, rgamma, rgem } from "../src/sample.ts";
import { condMean } from "../src/count.ts";

test("same seed, same GEM and CRP output", () => {
  const g1 = rgem(makeRng(7), 2);
  const g2 = rgem(makeRng(7), 2);
  assert.deepEqual(g1, g2);
  const c1 = new Crp(1, makeRng(11));
  const c2 = new Crp(1, makeRng(11));
  for (let i = 0; i < 100; i += 1) assert.deepEqual(c1.seat(), c2.seat());
  assert.deepEqual(c1.counts, c2.counts);
});

test("GEM: mean first weight is 1/(1+alpha) within 1e-2 (1e5 draws)", () => {
  for (const alpha of [0.5, 1, 10]) {
    const rng = makeRng(20260924);
    let s = 0;
    const n = 100000;
    for (let i = 0; i < n; i += 1) s += rgem(rng, alpha, 0.5).w[0];
    assert.ok(Math.abs(s / n - 1 / (1 + alpha)) < 1e-2, `alpha=${alpha}: ${s / n}`);
  }
});

test("GEM stops below eps = 1e-3, weights + rest sum to 1, alpha = 0.02 and 100 are finite", () => {
  for (const alpha of [0.02, 0.5, 1, 10, 100]) {
    const g = rgem(makeRng(3), alpha);
    assert.ok(g.rest < 1e-3);
    const total = g.w.reduce((a, b) => a + b, 0) + g.rest;
    assert.ok(Math.abs(total - 1) < 1e-12);
    assert.ok(g.w.every(Number.isFinite) && g.v.every((v) => v >= 0 && v <= 1));
  }
  assert.ok(rgem(makeRng(3), 100).w.length < 5000);
});

test("CRP alpha = 1, J = 79: mean tables over 1e4 runs within 5e-2 of E(K_79 | 1)", () => {
  const rng = makeRng(79);
  let s = 0;
  const n = 10000;
  for (let i = 0; i < n; i += 1) s += rcrpTables(rng, 1, 79);
  assert.ok(Math.abs(s / n - condMean(79, 1)) < 5e-2, `${s / n} vs ${condMean(79, 1)}`);
});

test("CRP probabilities: new-table probability for the 79th customer is alpha/(alpha+78)", () => {
  const crp = new Crp(1, makeRng(1));
  for (let i = 0; i < 78; i += 1) crp.seat();
  const p = crp.nextProbs();
  assert.ok(Math.abs(p[p.length - 1] - 1 / 79) < 1e-15);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test("Gamma, Beta, Dirichlet sample means", () => {
  const rng = makeRng(5);
  const n = 50000;
  let sg = 0;
  let sg2 = 0;
  let sb = 0;
  for (let i = 0; i < n; i += 1) {
    sg += rgamma(rng, 0.3);
    sg2 += rgamma(rng, 4.5);
    sb += rbeta(rng, 2, 5);
  }
  assert.ok(Math.abs(sg / n - 0.3) < 0.02 && Math.abs(sg2 / n - 4.5) < 0.05 && Math.abs(sb / n - 2 / 7) < 5e-3);
  const d = rdirichlet(rng, [0.5, 5, 40]);
  assert.ok(Math.abs(d.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test("lrgamma matches log(rgamma) draw for draw; rdirichlet stays finite for a = 0.001, K = 5000", () => {
  for (const shape of [0.3, 1, 4.5]) {
    const r1 = makeRng(11);
    const r2 = makeRng(11);
    for (let i = 0; i < 50; i += 1) {
      const g = rgamma(r1, shape);
      const lg = lrgamma(r2, shape);
      if (g > 0) assert.ok(Math.abs(Math.log(g) - lg) < 1e-9);
    }
  }
  const d = rdirichlet(makeRng(3), new Array(5000).fill(0.001));
  assert.ok(d.every(Number.isFinite));
  assert.ok(Math.abs(d.reduce((s, x) => s + x, 0) - 1) < 1e-12);
});

