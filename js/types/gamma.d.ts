/** log density of Gamma(shape a, rate b) at x > 0. */
export declare function dgammaLog(x: number, a: number, b: number): number;
/** Regularised lower incomplete gamma P(a, x). */
export declare function gammp(a: number, x: number): number;
/** Regularised upper incomplete gamma Q(a, x) = 1 - P(a, x). */
export declare function gammq(a: number, x: number): number;
/** Pr(alpha <= t) for alpha ~ Gamma(a, b). */
export declare function pgamma(t: number, a: number, b: number): number;
/** Pr(alpha > t) for alpha ~ Gamma(a, b). */
export declare function pgammaUpper(t: number, a: number, b: number): number;
/** Quantile of Gamma(a, b): the t with Pr(alpha <= t) = p. */
export declare function qgamma(p: number, a: number, b: number): number;
