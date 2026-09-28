// Display precision (CONTRACT.md section 6). Digit counts live here and nowhere else.
//   probabilities   .591   (3 decimals, no leading zero)
//   expected counts 4.16   (2 decimals)
//   Gamma(a, b)     (1.4082, 1.0770) when quoting the paper, else 3 significant digits

/** Fixed decimals; values below 1 in magnitude drop the leading zero (".591"). */
export function fmt(x, digits) {
  if (!Number.isFinite(x)) return "–";
  const s = Math.abs(x).toFixed(digits);
  const body = Math.abs(x) < 1 && digits > 0 ? s.replace(/^0(?=\.)/, "") : s;
  return (x < 0 && Number(s) !== 0 ? "-" : "") + body;
}

/** Probability: 3 decimals, no leading zero; "<.001" and ">.999" at the extremes. */
export function fmtProb(p) {
  if (p > 0 && p < 0.0005) return "<.001";
  if (p < 1 && p > 0.9995) return ">.999";
  return fmt(p, 3);
}

/** A concentration value: keeps the leading zero ("0.50", "2.00", "100"). */
export const fmtAlpha = (a) => (Number.isFinite(a) ? (a >= 100 ? a.toFixed(0) : a.toFixed(2)) : "–");

/** Expected count: 2 decimals (with the leading zero kept for counts). */
export const fmtCount = (k) => (Number.isFinite(k) ? k.toFixed(2) : "–");

/** Percentage with one decimal ("1.3%"). */
export const fmtPct = (p, digits = 1) => (Number.isFinite(p) ? `${(100 * p).toFixed(digits)}%` : "–");

/** A Gamma parameter: 3 significant digits, scientific for point-mass solutions. */
export function fmtParam(x) {
  if (!Number.isFinite(x)) return "–";
  if (Math.abs(x) >= 1e4) return x.toExponential(2).replace("e+", "e");
  return Number(x.toPrecision(3)).toString();
}

/** "Gamma(1.60, 1.22)"; `digits` fixes decimals when quoting the paper. */
export function fmtGamma(a, b, digits) {
  if (digits === undefined) return `Gamma(${fmtParam(a)}, ${fmtParam(b)})`;
  return `Gamma(${a.toFixed(digits)}, ${b.toFixed(digits)})`;
}

/** Integer interval "[1, 11]". */
export const fmtInterval = (lo, hi) => `[${lo}, ${hi}]`;
