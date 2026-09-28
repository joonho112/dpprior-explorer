import { test } from "node:test";
import assert from "node:assert/strict";
import { doroKL, scalShortcut, scalSolve, scalTails, ssiSolve } from "../src/solvers.ts";
import { num, readGolden, relErr } from "./golden.ts";

const gold = readGolden("solvers.csv");
const rowsOf = (method: string) => gold.filter((r) => r.method === method);
const timed = <T>(f: () => T): [T, number] => {
  const t0 = performance.now();
  const r = f();
  return [r, performance.now() - t0];
};

test("SSI-Weight: (2.179, 0.780) hits Pr(W_SB > .5) = .25 and Pr(W_SB > .9) = .05", () => {
  const r = ssiSolve();
  const g = rowsOf("ssi")[0];
  assert.ok(Math.abs(r.a - num(g, "a")) < 1e-9 && Math.abs(r.b - num(g, "b")) < 1e-9, `(${r.a}, ${r.b})`);
  assert.ok(Math.abs(r.a - 2.179) < 1e-3 && Math.abs(r.b - 0.780) < 1e-3);
  assert.ok(Math.abs(r.achieved[0] - 0.25) < 1e-12 && Math.abs(r.achieved[1] - 0.05) < 1e-12, `${r.achieved}`);
  assert.ok(r.converged);
});

test("DORO: Nelder-Mead from Dorazio's table reproduces the golden fits at n = 10, 50, 100 in under 300 ms", () => {
  for (const g of rowsOf("doro")) {
    const n = num(g, "n_or_m");
    const [r, ms] = timed(() => doroKL(n));
    assert.ok(relErr(r.a, num(g, "a")) < 1e-4 && relErr(r.b, num(g, "b")) < 1e-4, `n=${n}: (${r.a}, ${r.b})`);
    assert.ok(r.kl <= num(g, "KL") + 1e-9, `n=${n}: KL ${r.kl} vs ${num(g, "KL")}`);
    assert.ok(r.converged && ms < 300, `n=${n}: ${ms.toFixed(0)} ms`);
  }
  // b -> 0 without losing mass: E(alpha) is about 151 at n = 100 and the pmf sums to 1
  const r = doroKL(100);
  assert.ok(r.a / r.b > 140 && r.a / r.b < 160, `E(alpha) ${r.a / r.b}`);
  assert.ok(Math.abs(r.leak) < 1e-12, `leak ${r.leak}`);
  // the table only speeds things up: other starts, including the DPprior_a2_kl (M = 320) fits, end at the same point
  for (const start of [[1, 1], [0.3, 0.001], [0.5149, 0.0043]] as [number, number][]) {
    const s = doroKL(100, { start });
    assert.ok(relErr(s.a, r.a) < 1e-4 && relErr(s.b, r.b) < 1e-4, `start ${start}: (${s.a}, ${s.b})`);
  }
});

test("DORO-Unif: uniform on {1, ..., 9} at J = 100 gives (2.434, 2.461)", () => {
  const r = doroKL(100, { muK: 5 });
  const g = rowsOf("doro_unif")[0];
  assert.equal(r.top, 9);
  assert.ok(Math.abs(r.a - 2.434) < 2e-3 && Math.abs(r.b - 2.461) < 2e-3, `(${r.a}, ${r.b})`);
  assert.ok(Math.abs(r.kl - num(g, "KL")) < 1e-6 && Math.abs(r.leak - num(g, "P_tail")) < 1e-3);
});

test("SCAL: Newton solves both tails for m = 6, ..., 100; the published (0.403, 0.370) give .340 and .148", () => {
  for (const g of rowsOf("scal_exact")) {
    const m = num(g, "n_or_m");
    const [r, ms] = timed(() => scalSolve(m));
    assert.ok(r.converged && ms < 300, `m=${m}: ${ms.toFixed(0)} ms`);
    assert.ok(relErr(r.a, num(g, "a")) < 1e-6 && relErr(r.b, num(g, "b")) < 1e-6, `m=${m}: (${r.a}, ${r.b})`);
    assert.ok(Math.abs(r.pOne - 0.34) < 1e-9 && Math.abs(r.pTail - 0.15) < 1e-9);
    assert.equal(r.q, num(g, "tail_q"));
  }
  const pub = scalTails(100, 0.403, 0.37);
  assert.equal(pub.pOne.toFixed(3), "0.340");
  assert.equal(pub.pTail.toFixed(3), "0.148");
  // below m = 5 the targets need a point mass: the solver says so
  assert.equal(scalSolve(4).converged, false);
});

test("SCAL shortcut: exp(-0.033 m) collapses, P(K_100 = 1) = .834 (never the stale .824)", () => {
  const s = scalShortcut(100);
  const g = rowsOf("scal_shortcut").find((r) => num(r, "n_or_m") === 100)!;
  assert.ok(Math.abs(s.pOne - num(g, "P_K1")) < 1e-8 && Math.abs(s.pOne - 0.834) < 2e-3, `${s.pOne}`);
  assert.ok(Math.abs(s.mean - num(g, "E_K")) < 1e-4);
  const rounded = scalTails(100, 0.037, 0.037);
  assert.ok(Math.abs(rounded.pOne - 0.8336) < 1e-4 && Math.abs(rounded.pOne - 0.824) > 5e-3, `${rounded.pOne}`);
});
