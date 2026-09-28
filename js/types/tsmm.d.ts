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
    achieved: {
        M1: number;
        V: number;
    };
    /** "newton", "profile" (near the profile bound) or "none" */
    method: "newton" | "profile" | "none";
    start: {
        a0: number;
        b0: number;
        projected: boolean;
    };
}
export interface TsmmOptions {
    maxIter?: number;
    /** convergence tolerance on |F| */
    tolF?: number;
    /** override the A1 start (a0, b0) */
    start?: [number, number];
}
/** Largest variance of K_J on {1, ..., J} over all means (the support ceiling at mu_K = (J + 1) / 2). */
export declare const maxCountVariance: (J: number) => number;
/** M1, V and their derivatives in (log a, log b), in one pass over the alpha grid. */
export declare function tsmmMoments(J: number, a: number, b: number): {
    M1: number;
    V: number;
    jac: null | [[number, number], [number, number]];
};
/** TSMM: the Gamma(a, b) whose K_J has mean mu_K and variance sigma^2. */
export declare function tsmmFit(J: number, muK: number, varK: number, opts?: TsmmOptions): TsmmResult;
