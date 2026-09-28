export interface SolverResult {
    a: number;
    b: number;
    converged: boolean;
    iterations: number;
}
export declare const SSI_TARGETS: {
    t1: number;
    p1: number;
    t2: number;
    p2: number;
};
export declare function ssiSolve(p1?: number, p2?: number, t1?: number, t2?: number): SolverResult & {
    achieved: [number, number];
};
/**
 * Node factor of the alpha grid while a solver searches (the final values use the full grid).
 * The log-alpha trapezoid converges spectrally: a quarter of the nodes changes the pmf by
 * less than 1e-13 at the DORO, SCAL and shortcut solutions.
 */
export declare const SEARCH_NODE_FACTOR = 0.25;
/** Dorazio (2009), Table 1: KL solutions for a uniform target on {1, ..., n}; used as warm starts. */
export declare const DORAZIO_TABLE: Record<number, [number, number]>;
/** KL(target || induced) for a uniform target on {1, ..., top} over J units, and the mass outside it. */
export declare function doroDivergence(J: number, top: number, a: number, b: number, nodeFactor?: number): {
    kl: number;
    leak: number;
};
export interface DoroOptions {
    /** number of units; defaults to n (classic DORO) */
    J?: number;
    /** DORO-Unif: target uniform on {1, ..., min(2 muK - 1, J)} */
    muK?: number;
    /** warm start (a, b); defaults to Dorazio's table */
    start?: [number, number];
}
export declare function doroKL(n: number, opts?: DoroOptions): SolverResult & {
    kl: number;
    leak: number;
    top: number;
    J: number;
};
export declare const SCAL_TARGETS: {
    pOne: number;
    pTail: number;
};
export declare const SCAL_SHORTCUT_RATE = 0.033;
/** The SCAL tail threshold ceil(2 ln m). */
export declare const scalTailK: (m: number) => number;
/** P(K_m = 1) and P(K_m >= ceil(2 ln m)) under Gamma(a, b). */
export declare function scalTails(m: number, a: number, b: number, nodeFactor?: number): {
    pOne: number;
    pTail: number;
    q: number;
};
export declare function scalSolve(m: number, targets?: {
    pOne: number;
    pTail: number;
}, start?: [number, number]): SolverResult & {
    pOne: number;
    pTail: number;
    q: number;
};
/** The SCAL shortcut a = b = exp(-0.033 m) and what it implies for m units. */
export declare function scalShortcut(m: number): {
    a: number;
    b: number;
    pOne: number;
    pTail: number;
    q: number;
    mean: number;
};
