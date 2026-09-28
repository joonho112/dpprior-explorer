#!/usr/bin/env Rscript
# =============================================================================
# 06_jeffreys_sg_grid.R  (Step 7.9; feeds M-14 "Jeffreys vs DORO" and M-19 "Stirling-gamma vs Ga(2, 4)")
#
# Two priors on alpha that are not Gamma, so dp-core cannot mix over them; this script does.
#   Jeffreys (Rodriguez 2013, as described by Vicentini and Jermyn 2025, Sec. 3.1.4):
#     p(alpha) proportional to sqrt(I_n(alpha)), I_n(alpha) = (1 / alpha) sum_{j=1}^{n-1} j / (alpha + j)^2.
#     Proper, with an alpha^(-1/2) spike at 0 and an alpha^(-3/2) tail: no finite mean. The tail
#     carries real mass (4.3% above alpha = 1e4 at n = 100, all of it at K near n), so the
#     density is integrated over the whole log-alpha line, never a truncated grid.
#   Stirling-gamma Sg(a, b, m) (Zito, Rigon and Dunson 2024): density proportional to
#     alpha^(a - 1) / ((alpha)_m)^b, proper for 1 < a / b < m, with E(K_m) = a / b exactly.
# Output: data/precomputed/jeffreys_sg.{json,js}
#   jeffreys[]  n = 10, 100: log10-alpha density (per decade) on [-6, 6], masses beyond the grid,
#               induced pmf of K_n (k = 1..n) and its summaries, weight tails
#   sg[]        Sg(4, 1, n) and Sg(1, 0.25, n) with m = n for n = 10 ... 2000: E K_n (= a / b),
#               90% interval (n <= 500), P(K_n = 1), Pr(W_SB > .5), Pr(W_SB > .9), E(alpha)
# Numerics: _helpers.R (integrate() on unit log-alpha panels plus the two infinite end panels,
# stable log rising factorial). Run from r-export/:  Rscript 06_jeffreys_sg_grid.R
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
PKG <- need_dir("DPPRIOR_PKG", "the DPprior 2.0.0 source tree")
stopifnot(read.dcf(file.path(PKG, "DESCRIPTION"), fields = "Version")[1, 1] == "2.0.0")
suppressMessages(pkgload::load_all(PKG, export_all = TRUE, helpers = FALSE, quiet = TRUE))
source("_helpers.R")
logS <- compute_log_stirling(500)
r6 <- function(x) signif(x, 8)

# mass of a non-Gamma prior on [lo, hi] (alpha scale), integrating on log alpha
dens_mass <- function(prior, lo, hi) {
  g <- function(x) {
    v <- numeric(length(x)); ok <- is.finite(x); al <- exp(x[ok])
    v[ok] <- exp(prior$logf(al) - prior$shift + x[ok])
    v[!is.finite(v)] <- 0 # alpha underflows to 0 far out on the log line
    v
  }
  lx <- log(lo); hx <- log(hi)
  inner <- if (is.finite(lx) && is.finite(hx)) seq(lx, hx, length.out = max(2, ceiling(hx - lx) + 1)) else c(lx, hx)
  if (!is.finite(lx)) inner <- c(-Inf, seq(max(-40, hx - 40), hx, by = 1))
  if (!is.finite(hx)) inner <- c(seq(lx, min(40, lx + 40), by = 1), Inf)
  tot <- 0
  for (i in seq_len(length(inner) - 1)) {
    tot <- tot + stats::integrate(g, inner[i], inner[i + 1], rel.tol = 1e-11, abs.tol = 1e-16, subdivisions = 2000L, stop.on.error = FALSE)$value
  }
  tot / prior$Z
}

# --- Jeffreys ------------------------------------------------------------------------------
X10 <- seq(-6, 6, by = 0.05)
jeffreys <- lapply(c(10, 100), function(n) {
  pr <- prior_setup(list(type = "jeffreys", n = n))
  dens <- exp(pr$logf(10^X10) - pr$shift + X10 * log(10)) * log(10) / pr$Z # per decade
  p <- prior_pmf(pr, n, logS)
  ek <- sum(seq_len(n) * p)
  s <- list(E_K = r6(ek), q05 = pmf_q(p, .05), q50 = pmf_q(p, .5), q95 = pmf_q(p, .95), P_K1 = r6(p[1]), P_Kn = r6(p[n]),
            S50 = r6(prior_wsb_tail(pr, .5)), S90 = r6(prior_wsb_tail(pr, .9)), E_K_check = r6(prior_mean_K(pr, n)))
  mass <- list(below_1e_6 = r6(dens_mass(pr, 0, 1e-6)), above_1e6 = r6(dens_mass(pr, 1e6, Inf)), above_1e4 = r6(dens_mass(pr, 1e4, Inf)),
               median_alpha = NA)
  # median of alpha by bisection on the CDF (log scale)
  lo <- -30; hi <- 30
  for (it in 1:80) { mid <- (lo + hi) / 2; if (dens_mass(pr, 0, exp(mid)) < 0.5) lo <- mid else hi <- mid }
  mass$median_alpha <- r6(exp((lo + hi) / 2))
  cat(sprintf("Jeffreys n=%3d: E K %.4f (check %.4f) [%d, %d], P(K=1) %.4f, P(K=n) %.4f, S(.5) %.4f; mass <1e-6 %.4f, >1e4 %.4f, >1e6 %.4f, median alpha %.4f; pmf sum %.12f\n",
              n, ek, s$E_K_check, s$q05, s$q95, p[1], p[n], s$S50, mass$below_1e_6, mass$above_1e4, mass$above_1e6, mass$median_alpha, sum(p)))
  list(n = n, log10_alpha = X10, density_per_decade = r6(dens), mass = mass, pmf = r6(p), summary = s)
})

# --- Stirling-gamma, reference size m = n ------------------------------------------------------
N_SG <- c(10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000)
sg <- lapply(list(c(4, 1), c(1, 0.25)), function(ab) {
  rows <- lapply(N_SG, function(n) {
    pr <- prior_setup(list(type = "sg", a = ab[1], b = ab[2], m = n))
    ek <- prior_mean_K(pr, n)
    row <- list(n = n, E_K = r6(ek), P_K1 = r6(prior_pK1(pr, n)), S50 = r6(prior_wsb_tail(pr, .5)), S90 = r6(prior_wsb_tail(pr, .9)),
                E_alpha = r6(prior_expect(pr, identity, 0)))
    if (n <= 500) { p <- prior_pmf(pr, n, logS, min(n, 60)); row$q05 <- pmf_q(p, .05); row$q95 <- pmf_q(p, .95) }
    row
  })
  cat(sprintf("Sg(%g, %g, n): E K_n %s\n                 S(.5)  %s\n", ab[1], ab[2],
              paste(sprintf("%d:%.3f", N_SG, vapply(rows, function(r) r$E_K, 0)), collapse = " "),
              paste(sprintf("%d:%.3f", N_SG, vapply(rows, function(r) r$S50, 0)), collapse = " ")))
  list(a = ab[1], b = ab[2], label = sprintf("Sg(%g, %g, n)", ab[1], ab[2]), rows = rows)
})

out <- list(
  source = "r-export/06_jeffreys_sg_grid.R", dpprior = "DPprior 2.0.0 (load_all; log-Stirling table)", r_version = paste("R", getRversion()),
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
  method = "integrate() of the unnormalised density on log alpha over the whole line (unit panels on [-40, 40] plus infinite end panels); stable log rising factorial above alpha = 1e3",
  notes = c("Jeffreys: Rodriguez (2013) is not in the reference folder; the prior is taken from Vicentini and Jermyn (2025), Sec. 3.1.4.",
            "Jeffreys, n = 100: E K_100 = 49.8 over the whole alpha line; a grid truncated at alpha = 1e4 drops 4.3% of the mass (all at K near n) and gives 47.6.",
            "Stirling-gamma: Zito, Rigon and Dunson (2024); with m = n, E K_n = a / b exactly (their Theorem 3). pmf intervals for n <= 500 only (log-Stirling table)."),
  jeffreys = jeffreys, sg = sg)
json <- jsonlite::toJSON(out, auto_unbox = TRUE, digits = NA, pretty = FALSE, null = "null", na = "null")
dir.create(file.path(EXPL, "data", "precomputed"), showWarnings = FALSE, recursive = TRUE)
writeLines(json, file.path(EXPL, "data", "precomputed", "jeffreys_sg.json"))
writeLines(c("// written by r-export/06_jeffreys_sg_grid.R; do not edit", paste0("export default ", json, ";")),
           file.path(EXPL, "data", "precomputed", "jeffreys_sg.js"))
cat(sprintf("jeffreys_sg.json: %.1f KB; done in %.1f s\n", file.size(file.path(EXPL, "data", "precomputed", "jeffreys_sg.json")) / 1024,
            as.numeric(difftime(Sys.time(), t0, units = "secs"))))
