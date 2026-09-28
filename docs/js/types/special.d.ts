/** log Gamma(x) for x > 0. */
export declare function lgamma(x: number): number;
/** digamma psi(x) for x > 0. */
export declare function digamma(x: number): number;
/** trigamma psi'(x) for x > 0. */
export declare function trigamma(x: number): number;
/** log(exp(a) + exp(b)) without overflow. */
export declare function logAddExp(a: number, b: number): number;
/** log(sum(exp(xs))) over a numeric array. */
export declare function logSumExp(xs: ArrayLike<number>): number;
/** log of the rising factorial alpha (alpha + 1) ... (alpha + J - 1) = lgamma(alpha + J) - lgamma(alpha). */
export declare function logRising(alpha: number, J: number): number;
