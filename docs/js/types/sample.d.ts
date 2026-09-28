export interface Rng {
    /** uniform on [0, 1) */
    next(): number;
    seed: number;
}
/** mulberry32 seeded generator. */
export declare function makeRng(seed: number): Rng;
/** standard normal (Marsaglia polar method) */
export declare function rnorm(rng: Rng): number;
/** Gamma(shape, rate = 1) */
export declare function rgamma(rng: Rng, shape: number): number;
/**
 * log of a Gamma(shape, 1) draw, consuming the same random numbers as rgamma, so that
 * shapes far below 1 (U^(1/shape) underflows for shape ~ 0.001) stay finite on the log scale.
 */
export declare function lrgamma(rng: Rng, shape: number): number;
/** Beta(a, b) */
export declare function rbeta(rng: Rng, a: number, b: number): number;
/** Beta(1, alpha) by inversion */
export declare function rbeta1(rng: Rng, alpha: number): number;
/** Dirichlet(alphas), normalised on the log scale (finite for alphas down to ~1e-3 and K in the thousands). */
export declare function rdirichlet(rng: Rng, alphas: ArrayLike<number>): number[];
export declare const GEM_EPS = 0.001;
export interface GemDraw {
    alpha: number;
    /** stick proportions V_k ~ Beta(1, alpha) */
    v: number[];
    /** weights w_k = V_k prod_{j<k} (1 - V_j), in the order they were broken off (size-biased) */
    w: number[];
    /** mass left when breaking stopped (< eps), shown as one grey piece */
    rest: number;
}
/** GEM(alpha) stick-breaking, truncated when the remaining mass is below eps. */
export declare function rgem(rng: Rng, alpha: number, eps?: number): GemDraw;
export interface CrpStep {
    /** customer number, 1-based */
    n: number;
    /** table index chosen (0-based) */
    table: number;
    isNew: boolean;
    /** probabilities of each existing table, then the new-table probability (last entry) */
    probs: number[];
}
/** Chinese restaurant process: customer n sits at table k w.p. n_k/(alpha + n - 1), new w.p. alpha/(alpha + n - 1). */
export declare class Crp {
    readonly alpha: number;
    counts: number[];
    n: number;
    private rng;
    constructor(alpha: number, rng: Rng);
    /** probabilities for the next customer (existing tables, then new) */
    nextProbs(): number[];
    seat(): CrpStep;
    /** number of occupied tables K_n */
    get tables(): number;
}
/** Seat J customers and return the occupied-table count K_J. */
export declare function rcrpTables(rng: Rng, alpha: number, J: number): number;
