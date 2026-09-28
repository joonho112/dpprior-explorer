// The weight lens: size-biased first weight W_SB, largest weight W_max, co-clustering rho.
//
// Given alpha, W_SB ~ Beta(1, alpha); mixing over alpha ~ Gamma(a, b) gives the closed form
//   S(t; a, b) = Pr(W_SB > t) = (b / (b + c_t))^a,  c_t = -log(1 - t).
// W_SB is the share of the cluster a randomly chosen unit belongs to; it is not the
// largest weight. For t >= 1/2 at most one weight can exceed t, so
//   Pr(W_max > t) = integral_t^1 f_SB(w) / w dw,
// computed exactly after the substitution u = -log(1 - w). Below 1/2 only the
// bounds S(t) <= Pr(W_max > t) <= min(1, S(t) / t) are available (Prop. 1).
// rho = sum_k w_k^2 (probability that two units share a cluster), E(rho | alpha) = 1/(1 + alpha).
// R counterparts: prob_wsb_exceeds, density_w1, cdf_w1, quantile_w1, wmax_tail_bounds,
// prob_wmax_exceeds, mean_rho_given_alpha, var_rho_given_alpha, mean_rho.

import { alphaGrid, mixExpect } from "./mixing.ts";

/** Largest w at which densities are evaluated (CONTRACT.md section 6). */
export const W_DENSITY_MAX = 1 - 1e-4;
/** Majority-mass threshold used throughout the paper. */
export const MAJORITY_T = 0.5;

const ct = (t: number) => -Math.log1p(-t);

/** Pr(W_SB > t | a, b) = (b / (b + c_t))^a. */
export function wsbTail(t: number, a: number, b: number): number {
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  return Math.exp(-a * Math.log1p(ct(t) / b));
}

/** Pr(W_SB > t | alpha) = (1 - t)^alpha. */
export function wsbTailGivenAlpha(t: number, alpha: number): number {
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  return Math.exp(alpha * Math.log1p(-t));
}

/** Density of W_SB under Gamma(a, b): a b^a / ((1 - w) (b + c)^(a + 1)), c = -log(1 - w). */
export function wsbDensity(w: number, a: number, b: number): number {
  if (w < 0 || w > W_DENSITY_MAX) return Number.NaN;
  const c = ct(w);
  return Math.exp(Math.log(a) + a * Math.log(b) - Math.log1p(-w) - (a + 1) * Math.log(b + c));
}

/** Pr(W_SB <= w | a, b). */
export function wsbCdf(w: number, a: number, b: number): number {
  return 1 - wsbTail(w, a, b);
}

/** Quantile of W_SB: solves 1 - (b / (b + c))^a = u in closed form. */
export function wsbQuantile(u: number, a: number, b: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const c = b * Math.expm1(-Math.log1p(-u) / a);
  return -Math.expm1(-c);
}

export interface WmaxBounds {
  lower: number;
  upper: number;
}

/** Prop. 1 bounds: S(t) <= Pr(W_max > t) <= min(1, S(t) / t). */
export function wmaxBounds(t: number, a: number, b: number): WmaxBounds {
  const s = wsbTail(t, a, b);
  return { lower: s, upper: Math.min(1, s / t) };
}

// Exact W_max tail: integral over u = -log(1 - w) from c_t to U, plus the closed-form
// remainder beyond U where 1 / (1 - e^-u) = 1 to within e^-U.
const U_CUT = 40;
const SIMPSON_INTERVALS = 4000;

function simpsonLog(f: (u: number) => number, u0: number, u1: number): number {
  // Simpson's rule in y = log u (the integrand is smooth on a log scale)
  const y0 = Math.log(u0);
  const h = (Math.log(u1) - y0) / SIMPSON_INTERVALS;
  let s = 0;
  for (let i = 0; i <= SIMPSON_INTERVALS; i += 1) {
    const u = Math.exp(y0 + i * h);
    const coef = i === 0 || i === SIMPSON_INTERVALS ? 1 : i % 2 === 1 ? 4 : 2;
    s += coef * f(u) * u;
  }
  return (s * h) / 3;
}

/** Pr(W_max > t | a, b) for t >= 1/2 (exact); NaN below 1/2 (use wmaxBounds). */
export function wmaxTail(t: number, a: number, b: number): number {
  if (t >= 1) return 0;
  if (t < MAJORITY_T) return Number.NaN;
  const f = (u: number) =>
    Math.exp(Math.log(a) - Math.log(b + u) - a * Math.log1p(u / b) - Math.log(-Math.expm1(-u)));
  const remainder = Math.exp(-a * Math.log1p(U_CUT / b));
  return simpsonLog(f, ct(t), U_CUT) + remainder;
}

/** Pr(W_max > t | alpha) for t >= 1/2 (exact); NaN below 1/2. */
export function wmaxTailGivenAlpha(t: number, alpha: number): number {
  if (t >= 1) return 0;
  if (t < MAJORITY_T) return Number.NaN;
  const f = (u: number) => Math.exp(Math.log(alpha) - alpha * u - Math.log(-Math.expm1(-u)));
  const remainder = Math.exp(-alpha * U_CUT);
  return simpsonLog(f, ct(t), U_CUT) + remainder;
}

/** E(rho | alpha) = E(W_SB | alpha) = 1 / (1 + alpha). */
export function meanRhoGivenAlpha(alpha: number): number {
  return 1 / (1 + alpha);
}

/** Var(rho | alpha) = 2 alpha / ((alpha + 1)^2 (alpha + 2) (alpha + 3)). */
export function varRhoGivenAlpha(alpha: number): number {
  return (((2 * (alpha / (alpha + 1))) / (alpha + 1)) / (alpha + 2)) / (alpha + 3);
}

/** E(rho | a, b) = E[1 / (1 + alpha)] under Gamma(a, b). */
export function meanRho(a: number, b: number): number {
  return mixExpect(alphaGrid(a, b), meanRhoGivenAlpha, 1);
}
