// TSMM: two-stage moment matching of Gamma(a, b) to a count target (mu_K, sigma^2) at J units
// (the paper's Stage 1 A1 start, then Stage 2 Newton). Golden values:
// verification/golden/tsmm_fits.csv (r-export/05_golden_v2_solvers.R, DPprior_fit A2-MN) and
// verification/golden/tsmm_boundary.csv (r-export/14_golden_tsmm_boundary.R, an independent R solver).
//
//   F(a, b) = (M1 - mu_K, V - sigma^2),  M1 = E[kappa_J(alpha)],  V = E[v_J(alpha)] + Var[kappa_J(alpha)]
// Newton on x = (log a, log b) with the analytic score Jacobian
//   d E[h] / d log a = a E[h (log b - psi(a) + log alpha)],   d E[h] / d log b = E[h (a - b alpha)],
// all expectations on the alpha grid of mixing.ts (one pass per iterate), and a backtracking line
// search on |F|. Before Newton, two checks decide whether a Gamma prior exists at all:
//   support        1 < mu_K < J and 0 < sigma^2 < (mu_K - 1)(J - mu_K) (only the two-point law on
//                  {1, J} reaches the upper end);
//   profile bound  sigma^2 > v_J(alpha*), where kappa_J(alpha*) = mu_K: the point-mass limit.
// Every target between the two bounds has an exact Gamma solution. Just above the profile bound
// the solution has a large shape (Var K_J - v_J(alpha*) is about C / a): there a one-dimensional
// profile solve (outer: log a for the variance, inner: log b for the mean) finds it on the
// concentrated grid of mixing.ts. Statuses:
//   ok              |F| <= tolF and a <= 1e4
//   point-mass      |F| <= tolF and a > 1e4: an exact solution with CV(alpha) < .01, described as
//                   (nearly) a point mass at alpha*
//   approximate     a Gamma prior exists but the solver stopped with |F| > tolF; the result carries
//                   the achieved moments and must not be presented as calibrated
//   infeasible      sigma^2 <= v_J(alpha*)
//   support         outside the support rule above
//   no-convergence  Newton and the profile solve both failed

import { condMean, condVar, profileBound, supportUpperVariance } from "./count.ts";
import { a1Init } from "./elicit.ts";
import { alphaGrid, logMinusDigamma, POINT_MASS_A } from "./mixing.ts";
import { digamma } from "./special.ts";

export { profileBound, supportUpperVariance } from "./count.ts";

export type TsmmStatus = "ok" | "point-mass" | "approximate" | "infeasible" | "support" | "no-convergence";

export interface TsmmStep {
  iter: number;
  a: number;
  b: number;
  M1: number;
  V: number;
  residual: number;
  residMean: number;
  residVar: number;
  /** line-search step length taken from this iterate (NaN on the last row) */
  step: number;
}

export interface TsmmResult {
  a: number;
  b: number;
  /** accepted Newton steps (or outer profile steps) */
  iter: number;
  resid: [number, number];
  residual: number;
  status: TsmmStatus;
  trace: TsmmStep[];
  alphaStar: number;
  minVar: number;
  /** (mu_K - 1)(J - mu_K), the support ceiling for this mean */
  supportUpper: number;
  /** the moments of K_J under the returned Gamma(a, b) (NaN when there is none) */
  achieved: { M1: number; V: number };
  /** "newton", "profile" (near the profile bound) or "none" */
  method: "newton" | "profile" | "none";
  start: { a0: number; b0: number; projected: boolean };
}

export interface TsmmOptions {
  maxIter?: number;
  /** convergence tolerance on |F| */
  tolF?: number;
  /** override the A1 start (a0, b0) */
  start?: [number, number];
}

/** Largest variance of K_J on {1, ..., J} over all means (the support ceiling at mu_K = (J + 1) / 2). */
export const maxCountVariance = (J: number) => ((J - 1) * (J - 1)) / 4;
const LOG_A_BOUND = 28; // log a kept in [-28, 28]: a from 7e-13 to 1.4e12
const LOG_B_BOUND = 40; // log b kept in [-40, 40]
const MAX_LOG_STEP = 2; // largest Newton step in (log a, log b)
const TOL_FINAL = 1e-10; // iterate past tolF while the residual still improves
const PROFILE_ITER = 60; // outer steps of the profile solve
const MEAN_ITER = 60; // inner Newton steps on log b

/** M1, V and their derivatives in (log a, log b), in one pass over the alpha grid. */
export function tsmmMoments(J: number, a: number, b: number) {
  const grid = alphaGrid(a, b);
  if (grid.pointMass !== null) {
    const al = grid.pointMass;
    return { M1: condMean(J, al), V: condVar(J, al), jac: null as null | [[number, number], [number, number]] };
  }
  const n = grid.alpha.length;
  const sa = new Float64Array(n);
  const sb = new Float64Array(n);
  if (grid.logRatio !== null) {
    // concentrated Gamma: scores from u = log(alpha b / a) without cancellation, then centred
    // (their exact means are 0; centring removes the rounding in E[h s] = Cov(h, s))
    const c = logMinusDigamma(a);
    let ma = 0;
    let mb = 0;
    for (let i = 0; i < n; i += 1) {
      const u = grid.logRatio[i];
      sa[i] = a * (u + c);
      sb[i] = -a * Math.expm1(u);
      ma += grid.weight[i] * sa[i];
      mb += grid.weight[i] * sb[i];
    }
    for (let i = 0; i < n; i += 1) {
      sa[i] -= ma;
      sb[i] -= mb;
    }
  } else {
    const base = Math.log(b) - digamma(a);
    for (let i = 0; i < n; i += 1) {
      sa[i] = a * (base + Math.log(grid.alpha[i]));
      sb[i] = a - b * grid.alpha[i];
    }
  }
  let E1 = grid.p0; // the alpha -> 0 mass: kappa = 1, v = 0
  let E2 = grid.p0;
  let Ev = 0;
  let E1a = 0, E2a = 0, Eva = 0, E1b = 0, E2b = 0, Evb = 0;
  for (let i = 0; i < n; i += 1) {
    const al = grid.alpha[i];
    const w = grid.weight[i];
    const k = condMean(J, al);
    const v = condVar(J, al);
    E1 += w * k;
    E2 += w * k * k;
    Ev += w * v;
    E1a += w * k * sa[i];
    E2a += w * k * k * sa[i];
    Eva += w * v * sa[i];
    E1b += w * k * sb[i];
    E2b += w * k * k * sb[i];
    Evb += w * v * sb[i];
  }
  const M1 = E1;
  const V = Ev + E2 - E1 * E1;
  const jac: [[number, number], [number, number]] = [
    [E1a, E1b],
    [Eva + E2a - 2 * E1 * E1a, Evb + E2b - 2 * E1 * E1b],
  ];
  return { M1, V, jac };
}

/** The b (on the log scale) with E K_J = mu_K at shape a, by safeguarded Newton from a guess. */
function meanMatchedLogB(J: number, muK: number, la: number, lbGuess: number) {
  let lb = lbGuess;
  let m = tsmmMoments(J, Math.exp(la), Math.exp(lb));
  for (let k = 0; k < MEAN_ITER && m.jac; k += 1) {
    const f = m.M1 - muK;
    if (Math.abs(f) <= 1e-13 * (1 + muK)) break;
    const d = m.jac[0][1]; // dM1 / dlog b < 0
    let step = d < 0 ? -f / d : Math.sign(f); // raising b lowers the mean
    step = Math.max(-1, Math.min(1, step));
    lb = Math.max(-LOG_B_BOUND, Math.min(LOG_B_BOUND, lb + step));
    m = tsmmMoments(J, Math.exp(la), Math.exp(lb));
  }
  return { lb, m };
}

/**
 * Profile solve near the profile bound: along the curve E K_J = mu_K, V decreases towards
 * v_J(alpha*) as a grows, with V - v_J(alpha*) close to C / a. Secant steps on
 * g(log a) = log(V - v_J) - log(sigma^2 - v_J), safeguarded by a bracket that bisects.
 */
function profileSolve(J: number, muK: number, varK: number, alphaStar: number, minVar: number, laLow: number, tolF: number) {
  const target = Math.log(varK - minVar);
  const trace: TsmmStep[] = [];
  let lbGuess = laLow - Math.log(alphaStar);
  const at = (la: number) => {
    const r = meanMatchedLogB(J, muK, la, lbGuess);
    lbGuess = r.lb; // warm start for the next shape
    const excess = r.m.V - minVar;
    const F: [number, number] = [r.m.M1 - muK, r.m.V - varK];
    const res = Math.hypot(F[0], F[1]);
    trace.push({ iter: trace.length, a: Math.exp(la), b: Math.exp(r.lb), M1: r.m.M1, V: r.m.V, residual: res, residMean: F[0], residVar: F[1], step: Number.NaN });
    return { la, lb: r.lb, M1: r.m.M1, V: r.m.V, F, res, g: excess > 0 ? Math.log(excess) - target : Number.NEGATIVE_INFINITY };
  };
  // bracket: g decreases in log a (more concentrated, smaller variance)
  let lo = at(laLow);
  if (lo.g < 0) return { best: lo, trace }; // the target is not in the concentrated band
  let hi = at(Math.min(LOG_A_BOUND, laLow + Math.max(1, lo.g)));
  while (hi.g > 0 && hi.la < LOG_A_BOUND) hi = at(Math.min(LOG_A_BOUND, hi.la + Math.max(1, hi.g)));
  let best = hi.res < lo.res ? hi : lo;
  if (hi.g > 0) return { best, trace };
  for (let k = 0; k < PROFILE_ITER && best.res > tolF / 10; k += 1) {
    // secant inside the bracket, bisection when it would leave it
    let la = hi.la - (hi.g * (hi.la - lo.la)) / (hi.g - lo.g);
    if (!(la > lo.la && la < hi.la) || !Number.isFinite(la)) la = (lo.la + hi.la) / 2;
    const mid = at(la);
    if (mid.res < best.res) best = mid;
    if (mid.g > 0) lo = mid;
    else hi = mid;
    if (hi.la - lo.la < 1e-12) break;
  }
  return { best, trace };
}

/** TSMM: the Gamma(a, b) whose K_J has mean mu_K and variance sigma^2. */
export function tsmmFit(J: number, muK: number, varK: number, opts: TsmmOptions = {}): TsmmResult {
  const maxIter = opts.maxIter ?? 50;
  const tolF = opts.tolF ?? 1e-6;
  const supportUpper = supportUpperVariance(J, muK);
  const none = { a: Number.NaN, b: Number.NaN, iter: 0, resid: [Number.NaN, Number.NaN] as [number, number], residual: Number.NaN, trace: [] as TsmmStep[], achieved: { M1: Number.NaN, V: Number.NaN }, method: "none" as const };
  const noStart = { a0: Number.NaN, b0: Number.NaN, projected: false };
  if (!(muK > 1 && muK < J) || !(varK > 0 && varK < supportUpper)) {
    return { ...none, status: "support", alphaStar: Number.NaN, minVar: Number.NaN, supportUpper, start: noStart };
  }
  const { alphaStar, minVar } = profileBound(J, muK);
  if (varK <= minVar) {
    return { ...none, status: "infeasible", alphaStar, minVar, supportUpper, start: noStart };
  }
  const finish = (a: number, b: number, M1: number, V: number, trace: TsmmStep[], iter: number, method: "newton" | "profile", start: TsmmResult["start"]): TsmmResult => {
    const resid: [number, number] = [M1 - muK, V - varK];
    const residual = Math.hypot(resid[0], resid[1]);
    const status: TsmmStatus = residual <= tolF ? (a > POINT_MASS_A ? "point-mass" : "ok") : "approximate";
    return { a, b, iter, resid, residual, status, trace, alphaStar, minVar, supportUpper, achieved: { M1, V }, method, start };
  };
  const laEdge = Math.log(POINT_MASS_A);
  // Near the profile bound the solution has a > 1e4: solve on the profile curve directly. The band
  // is a small fraction of v_J(alpha*) (.03% at J = 50, mu_K = 5), so it is only looked for within
  // 5% above the bound; a Newton run that stalls on the concentrated side falls back to it anyway.
  if (varK < 1.05 * minVar) {
    const edge = meanMatchedLogB(J, muK, laEdge, laEdge - Math.log(alphaStar));
    if (varK < edge.m.V) {
      const p = profileSolve(J, muK, varK, alphaStar, minVar, laEdge, tolF);
      const s = p.best;
      return finish(Math.exp(s.la), Math.exp(s.lb), s.M1, s.V, p.trace, p.trace.length - 1, "profile", { a0: POINT_MASS_A, b0: Math.exp(edge.lb), projected: false });
    }
  }
  // Stage 1: the A1 closed form. Below its domain (sigma^2 <= mu_K - 1), or just above it where
  // D = sigma^2 - (mu_K - 1) is so small that a0 = m^2 / D starts Newton inside the concentrated
  // zone, use D = (mu_K - 1) / 4 instead ("projected"). None of the golden targets is affected.
  let projected = false;
  let a0: number;
  let b0: number;
  if (opts.start) [a0, b0] = opts.start;
  else {
    const s = a1Init(J, muK, varK);
    if (s.ok && varK - (muK - 1) >= 0.25 * (muK - 1)) ({ a0, b0 } = s);
    else {
      projected = true;
      const m = muK - 1;
      const D = Math.max(varK - m, 0.25 * m);
      a0 = (m * m) / D;
      b0 = (m * Math.log(J)) / D;
    }
  }
  const start = { a0, b0, projected };
  const clampA = (v: number) => Math.max(-LOG_A_BOUND, Math.min(LOG_A_BOUND, v));
  const clampB = (v: number) => Math.max(-LOG_B_BOUND, Math.min(LOG_B_BOUND, v));
  let x = [clampA(Math.log(a0)), clampB(Math.log(b0))];
  const evalAt = (y: number[]) => {
    const m = tsmmMoments(J, Math.exp(y[0]), Math.exp(y[1]));
    const F: [number, number] = [m.M1 - muK, m.V - varK];
    return { ...m, F, r: Math.hypot(F[0], F[1]) };
  };
  let cur = evalAt(x);
  const trace: TsmmStep[] = [];
  let iter = 0;
  for (; iter < maxIter; iter += 1) {
    const row = { iter, a: Math.exp(x[0]), b: Math.exp(x[1]), M1: cur.M1, V: cur.V, residual: cur.r, residMean: cur.F[0], residVar: cur.F[1], step: Number.NaN };
    trace.push(row);
    if (cur.r < TOL_FINAL || !cur.jac) break;
    const [[j00, j01], [j10, j11]] = cur.jac;
    const det = j00 * j11 - j01 * j10;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-300) break;
    let dx = [-(j11 * cur.F[0] - j01 * cur.F[1]) / det, -(-j10 * cur.F[0] + j00 * cur.F[1]) / det];
    const len = Math.hypot(dx[0], dx[1]);
    if (len > MAX_LOG_STEP) dx = dx.map((d) => (d * MAX_LOG_STEP) / len);
    let t = 1;
    let next = null as null | ReturnType<typeof evalAt>;
    let y = x;
    while (t > 1 / 1024) {
      y = [clampA(x[0] + t * dx[0]), clampB(x[1] + t * dx[1])];
      const e = evalAt(y);
      if (e.r < cur.r * (1 - 1e-4 * t)) { next = e; break; }
      t /= 2;
    }
    if (!next) break; // no decrease along the Newton direction
    row.step = t;
    x = y;
    cur = next;
  }
  if (trace.length === 0 || trace[trace.length - 1].a !== Math.exp(x[0])) {
    trace.push({ iter, a: Math.exp(x[0]), b: Math.exp(x[1]), M1: cur.M1, V: cur.V, residual: cur.r, residMean: cur.F[0], residVar: cur.F[1], step: Number.NaN });
  }
  const steps = trace.filter((s) => Number.isFinite(s.step)).length;
  if (cur.r <= tolF) return finish(Math.exp(x[0]), Math.exp(x[1]), cur.M1, cur.V, trace, steps, "newton", start);
  // Newton stalled. If it stopped on the concentrated side, finish on the profile curve from there.
  if (Math.exp(x[0]) >= POINT_MASS_A / 100) {
    const p = profileSolve(J, muK, varK, alphaStar, minVar, Math.min(x[0], laEdge), tolF);
    if (p.best.res < cur.r) {
      const s = p.best;
      return finish(Math.exp(s.la), Math.exp(s.lb), s.M1, s.V, [...trace, ...p.trace], steps + p.trace.length, "profile", start);
    }
  }
  return { a: Math.exp(x[0]), b: Math.exp(x[1]), iter: steps, resid: cur.F, residual: cur.r, status: "no-convergence", trace, alphaStar, minVar, supportUpper, achieved: { M1: cur.M1, V: cur.V }, method: "newton", start };
}
