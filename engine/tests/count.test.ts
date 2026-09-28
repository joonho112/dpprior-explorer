import { test } from "node:test";
import assert from "node:assert/strict";
import {
  condMean, condMeanDigamma, condMeanSum, condPmf, condPmfConvolution, condVar,
  condVarDigamma, condVarSum, logStirlingRow, pmfSummary,
} from "../src/count.ts";
import { lgamma, logSumExp } from "../src/special.ts";
import { num, readGolden, relErr } from "./golden.ts";

test("log-Stirling J <= 50 matches golden (rel 1e-10)", () => {
  let worst = 0;
  for (const row of readGolden("stirling_J50.csv")) {
    const got = logStirlingRow(num(row, "J"))[num(row, "k")];
    const want = num(row, "log_stirling");
    const e = want === 0 ? Math.abs(got) : relErr(got, want);
    worst = Math.max(worst, e);
  }
  assert.ok(worst < 1e-10, `worst rel err ${worst}`);
});

test("log-Stirling full rows J in {48, 79, 100, 200, 500} match golden (rel 1e-10)", () => {
  let worst = 0;
  for (const row of readGolden("stirling_J500.csv")) {
    const got = logStirlingRow(num(row, "J"))[num(row, "k")];
    const want = num(row, "log_stirling");
    worst = Math.max(worst, want === 0 ? Math.abs(got) : relErr(got, want));
  }
  assert.ok(worst < 1e-10, `worst rel err ${worst}`);
});

test("row-sum identity: logsumexp_k log|s(J,k)| = lgamma(J + 1)", () => {
  for (const J of [50, 500, 1000]) {
    const row = logStirlingRow(J);
    const d = Math.abs(logSumExp(row.subarray(1)) - lgamma(J + 1));
    assert.ok(d < 1e-9, `J=${J}: ${d}`);
  }
});

test("Stirling pmf and Bernoulli convolution agree at J = 100 (abs 1e-12) and sum to 1", () => {
  for (const alpha of [0.01, 0.5, 1, 2, 10, 100]) {
    const a = condPmf(100, alpha);
    const b = condPmfConvolution(100, alpha);
    let sa = 0;
    let sb = 0;
    for (let k = 0; k <= 100; k += 1) {
      assert.ok(Math.abs(a[k] - b[k]) < 1e-12, `alpha=${alpha} k=${k}: ${a[k]} vs ${b[k]}`);
      sa += a[k];
      sb += b[k];
    }
    assert.ok(Math.abs(sa - 1) < 1e-12 && Math.abs(sb - 1) < 1e-12);
    assert.equal(a[0], 0);
  }
});

test("conditional pmf J = 50 matches golden (abs 1e-12)", () => {
  for (const row of readGolden("cond_pmf_J50.csv")) {
    const got = condPmf(50, num(row, "alpha"))[num(row, "k")];
    assert.ok(Math.abs(got - num(row, "pmf")) < 1e-12, `alpha=${row.alpha} k=${row.k}`);
  }
});

test("finite-sum and digamma paths agree at J = 200 (1e-12)", () => {
  for (const alpha of [1e-6, 1e-3, 0.1, 1, 10, 100, 1000]) {
    const dm = Math.abs(condMeanSum(200, alpha) - condMeanDigamma(200, alpha));
    const dv = Math.abs(condVarSum(200, alpha) - condVarDigamma(200, alpha));
    assert.ok(dm < 1e-12, `mean alpha=${alpha}: ${dm}`);
    assert.ok(dv < 1e-12, `var alpha=${alpha}: ${dv}`);
  }
});

test("large alpha: E K_J stays in [1, J], Var K_J >= 0, and both match the finite sums", () => {
  for (const J of [200, 201, 500, 2000, 5000]) {
    for (const e of [-12, -6, -2, 0, 2, 4, 6, 8, 10, 12]) {
      const alpha = 10 ** e;
      const [m, v] = [condMean(J, alpha), condVar(J, alpha)];
      const [ms, vs] = [condMeanSum(J, alpha), condVarSum(J, alpha)];
      assert.ok(m >= 1 && m <= J && v >= 0, `J=${J} alpha=1e${e}: E ${m}, Var ${v}`);
      assert.ok(Math.abs(m - ms) <= 1e-10 * ms, `mean J=${J} alpha=1e${e}: ${m} vs ${ms}`);
      assert.ok(Math.abs(v - vs) <= 1e-9 * Math.max(vs, 1e-6), `var J=${J} alpha=1e${e}: ${v} vs ${vs}`);
    }
  }
  // the reviewer's case: digamma gave E = 201.0019 > J
  assert.ok(condMean(201, 1e12) <= 201 && Math.abs(condVar(201, 1e12) - 2.01e-8) < 1e-12);
});

test("conditional moments match golden (rel 1e-9), incl. J > 500 digamma rows", () => {
  let worst = 0;
  for (const row of readGolden("cond_moments.csv")) {
    const J = num(row, "J");
    const alpha = num(row, "alpha");
    const useDigamma = row.method === "digamma";
    const m = useDigamma ? condMeanDigamma(J, alpha) : condMean(J, alpha);
    const v = useDigamma ? condVarDigamma(J, alpha) : condVar(J, alpha);
    worst = Math.max(worst, relErr(m, num(row, "mean")), relErr(v, num(row, "var")));
  }
  assert.ok(worst < 1e-9, `worst rel err ${worst}`);
});

test("alpha = 1, J = 100: E K = 5.187 and pmf mean agrees", () => {
  assert.ok(Math.abs(condMean(100, 1) - 5.18737751763962) < 1e-12);
  const s = pmfSummary(condPmf(100, 1));
  assert.ok(Math.abs(s.mean - condMean(100, 1)) < 1e-10);
  assert.ok(Math.abs(s.var - condVar(100, 1)) < 1e-9);
});
