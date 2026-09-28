// Gamma mixtures E_{a,b}[h(alpha)], alpha ~ Gamma(shape a, rate b) (CONTRACT.md section 6).
//
// Split integration:
//   [0, lower]        mass pgamma(lower) goes to the alpha -> 0 limit h(0+)
//                     (K_J = 1, weight tails = 1); lower = max(1e-12, qgamma(1e-15)).
//   [lower, upper]    trapezoid rule on a uniform log-alpha grid with
//                     max(400, range / 0.02) nodes; upper = qgamma(1 - 1e-15).
//                     (1 - 1e-9 lost ~1e-3 of E[kappa^2] at J = 5000 for a = 0.037.)
//   a > 1e4           a concentrated Gamma (CV(alpha) < .01, e.g. hard-bound and near-bound TSMM
//                     solutions): trapezoid rule on u = log(alpha b / a), whose density is
//                     proportional to exp(-a (e^u - 1 - u)), over the mean of u +/- 12 sd with 401
//                     nodes, weights normalised; no qgamma is needed. POINT_MASS_A only marks where
//                     the site calls a prior "(nearly) a point mass"; the integral stays exact.
//   a >= 1e15         a true point mass at alpha = a / b (the Gamma is narrower than double
//                     precision can resolve).
// R counterparts: exact_K_moments, pmf_K_marginal, summary_K_marginal (the golden
// values use integrate(), never the package default Gauss-Laguerre M = 80).

import { condMean, condVar, logStirlingRow, pmfSummary, type PmfSummary } from "./count.ts";
import { dgammaLog, gammp, pgamma, qgamma } from "./gamma.ts";
import { lgamma, logSumExp, trigamma } from "./special.ts";

/** Above this shape CV(alpha) = 1 / sqrt(a) < .01: the site describes the prior as (nearly) a point mass. */
export const POINT_MASS_A = 1e4;
/** From this shape on the Gamma is treated as a true point mass at a / b. */
export const DEGENERATE_A = 1e15;
const CONC_NODES = 401;
const CONC_SD = 12;
export const ALPHA_FLOOR = 1e-12;
const LOWER_TAIL = 1e-15;
const UPPER_TAIL = 1e-15;
export const MIN_NODES = 400;
export const NODE_SPACING = 0.02;

export interface AlphaGrid {
  a: number;
  b: number;
  /** alpha = a / b when the prior is treated as a true point mass (a >= DEGENERATE_A), otherwise null */
  pointMass: number | null;
  /** u = log(alpha b / a) at each node for a concentrated Gamma (a > POINT_MASS_A), otherwise null */
  logRatio: Float64Array | null;
  /** mass assigned to the alpha -> 0 limit */
  p0: number;
  alpha: Float64Array;
  /** quadrature weights: density x alpha x d(log alpha) x trapezoid factor */
  weight: Float64Array;
}

/** Quadrature grid for Gamma(a, b); `nodeFactor` scales the node count (2 = doubling check). */
export function alphaGrid(a: number, b: number, nodeFactor = 1): AlphaGrid {
  if (!(a > 0 && b > 0)) throw new RangeError(`Gamma(a, b) needs a, b > 0, got (${a}, ${b})`);
  if (a >= DEGENERATE_A) {
    return { a, b, pointMass: a / b, logRatio: null, p0: 0, alpha: Float64Array.of(a / b), weight: Float64Array.of(1) };
  }
  if (a > POINT_MASS_A) return concentratedGrid(a, b, nodeFactor);
  const lower = Math.max(ALPHA_FLOOR, qgamma(LOWER_TAIL, a, b));
  const upper = qgamma(1 - UPPER_TAIL, a, b);
  const p0 = pgamma(lower, a, b);
  if (!(upper > lower)) {
    return { a, b, pointMass: null, logRatio: null, p0: 1, alpha: new Float64Array(0), weight: new Float64Array(0) };
  }
  const x0 = Math.log(lower);
  const range = Math.log(upper) - x0;
  const n = Math.ceil(Math.max(MIN_NODES, range / NODE_SPACING) * nodeFactor);
  const dx = range / (n - 1);
  const alpha = new Float64Array(n);
  const weight = new Float64Array(n);
  const density = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = x0 + i * dx;
    alpha[i] = Math.exp(x);
    density[i] = Math.exp(dgammaLog(alpha[i], a, b) + x); // integrand in log alpha
    const trap = i === 0 || i === n - 1 ? 0.5 : 1;
    weight[i] = density[i] * dx * trap;
  }
  // Euler-Maclaurin end correction: integral = T + dx^2/12 (f'(x0) - f'(xn)), with
  // f'(x) ~ (a - b alpha) f(x) for h smooth in alpha. It matters at the lower end for
  // a < 1, where the integrand at alpha = 1e-12 is not small (Gamma(0.037, 0.037)).
  const c = (dx * dx) / 12;
  weight[0] += c * (a - b * alpha[0]) * density[0];
  weight[n - 1] -= c * (a - b * alpha[n - 1]) * density[n - 1];
  return { a, b, pointMass: null, logRatio: null, p0, alpha, weight };
}

/** e^u - 1 - u without cancellation (a series near 0). */
export function expm1MinusU(u: number): number {
  if (Math.abs(u) < 0.01) return u * u * (0.5 + u * (1 / 6 + u * (1 / 24 + u * (1 / 120 + u / 720))));
  return Math.expm1(u) - u;
}

/** log(a) - psi(a) for large a (the asymptotic series; exact enough for a > 1e4). */
export function logMinusDigamma(a: number): number {
  const inv = 1 / a;
  const inv2 = inv * inv;
  return 0.5 * inv + inv2 * (1 / 12 - inv2 * (1 / 120 - inv2 / 252));
}

/**
 * Grid for a concentrated Gamma(a, b), a > POINT_MASS_A: u = log(alpha b / a) has density
 * proportional to exp(-a (e^u - 1 - u)), mean -(log a - psi(a)) and sd sqrt(psi'(a)); the
 * trapezoid rule over +/- CONC_SD sd is exact to rounding for smooth h, and the weights are
 * normalised so that E[1] = 1 exactly.
 */
export function concentratedGrid(a: number, b: number, nodeFactor = 1): AlphaGrid {
  const n = Math.ceil(CONC_NODES * nodeFactor);
  const sd = Math.sqrt(trigamma(a));
  const mean = -logMinusDigamma(a);
  const u0 = mean - CONC_SD * sd;
  const du = (2 * CONC_SD * sd) / (n - 1);
  const logRatio = new Float64Array(n);
  const alpha = new Float64Array(n);
  const weight = new Float64Array(n);
  const logW = new Float64Array(n);
  let top = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i += 1) {
    const u = u0 + i * du;
    logRatio[i] = u;
    alpha[i] = (a / b) * Math.exp(u);
    logW[i] = -a * expm1MinusU(u);
    if (logW[i] > top) top = logW[i];
  }
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    weight[i] = Math.exp(logW[i] - top) * (i === 0 || i === n - 1 ? 0.5 : 1);
    total += weight[i];
  }
  for (let i = 0; i < n; i += 1) weight[i] /= total;
  return { a, b, pointMass: null, logRatio, p0: 0, alpha, weight };
}

/** E[h(alpha)] with h(0+) = h0 for the mass below the floor. */
export function mixExpect(grid: AlphaGrid, h: (alpha: number) => number, h0: number): number {
  if (grid.pointMass !== null) return h(grid.pointMass);
  let s = grid.p0 * h0;
  for (let i = 0; i < grid.alpha.length; i += 1) s += grid.weight[i] * h(grid.alpha[i]);
  return s;
}

export interface Moments {
  mean: number;
  var: number;
  sd: number;
}

/** Marginal E(K_J) and Var(K_J) under Gamma(a, b); any J (digamma path above 200). */
export function mixMoments(J: number, a: number, b: number, grid: AlphaGrid = alphaGrid(a, b)): Moments {
  if (grid.pointMass !== null) {
    const v = condVar(J, grid.pointMass);
    return { mean: condMean(J, grid.pointMass), var: v, sd: Math.sqrt(v) };
  }
  let m1 = grid.p0;
  let m2 = grid.p0;
  let ev = 0;
  for (let i = 0; i < grid.alpha.length; i += 1) {
    const k = condMean(J, grid.alpha[i]);
    m1 += grid.weight[i] * k;
    m2 += grid.weight[i] * k * k;
    ev += grid.weight[i] * condVar(J, grid.alpha[i]);
  }
  const v = Math.max(0, ev + m2 - m1 * m1);
  return { mean: m1, var: v, sd: Math.sqrt(v) };
}

/** Marginal pmf of K_J under Gamma(a, b), index = k (pmf[0] = 0). Intended for J <= 500. */
export function mixPmf(J: number, a: number, b: number, grid: AlphaGrid = alphaGrid(a, b)): Float64Array {
  const L = logStirlingRow(J);
  const pmf = new Float64Array(J + 1);
  const w = new Float64Array(J);
  const add = (alpha: number, weight: number) => {
    const la = Math.log(alpha);
    for (let k = 1; k <= J; k += 1) w[k - 1] = L[k] + k * la;
    const norm = logSumExp(w);
    for (let k = 1; k <= J; k += 1) pmf[k] += weight * Math.exp(w[k - 1] - norm);
  };
  if (grid.pointMass !== null) {
    add(grid.pointMass, 1);
    return pmf;
  }
  pmf[1] += grid.p0;
  for (let i = 0; i < grid.alpha.length; i += 1) add(grid.alpha[i], grid.weight[i]);
  return pmf;
}

/** pmf summary plus Pr(alpha < 0.1) (Table 2 of the paper). */
export function mixSummary(J: number, a: number, b: number): PmfSummary & { prAlphaBelow01: number } {
  const grid = alphaGrid(a, b);
  const s = pmfSummary(mixPmf(J, a, b, grid));
  return { ...s, prAlphaBelow01: prAlphaBelow(0.1, a, b) };
}

/**
 * Pr(alpha < t) under Gamma(a, b). Above POINT_MASS_A the incomplete-gamma series is slow, so
 * the Wilson-Hilferty normal approximation of (b alpha / a)^(1/3) is used (error O(1/a));
 * a true point mass (a >= DEGENERATE_A) gives 0 or 1.
 */
export function prAlphaBelow(t: number, a: number, b: number): number {
  if (a >= DEGENERATE_A) return a / b < t ? 1 : 0;
  if (a > POINT_MASS_A) {
    const s = 1 / (9 * a);
    const z = (Math.cbrt((b * t) / a) - (1 - s)) / Math.sqrt(s);
    const tail = 0.5 * gammp(0.5, (z * z) / 2); // Pr(0 < Z < |z|)
    return z >= 0 ? 0.5 + tail : 0.5 - tail;
  }
  return pgamma(t, a, b);
}

/**
 * Prior collapse P(K_J = 1) under Gamma(a, b) for any J, without the pmf:
 * E[Gamma(alpha + 1) Gamma(J) / Gamma(alpha + J)], whose alpha -> 0 limit is 1. There is
 * no live cap (M-07 uses it up to J = 5000); parity against the golden p_K1 column.
 */
export function mixPK1(J: number, a: number, b: number, grid: AlphaGrid = alphaGrid(a, b)): number {
  if (J === 1) return 1;
  const lgJ = lgamma(J);
  return mixExpect(grid, (alpha) => Math.exp(lgamma(alpha + 1) + lgJ - lgamma(alpha + J)), 1);
}
