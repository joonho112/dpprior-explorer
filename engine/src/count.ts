// The count lens: K_J = number of occupied components among J units, given alpha.
//
// pmf arrays are indexed by count: pmf[k] = P(K_J = k), length J + 1, pmf[0] = 0
// (CONTRACT.md section 6). R counterparts (DPprior 2.0.0): compute_log_stirling,
// pmf_K_given_alpha, mean_K_given_alpha, var_K_given_alpha, log_rising_factorial.

import { digamma, logAddExp, logSumExp, trigamma } from "./special.ts";

/** Live marginal pmf / quantile cap (CONTRACT.md section 6). */
export const LIVE_J_MAX = 500;
/** Conditional moments use finite sums up to this J; above it, digamma/trigamma when alpha <= J and finite sums when alpha > J. */
export const FINITE_SUM_J_MAX = 200;
// Slack for "min k with cdf >= p" so cumulative rounding never skips a count;
// the R golden uses the same slack.
const CDF_SLACK = 1e-12;

// ---------------------------------------------------------------------------
// log |s(J, k)|, unsigned Stirling numbers of the first kind
// ---------------------------------------------------------------------------

// rows[n][k] = log|s(n, k)|, k = 0..n. Rows up to LIVE_J_MAX are cached.
const rows: Float64Array[] = [Float64Array.of(0)];

function nextRow(prev: Float64Array, n: number): Float64Array {
  // |s(n + 1, k)| = n |s(n, k)| + |s(n, k - 1)|
  const row = new Float64Array(n + 2);
  row[0] = Number.NEGATIVE_INFINITY;
  const logN = n > 0 ? Math.log(n) : Number.NEGATIVE_INFINITY;
  for (let k = 1; k <= n; k += 1) row[k] = logAddExp(prev[k - 1], logN + prev[k]);
  row[n + 1] = 0;
  return row;
}

/** log|s(J, k)| for k = 0..J (index = k). Cached for J <= 500; computed on demand above. */
export function logStirlingRow(J: number): Float64Array {
  if (!Number.isInteger(J) || J < 0) throw new RangeError(`J must be a non-negative integer, got ${J}`);
  const cachedTop = Math.min(J, LIVE_J_MAX);
  while (rows.length <= cachedTop) rows.push(nextRow(rows[rows.length - 1], rows.length - 1));
  if (J <= LIVE_J_MAX) return rows[J];
  let row = rows[LIVE_J_MAX];
  for (let n = LIVE_J_MAX; n < J; n += 1) row = nextRow(row, n);
  return row;
}

// ---------------------------------------------------------------------------
// conditional pmf P(K_J = k | alpha)
// ---------------------------------------------------------------------------

/** Antoniak pmf by the log-Stirling route; index = k, pmf[0] = 0. */
export function condPmf(J: number, alpha: number): Float64Array {
  const L = logStirlingRow(J);
  const logAlpha = Math.log(alpha);
  const w = new Float64Array(J);
  for (let k = 1; k <= J; k += 1) w[k - 1] = L[k] + k * logAlpha;
  const norm = logSumExp(w);
  const pmf = new Float64Array(J + 1);
  for (let k = 1; k <= J; k += 1) pmf[k] = Math.exp(w[k - 1] - norm);
  return pmf;
}

/**
 * Same pmf as a convolution of independent Bernoulli(alpha / (alpha + i - 1)),
 * i = 1..J (unit i opens a new table with that probability). O(J^2); used as an
 * independent check of condPmf and for J > 500 where no Stirling cache exists.
 */
export function condPmfConvolution(J: number, alpha: number): Float64Array {
  let pmf = new Float64Array(J + 1);
  pmf[1] = 1; // the first unit always opens a table
  for (let i = 2; i <= J; i += 1) {
    const q = alpha / (alpha + i - 1);
    const next = new Float64Array(J + 1);
    for (let k = 1; k <= i; k += 1) next[k] = pmf[k] * (1 - q) + pmf[k - 1] * q;
    pmf = next;
  }
  return pmf;
}

// ---------------------------------------------------------------------------
// conditional moments
// ---------------------------------------------------------------------------

/** E(K_J | alpha) by the finite sum sum_{i=1}^J alpha / (alpha + i - 1). */
export function condMeanSum(J: number, alpha: number): number {
  if (J === 1) return 1;
  let s = 0;
  if (alpha <= J) {
    for (let r = 1; r < J; r += 1) s += alpha / (alpha + r);
    return 1 + s;
  }
  // large alpha: subtract the small deficits from J (R's branch)
  for (let r = 1; r < J; r += 1) s += r / (alpha + r);
  return J - s;
}

/** Var(K_J | alpha) by the finite sum sum_{r=1}^{J-1} alpha r / (alpha + r)^2. */
export function condVarSum(J: number, alpha: number): number {
  let s = 0;
  for (let r = 1; r < J; r += 1) {
    const x = alpha <= r ? alpha / r : r / alpha;
    s += x / ((1 + x) * (1 + x));
  }
  return s;
}

/** E(K_J | alpha) = alpha (psi(alpha + J) - psi(alpha)). */
export function condMeanDigamma(J: number, alpha: number): number {
  return alpha * (digamma(alpha + J) - digamma(alpha));
}

/** Var(K_J | alpha) = kappa - alpha^2 (psi'(alpha) - psi'(alpha + J)). */
export function condVarDigamma(J: number, alpha: number): number {
  return condMeanDigamma(J, alpha) - alpha * alpha * (trigamma(alpha) - trigamma(alpha + J));
}

/**
 * The digamma/trigamma path is used only for J > 200 and alpha <= J. For alpha > J the
 * difference psi(alpha + J) - psi(alpha) cancels (at J = 201, alpha = 1e12 it gave E > J), while
 * the finite sums have positive terms; their cost is O(J) per call.
 */
const useSums = (J: number, alpha: number) => J <= FINITE_SUM_J_MAX || alpha > J;

/** E(K_J | alpha): finite sum for J <= 200 or alpha > J, digamma path otherwise. */
export function condMean(J: number, alpha: number): number {
  return useSums(J, alpha) ? condMeanSum(J, alpha) : condMeanDigamma(J, alpha);
}

/** Var(K_J | alpha): finite sum for J <= 200 or alpha > J, digamma/trigamma path otherwise. */
export function condVar(J: number, alpha: number): number {
  return useSums(J, alpha) ? condVarSum(J, alpha) : condVarDigamma(J, alpha);
}

/**
 * The profile bound at (J, mu_K): alpha* with E(K_J | alpha*) = mu_K (bisection on log alpha)
 * and v_J(alpha*) = Var(K_J | alpha*). Every Gamma prior with E K_J = mu_K has Var K_J above
 * v_J(alpha*) (the point-mass limit), and every variance above it is reached by some Gamma prior.
 */
export function profileBound(J: number, muK: number): { alphaStar: number; minVar: number } {
  let lo = -30;
  let hi = 30;
  for (let i = 0; i < 200 && hi - lo > 1e-13; i += 1) {
    const mid = (lo + hi) / 2;
    if (condMean(J, Math.exp(mid)) < muK) lo = mid;
    else hi = mid;
  }
  const alphaStar = Math.exp((lo + hi) / 2);
  return { alphaStar, minVar: condVar(J, alphaStar) };
}

/** Largest variance of a count on {1, ..., J} with mean mu_K (Bhatia-Davis); only the two-point law on {1, J} attains it. */
export const supportUpperVariance = (J: number, muK: number) => (muK - 1) * (J - muK);

// ---------------------------------------------------------------------------
// summaries of a count pmf (index = k)
// ---------------------------------------------------------------------------

/** min k with cdf(k) >= p. */
export function pmfQuantile(pmf: ArrayLike<number>, p: number): number {
  let c = 0;
  for (let k = 1; k < pmf.length; k += 1) {
    c += pmf[k];
    if (c >= p - CDF_SLACK) return k;
  }
  return pmf.length - 1;
}

export interface PmfSummary {
  mean: number;
  var: number;
  sd: number;
  mode: number;
  median: number;
  q05: number;
  q95: number;
  pK1: number;
}

/** Mean, variance, mode, median and the 90% interval [q05, q95] of a count pmf. */
export function pmfSummary(pmf: ArrayLike<number>): PmfSummary {
  let m1 = 0;
  let m2 = 0;
  let mode = 1;
  for (let k = 1; k < pmf.length; k += 1) {
    m1 += k * pmf[k];
    m2 += k * k * pmf[k];
    if (pmf[k] > pmf[mode]) mode = k;
  }
  const v = Math.max(0, m2 - m1 * m1);
  return {
    mean: m1,
    var: v,
    sd: Math.sqrt(v),
    mode,
    median: pmfQuantile(pmf, 0.5),
    q05: pmfQuantile(pmf, 0.05),
    q95: pmfQuantile(pmf, 0.95),
    pK1: pmf[1],
  };
}
