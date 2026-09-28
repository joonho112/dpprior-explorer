/** Live marginal pmf / quantile cap (CONTRACT.md section 6). */
export declare const LIVE_J_MAX = 500;
/** Conditional moments use finite sums up to this J; above it, digamma/trigamma when alpha <= J and finite sums when alpha > J. */
export declare const FINITE_SUM_J_MAX = 200;
/** log|s(J, k)| for k = 0..J (index = k). Cached for J <= 500; computed on demand above. */
export declare function logStirlingRow(J: number): Float64Array;
/** Antoniak pmf by the log-Stirling route; index = k, pmf[0] = 0. */
export declare function condPmf(J: number, alpha: number): Float64Array;
/**
 * Same pmf as a convolution of independent Bernoulli(alpha / (alpha + i - 1)),
 * i = 1..J (unit i opens a new table with that probability). O(J^2); used as an
 * independent check of condPmf and for J > 500 where no Stirling cache exists.
 */
export declare function condPmfConvolution(J: number, alpha: number): Float64Array;
/** E(K_J | alpha) by the finite sum sum_{i=1}^J alpha / (alpha + i - 1). */
export declare function condMeanSum(J: number, alpha: number): number;
/** Var(K_J | alpha) by the finite sum sum_{r=1}^{J-1} alpha r / (alpha + r)^2. */
export declare function condVarSum(J: number, alpha: number): number;
/** E(K_J | alpha) = alpha (psi(alpha + J) - psi(alpha)). */
export declare function condMeanDigamma(J: number, alpha: number): number;
/** Var(K_J | alpha) = kappa - alpha^2 (psi'(alpha) - psi'(alpha + J)). */
export declare function condVarDigamma(J: number, alpha: number): number;
/** E(K_J | alpha): finite sum for J <= 200 or alpha > J, digamma path otherwise. */
export declare function condMean(J: number, alpha: number): number;
/** Var(K_J | alpha): finite sum for J <= 200 or alpha > J, digamma/trigamma path otherwise. */
export declare function condVar(J: number, alpha: number): number;
/**
 * The profile bound at (J, mu_K): alpha* with E(K_J | alpha*) = mu_K (bisection on log alpha)
 * and v_J(alpha*) = Var(K_J | alpha*). Every Gamma prior with E K_J = mu_K has Var K_J above
 * v_J(alpha*) (the point-mass limit), and every variance above it is reached by some Gamma prior.
 */
export declare function profileBound(J: number, muK: number): {
    alphaStar: number;
    minVar: number;
};
/** Largest variance of a count on {1, ..., J} with mean mu_K (Bhatia-Davis); only the two-point law on {1, J} attains it. */
export declare const supportUpperVariance: (J: number, muK: number) => number;
/** min k with cdf(k) >= p. */
export declare function pmfQuantile(pmf: ArrayLike<number>, p: number): number;
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
export declare function pmfSummary(pmf: ArrayLike<number>): PmfSummary;
