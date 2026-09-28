import { test } from "node:test";
import assert from "node:assert/strict";
import { dgammaLog, gammp, gammq, pgamma, qgamma } from "../src/gamma.ts";
import { lgamma } from "../src/special.ts";
import { num, readGolden, relErr } from "./golden.ts";

test("gammp + gammq = 1 and exponential special case", () => {
  for (const [a, x] of [[0.037, 1e-9], [0.5, 0.3], [1, 2], [2.3, 0.7], [20, 25], [500, 480]]) {
    assert.ok(Math.abs(gammp(a, x) + gammq(a, x) - 1) < 1e-14, `a=${a} x=${x}`);
  }
  for (const x of [0.01, 0.1, 1, 5, 30]) assert.ok(Math.abs(gammp(1, x) - (1 - Math.exp(-x))) < 1e-14);
});

test("Pr(alpha < 0.1) matches golden (abs 1e-12)", () => {
  for (const row of readGolden("marginal_quantiles.csv")) {
    const a = num(row, "a");
    if (!Number.isFinite(a) || a > 1e4) continue;
    const got = pgamma(0.1, a, num(row, "b"));
    assert.ok(Math.abs(got - num(row, "pr_alpha_lt_0.1")) < 1e-12, `${row.label}: ${got}`);
  }
});

test("qgamma inverts pgamma, including extreme lower tails", () => {
  const cases = [[0.037, 0.037], [0.445, 0.003], [1, 1], [1.6, 1.22], [20.2967503116458, 14.5088544096694], [5000, 2500]];
  for (const [a, b] of cases) {
    for (const p of [1e-15, 1e-9, 0.05, 0.5, 0.95, 1 - 1e-9]) {
      // skip quantiles below the smallest double (Gamma(0.037, .) at p = 1e-15 is ~1e-406)
      if ((Math.log(p) + lgamma(a + 1)) / a - Math.log(b) < -700) continue;
      const q = qgamma(p, a, b);
      const back = p > 0.5 ? 1 - gammq(a, b * q) : pgamma(q, a, b);
      const tol = p > 0.5 ? 1e-12 : Math.max(1e-12 * p, 1e-25);
      assert.ok(Math.abs(back - p) < tol || relErr(back, p) < 1e-10, `a=${a} b=${b} p=${p}: q=${q} back=${back}`);
    }
  }
});

test("dgammaLog integrates to the mean a/b on a fine grid", () => {
  const [a, b] = [2.3158, 1.4204];
  let s = 0;
  let m = 0;
  const dx = 1e-3;
  for (let x = dx / 2; x < 40; x += dx) {
    const d = Math.exp(dgammaLog(x, a, b));
    s += d * dx;
    m += x * d * dx;
  }
  assert.ok(Math.abs(s - 1) < 1e-6 && Math.abs(m - a / b) < 1e-5);
});
