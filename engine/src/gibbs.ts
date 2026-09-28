// Collapsed Gibbs sampling for a Dirichlet process mixture of two-dimensional Gaussians
// (Neal 2000, Algorithm 3), for the teaching sampler P-13. Re-implemented from the
// mathematics; no code from Broderick's GPL-3 demos.
//
// Model: x_i | cluster c ~ N(mu_c, sigma^2 I), mu_c ~ N(0, sigma0^2 I), partition ~ CRP(alpha).
// With mu integrated out, point i given the others joins
//   an existing cluster c  with weight n_{-i,c} N(x_i | m_c, (sigma^2 + s_c^2) I),
//   a new cluster          with weight alpha   N(x_i | 0,  (sigma^2 + sigma0^2) I),
// where 1/s_c^2 = 1/sigma0^2 + n_c/sigma^2 and m_c = s_c^2 (sum of x_j in c) / sigma^2.
// The CRP prior weight times the predictive fit is the conditional posterior.

import { type Rng, makeRng, rnorm } from "./sample.ts";
import { logSumExp } from "./special.ts";

export interface Point2 {
  x: number;
  y: number;
}

export type GibbsInit = "one" | "singletons" | "random";

export interface GibbsOptions {
  alpha: number;
  sigma: number;
  sigma0: number;
  seed: number;
  init: GibbsInit;
  /** number of clusters for init = "random" */
  kInit?: number;
}

export interface Cluster {
  /** stable identifier (for colours in the UI); never reused within a run */
  id: number;
  n: number;
  sx: number;
  sy: number;
}

export interface GibbsState {
  points: Point2[];
  /** cluster index of each point (indices into clusters; compacted when a cluster empties) */
  z: Int32Array;
  clusters: Cluster[];
  alpha: number;
  sigma: number;
  sigma0: number;
  rng: Rng;
  sweeps: number;
  /** number of clusters after each completed sweep (entry 0 is the initial state) */
  trace: number[];
  nextId: number;
}

export interface PointUpdate {
  /** the point that was resampled */
  i: number;
  /** cluster ids in the order of probs; the last entry is the id a new cluster would get */
  ids: number[];
  /** probabilities: one per existing cluster (in current cluster order), then "new cluster" */
  probs: number[];
  /** CRP prior weights in the same order (n_c, then alpha), normalised */
  prior: number[];
  /** chosen index into probs (probs.length - 1 means a new cluster was opened) */
  chosen: number;
}

const LOG_2PI = Math.log(2 * Math.PI);

/** log N2(x | m, v I) */
function logNormal2(x: number, y: number, mx: number, my: number, v: number): number {
  const dx = x - mx;
  const dy = y - my;
  return -LOG_2PI - Math.log(v) - (dx * dx + dy * dy) / (2 * v);
}

/** Posterior predictive log density of a point under a cluster's current members. */
function logPredictive(st: GibbsState, c: Cluster, x: number, y: number): number {
  const s2 = 1 / (1 / (st.sigma0 * st.sigma0) + c.n / (st.sigma * st.sigma));
  const f = s2 / (st.sigma * st.sigma);
  return logNormal2(x, y, f * c.sx, f * c.sy, st.sigma * st.sigma + s2);
}

export function createGibbs(points: Point2[], opts: GibbsOptions): GibbsState {
  const rng = makeRng(opts.seed);
  const n = points.length;
  const st: GibbsState = {
    points, z: new Int32Array(n), clusters: [], alpha: opts.alpha, sigma: opts.sigma, sigma0: opts.sigma0,
    rng, sweeps: 0, trace: [], nextId: 0,
  };
  const k0 = opts.init === "one" ? 1 : opts.init === "singletons" ? n : Math.max(1, Math.min(n, opts.kInit ?? 10));
  for (let c = 0; c < k0; c += 1) st.clusters.push({ id: st.nextId++, n: 0, sx: 0, sy: 0 });
  for (let i = 0; i < n; i += 1) {
    const c = opts.init === "one" ? 0 : opts.init === "singletons" ? i : Math.floor(rng.next() * k0);
    st.z[i] = c;
    st.clusters[c].n += 1;
    st.clusters[c].sx += points[i].x;
    st.clusters[c].sy += points[i].y;
  }
  compact(st);
  st.trace.push(st.clusters.length);
  return st;
}

/** Drop empty clusters and renumber z. */
function compact(st: GibbsState): void {
  const map = new Int32Array(st.clusters.length).fill(-1);
  const kept: Cluster[] = [];
  st.clusters.forEach((c, k) => {
    if (c.n > 0) {
      map[k] = kept.length;
      kept.push(c);
    }
  });
  for (let i = 0; i < st.z.length; i += 1) st.z[i] = map[st.z[i]];
  st.clusters = kept;
}

/** Remove point i from its cluster, resample its cluster, and report the probabilities used. */
export function stepPoint(st: GibbsState, i: number): PointUpdate {
  const p = st.points[i];
  const k = st.z[i];
  const old = st.clusters[k];
  old.n -= 1;
  old.sx -= p.x;
  old.sy -= p.y;
  if (old.n === 0) {
    // an emptied cluster disappears before point i chooses again: move the last cluster
    // into its slot and renumber that cluster's points
    const last = st.clusters.length - 1;
    if (k !== last) {
      st.clusters[k] = st.clusters[last];
      for (let j = 0; j < st.z.length; j += 1) if (st.z[j] === last) st.z[j] = k;
    }
    st.clusters.pop();
  }
  const logw: number[] = [];
  const logPrior: number[] = [];
  for (const c of st.clusters) {
    logPrior.push(Math.log(c.n));
    logw.push(Math.log(c.n) + logPredictive(st, c, p.x, p.y));
  }
  logPrior.push(Math.log(st.alpha));
  logw.push(Math.log(st.alpha) + logNormal2(p.x, p.y, 0, 0, st.sigma * st.sigma + st.sigma0 * st.sigma0));
  const lse = logSumExp(logw);
  const probs = logw.map((v) => Math.exp(v - lse));
  const lp = logSumExp(logPrior);
  const prior = logPrior.map((v) => Math.exp(v - lp));
  const u = st.rng.next();
  let acc = 0;
  let chosen = probs.length - 1;
  for (let k = 0; k < probs.length; k += 1) {
    acc += probs[k];
    if (u < acc) {
      chosen = k;
      break;
    }
  }
  const ids = [...st.clusters.map((c) => c.id), st.nextId];
  if (chosen === st.clusters.length) st.clusters.push({ id: st.nextId++, n: 0, sx: 0, sy: 0 });
  const c = st.clusters[chosen];
  c.n += 1;
  c.sx += p.x;
  c.sy += p.y;
  st.z[i] = chosen;
  return { i, ids, probs, prior, chosen };
}

/** One full sweep over the points in order; returns the number of clusters afterwards. */
export function sweep(st: GibbsState): number {
  for (let i = 0; i < st.points.length; i += 1) stepPoint(st, i);
  st.sweeps += 1;
  st.trace.push(st.clusters.length);
  return st.clusters.length;
}

/** Set alpha (the live slider of P-13); the state keeps its partition. */
export function setAlpha(st: GibbsState, alpha: number): void {
  st.alpha = alpha;
}

/** Posterior mean of each cluster's location given its members. */
export function clusterMeans(st: GibbsState): Point2[] {
  return st.clusters.map((c) => {
    const s2 = 1 / (1 / (st.sigma0 * st.sigma0) + c.n / (st.sigma * st.sigma));
    const f = s2 / (st.sigma * st.sigma);
    return { x: f * c.sx, y: f * c.sy };
  });
}

/** Demonstration data: four clusters at (+-3, +-3) with weights 5/11, 3/11, 2/11, 1/11, sd 1. */
export const DEMO_MEANS: Point2[] = [
  { x: -3, y: 3 },
  { x: 3, y: 3 },
  { x: 3, y: -3 },
  { x: -3, y: -3 },
];
export const DEMO_WEIGHTS = [5, 3, 2, 1].map((w) => w / 11);

export function demoData(seed: number, n = 100, sd = 1): { points: Point2[]; truth: Int32Array } {
  const rng = makeRng(seed);
  const points: Point2[] = [];
  const truth = new Int32Array(n);
  for (let i = 0; i < n; i += 1) {
    const u = rng.next();
    let acc = 0;
    let k = DEMO_WEIGHTS.length - 1;
    for (let j = 0; j < DEMO_WEIGHTS.length; j += 1) {
      acc += DEMO_WEIGHTS[j];
      if (u < acc) {
        k = j;
        break;
      }
    }
    truth[i] = k;
    points.push({ x: DEMO_MEANS[k].x + sd * rnorm(rng), y: DEMO_MEANS[k].y + sd * rnorm(rng) });
  }
  return { points, truth };
}
