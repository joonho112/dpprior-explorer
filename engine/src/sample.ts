// Seeded sampling for the teaching animations (stick-breaking, CRP, Beta/Dirichlet).
//
// PRNG: mulberry32 (32-bit state; fast, reproducible across browsers). Gamma draws use
// Marsaglia-Tsang (shape >= 1) with the U^(1/shape) boost below 1. Beta(1, alpha) uses
// the closed form 1 - (1 - u)^(1/alpha) = -expm1(log1p(-u) / alpha), which stays finite
// for alpha = 0.02. GEM stops when the remaining mass drops below eps = 1e-3
// (CONTRACT.md section 6) and reports the rest as one piece.
// These are re-implemented from the mathematics (no code from Broderick's GPL-3 demos).

export interface Rng {
  /** uniform on [0, 1) */
  next(): number;
  seed: number;
}

/** mulberry32 seeded generator. */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    seed,
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** uniform on (0, 1), never exactly 0 */
function openUniform(rng: Rng): number {
  let u = rng.next();
  while (u === 0) u = rng.next();
  return u;
}

/** standard normal (Marsaglia polar method) */
export function rnorm(rng: Rng): number {
  for (;;) {
    const x = 2 * rng.next() - 1;
    const y = 2 * rng.next() - 1;
    const s = x * x + y * y;
    if (s > 0 && s < 1) return x * Math.sqrt((-2 * Math.log(s)) / s);
  }
}

/** Gamma(shape, rate = 1) */
export function rgamma(rng: Rng, shape: number): number {
  if (shape < 1) return rgamma(rng, shape + 1) * Math.pow(openUniform(rng), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = rnorm(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = openUniform(rng);
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * log of a Gamma(shape, 1) draw, consuming the same random numbers as rgamma, so that
 * shapes far below 1 (U^(1/shape) underflows for shape ~ 0.001) stay finite on the log scale.
 */
export function lrgamma(rng: Rng, shape: number): number {
  if (shape < 1) {
    const g = lrgamma(rng, shape + 1);
    return g + Math.log(openUniform(rng)) / shape;
  }
  return Math.log(rgamma(rng, shape));
}

/** Beta(a, b) */
export function rbeta(rng: Rng, a: number, b: number): number {
  const x = rgamma(rng, a);
  const y = rgamma(rng, b);
  return x / (x + y);
}

/** Beta(1, alpha) by inversion */
export function rbeta1(rng: Rng, alpha: number): number {
  return -Math.expm1(Math.log1p(-rng.next()) / alpha);
}

/** Dirichlet(alphas), normalised on the log scale (finite for alphas down to ~1e-3 and K in the thousands). */
export function rdirichlet(rng: Rng, alphas: ArrayLike<number>): number[] {
  const lg = Array.from(alphas, (a) => lrgamma(rng, a));
  const top = Math.max(...lg);
  const e = lg.map((x) => Math.exp(x - top));
  const s = e.reduce((acc, x) => acc + x, 0);
  return e.map((x) => x / s);
}

export const GEM_EPS = 1e-3;
const GEM_MAX_PIECES = 100000;

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
export function rgem(rng: Rng, alpha: number, eps = GEM_EPS): GemDraw {
  const v: number[] = [];
  const w: number[] = [];
  let rest = 1;
  while (rest >= eps && v.length < GEM_MAX_PIECES) {
    const vk = rbeta1(rng, alpha);
    v.push(vk);
    w.push(rest * vk);
    rest *= 1 - vk;
  }
  return { alpha, v, w, rest };
}

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
export class Crp {
  readonly alpha: number;
  counts: number[] = [];
  n = 0;
  private rng: Rng;

  constructor(alpha: number, rng: Rng) {
    this.alpha = alpha;
    this.rng = rng;
  }

  /** probabilities for the next customer (existing tables, then new) */
  nextProbs(): number[] {
    const denom = this.alpha + this.n;
    return [...this.counts.map((c) => c / denom), this.alpha / denom];
  }

  seat(): CrpStep {
    const probs = this.nextProbs();
    const u = this.rng.next();
    let acc = 0;
    let table = probs.length - 1;
    for (let k = 0; k < probs.length; k += 1) {
      acc += probs[k];
      if (u < acc) {
        table = k;
        break;
      }
    }
    const isNew = table === this.counts.length;
    if (isNew) this.counts.push(1);
    else this.counts[table] += 1;
    this.n += 1;
    return { n: this.n, table, isNew, probs };
  }

  /** number of occupied tables K_n */
  get tables(): number {
    return this.counts.length;
  }
}

/** Seat J customers and return the occupied-table count K_J. */
export function rcrpTables(rng: Rng, alpha: number, J: number): number {
  const crp = new Crp(alpha, rng);
  for (let i = 0; i < J; i += 1) crp.seat();
  return crp.tables;
}
