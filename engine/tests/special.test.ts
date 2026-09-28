import { test } from "node:test";
import assert from "node:assert/strict";
import { digamma, lgamma, logRising, logSumExp, trigamma } from "../src/special.ts";
import { num, readGolden, relErr } from "./golden.ts";

test("lgamma at exact points", () => {
  assert.ok(Math.abs(lgamma(1)) < 1e-14);
  assert.ok(Math.abs(lgamma(2)) < 1e-14);
  assert.ok(Math.abs(lgamma(0.5) - 0.5 * Math.log(Math.PI)) < 1e-14);
  // 10! = 3628800
  assert.ok(relErr(lgamma(11), Math.log(3628800)) < 1e-14);
  // tiny x: lgamma(x) = -log(x) - gamma x + O(x^2)
  const x = 1e-9;
  assert.ok(Math.abs(lgamma(x) - (-Math.log(x) - 0.5772156649015329 * x)) < 1e-14);
});

test("digamma and trigamma at exact points", () => {
  const eulerGamma = 0.5772156649015329;
  assert.ok(Math.abs(digamma(1) + eulerGamma) < 1e-14);
  assert.ok(Math.abs(digamma(0.5) + eulerGamma + 2 * Math.log(2)) < 1e-14);
  assert.ok(Math.abs(trigamma(1) - (Math.PI * Math.PI) / 6) < 1e-14);
  assert.ok(Math.abs(trigamma(0.5) - (Math.PI * Math.PI) / 2) < 1e-13);
  // recurrence consistency across the asymptotic threshold
  for (const v of [9.5, 10, 10.5, 123.4]) {
    assert.ok(Math.abs(digamma(v + 1) - digamma(v) - 1 / v) < 1e-14);
    assert.ok(Math.abs(trigamma(v) - trigamma(v + 1) - 1 / (v * v)) < 1e-15);
  }
});

test("log rising factorial matches golden (rel 1e-10), incl. alpha in {1e-9, 1e-6, 1e-3} at J = 500", () => {
  for (const row of readGolden("log_rising.csv")) {
    const got = logRising(num(row, "alpha"), num(row, "J"));
    assert.ok(relErr(got, num(row, "log_rising")) < 1e-10, `alpha=${row.alpha} J=${row.J}: ${got} vs ${row.log_rising}`);
    assert.ok(relErr(got, num(row, "lgamma_diff")) < 1e-10);
  }
});

test("logSumExp", () => {
  assert.equal(logSumExp([Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]), Number.NEGATIVE_INFINITY);
  assert.ok(Math.abs(logSumExp([Math.log(2), Math.log(3)]) - Math.log(5)) < 1e-15);
  assert.ok(Math.abs(logSumExp([1000, 1000]) - (1000 + Math.log(2))) < 1e-12);
});
