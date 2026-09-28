import { type PmfSummary } from "./count.ts";
/** Above this shape CV(alpha) = 1 / sqrt(a) < .01: the site describes the prior as (nearly) a point mass. */
export declare const POINT_MASS_A = 10000;
/** From this shape on the Gamma is treated as a true point mass at a / b. */
export declare const DEGENERATE_A = 1000000000000000;
export declare const ALPHA_FLOOR = 1e-12;
export declare const MIN_NODES = 400;
export declare const NODE_SPACING = 0.02;
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
export declare function alphaGrid(a: number, b: number, nodeFactor?: number): AlphaGrid;
/** e^u - 1 - u without cancellation (a series near 0). */
export declare function expm1MinusU(u: number): number;
/** log(a) - psi(a) for large a (the asymptotic series; exact enough for a > 1e4). */
export declare function logMinusDigamma(a: number): number;
/**
 * Grid for a concentrated Gamma(a, b), a > POINT_MASS_A: u = log(alpha b / a) has density
 * proportional to exp(-a (e^u - 1 - u)), mean -(log a - psi(a)) and sd sqrt(psi'(a)); the
 * trapezoid rule over +/- CONC_SD sd is exact to rounding for smooth h, and the weights are
 * normalised so that E[1] = 1 exactly.
 */
export declare function concentratedGrid(a: number, b: number, nodeFactor?: number): AlphaGrid;
/** E[h(alpha)] with h(0+) = h0 for the mass below the floor. */
export declare function mixExpect(grid: AlphaGrid, h: (alpha: number) => number, h0: number): number;
export interface Moments {
    mean: number;
    var: number;
    sd: number;
}
/** Marginal E(K_J) and Var(K_J) under Gamma(a, b); any J (digamma path above 200). */
export declare function mixMoments(J: number, a: number, b: number, grid?: AlphaGrid): Moments;
/** Marginal pmf of K_J under Gamma(a, b), index = k (pmf[0] = 0). Intended for J <= 500. */
export declare function mixPmf(J: number, a: number, b: number, grid?: AlphaGrid): Float64Array;
/** pmf summary plus Pr(alpha < 0.1) (Table 2 of the paper). */
export declare function mixSummary(J: number, a: number, b: number): PmfSummary & {
    prAlphaBelow01: number;
};
/**
 * Pr(alpha < t) under Gamma(a, b). Above POINT_MASS_A the incomplete-gamma series is slow, so
 * the Wilson-Hilferty normal approximation of (b alpha / a)^(1/3) is used (error O(1/a));
 * a true point mass (a >= DEGENERATE_A) gives 0 or 1.
 */
export declare function prAlphaBelow(t: number, a: number, b: number): number;
/**
 * Prior collapse P(K_J = 1) under Gamma(a, b) for any J, without the pmf:
 * E[Gamma(alpha + 1) Gamma(J) / Gamma(alpha + J)], whose alpha -> 0 limit is 1. There is
 * no live cap (M-07 uses it up to J = 5000); parity against the golden p_K1 column.
 */
export declare function mixPK1(J: number, a: number, b: number, grid?: AlphaGrid): number;
