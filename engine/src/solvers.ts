// Solvers for published hyperprior rules (Phase 7): what each rule's Gamma(a, b) is, so the
// widgets can show what it implies. Golden values: verification/golden/solvers.csv
// (r-export/05_golden_v2_solvers.R, DPprior 2.0.0 + the replication package's SSI solver).
//
//   ssiSolve      SSI-Weight: Pr(W_SB > t1) = p1 and Pr(W_SB > t2) = p2 (default .25 at .5 and
//                 .05 at .9). The ratio of the log tails fixes b (bisection on log b); a follows.
//   doroKL        Dorazio (2009): the Gamma(a, b) closest in KL(target || induced) to a uniform
//                 count target on {1, ..., top} (top = n; DORO-Unif: top = 2 mu_K - 1 at J units),
//                 Nelder-Mead on (log a, log b) in [-15, 15], started from Dorazio's table.
//   scalSolve     Murugiah & Sweeting (2012): P(K_m = 1) = .34 and P(K_m >= ceil(2 ln m)) = .15,
//                 Newton on (log a, log b) from (0.5, 0.5); no solution below m = 5 (the targets
//                 then need a point mass, and the result says converged: false).
//   scalShortcut  the shortcut a = b = exp(-0.033 m), which collapses: P(K_100 = 1) = .834.

import { alphaGrid, mixMoments, mixPmf } from "./mixing.ts";
import { wsbTail } from "./weights.ts";

export interface SolverResult {
  a: number;
  b: number;
  converged: boolean;
  iterations: number;
}

// --- SSI-Weight ---------------------------------------------------------------------------------

export const SSI_TARGETS = { t1: 0.5, p1: 0.25, t2: 0.9, p2: 0.05 };

export function ssiSolve(p1 = SSI_TARGETS.p1, p2 = SSI_TARGETS.p2, t1 = SSI_TARGETS.t1, t2 = SSI_TARGETS.t2): SolverResult & { achieved: [number, number] } {
  const d1 = -Math.log1p(-t1);
  const d2 = -Math.log1p(-t2);
  const target = Math.log(p1) / Math.log(p2);
  const ratio = (lb: number) => {
    const b = Math.exp(lb);
    return Math.log(b / (b + d1)) / Math.log(b / (b + d2)) - target;
  };
  // the log-tail ratio falls from 1 (b -> 0) to d1/d2 (b -> infinity)
  let lo = -20;
  let hi = 20;
  let it = 0;
  for (; it < 200 && hi - lo > 1e-14; it += 1) {
    const mid = (lo + hi) / 2;
    if (ratio(mid) > 0) lo = mid; else hi = mid;
  }
  const b = Math.exp((lo + hi) / 2);
  const a = Math.log(p1) / Math.log(b / (b + d1));
  return { a, b, converged: hi - lo <= 1e-12, iterations: it, achieved: [wsbTail(t1, a, b), wsbTail(t2, a, b)] };
}

// --- Nelder-Mead on two variables -----------------------------------------------------------------

function nelderMead(f: (x: number[]) => number, x0: number[], step: number, tol: number, maxIter: number) {
  let simplex = [x0, [x0[0] + step, x0[1]], [x0[0], x0[1] + step]].map((x) => ({ x, v: f(x) }));
  let it = 0;
  for (; it < maxIter; it += 1) {
    simplex.sort((p, q) => p.v - q.v);
    const [best, mid, worst] = simplex;
    if (Math.abs(worst.v - best.v) < tol && Math.hypot(worst.x[0] - best.x[0], worst.x[1] - best.x[1]) < 1e-7) break;
    const c = [(best.x[0] + mid.x[0]) / 2, (best.x[1] + mid.x[1]) / 2];
    const at = (t: number) => [c[0] + t * (worst.x[0] - c[0]), c[1] + t * (worst.x[1] - c[1])];
    const r = { x: at(-1), v: 0 };
    r.v = f(r.x);
    if (r.v < best.v) {
      const e = { x: at(-2), v: 0 };
      e.v = f(e.x);
      simplex[2] = e.v < r.v ? e : r;
    } else if (r.v < mid.v) {
      simplex[2] = r;
    } else {
      const k = { x: at(r.v < worst.v ? -0.5 : 0.5), v: 0 };
      k.v = f(k.x);
      if (k.v < Math.min(r.v, worst.v)) simplex[2] = k;
      else simplex = simplex.map((p, i) => (i === 0 ? p : { x: [(p.x[0] + best.x[0]) / 2, (p.x[1] + best.x[1]) / 2], v: f([(p.x[0] + best.x[0]) / 2, (p.x[1] + best.x[1]) / 2]) }));
    }
  }
  simplex.sort((p, q) => p.v - q.v);
  return { x: simplex[0].x, v: simplex[0].v, iterations: it, converged: it < maxIter };
}

// --- DORO ----------------------------------------------------------------------------------------

/**
 * Node factor of the alpha grid while a solver searches (the final values use the full grid).
 * The log-alpha trapezoid converges spectrally: a quarter of the nodes changes the pmf by
 * less than 1e-13 at the DORO, SCAL and shortcut solutions.
 */
export const SEARCH_NODE_FACTOR = 0.25;

/** Dorazio (2009), Table 1: KL solutions for a uniform target on {1, ..., n}; used as warm starts. */
export const DORAZIO_TABLE: Record<number, [number, number]> = { 10: [0.525, 0.046], 50: [0.467, 0.007] };
const LOG_BOUND = 15;
/** Largest Newton step in (log a, log b). */
const MAX_LOG_STEP = 2;

function doroStart(n: number): [number, number] {
  const keys = Object.keys(DORAZIO_TABLE).map(Number).sort((x, y) => x - y);
  if (DORAZIO_TABLE[n]) return DORAZIO_TABLE[n];
  if (n <= keys[0]) return DORAZIO_TABLE[keys[0]];
  if (n >= keys[keys.length - 1]) return DORAZIO_TABLE[keys[keys.length - 1]];
  // log-log interpolation between the tabulated n
  const hi = keys.find((k) => k > n) as number;
  const lo = keys[keys.indexOf(hi) - 1];
  const w = (Math.log(n) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  const [a0, b0] = DORAZIO_TABLE[lo];
  const [a1, b1] = DORAZIO_TABLE[hi];
  return [Math.exp((1 - w) * Math.log(a0) + w * Math.log(a1)), Math.exp((1 - w) * Math.log(b0) + w * Math.log(b1))];
}

/** KL(target || induced) for a uniform target on {1, ..., top} over J units, and the mass outside it. */
export function doroDivergence(J: number, top: number, a: number, b: number, nodeFactor = 1): { kl: number; leak: number } {
  const p = mixPmf(J, a, b, alphaGrid(a, b, nodeFactor));
  let kl = 0;
  let inside = 0;
  for (let k = 1; k <= top; k += 1) {
    kl += (1 / top) * Math.log(1 / top / Math.max(p[k], 1e-300));
    inside += p[k];
  }
  return { kl, leak: 1 - inside };
}

export interface DoroOptions {
  /** number of units; defaults to n (classic DORO) */
  J?: number;
  /** DORO-Unif: target uniform on {1, ..., min(2 muK - 1, J)} */
  muK?: number;
  /** warm start (a, b); defaults to Dorazio's table */
  start?: [number, number];
}

export function doroKL(n: number, opts: DoroOptions = {}): SolverResult & { kl: number; leak: number; top: number; J: number } {
  const J = opts.J ?? n;
  const top = opts.muK !== undefined ? Math.min(2 * opts.muK - 1, J) : Math.min(n, J);
  const start = opts.start ?? (opts.muK !== undefined ? ([opts.muK / 2, opts.muK / 2] as [number, number]) : doroStart(n));
  const f = (x: number[]) => {
    const la = Math.max(-LOG_BOUND, Math.min(LOG_BOUND, x[0]));
    const lb = Math.max(-LOG_BOUND, Math.min(LOG_BOUND, x[1]));
    return doroDivergence(J, top, Math.exp(la), Math.exp(lb), SEARCH_NODE_FACTOR).kl;
  };
  const r = nelderMead(f, [Math.log(start[0]), Math.log(start[1])], 0.1, 1e-11, 400);
  const a = Math.exp(Math.max(-LOG_BOUND, Math.min(LOG_BOUND, r.x[0])));
  const b = Math.exp(Math.max(-LOG_BOUND, Math.min(LOG_BOUND, r.x[1])));
  const d = doroDivergence(J, top, a, b);
  return { a, b, kl: d.kl, leak: d.leak, top, J, converged: r.converged, iterations: r.iterations };
}

// --- SCAL ----------------------------------------------------------------------------------------

export const SCAL_TARGETS = { pOne: 0.34, pTail: 0.15 };
/** Newton start; it reaches the same solution from (0.2, 0.2) to (2, 2) for m = 5, ..., 500. */
const SCAL_START: [number, number] = [0.5, 0.5];
export const SCAL_SHORTCUT_RATE = 0.033;

/** The SCAL tail threshold ceil(2 ln m). */
export const scalTailK = (m: number) => Math.ceil(2 * Math.log(m));

/** P(K_m = 1) and P(K_m >= ceil(2 ln m)) under Gamma(a, b). */
export function scalTails(m: number, a: number, b: number, nodeFactor = 1): { pOne: number; pTail: number; q: number } {
  const p = mixPmf(m, a, b, alphaGrid(a, b, nodeFactor));
  const q = scalTailK(m);
  let below = 0;
  for (let k = 1; k < q; k += 1) below += p[k];
  return { pOne: p[1], pTail: 1 - below, q };
}

export function scalSolve(m: number, targets = SCAL_TARGETS, start?: [number, number]): SolverResult & { pOne: number; pTail: number; q: number } {
  const clamp = (v: number) => Math.max(-LOG_BOUND, Math.min(LOG_BOUND, v));
  let x = (start ?? SCAL_START).map((v) => clamp(Math.log(v)));
  const F = (v: number[]) => {
    const t = scalTails(m, Math.exp(v[0]), Math.exp(v[1]), SEARCH_NODE_FACTOR);
    return [t.pOne - targets.pOne, t.pTail - targets.pTail];
  };
  let fx = F(x);
  let it = 0;
  const h = 1e-5;
  for (; it < 60 && Math.hypot(fx[0], fx[1]) > 1e-11; it += 1) {
    const fa = [F([x[0] + h, x[1]]), F([x[0] - h, x[1]])];
    const fb = [F([x[0], x[1] + h]), F([x[0], x[1] - h])];
    const J00 = (fa[0][0] - fa[1][0]) / (2 * h);
    const J10 = (fa[0][1] - fa[1][1]) / (2 * h);
    const J01 = (fb[0][0] - fb[1][0]) / (2 * h);
    const J11 = (fb[0][1] - fb[1][1]) / (2 * h);
    const det = J00 * J11 - J01 * J10;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-300) break;
    let dx = [(J11 * fx[0] - J01 * fx[1]) / det, (-J10 * fx[0] + J00 * fx[1]) / det];
    const len = Math.hypot(dx[0], dx[1]);
    if (len > MAX_LOG_STEP) dx = dx.map((d) => (d * MAX_LOG_STEP) / len); // trust region in (log a, log b)
    let step = 1;
    let next = [clamp(x[0] - dx[0]), clamp(x[1] - dx[1])];
    let fn = F(next);
    while (Math.hypot(fn[0], fn[1]) > Math.hypot(fx[0], fx[1]) && step > 1 / 64) {
      step /= 2;
      next = [clamp(x[0] - step * dx[0]), clamp(x[1] - step * dx[1])];
      fn = F(next);
    }
    x = next;
    fx = fn;
  }
  const a = Math.exp(x[0]);
  const b = Math.exp(x[1]);
  const t = scalTails(m, a, b);
  return { a, b, pOne: t.pOne, pTail: t.pTail, q: t.q, converged: Math.hypot(t.pOne - targets.pOne, t.pTail - targets.pTail) <= 1e-9, iterations: it };
}

/** The SCAL shortcut a = b = exp(-0.033 m) and what it implies for m units. */
export function scalShortcut(m: number): { a: number; b: number; pOne: number; pTail: number; q: number; mean: number } {
  const a = Math.exp(-SCAL_SHORTCUT_RATE * m);
  const t = scalTails(m, a, a);
  return { a, b: a, ...t, mean: mixMoments(m, a, a).mean };
}
