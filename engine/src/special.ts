// Special functions for dp-core.
//
// lgamma: Lanczos approximation (g = 7, n = 9 coefficients) for x >= 0.5, with the
// shift lgamma(x) = lgamma(x + 1) - log(x) below 0.5 so tiny concentrations
// (alpha = 1e-9) keep full relative precision.
// digamma / trigamma: recurrence up to x >= 10, then the asymptotic series.
// R counterparts: base::lgamma, base::digamma, base::trigamma.

const LANCZOS_G = 7;
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];
const HALF_LOG_2PI = 0.5 * Math.log(2 * Math.PI);

/** log Gamma(x) for x > 0. */
export function lgamma(x: number): number {
  if (!(x > 0)) return Number.NaN;
  if (x < 0.5) return lgamma(x + 1) - Math.log(x);
  const z = x - 1;
  let series = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i += 1) series += LANCZOS[i] / (z + i);
  const t = z + LANCZOS_G + 0.5;
  return HALF_LOG_2PI + (z + 0.5) * Math.log(t) - t + Math.log(series);
}

// Asymptotic threshold for the digamma / trigamma series (truncation error < 1e-16 at 10).
const ASYMPTOTIC_X = 10;

/** digamma psi(x) for x > 0. */
export function digamma(x: number): number {
  if (!(x > 0)) return Number.NaN;
  let shift = 0;
  let v = x;
  while (v < ASYMPTOTIC_X) {
    shift -= 1 / v;
    v += 1;
  }
  const inv = 1 / v;
  const inv2 = inv * inv;
  // psi(v) ~ log v - 1/(2v) - sum_k B_2k / (2k v^2k)
  const series =
    inv2 * (1 / 12 - inv2 * (1 / 120 - inv2 * (1 / 252 - inv2 * (1 / 240 - inv2 * (1 / 132 - inv2 * (691 / 32760 - inv2 / 12))))));
  return shift + Math.log(v) - 0.5 * inv - series;
}

/** trigamma psi'(x) for x > 0. */
export function trigamma(x: number): number {
  if (!(x > 0)) return Number.NaN;
  let shift = 0;
  let v = x;
  while (v < ASYMPTOTIC_X) {
    shift += 1 / (v * v);
    v += 1;
  }
  const inv = 1 / v;
  const inv2 = inv * inv;
  // psi'(v) ~ 1/v + 1/(2v^2) + sum_k B_2k / v^(2k+1)
  const series =
    inv * (1 + inv * (0.5 + inv * (1 / 6 - inv2 * (1 / 30 - inv2 * (1 / 42 - inv2 * (1 / 30 - inv2 * (5 / 66 - inv2 * (691 / 2730 - inv2 * (7 / 6)))))))));
  return shift + series;
}

/** log(exp(a) + exp(b)) without overflow. */
export function logAddExp(a: number, b: number): number {
  if (a === Number.NEGATIVE_INFINITY) return b;
  if (b === Number.NEGATIVE_INFINITY) return a;
  const m = Math.max(a, b);
  return m + Math.log1p(Math.exp(-Math.abs(a - b)));
}

/** log(sum(exp(xs))) over a numeric array. */
export function logSumExp(xs: ArrayLike<number>): number {
  let m = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < xs.length; i += 1) if (xs[i] > m) m = xs[i];
  if (m === Number.NEGATIVE_INFINITY || m === Number.POSITIVE_INFINITY) return m;
  let s = 0;
  for (let i = 0; i < xs.length; i += 1) s += Math.exp(xs[i] - m);
  return m + Math.log(s);
}

/** log of the rising factorial alpha (alpha + 1) ... (alpha + J - 1) = lgamma(alpha + J) - lgamma(alpha). */
export function logRising(alpha: number, J: number): number {
  return lgamma(alpha + J) - lgamma(alpha);
}
