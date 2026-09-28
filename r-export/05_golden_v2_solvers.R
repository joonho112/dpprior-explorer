#!/usr/bin/env Rscript
# =============================================================================
# 05_golden_v2_solvers.R  (Step 7.1; golden values for engine/src/solvers.ts, Step 7.2)
#
# Solutions of the published hyperprior rules, solved here rather than copied:
#   SSI-Weight   Pr(W_SB > .5) = .25 and Pr(W_SB > .9) = .05 (targets from the replication
#                package's calibration/policy.yml), solved by its pcv_solve_ssi (uniroot on log b,
#                a in closed form)
#   DORO         Dorazio (2009): Gamma(a, b) closest in KL(target || induced) to the uniform
#                count distribution on {1, ..., n}, n = 10, 50, 100; DPprior_a2_kl(method = "pmf",
#                M = 320), checked against a Nelder-Mead on (log a, log b) in [-15, 15]
#   DORO-Unif    the paper's variant: uniform on {1, ..., 2 mu_K - 1} at J = 100, mu_K = 5 (DPprior_a2_kl
#                start, polished by Nelder-Mead on the integrate() KL; Step 7.3)
#   SCAL         Murugiah & Sweeting (2012): P(K_m = 1) = .34 and P(K_m >= ceil(2 ln m)) = .15,
#                solved for m = 6, 10, 25, 50, 75, 100 (start: the published (a, b)), and the
#                shortcut a = b = exp(-0.033 m), plus the rounded (0.037, 0.037)
# Count summaries use integrate() on log-alpha panels (_helpers.R), never Gauss-Laguerre
# M = 80: the shortcut's P(K_100 = 1) is .8336, not the stale .824.
#   TSMM (Step 8.1) the paper's calibrations (J = 50; J = 100 at VIF 1.25, 1.5, 2.5, 5; STAR, BD, Vocab) and
#                the [3, 10] targets at J = 100 (80%: feasible; 95%: below the profile minimum variance)
# Output: verification/golden/solvers.csv and tsmm_fits.csv (+ golden_manifest.csv rows)
# Run from r-export/:  Rscript 05_golden_v2_solvers.R
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
PKG <- need_dir("DPPRIOR_PKG", "the DPprior 2.0.0 source tree")
REPL <- need_dir("REPL_DIR", "a checkout of DPprior-paper-replication")
stopifnot(read.dcf(file.path(PKG, "DESCRIPTION"), fields = "Version")[1, 1] == "2.0.0")
suppressMessages(pkgload::load_all(PKG, export_all = TRUE, helpers = FALSE, quiet = TRUE))
source("_helpers.R")
source(file.path(REPL, "calibration", "policy_helpers.R"))
policy <- yaml::read_yaml(file.path(REPL, "calibration", "policy.yml"))
logS <- compute_log_stirling(500)

rows <- list()
add <- function(method, n_or_m, a, b, KL, P_K1, P_tail, tail_q, E_K, note) {
  rows[[length(rows) + 1]] <<- data.frame(method = method, n_or_m = n_or_m, a = a, b = b, KL = KL, P_K1 = P_K1,
                                          P_tail = P_tail, tail_q = tail_q, E_K = E_K, S_half = wsb_tail(.5, a, b), note = note)
}
kl_uniform <- function(n, a, b, top = n) {
  p <- marginal_pmf(n, a, b, logS, top)
  sum((1 / top) * log((1 / top) / p))
}

# --- SSI-Weight --------------------------------------------------------------------------------
ssi <- pcv_solve_ssi(policy)
for (J in c(25, 100, 500)) {
  add("ssi", J, ssi$a, ssi$b, NA, marginal_pmf(J, ssi$a, ssi$b, logS, 1)[1], wsb_tail(.9, ssi$a, ssi$b), NA,
      marginal_mean(J, ssi$a, ssi$b), "P_tail = Pr(W_SB > .9); count summaries at J = n_or_m")
}

# --- DORO (uniform on {1, ..., n}) -----------------------------------------------------------------
dorazio <- data.frame(n = c(10, 50, 100), a = c(0.525, 0.467, NA), b = c(0.046, 0.007, NA)) # Dorazio (2009) table, where given
nm_fit <- function(n, start, top = n) {
  f <- function(p) { p <- pmin(15, pmax(-15, p)); kl_uniform(n, exp(p[1]), exp(p[2]), top) }
  o <- stats::optim(log(start), f, method = "Nelder-Mead", control = list(reltol = 1e-12, maxit = 2000))
  list(a = exp(o$par[1]), b = exp(o$par[2]), kl = o$value, conv = o$convergence)
}
doro_start <- NULL
for (i in seq_len(nrow(dorazio))) {
  n <- dorazio$n[i]
  fit <- tryCatch(DPprior_a2_kl(n, rep(1 / n, n), method = "pmf", M = 320L), error = function(e) NULL)
  start <- if (!is.na(dorazio$a[i])) c(dorazio$a[i], dorazio$b[i]) else if (!is.null(doro_start)) doro_start else c(0.5, 0.01)
  nm <- nm_fit(n, start)
  pk <- if (!is.null(fit)) c(fit$parameters$a, fit$parameters$b) else c(NA, NA)
  cat(sprintf("DORO n=%3d: DPprior_a2_kl (%s) | Nelder-Mead from %s -> (%.4f, %.5f) KL %.5f conv %d\n", n,
              paste(sprintf("%.4f", pk), collapse = ", "), paste(sprintf("%.3f", start), collapse = ", "), nm$a, nm$b, nm$kl, nm$conv))
  a <- nm$a; b <- nm$b
  doro_start <- c(a, b)
  add("doro", n, a, b, nm$kl, marginal_pmf(n, a, b, logS, 1)[1], NA, NA, marginal_mean(n, a, b),
      sprintf("Nelder-Mead on (log a, log b); DPprior_a2_kl gave (%s); E(alpha) = %.2f", paste(sprintf("%.4f", pk), collapse = ", "), a / b))
}

# --- DORO-Unif (J = 100, mu_K = 5: uniform on {1, ..., 9}) ---------------------------------------
# DPprior_a2_kl (Gauss-Laguerre M = 320) lands 2e-4 off the optimum of the integrate() KL; polish it
# (Step 7.3: the polished fit matches OSM Table F.4 and the engine's doroKL to 1e-6)
top <- 9
fit <- DPprior_a2_kl(100, c(rep(1 / top, top), rep(0, 100 - top)), method = "pmf", M = 320L)
a0 <- fit$parameters$a; b0 <- fit$parameters$b
nm <- nm_fit(100, c(a0, b0), top)
a <- nm$a; b <- nm$b
cat(sprintf("DORO-Unif J=100: DPprior_a2_kl (%.5f, %.5f) -> Nelder-Mead (%.5f, %.5f) KL %.8f\n", a0, b0, a, b, nm$kl))
p9 <- marginal_pmf(100, a, b, logS, top)
add("doro_unif", 100, a, b, sum((1 / top) * log((1 / top) / p9)), p9[1], 1 - sum(p9), top + 1, marginal_mean(100, a, b),
    sprintf("target uniform on {1, ..., 9}; P_tail = mass outside the support (K >= 10); Nelder-Mead on the integrate() KL from DPprior_a2_kl pmf M = 320 (%.5f, %.5f)", a0, b0))

# --- SCAL exact solutions and shortcut -------------------------------------------------------------
published <- data.frame(m = c(6, 10, 25, 50, 75, 100), a = c(1, 0.66, 0.490, 0.466, 0.432, 0.403), b = c(1, 0.61, 0.438, 0.467, 0.420, 0.370))
scal_tails <- function(m, a, b) {
  q <- ceiling(2 * log(m))
  p <- marginal_pmf(m, a, b, logS, q - 1)
  c(p1 = p[1], ptail = 1 - sum(p), q = q)
}
for (i in seq_len(nrow(published))) {
  m <- published$m[i]
  f <- function(p) { tl <- scal_tails(m, exp(p[1]), exp(p[2])); sum((tl[1:2] - c(0.34, 0.15))^2) }
  o <- stats::optim(log(c(published$a[i], published$b[i])), f, method = "Nelder-Mead", control = list(reltol = 1e-14, maxit = 4000))
  a <- exp(o$par[1]); b <- exp(o$par[2])
  tl <- scal_tails(m, a, b)
  add("scal_exact", m, a, b, NA, tl[["p1"]], tl[["ptail"]], tl[["q"]], marginal_mean(m, a, b),
      sprintf("solved; published (%.3f, %.3f); residuals %.1e, %.1e", published$a[i], published$b[i], tl[["p1"]] - 0.34, tl[["ptail"]] - 0.15))
  tp <- scal_tails(m, published$a[i], published$b[i])
  add("scal_published", m, published$a[i], published$b[i], NA, tp[["p1"]], tp[["ptail"]], tp[["q"]], marginal_mean(m, published$a[i], published$b[i]),
      "published (a, b) as tabulated (rounded); their implied tails")
  sc <- exp(-0.033 * m)
  tl2 <- scal_tails(m, sc, sc)
  add("scal_shortcut", m, sc, sc, NA, tl2[["p1"]], tl2[["ptail"]], tl2[["q"]], marginal_mean(m, sc, sc), "a = b = exp(-0.033 m)")
}
tl3 <- scal_tails(100, 0.037, 0.037)
add("scal_shortcut_rounded", 100, 0.037, 0.037, NA, tl3[["p1"]], tl3[["ptail"]], tl3[["q"]], marginal_mean(100, 0.037, 0.037),
    "the rounded (0.037, 0.037) quoted in the literature; P(K_100 = 1) = .8336 by integrate (never the M = 80 value .824)")

# --- TSMM fits (Step 8.1): the paper's calibrations and one infeasible target ------------------
# DPprior_fit (A2-MN, M = 160; the package verifies at 320 nodes). Moments of each fit are re-checked
# with integrate(). The profile bound: for a target mean mu at J units, no Gamma prior has a smaller
# count variance than v_J(alpha*), where kappa_J(alpha*) = mu (the point-mass limit).
zq <- function(p) stats::qnorm(1 - (1 - p) / 2)
iv <- function(lo, hi, p) ((hi - lo) / (2 * zq(p)))^2
tsmm_cases <- data.frame(
  case = c("J50", "J100_VIF1.25", "J100_VIF1.5", "J100_VIF2.5", "J100_VIF5", "STAR", "BD", "Vocab", "J100_3to10_80", "J100_3to10_95"),
  J = c(50, 100, 100, 100, 100, 79, 48, 500, 100, 100),
  mu_K = c(5, 5, 5, 5, 5, 5, 4, 5, 6.5, 6.5),
  sigma2 = c(10, 1.25 * 4, 1.5 * 4, 2.5 * 4, 5 * 4, iv(2, 8, .8), iv(1, 8, .8), iv(2, 10, .8), iv(3, 10, .8), iv(3, 10, .95)),
  route = c("VIF 2.5", "VIF 1.25", "VIF 1.5", "VIF 2.5", "VIF 5", "interval [2, 8] 80%", "interval [1, 8] 80%", "interval [2, 10] 80%",
            "interval [3, 10] 80%", "interval [3, 10] 95%"),
  stringsAsFactors = FALSE)
cond_var <- function(al, J) kappa_dg(al, J) - al^2 * (trigamma(al) - trigamma(al + J))
marg_var <- function(J, a, b) {
  m1 <- marginal_mean(J, a, b)
  m2 <- mix_expect(function(al) cond_var(al, J) + kappa_dg(al, J)^2, a, b, h0 = 1)
  m2 - m1^2
}
tsmm_rows <- lapply(seq_len(nrow(tsmm_cases)), function(i) {
  cs <- tsmm_cases[i, ]
  astar <- stats::uniroot(function(l) kappa_dg(exp(l), cs$J) - cs$mu_K, c(-20, 20), tol = 1e-14)$root
  alpha_star <- exp(astar)
  min_var <- cond_var(alpha_star, cs$J)
  fit <- tryCatch(DPprior_fit(cs$J, mu_K = cs$mu_K, var_K = cs$sigma2, method = "A2-MN", M = 160L, check_diagnostics = FALSE),
                  error = function(e) e)
  if (cs$sigma2 <= min_var || inherits(fit, "error") || !isTRUE(fit$usable)) {
    why <- if (cs$sigma2 <= min_var) sprintf("sigma2 %.4f below the profile minimum %.4f", cs$sigma2, min_var) else
      if (inherits(fit, "error")) conditionMessage(fit) else fit$status
    cat(sprintf("TSMM %-14s J=%3d (%.2f, %.4f): infeasible (%s); alpha* %.4f, min var %.4f\n", cs$case, cs$J, cs$mu_K, cs$sigma2, substr(why, 1, 80), alpha_star, min_var))
    return(data.frame(case = cs$case, route = cs$route, J = cs$J, mu_K = cs$mu_K, sigma2 = cs$sigma2, a = NA, b = NA, iter = NA,
                      resid_M1 = NA, resid_V = NA, status = "infeasible", alpha_star = alpha_star, min_var = min_var, S50 = NA, E_K = NA))
  }
  a <- fit$a; b <- fit$b
  m1 <- marginal_mean(cs$J, a, b); v <- marg_var(cs$J, a, b)
  cat(sprintf("TSMM %-14s J=%3d (%.2f, %.4f): (%.6f, %.6f) in %d iterations; integrate residuals %.1e, %.1e; S(.5) %.4f; alpha* %.4f, min var %.4f\n",
              cs$case, cs$J, cs$mu_K, cs$sigma2, a, b, fit$iterations, m1 - cs$mu_K, v - cs$sigma2, wsb_tail(.5, a, b), alpha_star, min_var))
  data.frame(case = cs$case, route = cs$route, J = cs$J, mu_K = cs$mu_K, sigma2 = cs$sigma2, a = a, b = b, iter = fit$iterations,
             resid_M1 = m1 - cs$mu_K, resid_V = v - cs$sigma2, status = "ok", alpha_star = alpha_star, min_var = min_var,
             S50 = wsb_tail(.5, a, b), E_K = m1)
})
tsmm <- do.call(rbind, tsmm_rows)
for (cn in c("sigma2", "a", "b", "resid_M1", "resid_V", "alpha_star", "min_var", "S50", "E_K")) tsmm[[cn]] <- ifelse(is.na(tsmm[[cn]]), "NA", sprintf("%.17g", tsmm[[cn]]))
tpath <- file.path(EXPL, "verification", "golden", "tsmm_fits.csv")
utils::write.csv(tsmm, tpath, row.names = FALSE)

gold <- do.call(rbind, rows)
num_cols <- c("a", "b", "KL", "P_K1", "P_tail", "E_K", "S_half")
for (cn in num_cols) gold[[cn]] <- ifelse(is.na(gold[[cn]]), "NA", sprintf("%.17g", gold[[cn]]))
gpath <- file.path(EXPL, "verification", "golden", "solvers.csv")
utils::write.csv(gold, gpath, row.names = FALSE)
man_path <- file.path(EXPL, "verification", "golden", "golden_manifest.csv")
man <- utils::read.csv(man_path, stringsAsFactors = FALSE, colClasses = "character")
man <- man[man$file != "solvers.csv", ]
sha <- strsplit(system2("shasum", c("-a", "256", shQuote(gpath)), stdout = TRUE), " ")[[1]][1]
man <- rbind(man, data.frame(file = "solvers.csv", sha256 = sha, rows = as.character(nrow(gold)),
                             dpprior = "DPprior 2.0.0 (load_all)", r_version = paste("R", getRversion()),
                             method = "05_golden_v2_solvers.R: SSI (pcv_solve_ssi), DORO (Nelder-Mead on log a, log b; DPprior_a2_kl pmf M = 320 cross-check), DORO-Unif (DPprior_a2_kl start, Nelder-Mead polish), SCAL exact (Nelder-Mead on the two tails) and shortcut",
                             M = "integrate (DORO-Unif start: Gauss-Laguerre M = 320)", seed = "NA", eps_alpha = "1e-12",
                             int_rel_tol = "1e-11", generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
                             notes = "golden rows for engine/src/solvers.ts (Step 7.2)"))
man <- man[man$file != "tsmm_fits.csv", ]
tsha <- strsplit(system2("shasum", c("-a", "256", shQuote(tpath)), stdout = TRUE), " ")[[1]][1]
man <- rbind(man, data.frame(file = "tsmm_fits.csv", sha256 = tsha, rows = as.character(nrow(tsmm)),
                             dpprior = "DPprior 2.0.0 (load_all)", r_version = paste("R", getRversion()),
                             method = "05_golden_v2_solvers.R (Step 8.1): DPprior_fit A2-MN (M = 160, verified at 320); moments re-checked by integrate(); profile bound alpha* by uniroot on kappa_J = mu",
                             M = "fit: Gauss-Laguerre M = 160 (verify 320); checks: integrate", seed = "NA", eps_alpha = "1e-12",
                             int_rel_tol = "1e-11", generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
                             notes = "golden rows for engine/src/tsmm.ts (Step 8.2)"))
utils::write.csv(man, man_path, row.names = FALSE)
print(gold[, c("method", "n_or_m", "a", "b", "KL", "P_K1", "P_tail", "E_K", "S_half")], row.names = FALSE)
cat(sprintf("solvers.csv: %d rows; tsmm_fits.csv: %d rows; done in %.1f s\n", nrow(gold), nrow(tsmm), as.numeric(difftime(Sys.time(), t0, units = "secs"))))
