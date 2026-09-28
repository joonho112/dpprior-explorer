export type Confidence = "high" | "medium" | "low";
export declare const VIF_BY_CONFIDENCE: Record<Confidence, number>;
/** sigma_K^2 = VIF (mu_K - 1). */
export declare function vifToVariance(muK: number, vif: number): number;
/** sigma_K^2 from a confidence label. */
export declare function confidenceToVariance(muK: number, confidence: Confidence): number;
/** sigma_K^2 = (CV_K mu_K)^2 with CV_K = sigma_K / mu_K. */
export declare function cvToVariance(muK: number, cvK: number): number;
/** Standard normal quantile (Wichura, AS 241, PPND16; about 16 digits). */
export declare function qnorm(p: number): number;
export interface CountMoments {
    muK: number;
    varK: number;
    z?: number;
}
/** Normal-proxy conversion of "K in [lo, hi] with probability coverage" (mu_K = midpoint unless given). */
export declare function intervalToMoments(lo: number, hi: number, coverage: number, muK?: number): CountMoments;
export interface Feasibility {
    /** 1 < mu_K < J */
    meanOk: boolean;
    /** 0 < sigma_K^2 < (mu_K - 1)(J - mu_K): the largest variance on {1..J} with that mean is reached only by the two-point law on {1, J} */
    supportOk: boolean;
    supportUpper: number;
    /** the profile bound v_J(alpha*): no Gamma prior with E K_J = mu_K has Var K_J at or below it */
    minVar: number;
    alphaStar: number;
    /** minVar < sigma_K^2: some Gamma(a, b) has exactly this mean and variance */
    feasible: boolean;
    /** sigma_K^2 > mu_K - 1: the A1 closed-form start exists (otherwise TSMM starts from a projected point; the prior can still exist) */
    a1Ok: boolean;
    /** meanOk and supportOk and feasible */
    ok: boolean;
    /** why the target fails ("" when ok) */
    message: string;
    /** a remark for a feasible target ("" when there is none) */
    note: string;
}
/** Checks a count target before calibration: the support of K_J and the profile bound decide; A1 does not. */
export declare function checkTarget(J: number, muK: number, varK: number): Feasibility;
export interface A1Start {
    a0: number;
    b0: number;
    ok: boolean;
}
/** Stage 1 initialiser (shifted NB proxy, log J scaling). */
export declare function a1Init(J: number, muK: number, varK: number): A1Start;
