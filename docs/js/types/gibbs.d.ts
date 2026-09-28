import { type Rng } from "./sample.ts";
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
export declare function createGibbs(points: Point2[], opts: GibbsOptions): GibbsState;
/** Remove point i from its cluster, resample its cluster, and report the probabilities used. */
export declare function stepPoint(st: GibbsState, i: number): PointUpdate;
/** One full sweep over the points in order; returns the number of clusters afterwards. */
export declare function sweep(st: GibbsState): number;
/** Set alpha (the live slider of P-13); the state keeps its partition. */
export declare function setAlpha(st: GibbsState, alpha: number): void;
/** Posterior mean of each cluster's location given its members. */
export declare function clusterMeans(st: GibbsState): Point2[];
/** Demonstration data: four clusters at (+-3, +-3) with weights 5/11, 3/11, 2/11, 1/11, sd 1. */
export declare const DEMO_MEANS: Point2[];
export declare const DEMO_WEIGHTS: number[];
export declare function demoData(seed: number, n?: number, sd?: number): {
    points: Point2[];
    truth: Int32Array;
};
