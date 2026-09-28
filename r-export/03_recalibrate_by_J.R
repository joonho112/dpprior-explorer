#!/usr/bin/env Rscript
# =============================================================================
# 03_recalibrate_by_J.R  (Step 7.11; the only input of M-16 "transported vs recalibrated")
#
# The vocabulary target "about 5 clusters, between 2 and 10 with 80% probability" (mu_K = 5,
# var_K = ((10 - 2) / (2 z_.90))^2 = 9.742, the normal-proxy interval route) is calibrated by TSMM
# (DPprior_fit, method A2-MN, M = 160 with the package's own check at 320 nodes) at every J on the grid below ("recalibrated"), and the
# J = 500 solution, Gamma(2.1062, 3.0789), is carried unchanged to every J ("transported").
# Every summary is recomputed with integrate() on log-alpha panels (_helpers.R); the TSMM moments
# are re-checked the same way (residuals reported). Fig. 2 of the paper (replication
# docs/artifacts/main-figure-2.csv) is used only as a cross-check.
# Outputs
#   data/precomputed/count_prior_by_J.{json,js}
#   verification/golden/count_prior_by_J.csv  (+ a golden_manifest.csv row)
# Run from r-export/:  Rscript 03_recalibrate_by_J.R
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
PKG <- need_dir("DPPRIOR_PKG", "the DPprior 2.0.0 source tree")
REPL <- need_dir("REPL_DIR", "a checkout of DPprior-paper-replication")
stopifnot(read.dcf(file.path(PKG, "DESCRIPTION"), fields = "Version")[1, 1] == "2.0.0")
suppressMessages(pkgload::load_all(PKG, export_all = TRUE, helpers = FALSE, quiet = TRUE))
source("_helpers.R")
logS <- compute_log_stirling(500)
r8 <- function(x) signif(x, 10)
MU_K <- 5
K_LO <- 2; K_HI <- 10; COVER <- 0.8
VAR_K <- ((K_HI - K_LO) / (2 * qnorm(1 - (1 - COVER) / 2)))^2
cat(sprintf("target: mu_K = %g, var_K = %.6f (interval [%g, %g] with %.0f%%)\n", MU_K, VAR_K, K_LO, K_HI, 100 * COVER))

marginal_var <- function(J, a, b) {
  m1 <- marginal_mean(J, a, b)
  m2 <- mix_expect(function(al) { k <- kappa_dg(al, J); v <- k - al^2 * (trigamma(al) - trigamma(al + J)); v + k^2 }, a, b, h0 = 1)
  m2 - m1^2
}
summ <- function(J, a, b) {
  p <- marginal_pmf(J, a, b, logS, J)
  list(E_K = sum(seq_len(J) * p), SD_K = sqrt(marginal_var(J, a, b)), q05 = pmf_q(p, .05), q50 = pmf_q(p, .5), q95 = pmf_q(p, .95),
       P_K1 = p[1], S50 = wsb_tail(.5, a, b), S90 = wsb_tail(.9, a, b))
}

golden <- list()
g <- function(block, J, quantity, value) golden[[length(golden) + 1]] <<- data.frame(block = block, J = J, quantity = quantity, value = value)

# --- recalibrated at each J ----------------------------------------------------------------------
J_RECAL <- sort(unique(c(10, 15, 20, seq(25, 500, by = 25), 79)))
recal <- lapply(J_RECAL, function(J) {
  fit <- tryCatch(DPprior_fit(J, mu_K = MU_K, var_K = VAR_K, method = "A2-MN", M = 160L, check_diagnostics = FALSE, verbose = FALSE),
                  error = function(e) e)
  if (inherits(fit, "error") || is.null(fit$parameters$a) || !isTRUE(fit$usable)) {
    msg <- if (inherits(fit, "error")) conditionMessage(fit) else sprintf("status %s, usable %s", fit$status, fit$usable)
    cat(sprintf("J=%3d: no usable TSMM solution (%s)\n", J, substr(msg, 1, 120)))
    return(list(J = J, feasible = FALSE, note = substr(msg, 1, 200)))
  }
  a <- fit$parameters$a; b <- fit$parameters$b
  s <- summ(J, a, b)
  res <- c(s$E_K - MU_K, s$SD_K^2 - VAR_K)
  cat(sprintf("J=%3d: (%.6f, %.6f)  E K %.5f  Var %.5f  [%d, %d]  S(.5) %.4f  S(.9) %.4f  P(K=1) %.4f  residuals %.1e %.1e  (%s)\n",
              J, a, b, s$E_K, s$SD_K^2, s$q05, s$q95, s$S50, s$S90, s$P_K1, res[1], res[2], fit$status))
  for (q in c("a", "b")) g("recalibrated", J, q, get(q))
  g("recalibrated", J, "E_K", s$E_K); g("recalibrated", J, "q05", s$q05); g("recalibrated", J, "q95", s$q95)
  g("recalibrated", J, "S50", s$S50); g("recalibrated", J, "P_K1", s$P_K1)
  list(J = J, feasible = TRUE, a = r8(a), b = r8(b), E_K = r8(s$E_K), SD_K = r8(s$SD_K), q05 = s$q05, q50 = s$q50, q95 = s$q95,
       P_K1 = r8(s$P_K1), S50 = r8(s$S50), S90 = r8(s$S90), residual_mean = signif(res[1], 3), residual_var = signif(res[2], 3), status = fit$status)
})
r500 <- recal[[which(J_RECAL == 500)]]
stopifnot(isTRUE(r500$feasible))

# --- transported: the J = 500 solution at every J ---------------------------------------------------
J_TRANS <- c(10, 15, 20, 25, 30, 40, 50, 60, 79, 100, 125, 150, 200, 250, 300, 400, 500)
ta <- r500$a; tb <- r500$b
trans <- lapply(J_TRANS, function(J) {
  s <- summ(J, ta, tb)
  g("transported", J, "E_K", s$E_K); g("transported", J, "q05", s$q05); g("transported", J, "q95", s$q95); g("transported", J, "P_K1", s$P_K1)
  list(J = J, E_K = r8(s$E_K), SD_K = r8(s$SD_K), q05 = s$q05, q50 = s$q50, q95 = s$q95, P_K1 = r8(s$P_K1))
})
cat(sprintf("transported Gamma(%.4f, %.4f): E K %s; S(.5) %.4f at every J\n", ta, tb,
            paste(sprintf("%d:%.3f", J_TRANS, vapply(trans, function(x) x$E_K, 0)), collapse = " "), wsb_tail(.5, ta, tb)))

# --- cross-check against the paper's Fig. 2 data -----------------------------------------------------
f2 <- utils::read.csv(file.path(REPL, "docs", "artifacts", "main-figure-2.csv"), stringsAsFactors = FALSE)
chk <- f2[f2$curve == "tsmm_recalibrated", c("J", "a", "b", "wsb_tail_50")]
for (i in seq_len(nrow(chk))) {
  mine <- Filter(function(x) x$J == chk$J[i] && isTRUE(x$feasible), recal)
  if (length(mine)) cat(sprintf("Fig. 2 check J=%3d: paper (%.6f, %.6f) S %.4f | here (%.6f, %.6f) S %.4f\n", chk$J[i], chk$a[i], chk$b[i], chk$wsb_tail_50[i],
                                mine[[1]]$a, mine[[1]]$b, mine[[1]]$S50))
}

out <- list(
  source = "r-export/03_recalibrate_by_J.R", dpprior = "DPprior 2.0.0 (load_all; DPprior_fit A2-MN, M = 160, verified at 320)", r_version = paste("R", getRversion()),
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
  method = "TSMM by DPprior_fit(method = 'A2-MN', M = 160; the package verifies at 320 nodes); every summary recomputed with integrate() on log-alpha panels",
  target = list(label = "about 5 clusters, between 2 and 10 with 80% probability", mu_K = MU_K, K_interval = c(K_LO, K_HI), coverage = COVER,
                var_K = r8(VAR_K), route = "normal proxy: var_K = ((10 - 2) / (2 z_.90))^2"),
  recalibrated = recal,
  transported = list(from_J = 500, a = ta, b = tb, S50 = r8(wsb_tail(.5, ta, tb)), S90 = r8(wsb_tail(.9, ta, tb)), rows = trans),
  check = "Fig. 2 of the paper (replication docs/artifacts/main-figure-2.csv) agrees on (a, b) and Pr(W_SB > .5) where both exist")
json <- jsonlite::toJSON(out, auto_unbox = TRUE, digits = NA, pretty = TRUE, null = "null", na = "null")
writeLines(json, file.path(EXPL, "data", "precomputed", "count_prior_by_J.json"))
writeLines(c("// written by r-export/03_recalibrate_by_J.R; do not edit", paste0("export default ", json, ";")),
           file.path(EXPL, "data", "precomputed", "count_prior_by_J.js"))

gold <- do.call(rbind, golden)
gold$value <- sprintf("%.17g", gold$value)
gpath <- file.path(EXPL, "verification", "golden", "count_prior_by_J.csv")
utils::write.csv(gold, gpath, row.names = FALSE)
man_path <- file.path(EXPL, "verification", "golden", "golden_manifest.csv")
man <- utils::read.csv(man_path, stringsAsFactors = FALSE, colClasses = "character")
man <- man[man$file != "count_prior_by_J.csv", ]
sha <- strsplit(system2("shasum", c("-a", "256", shQuote(gpath)), stdout = TRUE), " ")[[1]][1]
man <- rbind(man, data.frame(file = "count_prior_by_J.csv", sha256 = sha, rows = as.character(nrow(gold)),
                             dpprior = "DPprior 2.0.0 (load_all)", r_version = paste("R", getRversion()),
                             method = "03_recalibrate_by_J.R: TSMM (DPprior_fit A2-MN, M = 160, verified at 320) per J; summaries by integrate()",
                             M = "integrate (fit: Gauss-Laguerre M = 160, verified at 320)", seed = "NA", eps_alpha = "1e-12",
                             int_rel_tol = "1e-11", generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
                             notes = "recalibrated and transported count priors for M-16 (Step 7.11)"))
utils::write.csv(man, man_path, row.names = FALSE)
cat(sprintf("count_prior_by_J.json: %.1f KB; golden rows %d; done in %.1f s\n",
            file.size(file.path(EXPL, "data", "precomputed", "count_prior_by_J.json")) / 1024, nrow(gold),
            as.numeric(difftime(Sys.time(), t0, units = "secs"))))
