import { test } from "node:test";
import assert from "node:assert/strict";
import { a1Init, checkTarget, confidenceToVariance, cvToVariance, intervalToMoments, qnorm, vifToVariance } from "../src/elicit.ts";
import { num, readGolden, relErr } from "./golden.ts";

test("qnorm matches R qnorm", () => {
  assert.ok(Math.abs(qnorm(0.9) - 1.2815515655446004) < 1e-15);
  assert.ok(Math.abs(qnorm(0.975) - 1.959963984540054) < 1e-15);
  assert.ok(Math.abs(qnorm(1e-10) + 6.361340902404056) < 1e-12);
  assert.ok(Math.abs(qnorm(0.5)) < 1e-16);
});

test("A1 initialiser matches golden; infeasible target is flagged", () => {
  for (const row of readGolden("a1_init.csv")) {
    const r = a1Init(num(row, "J"), num(row, "mu_K"), num(row, "var_K"));
    if (row.status === "ok") {
      assert.ok(r.ok && relErr(r.a0, num(row, "a0")) < 1e-10 && relErr(r.b0, num(row, "b0")) < 1e-10, `J=${row.J} mu=${row.mu_K}`);
    } else {
      assert.equal(r.ok, false);
    }
  }
  const w = a1Init(50, 5, 10);
  assert.ok(Math.abs(w.a0 - 2.667) < 1e-3 && Math.abs(w.b0 - 2.608) < 1e-3);
});

test("elicitation conversions match golden", () => {
  for (const row of readGolden("elicitation_conversions.csv")) {
    const kind = String(row.kind);
    const mu = num(row, "mu_K");
    let varK: number;
    if (kind === "vif" || kind === "confidence_vif") varK = vifToVariance(mu, num(row, "param"));
    else if (kind === "cv_K") varK = cvToVariance(mu, num(row, "param"));
    else {
      const m = intervalToMoments(num(row, "lo"), num(row, "hi"), num(row, "coverage"), mu);
      varK = m.varK;
      assert.ok(Math.abs((m.z ?? 0) - num(row, "z")) < 1e-14);
    }
    assert.ok(relErr(varK, num(row, "var_K")) < 1e-12, `${kind} ${row.param}: ${varK}`);
    const f = checkTarget(num(row, "J"), mu, varK);
    assert.equal(f.supportOk, row.support_ok === "TRUE", `${kind} support`);
    assert.equal(f.a1Ok, row.a1_ok === "TRUE", `${kind} a1`);
  }
  assert.equal(confidenceToVariance(5, "medium"), 10);
});

test("[3,10] at 95% (sigma^2 3.19) is flagged infeasible; at 80% it is fine", () => {
  const tight = intervalToMoments(3, 10, 0.95);
  assert.ok(Math.abs(tight.varK - 3.19) < 0.01);
  const f = checkTarget(100, tight.muK, tight.varK);
  assert.equal(f.ok, false);
  assert.equal(f.feasible, false);
  assert.ok(Math.abs(f.minVar - 4.522) < 1e-3);
  const wide = intervalToMoments(3, 10, 0.8);
  assert.ok(Math.abs(wide.varK - 7.46) < 0.01);
  assert.equal(checkTarget(100, wide.muK, wide.varK).ok, true);
});

test("checkTarget decides by the support and the profile bound, not by the A1 start", () => {
  const low = checkTarget(50, 5, 3.5); // below mu_K - 1 = 4 but above the bound 3.2218
  assert.equal(low.ok, true);
  assert.equal(low.a1Ok, false);
  assert.ok(low.note.length > 0 && low.message === "");
  const high = checkTarget(50, 2, 100); // the ceiling for mean 2 is (2 - 1)(50 - 2) = 48
  assert.equal(high.ok, false);
  assert.equal(high.supportOk, false);
  assert.equal(high.supportUpper, 48);
  assert.match(high.message, /48\.00/);
  const below = checkTarget(50, 5, 3.0);
  assert.equal(below.ok, false);
  assert.equal(below.feasible, false);
  assert.match(below.message, /smallest variance/);
  assert.equal(checkTarget(50, 5, 10).ok, true);
  assert.equal(checkTarget(50, 1, 10).ok, false);
});
