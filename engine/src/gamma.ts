// Gamma(a, b) in the shape-rate parameterisation: density b^a alpha^(a-1) e^(-b alpha) / Gamma(a).
//
// gammp / gammq: regularised incomplete gamma by the power series (x < a + 1) and a
// modified Lentz continued fraction otherwise. qgamma: bisection in log x, bracketed
// below by the small-x closed form P(a, x) ~ x^a / Gamma(a + 1).
// R counterparts: stats::dgamma, stats::pgamma, stats::qgamma.

import { lgamma } from "./special.ts";

const MAX_ITER = 100000;
const SERIES_EPS = 1e-16;
const TINY = 1e-300;

/** log density of Gamma(shape a, rate b) at x > 0. */
export function dgammaLog(x: number, a: number, b: number): number {
  if (!(x > 0)) return Number.NEGATIVE_INFINITY;
  return a * Math.log(b) + (a - 1) * Math.log(x) - b * x - lgamma(a);
}

function logPrefactor(a: number, x: number): number {
  return -x + a * Math.log(x) - lgamma(a);
}

function lowerSeries(a: number, x: number): number {
  let ap = a;
  let term = 1 / a;
  let sum = term;
  for (let n = 0; n < MAX_ITER; n += 1) {
    ap += 1;
    term *= x / ap;
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * SERIES_EPS) break;
  }
  return sum * Math.exp(logPrefactor(a, x));
}

function upperFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < MAX_ITER; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < SERIES_EPS) break;
  }
  return Math.exp(logPrefactor(a, x)) * h;
}

/** Regularised lower incomplete gamma P(a, x). */
export function gammp(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x === Number.POSITIVE_INFINITY) return 1;
  return x < a + 1 ? lowerSeries(a, x) : 1 - upperFraction(a, x);
}

/** Regularised upper incomplete gamma Q(a, x) = 1 - P(a, x). */
export function gammq(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x === Number.POSITIVE_INFINITY) return 0;
  return x < a + 1 ? 1 - lowerSeries(a, x) : upperFraction(a, x);
}

/** Pr(alpha <= t) for alpha ~ Gamma(a, b). */
export function pgamma(t: number, a: number, b: number): number {
  return gammp(a, b * t);
}

/** Pr(alpha > t) for alpha ~ Gamma(a, b). */
export function pgammaUpper(t: number, a: number, b: number): number {
  return gammq(a, b * t);
}

const BISECTION_STEPS = 200;
const LOG_WIDTH_TOL = 1e-15;

/** Quantile of Gamma(a, b): the t with Pr(alpha <= t) = p. */
export function qgamma(p: number, a: number, b: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return Number.POSITIVE_INFINITY;
  const upper = p > 0.5;
  // P(a, x) <= x^a / Gamma(a + 1), so this x never exceeds the quantile
  let lo = Math.exp((Math.log(p) + lgamma(a + 1)) / a) * 0.5;
  if (!(lo > 0)) lo = Number.MIN_VALUE;
  let hi = Math.max(lo * 2, a + 1);
  const below = (x: number) => (upper ? gammq(a, x) > 1 - p : gammp(a, x) < p);
  while (below(hi)) hi *= 2;
  while (!below(lo) && lo > Number.MIN_VALUE) lo /= 2;
  let llo = Math.log(lo);
  let lhi = Math.log(hi);
  for (let i = 0; i < BISECTION_STEPS && lhi - llo > LOG_WIDTH_TOL; i += 1) {
    const mid = 0.5 * (llo + lhi);
    if (below(Math.exp(mid))) llo = mid;
    else lhi = mid;
  }
  return Math.exp(0.5 * (llo + lhi)) / b;
}
