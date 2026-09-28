#!/usr/bin/env Rscript
# =============================================================================
# 01_golden_closed_forms.R
#
# Golden values for the dp-core parity runner (verification/).
#
#   Part A (Step 1.3)  closed forms: Stirling tables, conditional K moments and
#                      pmf, log rising factorials, W_SB tail/density/cdf/quantile,
#                      E(rho), A1 initialiser, elicitation conversions, and the
#                      Stirling row-sum self-test.
#   Part B (Step 1.4)  Gamma-mixture marginals: K_J moments, pmf, quantiles,
#                      Pr(alpha < t); W_max exact tails and Monte Carlo rows;
#                      golden_manifest.csv with sha256 per file.
#
# Rules (CONTRACT.md, "Numerical rules"):
#   * DPprior 2.0.0 is loaded from source with pkgload::load_all() in THIS
#     process only; the installed DPprior (1.1.0) is never attached.
#   * Gamma mixtures use stats::integrate() on log(alpha) panels cut at gamma
#     quantiles; the mass on [0, 1e-12] is assigned to the alpha -> 0 limit
#     (K_J = 1, W tails = 1). The package default Gauss-Laguerre M = 80 is never
#     used for golden values (it gives the stale .824 for Gamma(.037, .037)).
#   * J > 500 uses the digamma/trigamma path (the package caps J at 500).
#   * Every pmf file carries an explicit count column k (k = 1..J). The package's
#     pmf vectors are 0-indexed (p[1] = P(K = 0) = 0); that entry is dropped.
#
# Run from r-export/:  Rscript 01_golden_closed_forms.R
# =============================================================================

options(warn = 1, digits = 15)
t_start <- Sys.time()

source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
PKG <- need_dir("DPPRIOR_PKG", "the DPprior 2.0.0 source tree")
OUT <- file.path(EXPL, "verification", "golden")
stopifnot(dir.exists(PKG), dir.exists(OUT))

pkg_version <- read.dcf(file.path(PKG, "DESCRIPTION"), fields = "Version")[1, 1]
if (pkg_version != "2.0.0") stop("expected DPprior source 2.0.0, found ", pkg_version)
if ("package:DPprior" %in% search()) stop("an installed DPprior is attached; run in a fresh Rscript")

suppressMessages(pkgload::load_all(PKG, export_all = TRUE, helpers = FALSE, quiet = TRUE))
stopifnot(exists("prob_wsb_exceeds"), exists("prob_wmax_exceeds"))  # 2.0.0-only exports
DPPRIOR_LABEL <- "DPprior 2.0.0 (load_all)"
R_LABEL <- paste0("R ", getRversion())

# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------
num17 <- function(x) ifelse(is.na(x), "NA", sprintf("%.17g", x))

write_golden <- function(df, name) {
  out <- df
  for (col in names(out)) if (is.double(out[[col]])) out[[col]] <- num17(out[[col]])
  path <- file.path(OUT, name)
  utils::write.csv(out, path, row.names = FALSE, quote = TRUE, na = "NA")
  cat(sprintf("  wrote %-36s %6d rows\n", name, nrow(df)))
  invisible(path)
}

logsumexp <- function(x) {
  m <- max(x)
  if (!is.finite(m)) return(m)
  m + log(sum(exp(x - m)))
}

# E(K_J | alpha), Var(K_J | alpha) by the digamma/trigamma path
kappa_dg <- function(alpha, J) alpha * (digamma(alpha + J) - digamma(alpha))
v_dg <- function(alpha, J) kappa_dg(alpha, J) - alpha^2 * (trigamma(alpha) - trigamma(alpha + J))

# vectorised finite-sum path through the package (J <= 500)
kappa_fs <- function(alpha, J) vapply(alpha, function(a) mean_K_given_alpha(J, a), numeric(1))
v_fs <- function(alpha, J) vapply(alpha, function(a) var_K_given_alpha(J, a), numeric(1))
kappa_any <- function(alpha, J) if (J <= 500) kappa_fs(alpha, J) else kappa_dg(alpha, J)
v_any <- function(alpha, J) if (J <= 500) v_fs(alpha, J) else v_dg(alpha, J)

# log |s(J, k)| for k = 1..J by the row recursion (vectorised; used for J > 500)
stirling_row <- function(J) {
  row <- 0  # n = 0: log|s(0,0)| = 0 (index k = 0)
  for (n in 0:(J - 1)) {
    # |s(n+1, k)| = n |s(n, k)| + |s(n, k-1)|, k = 0..n+1
    prev <- c(row, -Inf)          # k = 0..n+1 of row n
    shifted <- c(-Inf, row)        # |s(n, k-1)|
    scaled <- if (n == 0) rep(-Inf, n + 2) else log(n) + prev
    m <- pmax(scaled, shifted)
    row <- ifelse(is.finite(m), m + log(exp(scaled - m) + exp(shifted - m)), -Inf)
  }
  row[-1]  # drop k = 0; returns k = 1..J
}

# -----------------------------------------------------------------------------
# Gamma-mixture integrator: E[h(alpha)], alpha ~ Gamma(shape a, rate b)
# -----------------------------------------------------------------------------
EPS_ALPHA <- 1e-12
PANEL_PROBS <- c(1e-15, 1e-12, 1e-9, 1e-6, 1e-4, 1e-3, 0.01, 0.05,
                 seq(0.1, 0.9, by = 0.1), 0.95, 0.99, 0.999,
                 1 - 1e-4, 1 - 1e-6, 1 - 1e-9, 1 - 1e-12, 1 - 1e-15)
INT_REL_TOL <- 1e-11
INT_ABS_TOL <- 1e-16
int_log <- new.env()
int_log$max_abs_error <- 0
int_log$calls <- 0L
int_log$bad <- character()
int_log$bad_value <- 0
int_log$bad_err <- 0

panel_edges <- function(a, b) {
  q <- qgamma(PANEL_PROBS, shape = a, rate = b)
  hi <- qgamma(1 - 1e-15, shape = a, rate = b)
  lo <- EPS_ALPHA
  x <- log(c(lo, q[q > lo & q < hi], hi))
  x <- sort(unique(x))
  # refine: no panel wider than 0.5 in log(alpha)
  out <- x[1]
  for (i in seq_len(length(x) - 1)) {
    n_sub <- max(1, ceiling((x[i + 1] - x[i]) / 0.5))
    out <- c(out, seq(x[i], x[i + 1], length.out = n_sub + 1)[-1])
  }
  out
}

mix_expect <- function(h, a, b, h0) {
  p0 <- pgamma(EPS_ALPHA, shape = a, rate = b)
  total <- h0 * p0
  edges <- panel_edges(a, b)
  f <- function(x) {
    al <- exp(x)
    h(al) * exp(dgamma(al, shape = a, rate = b, log = TRUE) + x)
  }
  for (i in seq_len(length(edges) - 1)) {
    r <- stats::integrate(f, edges[i], edges[i + 1], rel.tol = INT_REL_TOL,
                          abs.tol = INT_ABS_TOL, subdivisions = 2000L,
                          stop.on.error = FALSE)
    int_log$calls <- int_log$calls + 1L
    int_log$max_abs_error <- max(int_log$max_abs_error, r$abs.error)
    if (!identical(r$message, "OK")) {
      int_log$bad <- c(int_log$bad, r$message)
      int_log$bad_value <- max(int_log$bad_value, abs(r$value))
      int_log$bad_err <- max(int_log$bad_err, r$abs.error)
    }
    total <- total + r$value
  }
  total
}

cat(sprintf("01_golden_closed_forms.R | %s | %s | out = %s\n", DPPRIOR_LABEL, R_LABEL, OUT))
manifest <- list()
add_manifest <- function(file, method, M = "n/a (closed form)", seed = NA, notes = "") {
  manifest[[file]] <<- data.frame(file = file, method = method, M = M, seed = seed,
                                  notes = notes, stringsAsFactors = FALSE)
}

# =============================================================================
# PART A (Step 1.3): closed forms
# =============================================================================
cat("Part A: closed forms\n")
logS500 <- compute_log_stirling(500)

# --- A1. Stirling tables ------------------------------------------------------
st50 <- do.call(rbind, lapply(1:50, function(J) data.frame(
  J = J, k = 1:J, log_stirling = logS500[J + 1, (1:J) + 1])))
write_golden(st50, "stirling_J50.csv")
add_manifest("stirling_J50.csv", "compute_log_stirling (log-space recurrence)",
             notes = "log|s(J,k)| unsigned first kind; J = 1..50, k = 1..J")

st500 <- do.call(rbind, lapply(c(48, 79, 100, 200, 500), function(J) data.frame(
  J = J, k = 1:J, log_stirling = logS500[J + 1, (1:J) + 1])))
write_golden(st500, "stirling_J500.csv")
add_manifest("stirling_J500.csv", "compute_log_stirling (log-space recurrence)",
             notes = "full rows J in {48, 79, 100, 200, 500}")

# row-sum self-test: logsumexp_k L[J, k] = lgamma(J + 1)
rowsum <- do.call(rbind, lapply(c(10, 50, 100, 200, 500), function(J) {
  lse <- logsumexp(logS500[J + 1, (1:J) + 1])
  data.frame(J = J, logsumexp_row = lse, lgamma_J_plus_1 = lgamma(J + 1),
             abs_diff = abs(lse - lgamma(J + 1)))
}))
ext_rows <- lapply(c(1000, 5000), function(J) {
  r <- stirling_row(J)
  data.frame(J = J, logsumexp_row = logsumexp(r), lgamma_J_plus_1 = lgamma(J + 1),
             abs_diff = abs(logsumexp(r) - lgamma(J + 1)))
})
rowsum <- rbind(rowsum, do.call(rbind, ext_rows))
rowsum$pass_1e10 <- rowsum$abs_diff <= 1e-10 * pmax(1, rowsum$lgamma_J_plus_1 / 1e3)
write_golden(rowsum, "selftest_rowsum.csv")
add_manifest("selftest_rowsum.csv", "row-sum identity self-test",
             notes = "J <= 500 package table; J = 1000, 5000 vectorised row recursion")
stopifnot(all(rowsum$abs_diff[rowsum$J %in% c(50, 500)] <= 1e-10))
# cross-check the vectorised recursion against the package table
chk <- max(abs(stirling_row(500) - logS500[501, 2:501]))
cat(sprintf("  vectorised stirling_row(500) vs package: max abs diff %.3g\n", chk))
stopifnot(chk < 1e-9)

# --- A2. conditional moments ---------------------------------------------------
alphas <- c(1e-6, 1e-3, 0.1, 1, 10, 100, 1000)
cm_fs <- expand.grid(alpha = alphas, J = c(10, 25, 48, 50, 79, 100, 200, 500))
cm_fs$mean <- mapply(function(J, a) mean_K_given_alpha(J, a), cm_fs$J, cm_fs$alpha)
cm_fs$var <- mapply(function(J, a) var_K_given_alpha(J, a), cm_fs$J, cm_fs$alpha)
cm_fs$method <- "finite_sum"
cm_dg <- expand.grid(alpha = alphas, J = c(200, 1000, 2000, 5000))
cm_dg$mean <- kappa_dg(cm_dg$alpha, cm_dg$J)
cm_dg$var <- v_dg(cm_dg$alpha, cm_dg$J)
cm_dg$method <- "digamma"
cm <- rbind(cm_fs, cm_dg)[, c("J", "alpha", "mean", "var", "method")]
write_golden(cm, "cond_moments.csv")
add_manifest("cond_moments.csv", "finite_sum (J <= 500, package) + digamma/trigamma (J = 200 check, J > 500)")
j200 <- merge(cm_fs[cm_fs$J == 200, ], cm_dg[cm_dg$J == 200, ], by = c("J", "alpha"))
cat(sprintf("  J = 200 finite-sum vs digamma: mean %.3g, var %.3g (max abs)\n",
            max(abs(j200$mean.x - j200$mean.y)), max(abs(j200$var.x - j200$var.y))))

# log rising factorial lgamma(alpha + J) - lgamma(alpha)
lr <- expand.grid(alpha = c(1e-9, 1e-6, 1e-3, 0.1, 1, 10, 1000), J = c(50, 500))
lr$log_rising <- mapply(function(a, J) log_rising_factorial(a, J), lr$alpha, lr$J)
lr$lgamma_diff <- lgamma(lr$alpha + lr$J) - lgamma(lr$alpha)
write_golden(lr[, c("J", "alpha", "log_rising", "lgamma_diff")], "log_rising.csv")
add_manifest("log_rising.csv", "log_rising_factorial (package) and lgamma difference")

# --- A3. conditional pmf, J = 50 -------------------------------------------------
cp <- do.call(rbind, lapply(c(1e-3, 0.1, 0.5, 1, 2, 5, 10, 50), function(a) {
  p <- pmf_K_given_alpha(50, a, logS500)  # length 51, p[1] = P(K = 0) = 0
  data.frame(J = 50, alpha = a, k = 1:50, pmf = p[-1])
}))
write_golden(cp, "cond_pmf_J50.csv")
add_manifest("cond_pmf_J50.csv", "pmf_K_given_alpha (Antoniak, log-Stirling)",
             notes = "k = 1..50; package index 1 (K = 0) dropped")

# --- A4. W_SB (size-biased first weight) ------------------------------------------
# Vocabulary priors use the exact solver values from the replication package
# (data-frozen/rasch/priors.csv); the paper quotes them rounded. The rounded hard
# solution (3.27e6, 1.63e6) has alpha = 2.006 and S(.5) = .2489, while the exact
# solution has alpha = 2.0000 and S(.5) = .2500.
PRIORS <- data.frame(
  label = c("Gamma(1,1) vague", "Gamma(2,4) literature", "Gamma(1,3) literature",
            "Gamma(1.60,1.22) Fig 1", "TSMM J50", "Dual-Anchor J50 lambda .30",
            "hard J50", "SSI-Weight J100", "SCAL shortcut m100", "TSMM J100 VIF5",
            "Gamma(5,0.5)", "Gamma(0.467,0.007)", "Gamma(0.445,0.003)",
            "TSMM J100 VIF1.25", "Vocab Dual-Anchor", "Vocab hard (point mass)",
            "Vocab TSMM"),
  a = c(1, 2, 1, 1.60, 1.4082, 2.3158, 5.2745, 2.179, 0.037, 0.62, 5, 0.467, 0.445,
        7.13, 20.2967503116458, 3268991.12646551, 2.10622839376745),
  b = c(1, 4, 3, 1.22, 1.0770, 1.4204, 2.3059, 0.780, 0.037, 0.56, 0.5, 0.007, 0.003,
        7.41, 14.5088544096694, 1634495.21665859, 3.0788824875447),
  stringsAsFactors = FALSE)

tails_t <- c(0.1, 0.25, 0.5, 0.75, 0.9, 0.95)
wsb_tail <- do.call(rbind, lapply(seq_len(nrow(PRIORS)), function(i) data.frame(
  kind = "tail", a = PRIORS$a[i], b = PRIORS$b[i], x = tails_t,
  value = vapply(tails_t, function(t) prob_wsb_exceeds(t, PRIORS$a[i], PRIORS$b[i]), 0))))
dens_x <- c(0, 0.01, 0.05, seq(0.1, 0.9, by = 0.1), 0.95, 0.99, 0.999, 1 - 1e-4)
wsb_dens <- do.call(rbind, lapply(1:9, function(i) data.frame(
  kind = "density", a = PRIORS$a[i], b = PRIORS$b[i], x = dens_x,
  value = density_w1(dens_x, PRIORS$a[i], PRIORS$b[i]))))
wsb_cdf <- do.call(rbind, lapply(1:9, function(i) data.frame(
  kind = "cdf", a = PRIORS$a[i], b = PRIORS$b[i], x = dens_x,
  value = cdf_w1(dens_x, PRIORS$a[i], PRIORS$b[i]))))
qu <- c(0.05, 0.25, 0.5, 0.75, 0.95)
wsb_q <- do.call(rbind, lapply(1:9, function(i) data.frame(
  kind = "quantile", a = PRIORS$a[i], b = PRIORS$b[i], x = qu,
  value = quantile_w1(qu, PRIORS$a[i], PRIORS$b[i]))))
cond_t <- expand.grid(alpha = c(0.02, 0.5, 1, 2, 10), t = c(0.5, 0.9))
wsb_cond <- data.frame(kind = "cond_tail", a = NA, b = NA, x = cond_t$t,
                       value = (1 - cond_t$t)^cond_t$alpha, alpha = cond_t$alpha)
wsb <- rbind(cbind(rbind(wsb_tail, wsb_dens, wsb_cdf, wsb_q), alpha = NA), wsb_cond)
write_golden(wsb, "wsb.csv")
add_manifest("wsb.csv", "prob_wsb_exceeds / density_w1 / cdf_w1 / quantile_w1 closed forms",
             notes = "kind in {tail, density, cdf, quantile, cond_tail}; density grid [0, 1-1e-4]")

# --- A5. rho = co-clustering probability -------------------------------------------
rho_c <- data.frame(kind = "cond_mean", a = NA, b = NA,
                    alpha = c(1e-3, 0.1, 0.5, 1, 2, 10, 100))
rho_c$value <- vapply(rho_c$alpha, mean_rho_given_alpha, 0)
rho_v <- data.frame(kind = "cond_var", a = NA, b = NA, alpha = rho_c$alpha)
rho_v$value <- vapply(rho_v$alpha, var_rho_given_alpha, 0)
rho_m <- data.frame(kind = "marg_mean", a = PRIORS$a, b = PRIORS$b, alpha = NA)
rho_m$value <- mapply(function(a, b) mix_expect(function(al) 1 / (1 + al), a, b, h0 = 1),
                      PRIORS$a, PRIORS$b)
rho <- rbind(rho_c, rho_v, rho_m)
rho$method <- ifelse(rho$kind == "marg_mean", "integrate", "closed_form")
write_golden(rho, "rho.csv")
add_manifest("rho.csv", "mean_rho_given_alpha / var_rho_given_alpha closed forms; E[1/(1+alpha)] by integrate()",
             M = "integrate (marg_mean rows)")

# --- A6. A1 initialiser ------------------------------------------------------------
a1_cases <- data.frame(
  J = c(50, 100, 100, 100, 100, 79, 48, 500, 100, 100, 100, 100),
  mu_K = c(5, 5, 5, 5, 5, 5, 4, 5, 6.5, 10, 30, 6.5),
  var_K = c(10, 5, 6, 10, 20, 5.4787, 7.4574, 9.7424, 7.4574, 22.5, 72.5, 3.1888))
a1 <- do.call(rbind, lapply(seq_len(nrow(a1_cases)), function(i) {
  cs <- a1_cases[i, ]
  fit <- tryCatch(DPprior_a1(cs$J, cs$mu_K, cs$var_K), error = function(e) e)
  m0 <- cs$mu_K - 1
  if (inherits(fit, "error")) {
    data.frame(cs, a0 = NA, b0 = NA, a0_formula = NA, b0_formula = NA,
               status = "infeasible_a1", message = conditionMessage(fit))
  } else {
    data.frame(cs, a0 = fit$parameters$a, b0 = fit$parameters$b,
               a0_formula = m0^2 / (cs$var_K - m0), b0_formula = m0 * log(cs$J) / (cs$var_K - m0),
               status = "ok", message = "")
  }
}))
write_golden(a1, "a1_init.csv")
add_manifest("a1_init.csv", "DPprior_a1 (scaling = log) + closed form a0 = m^2/(s2-m), b0 = m log J/(s2-m)",
             notes = "m = mu_K - 1; var_K <= m is A1-infeasible")

# --- A7. elicitation conversions -------------------------------------------------------
z80 <- qnorm(0.9); z95 <- qnorm(0.975)
conv <- rbind(
  data.frame(kind = "vif", mu_K = 5, param = c(1.25, 1.5, 2.5, 5), coverage = NA, lo = NA, hi = NA,
             var_K = vapply(c(1.25, 1.5, 2.5, 5), function(v) vif_to_variance(5, v), 0)),
  data.frame(kind = "confidence_vif", mu_K = 5, param = vapply(c("high", "medium", "low"), confidence_to_vif, 0),
             coverage = NA, lo = NA, hi = NA,
             var_K = vapply(c("high", "medium", "low"), function(cf) vif_to_variance(5, confidence_to_vif(cf)), 0)),
  data.frame(kind = "cv_K", mu_K = 5, param = c(0.3, 0.5, 0.8), coverage = NA, lo = NA, hi = NA,
             var_K = (c(0.3, 0.5, 0.8) * 5)^2),
  data.frame(kind = "interval_normal", mu_K = c(5, 4, 5, 6.5, 6.5), param = NA,
             coverage = c(0.8, 0.8, 0.8, 0.8, 0.95), lo = c(2, 1, 2, 3, 3), hi = c(8, 8, 10, 10, 10),
             var_K = NA))
iv <- conv$kind == "interval_normal"
zz <- qnorm((1 + conv$coverage[iv]) / 2)
conv$var_K[iv] <- ((conv$hi[iv] - conv$lo[iv]) / (2 * zz))^2
conv$z <- NA; conv$z[iv] <- zz
conv$J <- 100; conv$J[iv] <- c(79, 48, 500, 100, 100)
conv$support_upper <- (conv$mu_K - 1) * (conv$J - conv$mu_K)
conv$support_ok <- conv$mu_K > 1 & conv$mu_K < conv$J & conv$var_K <= conv$support_upper
conv$a1_ok <- conv$var_K > conv$mu_K - 1
write_golden(conv, "elicitation_conversions.csv")
add_manifest("elicitation_conversions.csv",
             "vif_to_variance, confidence_to_vif (package); cv_K and normal-proxy interval (paper Sec. 3.2)",
             notes = sprintf("z_.9 = %.10f, z_.975 = %.10f; confidence labels: high 1.5, medium 2.5, low 5", z80, z95))

# =============================================================================
# PART B (Step 1.4): Gamma-mixture marginals
# =============================================================================
cat("Part B: Gamma-mixture marginals\n")
J_MOM <- c(50, 79, 100, 500, 1000, 2000, 5000)
mm <- do.call(rbind, lapply(seq_len(nrow(PRIORS)), function(i) {
  a <- PRIORS$a[i]; b <- PRIORS$b[i]
  do.call(rbind, lapply(J_MOM, function(J) {
    EK <- mix_expect(function(al) kappa_any(al, J), a, b, h0 = 1)
    EK2 <- mix_expect(function(al) kappa_any(al, J)^2, a, b, h0 = 1)
    Ev <- mix_expect(function(al) v_any(al, J), a, b, h0 = 0)
    pm <- data.frame(label = PRIORS$label[i], a = a, b = b, J = J, mean = EK,
                     var = Ev + EK2 - EK^2,
                     method = if (J <= 500) "finite_sum+integrate" else "digamma+integrate",
                     pkg_M320_mean = NA, pkg_M320_var = NA, pkg_status = "")
    if (J <= 500 && a < 1e4) {
      pk <- tryCatch(exact_K_moments(J, a, b, M = 320L), error = function(e) NULL)
      if (!is.null(pk)) {
        pm$pkg_M320_mean <- pk$mean; pm$pkg_M320_var <- pk$var
        pm$pkg_status <- if (!is.null(pk$status)) as.character(pk$status) else ""
      }
    }
    pm
  }))
}))
# point-mass rows for the bypass rule (a > 1e4 -> alpha = a / b)
pmr <- PRIORS[PRIORS$a > 1e4, ]
for (i in seq_len(nrow(pmr))) {
  al <- pmr$a[i] / pmr$b[i]
  mm <- rbind(mm, data.frame(label = paste(pmr$label[i], "[point mass alpha = a/b]"),
                             a = pmr$a[i], b = pmr$b[i], J = J_MOM,
                             mean = vapply(J_MOM, function(J) kappa_any(al, J), 0),
                             var = vapply(J_MOM, function(J) v_any(al, J), 0),
                             method = "point_mass", pkg_M320_mean = NA, pkg_M320_var = NA,
                             pkg_status = ""))
}
write_golden(mm, "marginal_moments.csv")
add_manifest("marginal_moments.csv", "integrate() on log-alpha panels; [0,1e-12] -> alpha->0 limit",
             M = "integrate (cross-check column: Gauss-Laguerre M = 320)", notes = "J <= 500 finite sums (package), J > 500 digamma/trigamma; pkg_M320_* = exact_K_moments(M = 320) cross-check")

# --- marginal pmf J = 50, 100, 500 --------------------------------------------------
pmf_rows <- list()
for (i in seq_len(nrow(PRIORS))) {
  a <- PRIORS$a[i]; b <- PRIORS$b[i]
  for (J in c(50, 100, 500)) {
    L <- logS500[J + 1, (1:J) + 1]
    p <- vapply(1:J, function(k) {
      h <- function(al) exp(L[k] + k * log(al) + lgamma(al) - lgamma(al + J))
      mix_expect(h, a, b, h0 = as.numeric(k == 1))
    }, 0)
    pk <- if (a < 1e4) tryCatch(pmf_K_marginal(J, a, b, logS500, M = 320L)[-1], error = function(e) rep(NA, J)) else rep(NA, J)
    pmf_rows[[length(pmf_rows) + 1]] <- data.frame(label = PRIORS$label[i], a = a, b = b, J = J,
                                                     k = 1:J, pmf = p, pkg_M320 = pk,
                                                     method = "integrate")
    if (a > 1e4) {
      # the engine's bypass rule (CONTRACT section 6): point mass at alpha = a / b
      pm <- pmf_K_given_alpha(J, a / b, logS500)[-1]
      pmf_rows[[length(pmf_rows) + 1]] <- data.frame(label = PRIORS$label[i], a = a, b = b, J = J,
                                                       k = 1:J, pmf = pm, pkg_M320 = NA,
                                                       method = "point_mass")
    }
  }
}
mp <- do.call(rbind, pmf_rows)
write_golden(mp, "marginal_pmf_J50_J100_J500.csv")
add_manifest("marginal_pmf_J50_J100_J500.csv", "integrate() per k on log-alpha panels",
             M = "integrate (cross-check column: Gauss-Laguerre M = 320)",
             notes = "k = 1..J explicit; method = integrate | point_mass (a > 1e4 bypass rows); pkg_M320 = pmf_K_marginal(M = 320)[-1] cross-check")

# --- quantiles, Pr(alpha < t) -----------------------------------------------------------
qfrom <- function(p, k, prob) k[which(cumsum(p) >= prob - 1e-12)[1]]
mq <- do.call(rbind, lapply(split(mp[mp$method == "integrate", ], list(mp$label[mp$method == "integrate"], mp$J[mp$method == "integrate"]), drop = TRUE), function(d) {
  d <- d[order(d$k), ]
  data.frame(label = d$label[1], a = d$a[1], b = d$b[1], J = d$J[1], alpha_fixed = NA,
             pmf_sum = sum(d$pmf), mode = d$k[which.max(d$pmf)],
             q05 = qfrom(d$pmf, d$k, 0.05), median = qfrom(d$pmf, d$k, 0.5),
             q95 = qfrom(d$pmf, d$k, 0.95), p_K1 = d$pmf[1],
             pr_alpha_lt_0.1 = pgamma(0.1, d$a[1], d$b[1]),
             method = "integrate pmf (J <= 500)")
}))
# J > 500: pmf from the vectorised Stirling row (extension beyond the package cap)
ext <- list()
for (J in c(1000, 2000, 5000)) {
  L <- stirling_row(J)
  kmax <- J
  for (i in seq_len(nrow(PRIORS))) {
    a <- PRIORS$a[i]; b <- PRIORS$b[i]
    if (a > 1e4) next
    # only the mass up to the 0.999 point is needed for q05/median/q95:
    # accumulate k = 1, 2, ... and stop once the cdf passes 0.999
    p <- numeric(0)
    k <- 0
    while (k < kmax && sum(p) < 0.999) {
      k <- k + 1
      h <- function(al) exp(L[k] + k * log(al) + lgamma(al) - lgamma(al + J))
      p <- c(p, mix_expect(h, a, b, h0 = as.numeric(k == 1)))
    }
    ks <- seq_along(p)
    ext[[length(ext) + 1]] <- data.frame(label = PRIORS$label[i], a = a, b = b, J = J,
      alpha_fixed = NA, pmf_sum = sum(p), mode = ks[which.max(p)],
      q05 = qfrom(p, ks, 0.05), median = qfrom(p, ks, 0.5), q95 = qfrom(p, ks, 0.95),
      p_K1 = p[1], pr_alpha_lt_0.1 = pgamma(0.1, a, b),
      method = "integrate pmf, Stirling row extended beyond J = 500")
  }
  # fixed alpha = 1 (the M-01 'alpha = 1' curve)
  lp <- L + (1:J) * log(1) + lgamma(1) - lgamma(1 + J)
  p <- exp(lp)
  ext[[length(ext) + 1]] <- data.frame(label = "alpha = 1 fixed", a = NA, b = NA, J = J,
    alpha_fixed = 1, pmf_sum = sum(p), mode = which.max(p), q05 = qfrom(p, 1:J, 0.05),
    median = qfrom(p, 1:J, 0.5), q95 = qfrom(p, 1:J, 0.95), p_K1 = p[1], pr_alpha_lt_0.1 = 0,
    method = "Antoniak pmf, Stirling row extended beyond J = 500")
}
for (J in c(50, 79, 100, 500)) {
  p <- pmf_K_given_alpha(J, 1, logS500)[-1]
  ext[[length(ext) + 1]] <- data.frame(label = "alpha = 1 fixed", a = NA, b = NA, J = J,
    alpha_fixed = 1, pmf_sum = sum(p), mode = which.max(p), q05 = qfrom(p, 1:J, 0.05),
    median = qfrom(p, 1:J, 0.5), q95 = qfrom(p, 1:J, 0.95), p_K1 = p[1], pr_alpha_lt_0.1 = 0,
    method = "pmf_K_given_alpha")
}
mq <- rbind(mq, do.call(rbind, ext))
mq <- mq[order(mq$label, mq$J), ]
write_golden(mq, "marginal_quantiles.csv")
add_manifest("marginal_quantiles.csv", "quantiles = min k with cdf >= p; Pr(alpha < 0.1) = pgamma",
             M = "integrate",
             notes = "J > 500 rows use a vectorised log-Stirling row (checked against the package at J = 500)")

# --- W_max tails -------------------------------------------------------------------------
wm_det <- do.call(rbind, lapply(seq_len(nrow(PRIORS)), function(i) {
  a <- PRIORS$a[i]; b <- PRIORS$b[i]
  do.call(rbind, lapply(c(0.5, 0.9), function(t) {
    r <- prob_wmax_exceeds(t, a = a, b = b, method = "deterministic")
    bd <- wmax_tail_bounds(t, a = a, b = b)
    data.frame(label = PRIORS$label[i], a = a, b = b, alpha = NA, t = t, estimate = r$estimate,
               lower_bound = bd$lower_bound, upper_bound = bd$upper_bound,
               method = "deterministic", n_draws = NA, seed = NA, mc_se = NA, status = r$status)
  }))
}))
wm_fix <- do.call(rbind, lapply(c(0.5, 1, 2, 10), function(al) {
  do.call(rbind, lapply(c(0.5, 0.9), function(t) {
    r <- prob_wmax_exceeds(t, alpha = al, method = "deterministic")
    bd <- wmax_tail_bounds(t, alpha = al)
    data.frame(label = sprintf("alpha = %g fixed", al), a = NA, b = NA, alpha = al, t = t,
               estimate = r$estimate, lower_bound = bd$lower_bound, upper_bound = bd$upper_bound,
               method = "deterministic", n_draws = NA, seed = NA, mc_se = NA, status = r$status)
  }))
}))
MC_SEED <- 20260924L; MC_N <- 200000L
wm_mc <- do.call(rbind, lapply(c(1, 4, 6), function(i) {
  a <- PRIORS$a[i]; b <- PRIORS$b[i]
  r <- prob_wmax_exceeds(0.5, a = a, b = b, method = "monte_carlo", n = MC_N, seed = MC_SEED)
  bd <- wmax_tail_bounds(0.5, a = a, b = b)
  se <- sqrt(r$estimate * (1 - r$estimate) / MC_N)
  data.frame(label = PRIORS$label[i], a = a, b = b, alpha = NA, t = 0.5, estimate = r$estimate,
             lower_bound = bd$lower_bound, upper_bound = bd$upper_bound, method = "monte_carlo",
             n_draws = MC_N, seed = MC_SEED, mc_se = se, status = r$status)
}))
wm <- rbind(wm_det, wm_fix, wm_mc)
write_golden(wm, "wmax_mc.csv")
add_manifest("wmax_mc.csv", "prob_wmax_exceeds deterministic (t >= .5) + monte_carlo rows; wmax_tail_bounds",
             M = "integrate (deterministic rows) / Monte Carlo",
             seed = MC_SEED, notes = sprintf("MC rows: n_draws = %d, seed = %d; parity tolerance 5e-3", MC_N, MC_SEED))

# =============================================================================
# manifest
# =============================================================================
now <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
man <- do.call(rbind, manifest)
man$sha256 <- vapply(man$file, function(f) {
  out <- system2("shasum", c("-a", "256", shQuote(file.path(OUT, f))), stdout = TRUE)
  strsplit(out, " ")[[1]][1]
}, "")
man$rows <- vapply(man$file, function(f) nrow(utils::read.csv(file.path(OUT, f))), 0L)
man$dpprior <- DPPRIOR_LABEL
man$r_version <- R_LABEL
man$eps_alpha <- EPS_ALPHA
man$int_rel_tol <- INT_REL_TOL
man$generated_at <- now
man <- man[, c("file", "sha256", "rows", "dpprior", "r_version", "method", "M", "seed",
               "eps_alpha", "int_rel_tol", "generated_at", "notes")]
# keep the rows that 02, 03, 05, 13, 14 and 15 add for their own files, so that this script can be
# rerun alone (since 1.1.0); every column as text, as those scripts write it
man[] <- lapply(man, as.character)
man_path <- file.path(OUT, "golden_manifest.csv")
kept <- 0L
if (file.exists(man_path)) {
  old <- utils::read.csv(man_path, stringsAsFactors = FALSE, colClasses = "character")
  old <- old[!(old$file %in% man$file), names(man), drop = FALSE]
  kept <- nrow(old)
  man <- rbind(man, old)
}
utils::write.csv(man, man_path, row.names = FALSE)
cat(sprintf("  wrote golden_manifest.csv (%d files, %d kept from other scripts)\n", nrow(man), kept))
cat(sprintf("integrate(): %d panel calls, max reported abs.error %.3g, non-OK messages %d\n",
            int_log$calls, int_log$max_abs_error, length(int_log$bad)))
if (length(int_log$bad)) {
  print(table(int_log$bad))
  cat(sprintf("non-OK panels: max |value| %.3g, max abs.error %.3g\n", int_log$bad_value, int_log$bad_err))
}
cat(sprintf("done in %.1f s\n", as.numeric(difftime(Sys.time(), t_start, units = "secs"))))
