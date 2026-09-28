/** Largest w at which densities are evaluated (CONTRACT.md section 6). */
export declare const W_DENSITY_MAX: number;
/** Majority-mass threshold used throughout the paper. */
export declare const MAJORITY_T = 0.5;
/** Pr(W_SB > t | a, b) = (b / (b + c_t))^a. */
export declare function wsbTail(t: number, a: number, b: number): number;
/** Pr(W_SB > t | alpha) = (1 - t)^alpha. */
export declare function wsbTailGivenAlpha(t: number, alpha: number): number;
/** Density of W_SB under Gamma(a, b): a b^a / ((1 - w) (b + c)^(a + 1)), c = -log(1 - w). */
export declare function wsbDensity(w: number, a: number, b: number): number;
/** Pr(W_SB <= w | a, b). */
export declare function wsbCdf(w: number, a: number, b: number): number;
/** Quantile of W_SB: solves 1 - (b / (b + c))^a = u in closed form. */
export declare function wsbQuantile(u: number, a: number, b: number): number;
export interface WmaxBounds {
    lower: number;
    upper: number;
}
/** Prop. 1 bounds: S(t) <= Pr(W_max > t) <= min(1, S(t) / t). */
export declare function wmaxBounds(t: number, a: number, b: number): WmaxBounds;
/** Pr(W_max > t | a, b) for t >= 1/2 (exact); NaN below 1/2 (use wmaxBounds). */
export declare function wmaxTail(t: number, a: number, b: number): number;
/** Pr(W_max > t | alpha) for t >= 1/2 (exact); NaN below 1/2. */
export declare function wmaxTailGivenAlpha(t: number, alpha: number): number;
/** E(rho | alpha) = E(W_SB | alpha) = 1 / (1 + alpha). */
export declare function meanRhoGivenAlpha(alpha: number): number;
/** Var(rho | alpha) = 2 alpha / ((alpha + 1)^2 (alpha + 2) (alpha + 3)). */
export declare function varRhoGivenAlpha(alpha: number): number;
/** E(rho | a, b) = E[1 / (1 + alpha)] under Gamma(a, b). */
export declare function meanRho(a: number, b: number): number;
