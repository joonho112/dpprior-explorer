// dp-core: the single math engine of DPprior Explorer.
//
// Every number a widget shows comes from here, and every function below is checked
// against golden values from the DPprior R package 2.0.0 (verification/golden/,
// verification/run_parity.mjs). Built to ../js/dp-core.js (ES module) and
// ../js/dp-core.umd.js (global `dpCore`).
//
// Modules
//   special   lgamma, digamma, trigamma, logSumExp, logRising
//   count     K_J given alpha: log-Stirling rows, Antoniak pmf, moments, pmf summaries, the profile bound
//   gamma     Gamma(a, b) density, incomplete gamma, quantile
//   mixing    Gamma mixtures: marginal K_J moments, pmf, summaries, Pr(alpha < t); a mode-centred grid for a > 1e4
//   weights   W_SB tail/density/quantile, W_max bounds and exact tail, rho
//   elicit    interval / VIF / CV conversions, feasibility checks, A1 initialiser
//   sample    seeded PRNG, Gamma/Beta/Dirichlet, GEM stick-breaking, CRP
//   gibbs     collapsed Gibbs sampler for a DP mixture of 2-D Gaussians (Neal Algorithm 3)
//   solvers   published hyperprior rules solved for (a, b): SSI-Weight, DORO (KL), SCAL, shortcut
//   tsmm      TSMM: support and profile-bound checks, Stage 1 A1 start, Stage 2 Newton, a profile solve near the bound

export const DP_CORE_VERSION = "0.2.0";

export {
  digamma, lgamma, logAddExp, logRising, logSumExp, trigamma,
} from "./special.ts";
export {
  FINITE_SUM_J_MAX, LIVE_J_MAX, condMean, condMeanDigamma, condMeanSum, condPmf,
  condPmfConvolution, condVar, condVarDigamma, condVarSum, logStirlingRow, pmfQuantile,
  pmfSummary, profileBound, supportUpperVariance, type PmfSummary,
} from "./count.ts";
export { dgammaLog, gammp, gammq, pgamma, pgammaUpper, qgamma } from "./gamma.ts";
export {
  ALPHA_FLOOR, DEGENERATE_A, MIN_NODES, NODE_SPACING, POINT_MASS_A, alphaGrid, mixExpect, mixMoments,
  mixPK1, mixPmf, mixSummary, prAlphaBelow, type AlphaGrid, type Moments,
} from "./mixing.ts";
export {
  MAJORITY_T, W_DENSITY_MAX, meanRho, meanRhoGivenAlpha, varRhoGivenAlpha, wmaxBounds,
  wmaxTail, wmaxTailGivenAlpha, wsbCdf, wsbDensity, wsbQuantile, wsbTail, wsbTailGivenAlpha,
  type WmaxBounds,
} from "./weights.ts";
export {
  VIF_BY_CONFIDENCE, a1Init, checkTarget, confidenceToVariance, cvToVariance,
  intervalToMoments, qnorm, vifToVariance, type A1Start, type Confidence, type CountMoments,
  type Feasibility,
} from "./elicit.ts";
export {
  DEMO_MEANS, DEMO_WEIGHTS, clusterMeans, createGibbs, demoData, setAlpha, stepPoint, sweep,
  type Cluster, type GibbsInit, type GibbsOptions, type GibbsState, type Point2, type PointUpdate,
} from "./gibbs.ts";
export {
  DORAZIO_TABLE, SCAL_SHORTCUT_RATE, SCAL_TARGETS, SEARCH_NODE_FACTOR, SSI_TARGETS, doroDivergence,
  doroKL, scalShortcut, scalSolve, scalTailK, scalTails, ssiSolve, type DoroOptions, type SolverResult,
} from "./solvers.ts";
export {
  maxCountVariance, tsmmFit, tsmmMoments, type TsmmOptions, type TsmmResult, type TsmmStatus,
  type TsmmStep,
} from "./tsmm.ts";
export {
  Crp, GEM_EPS, lrgamma, makeRng, rbeta, rbeta1, rcrpTables, rdirichlet, rgamma, rgem, rnorm,
  type CrpStep, type GemDraw, type Rng,
} from "./sample.ts";
