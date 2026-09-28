import { test } from "node:test";
import assert from "node:assert/strict";
import {
  meanRho, meanRhoGivenAlpha, varRhoGivenAlpha, wmaxBounds, wmaxTail, wmaxTailGivenAlpha,
  wsbCdf, wsbDensity, wsbQuantile, wsbTail, wsbTailGivenAlpha,
} from "../src/weights.ts";
import { num, readGolden, relErr } from "./golden.ts";

test("W_SB tail / density / cdf / quantile / conditional tail match golden", () => {
  let worst = { tail: 0, density: 0, cdf: 0, quantile: 0, cond_tail: 0 } as Record<string, number>;
  for (const row of readGolden("wsb.csv")) {
    const kind = String(row.kind);
    const [a, b, x] = [num(row, "a"), num(row, "b"), num(row, "x")];
    let got: number;
    if (kind === "tail") got = wsbTail(x, a, b);
    else if (kind === "density") {
      // R's density_w1 returns 0 on the boundary w = 0; the engine returns the limit a / b
      if (x === 0) {
        assert.ok(Math.abs(wsbDensity(0, a, b) - a / b) < 1e-12);
        continue;
      }
      got = wsbDensity(x, a, b);
    }
    else if (kind === "cdf") got = wsbCdf(x, a, b);
    else if (kind === "quantile") got = wsbQuantile(x, a, b);
    else got = wsbTailGivenAlpha(x, num(row, "alpha"));
    const want = num(row, "value");
    const e = Math.abs(want) > 1 ? relErr(got, want) : Math.abs(got - want);
    worst[kind] = Math.max(worst[kind], e);
  }
  for (const [k, v] of Object.entries(worst)) assert.ok(v < 1e-10, `${k}: ${v}`);
});

test("headline W_SB tails (abs 1e-3)", () => {
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-3;
  assert.ok(near(wsbTail(0.5, 1, 1), 0.591) && near(wsbTail(0.9, 1, 1), 0.303));
  assert.ok(near(wsbTail(0.5, 1.6, 1.22), 0.487) && near(wsbTail(0.9, 1.6, 1.22), 0.183));
  assert.ok(near(wsbTail(0.5, 2.179, 0.78), 0.25) && near(wsbTail(0.9, 2.179, 0.78), 0.05));
});

test("rho: conditional closed forms and Gamma mixture match golden", () => {
  for (const row of readGolden("rho.csv")) {
    const kind = String(row.kind);
    const want = num(row, "value");
    let got: number;
    if (kind === "cond_mean") got = meanRhoGivenAlpha(num(row, "alpha"));
    else if (kind === "cond_var") got = varRhoGivenAlpha(num(row, "alpha"));
    else got = meanRho(num(row, "a"), num(row, "b"));
    // a > 1e4 uses the concentrated grid (CONTRACT section 6) and meets the true Gamma as closely
    const tol = kind === "marg_mean" ? 1e-8 : 1e-14;
    assert.ok(Math.abs(got - want) < tol, `${kind} ${row.label ?? ""} a=${row.a} alpha=${row.alpha}: ${got} vs ${want}`);
  }
});

test("W_max: deterministic tails (abs 1e-8), bounds, and Monte Carlo rows (abs 5e-3)", () => {
  for (const row of readGolden("wmax_mc.csv")) {
    const t = num(row, "t");
    const fixed = Number.isFinite(num(row, "alpha"));
    const exact = fixed ? wmaxTailGivenAlpha(t, num(row, "alpha")) : wmaxTail(t, num(row, "a"), num(row, "b"));
    if (!fixed) {
      const bd = wmaxBounds(t, num(row, "a"), num(row, "b"));
      assert.ok(Math.abs(bd.lower - num(row, "lower_bound")) < 1e-12 && Math.abs(bd.upper - num(row, "upper_bound")) < 1e-12);
      assert.ok(exact >= bd.lower - 1e-12 && exact <= bd.upper + 1e-12, `${row.label}: exact outside bounds`);
    }
    const want = num(row, "estimate");
    if (!Number.isFinite(want)) continue; // the package declined (status approximate): bounds only
    const tol = row.method === "monte_carlo" ? 5e-3 : 1e-8;
    assert.ok(Math.abs(exact - want) < tol, `${row.label} t=${t} ${row.method}: ${exact} vs ${want}`);
  }
});

test("Pr(W_max > .5 | Gamma(1,1)) = .728 within 5e-3 of the MC golden and inside [S, S/t]", () => {
  const v = wmaxTail(0.5, 1, 1);
  assert.ok(Math.abs(v - 0.728) < 5e-3);
  const bd = wmaxBounds(0.5, 1, 1);
  assert.ok(v > bd.lower && v < bd.upper);
});
