import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_WEIGHTS, clusterMeans, createGibbs, demoData, setAlpha, stepPoint, sweep } from "../src/gibbs.ts";

// alpha = 0.01 is the value hard-coded in Broderick's sampler demo; sigma matches the data sd
const OPTS = { alpha: 0.01, sigma: 1, sigma0: 3, seed: 7 };

test("demo data: 100 points from four clusters at (+-3, +-3) with weights 5/11, 3/11, 2/11, 1/11", () => {
  const { points, truth } = demoData(1);
  assert.equal(points.length, 100);
  assert.deepEqual(DEMO_WEIGHTS.map((w) => Number(w.toFixed(4))), [0.4545, 0.2727, 0.1818, 0.0909]);
  const counts = [0, 0, 0, 0];
  truth.forEach((k) => (counts[k] += 1));
  assert.ok(counts.every((c) => c > 0));
});

test("collapsed Gibbs enters K in 3..5 within 10 sweeps from one cluster, singletons and a random start", () => {
  const { points } = demoData(1);
  for (const init of ["one", "singletons", "random"] as const) {
    const st = createGibbs(points, { ...OPTS, init, kInit: 10 });
    for (let s = 0; s < 10; s += 1) sweep(st);
    const first = st.trace.findIndex((K) => K >= 3 && K <= 5);
    assert.ok(first >= 0 && first <= 10, `${init}: trace ${st.trace.join(" ")}`);
    assert.equal(st.clusters.reduce((a, c) => a + c.n, 0), 100);
  }
});

test("alpha moves the equilibrium: alpha = 1 keeps more clusters than alpha = 0.01", () => {
  const { points } = demoData(1);
  const meanK = (alpha: number) => {
    const st = createGibbs(points, { ...OPTS, alpha, init: "one" });
    for (let s = 0; s < 60; s += 1) sweep(st);
    const tail = st.trace.slice(21);
    return tail.reduce((a, b) => a + b, 0) / tail.length;
  };
  const small = meanK(0.01);
  const large = meanK(1);
  assert.ok(small < 4.6, `alpha 0.01: mean K ${small}`);
  assert.ok(large > small + 0.5, `alpha 1: mean K ${large} vs ${small}`);
});

test("same seed, same run; bookkeeping stays consistent", () => {
  const { points } = demoData(2);
  const a = createGibbs(points, { ...OPTS, init: "singletons" });
  const b = createGibbs(points, { ...OPTS, init: "singletons" });
  for (let s = 0; s < 5; s += 1) {
    sweep(a);
    sweep(b);
  }
  assert.deepEqual(Array.from(a.z), Array.from(b.z));
  assert.deepEqual(a.trace, b.trace);
  // cluster sums match the members
  a.clusters.forEach((c, k) => {
    let n = 0;
    let sx = 0;
    points.forEach((p, i) => {
      if (a.z[i] === k) {
        n += 1;
        sx += p.x;
      }
    });
    assert.equal(c.n, n);
    assert.ok(Math.abs(c.sx - sx) < 1e-9);
  });
  assert.equal(clusterMeans(a).length, a.clusters.length);
});

test("stepPoint returns normalised probabilities with the new-cluster option last", () => {
  const { points } = demoData(3);
  const st = createGibbs(points, { ...OPTS, init: "one" });
  const u = stepPoint(st, 0);
  assert.equal(u.probs.length, u.ids.length);
  assert.ok(Math.abs(u.probs.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(u.prior.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  setAlpha(st, 1e-4);
  const v = stepPoint(st, 1);
  assert.ok(v.prior[v.prior.length - 1] < 1e-5);
});

