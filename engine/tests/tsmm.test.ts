import { test } from "node:test";
import assert from "node:assert/strict";
import { maxCountVariance, profileBound, supportUpperVariance, tsmmFit } from "../src/tsmm.ts";
import { num, readGolden, relErr } from "./golden.ts";

const gold = readGolden("tsmm_fits.csv");

test("TSMM reproduces the feasible golden fits (DPprior_fit A2-MN) to 1e-5 relative", () => {
  for (const g of gold.filter((r) => r.status === "ok")) {
    const r = tsmmFit(num(g, "J"), num(g, "mu_K"), num(g, "sigma2"));
    assert.equal(r.status, "ok", String(g.case));
    assert.ok(relErr(r.a, num(g, "a")) < 1e-5 && relErr(r.b, num(g, "b")) < 1e-5, `${g.case}: (${r.a}, ${r.b})`);
    assert.ok(r.residual < 1e-8, `${g.case}: residual ${r.residual}`);
  }
});

test("J = 50, (5, 10): Newton from the A1 start (2.667, 2.608) to (1.4082, 1.0770), as in the paper's trace", () => {
  const r = tsmmFit(50, 5, 10);
  const t = r.trace;
  assert.ok(Math.abs(t[0].a - 2.6667) < 1e-4 && Math.abs(t[0].b - 2.6080) < 1e-4);
  assert.ok(Math.abs(t[0].residMean + 0.585) < 1e-3 && Math.abs(t[0].residVar + 4.382) < 1e-3, `${t[0].residMean}, ${t[0].residVar}`);
  assert.ok(Math.abs(t[1].a - 0.8406) < 1e-3 && Math.abs(t[1].b - 0.6273) < 1e-3, `step 1: (${t[1].a}, ${t[1].b})`);
  assert.ok(Math.abs(r.a - 1.4082) < 1e-4 && Math.abs(r.b - 1.0770) < 1e-4);
  assert.ok(r.iter <= 8);
});

test("[3, 10] at 95% at J = 100 (sigma^2 = 3.189) is infeasible: alpha* = 1.386, minimum variance 4.522", () => {
  const g = gold.find((row) => row.case === "J100_3to10_95")!;
  const r = tsmmFit(100, 6.5, num(g, "sigma2"));
  assert.equal(r.status, "infeasible");
  assert.ok(Math.abs(r.alphaStar - 1.386) < 1e-3 && Math.abs(r.minVar - 4.522) < 1e-3, `${r.alphaStar}, ${r.minVar}`);
  const pb = profileBound(100, 6.5);
  assert.ok(Math.abs(pb.alphaStar - num(g, "alpha_star")) < 1e-9 && Math.abs(pb.minVar - num(g, "min_var")) < 1e-9);
});

test("support: mu_K outside (1, J) or sigma^2 at or above (mu_K - 1)(J - mu_K) is refused before any fit", () => {
  assert.equal(tsmmFit(10, 1, 3).status, "support");
  assert.equal(tsmmFit(10, 10, 3).status, "support");
  assert.equal(tsmmFit(10, 5, maxCountVariance(10) + 1).status, "support");
  assert.equal(tsmmFit(10, 5, supportUpperVariance(10, 5)).status, "support"); // only the two-point law reaches it
  // the mean-specific ceiling, not (J - 1)^2 / 4 = 600.25
  const r = tsmmFit(50, 2, 100);
  assert.equal(r.status, "support");
  assert.equal(r.supportUpper, 48);
  assert.equal(tsmmFit(50, 5, 181).status, "support");
});

test("below the A1 domain (sigma^2 <= mu_K - 1) the start is projected and Newton still converges", () => {
  const r = tsmmFit(100, 6.5, 5);
  assert.equal(r.start.projected, true);
  assert.equal(r.status, "ok");
  assert.ok(r.residual < 1e-8);
});

test("a J = 50 fit takes under 150 ms", () => {
  tsmmFit(50, 5, 10);
  const t0 = performance.now();
  tsmmFit(50, 5, 10);
  assert.ok(performance.now() - t0 < 150);
});

test("near the profile bound the exact Gamma solution is found", () => {
  // the reviewer's case: before, a = 1e4 with Var 3.22278 was labelled calibrated (residual 8.8e-4)
  const r = tsmmFit(50, 5, 3.2219);
  assert.equal(r.status, "point-mass"); // an exact solution with CV(alpha) < .01
  assert.ok(r.residual <= 1e-6 && Math.abs(r.achieved.V - 3.2219) <= 1e-6 && Math.abs(r.achieved.M1 - 5) <= 1e-6, `${r.residual}`);
  assert.ok(r.a > 1e4 && Math.abs(r.a / r.b - r.alphaStar) < 1e-3 * r.alphaStar);
  const s = tsmmFit(100, 6.5, 4.5235); // the bound is 4.5224; the CV = .01 prior has 4.5244
  assert.equal(s.status, "point-mass");
  assert.ok(s.residual <= 1e-6 && Math.abs(s.a / s.b - 1.386) < 1e-3, `${s.a / s.b}, ${s.residual}`);
  const u = tsmmFit(100, 6.5, 4.5245); // just above the band: Newton converges, CV(alpha) about .0102
  assert.equal(u.status, "ok");
  assert.ok(u.residual < 1e-8 && u.a > 9000 && u.a < 1e4, `${u.a}`);
  const v = tsmmFit(50, 10, 6.2049);
  assert.equal(v.status, "point-mass");
  assert.ok(v.residual <= 1e-6);
  const w = tsmmFit(50, 5, 3.2217947); // 1.2e-8 above the bound: a is near 1e9, still within tolerance
  assert.ok(w.status === "point-mass" && w.residual <= 1e-6, `${w.status} ${w.residual}`);
});

test("a variance below mu_K - 1 is feasible and TSMM matches DPprior 2.0.0", () => {
  const r = tsmmFit(50, 5, 3.5); // DPprior_fit (2.0.0, A2-MN): Gamma(36.44479, 30.78524), converged
  assert.equal(r.status, "ok");
  assert.equal(r.start.projected, true);
  assert.ok(relErr(r.a, 36.44479) < 1e-6 && relErr(r.b, 30.78524) < 1e-6, `(${r.a}, ${r.b})`);
});

test("a success status always meets tolF, and every target between the bounds is solved up to 95% of the ceiling", () => {
  let fits = 0;
  for (const J of [20, 50, 500]) {
    for (const mu of [1.5, 2, 5, 10]) {
      if (!(mu < J)) continue;
      const { minVar } = profileBound(J, mu);
      const up = supportUpperVariance(J, mu);
      const vs = [minVar * (1 + 1e-7), minVar * (1 + 1e-4), minVar * 1.01, minVar * 1.2, (minVar + up) / 20, (minVar + up) / 4, 0.5 * up, 0.8 * up, 0.95 * up];
      for (const v of vs) {
        const f = tsmmFit(J, mu, v);
        fits += 1;
        assert.ok(f.status === "ok" || f.status === "point-mass", `J=${J} mu=${mu} v=${v}: ${f.status}`);
        assert.ok(f.residual <= 1e-6, `J=${J} mu=${mu} v=${v}: residual ${f.residual}`);
        assert.ok(Math.abs(f.achieved.M1 - mu) <= 1e-6 && Math.abs(f.achieved.V - v) <= 1e-6);
      }
    }
  }
  assert.ok(fits > 90);
});

test("a start deep in the point-mass zone (sigma^2 just above mu_K - 1) is floored and Newton converges", () => {
  const r = tsmmFit(500, 1.5, 0.500007); // A1 would start at a0 = .25 / 7e-6 = 3.6e4
  assert.equal(r.start.projected, true);
  assert.equal(r.status, "ok");
  assert.ok(r.residual < 1e-8);
  // the floor D >= (mu_K - 1) / 4 leaves the paper's targets alone: VIF 1.25 sits exactly on it
  assert.equal(tsmmFit(100, 5, 5).start.projected, false);
  assert.equal(tsmmFit(50, 5, 10).start.projected, false);
});
