// Elicitation inputs -> count moments (mu_K, sigma_K^2), feasibility checks, and the
// Stage 1 (A1) initialiser of TSMM.
//
// Paper, Sec. 3.2: an interval [k_L, k_U] with probability q gives
//   sigma_K ~ (k_U - k_L) / (2 z_{(1+q)/2}),  mu_K = midpoint unless stated;
// a confidence label gives sigma_K^2 = VIF (mu_K - 1) with VIF high 1.5 / medium 2.5 / low 5;
// a coefficient of variation gives sigma_K^2 = (CV_K mu_K)^2.
// Stage 1 (shifted negative-binomial proxy, m = mu_K - 1, D = sigma_K^2 - m > 0):
//   a0 = m^2 / D,  b0 = m log(J) / D.
// R counterparts: DPprior_a1 (scaling = "log"), vif_to_variance, confidence_to_vif.

import { profileBound, supportUpperVariance } from "./count.ts";

export type Confidence = "high" | "medium" | "low";

export const VIF_BY_CONFIDENCE: Record<Confidence, number> = { high: 1.5, medium: 2.5, low: 5 };

/** sigma_K^2 = VIF (mu_K - 1). */
export function vifToVariance(muK: number, vif: number): number {
  return vif * (muK - 1);
}

/** sigma_K^2 from a confidence label. */
export function confidenceToVariance(muK: number, confidence: Confidence): number {
  return vifToVariance(muK, VIF_BY_CONFIDENCE[confidence]);
}

/** sigma_K^2 = (CV_K mu_K)^2 with CV_K = sigma_K / mu_K. */
export function cvToVariance(muK: number, cvK: number): number {
  return (cvK * muK) ** 2;
}

/** Standard normal quantile (Wichura, AS 241, PPND16; about 16 digits). */
export function qnorm(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return Number.POSITIVE_INFINITY;
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return (
      (q *
        (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r +
          45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r +
          133.14166789178437745) * r + 3.387132872796366608)) /
      (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r +
        21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r +
        42.313330701600911252) * r + 1)
    );
  }
  let r = Math.sqrt(-Math.log(q < 0 ? p : 1 - p));
  let val: number;
  if (r <= 5) {
    r -= 1.6;
    val =
      (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r +
        1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r +
        4.6303378461565452959) * r + 1.42343711074968357734) /
      (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r +
        0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r +
        2.05319162663775882187) * r + 1);
  } else {
    r -= 5;
    val =
      (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r +
        0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r +
        5.4637849111641143699) * r + 6.6579046435011037772) /
      (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r +
        7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r +
        0.59983220655588793769) * r + 1);
  }
  return q < 0 ? -val : val;
}

export interface CountMoments {
  muK: number;
  varK: number;
  z?: number;
}

/** Normal-proxy conversion of "K in [lo, hi] with probability coverage" (mu_K = midpoint unless given). */
export function intervalToMoments(lo: number, hi: number, coverage: number, muK?: number): CountMoments {
  const z = qnorm((1 + coverage) / 2);
  const sd = (hi - lo) / (2 * z);
  return { muK: muK ?? (lo + hi) / 2, varK: sd * sd, z };
}

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
export function checkTarget(J: number, muK: number, varK: number): Feasibility {
  const meanOk = muK > 1 && muK < J;
  const supportUpper = supportUpperVariance(J, muK);
  const supportOk = meanOk && varK > 0 && varK < supportUpper;
  const { alphaStar, minVar } = meanOk ? profileBound(J, muK) : { alphaStar: Number.NaN, minVar: Number.NaN };
  const feasible = supportOk && varK > minVar;
  const a1Ok = varK > muK - 1;
  let message = "";
  if (!meanOk) message = `The expected count must lie strictly between 1 and J = ${J}.`;
  else if (!(varK > 0)) message = "The variance must be positive.";
  else if (!supportOk)
    message = `A variance of ${varK.toFixed(2)} is impossible for a count on 1..${J} with mean ${muK.toFixed(2)}: it must stay below (mu_K - 1)(J - mu_K) = ${supportUpper.toFixed(2)}.`;
  else if (!feasible)
    message = `The variance is at or below ${minVar.toFixed(3)}, the smallest variance of K_${J} that any Gamma prior with mean ${muK.toFixed(2)} can give (the point mass alpha* = ${alphaStar.toFixed(3)}). Widen the interval or lower its coverage.`;
  const note = feasible && !a1Ok
    ? `The variance is at or below mu_K - 1 = ${(muK - 1).toFixed(2)}, so the A1 closed-form start does not exist; TSMM starts from a projected point and still reaches a Gamma prior.`
    : "";
  return { meanOk, supportOk, supportUpper, minVar, alphaStar, feasible, a1Ok, ok: meanOk && supportOk && feasible, message, note };
}

export interface A1Start {
  a0: number;
  b0: number;
  ok: boolean;
}

/** Stage 1 initialiser (shifted NB proxy, log J scaling). */
export function a1Init(J: number, muK: number, varK: number): A1Start {
  const m = muK - 1;
  const D = varK - m;
  if (!(m > 0) || !(D > 0)) return { a0: Number.NaN, b0: Number.NaN, ok: false };
  return { a0: (m * m) / D, b0: (m * Math.log(J)) / D, ok: true };
}
