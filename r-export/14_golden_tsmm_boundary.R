#!/usr/bin/env Rscript
# =============================================================================
# 14_golden_tsmm_boundary.R  (release 1.1.0)
#
# An independent oracle for TSMM targets near the edges of the feasible region: just above the
# profile bound v_J(alpha*) (exact solutions with a far above 1e4), below mu_K - 1 (no A1 start),
# ordinary targets, high variances, and targets outside the support or below the bound.
#
# Independent of the engine's quadrature: every Gamma expectation is an integral over u in (0, 1)
# with alpha = qgamma(u, a, b) (stats::integrate on fixed u panels), not the log-alpha grid used by
# dp-core and by r-export/_helpers.R. The solution (a, b) is found by nested root finding:
#   inner  log b with E K_J = mu_K at fixed a (Newton, dE/dlog b = -E[alpha kappa'(alpha)]),
#   outer  log a with Var K_J = sigma^2 along that curve (uniroot; near the bound on
#          log(Var - v_J) - log(sigma^2 - v_J), which is close to linear in log a).
# The profile bound alpha* solves kappa_J(alpha*) = mu_K by uniroot on log alpha. DPprior 2.0.0
# (pkgload::load_all, this process only) is run on the same targets with DPprior_fit(A2-MN, M = 160)
# and its status and (a, b) are recorded for reference.
# Output: verification/golden/tsmm_boundary.csv (+ its golden_manifest.csv row)
# Run from r-export/:  Rscript 14_golden_tsmm_boundary.R
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
PKG <- need_dir("DPPRIOR_PKG", "the DPprior 2.0.0 source tree")
stopifnot(read.dcf(file.path(PKG, "DESCRIPTION"), fields = "Version")[1, 1] == "2.0.0")
if ("package:DPprior" %in% search()) stop("an installed DPprior is attached; run in a fresh Rscript")
suppressMessages(pkgload::load_all(PKG, export_all = TRUE, helpers = FALSE, quiet = TRUE))

source("_oracle.R")

profile_bound <- function(J, mu) {
  r <- stats::uniroot(function(la) kappa(exp(la), J) - mu, c(-40, 40), tol = 1e-15)
  al <- exp(r$root)
  c(alpha_star = al, min_var = vcond(al, J))
}

# inner: log b with E K_J = mu at shape a (E K_J decreases in b)
mean_lb <- function(J, mu, la, lb0) {
  a <- exp(la)
  lb <- lb0
  for (k in 1:60) {
    b <- exp(lb)
    m1 <- u_expect(function(al) kappa(al, J), a, b)
    f <- m1 - mu
    if (abs(f) < 1e-13 * (1 + mu)) break
    d <- -u_expect(function(al) dkappa_x(al, J), a, b) # dE/dlog b
    step <- if (d < 0) -f / d else sign(f)
    lb <- lb + max(-1, min(1, step))
  }
  lb
}

# outer: log a with Var K_J = v along the mean-matched curve
solve_target <- function(J, mu, v, pb) {
  cache <- new.env()
  lb_guess <- NA_real_
  curve <- function(la) {
    key <- sprintf("%.15g", la)
    if (!is.null(cache[[key]])) return(cache[[key]])
    lb0 <- if (is.na(lb_guess)) la - log(pb[["alpha_star"]]) else lb_guess
    lb <- mean_lb(J, mu, la, lb0)
    lb_guess <<- lb
    m <- moments(J, exp(la), exp(lb))
    out <- list(la = la, lb = lb, M1 = m[["M1"]], V = m[["V"]])
    assign(key, out, envir = cache)
    out
  }
  near <- v < 1.05 * pb[["min_var"]]
  g <- if (near) {
    function(la) { cv <- curve(la); ex <- cv$V - pb[["min_var"]]; if (ex > 0) log(ex) - log(v - pb[["min_var"]]) else -50 }
  } else {
    function(la) curve(la)$V - v
  }
  # bracket from a start: near the bound la0 from V - v_J ~ C / a at a = 1e4, else the A1 start
  if (near) {
    c4 <- (curve(log(1e4))$V - pb[["min_var"]]) * 1e4
    la0 <- log(max(1, c4 / (v - pb[["min_var"]])))
  } else {
    m <- mu - 1
    D <- max(v - m, 0.25 * m)
    la0 <- log(m^2 / D)
  }
  lo <- la0 - 1
  hi <- la0 + 1
  while (g(lo) < 0 && lo > -30) lo <- lo - 2
  while (g(hi) > 0 && hi < 30) hi <- hi + 2
  r <- stats::uniroot(g, c(lo, hi), tol = 1e-12, maxiter = 200)
  cv <- curve(r$root)
  # sensitivity of Var to log a along the curve (for the parity tolerance on log a)
  dla <- 1e-4
  sens <- abs(curve(r$root + dla)$V - curve(r$root - dla)$V) / (2 * dla)
  list(a = exp(cv$la), b = exp(cv$lb), M1 = cv$M1, V = cv$V, sens = sens)
}

cases <- list(
  list(case = "paper_J50_VIF2.5", J = 50, mu = 5, v = 10),
  list(case = "J100_VIF1.25", J = 100, mu = 5, v = 5),
  list(case = "J100_VIF5", J = 100, mu = 5, v = 20),
  list(case = "low_J50_3.5", J = 50, mu = 5, v = 3.5),
  list(case = "low_J50_3.9", J = 50, mu = 5, v = 3.9),
  list(case = "low_J50_4.0", J = 50, mu = 5, v = 4.0),
  list(case = "low_J100_mu6.5_5", J = 100, mu = 6.5, v = 5),
  list(case = "near_J50_3.2225", J = 50, mu = 5, v = 3.2225),
  list(case = "near_J50_3.2219", J = 50, mu = 5, v = 3.2219),
  list(case = "near_J50_3.2218", J = 50, mu = 5, v = 3.2218),
  list(case = "near_J100_mu6.5_4.5235", J = 100, mu = 6.5, v = 4.5235),
  list(case = "edge_J100_mu6.5_4.5245", J = 100, mu = 6.5, v = 4.5245),
  list(case = "near_J50_mu10_6.2049", J = 50, mu = 10, v = 6.2049),
  list(case = "near_J500_mu10_7.76", J = 500, mu = 10, v = 7.76),
  list(case = "high_J50_half", J = 50, mu = 5, v = 90),
  list(case = "high_J50_mu2_0.8", J = 50, mu = 2, v = 0.8 * 48),
  list(case = "support_J50_mu2_100", J = 50, mu = 2, v = 100),
  list(case = "support_J50_ceiling", J = 50, mu = 5, v = 180),
  list(case = "infeasible_J50_3.0", J = 50, mu = 5, v = 3.0),
  list(case = "infeasible_J100_3to10_95", J = 100, mu = 6.5, v = 3.188892702430822),
  # "[3, 10] with 80% probability" at J = 100, the elicitation page's
  # example whose Pr(W_SB > .5) = .4002 sits just above the .40 trigger
  list(case = "ok_J100_3to10_80", J = 100, mu = 6.5, v = (7 / (2 * qnorm(0.9)))^2)
)

rows <- list()
for (cs in cases) {
  J <- cs$J; mu <- cs$mu; v <- cs$v
  upper <- (mu - 1) * (J - mu)
  pb <- profile_bound(J, mu)
  status <- if (!(mu > 1 && mu < J) || !(v > 0 && v < upper)) "support" else if (v <= pb[["min_var"]]) "infeasible" else NA_character_
  sol <- list(a = NA_real_, b = NA_real_, M1 = NA_real_, V = NA_real_, sens = NA_real_)
  if (is.na(status)) {
    sol <- solve_target(J, mu, v, pb)
    status <- if (sol$a > 1e4) "point-mass" else "ok"
  }
  pkg <- list(status = "not run", a = NA_real_, b = NA_real_)
  if (status %in% c("ok", "point-mass")) {
    warned <- FALSE
    fit <- tryCatch(withCallingHandlers(
      DPprior_fit(J, mu_K = mu, var_K = v, method = "A2-MN", M = 160L, check_diagnostics = FALSE),
      warning = function(w) { warned <<- TRUE; invokeRestart("muffleWarning") }),
      error = function(e) NULL)
    if (is.null(fit)) pkg$status <- "error" else {
      pkg$status <- paste0(fit$status %||% "unknown", if (warned) " (warning)" else "")
      pkg$a <- fit$parameters$a %||% NA_real_
      pkg$b <- fit$parameters$b %||% NA_real_
    }
  }
  tol_log_a <- if (is.na(sol$sens)) NA_real_ else max(1e-6, 2e-7 / sol$sens)
  cat(sprintf("%-26s %-11s a %-14.8g b %-14.8g M1 %.12f V %.12f (target %.10g) sens %.3g | pkg %s (%s, %s)\n",
              cs$case, status, sol$a, sol$b, sol$M1, sol$V, v, sol$sens, pkg$status, format(pkg$a, digits = 8), format(pkg$b, digits = 8)))
  rows[[length(rows) + 1]] <- data.frame(case = cs$case, J = J, mu_K = mu, var_K = v, status = status,
    a = sol$a, b = sol$b, E_K = sol$M1, Var_K = sol$V, alpha_star = pb[["alpha_star"]], min_var = pb[["min_var"]],
    support_upper = upper, sens_dV_dloga = sol$sens, tol_log_a = tol_log_a,
    pkg_status = pkg$status, pkg_a = pkg$a, pkg_b = pkg$b)
}
gold <- do.call(rbind, rows)

num_cols <- c("mu_K", "var_K", "a", "b", "E_K", "Var_K", "alpha_star", "min_var", "support_upper", "sens_dV_dloga", "tol_log_a", "pkg_a", "pkg_b")
out <- gold
for (cn in num_cols) out[[cn]] <- ifelse(is.na(out[[cn]]), "NA", sprintf("%.17g", out[[cn]]))
gpath <- file.path(EXPL, "verification", "golden", "tsmm_boundary.csv")
utils::write.csv(out, gpath, row.names = FALSE)
cat(sprintf("wrote %s (%d rows)\n", gpath, nrow(out)))

man_path <- file.path(EXPL, "verification", "golden", "golden_manifest.csv")
lines <- readLines(man_path, warn = FALSE)
lines <- lines[!startsWith(lines, "\"tsmm_boundary.csv\",")]
sha <- strsplit(system2("shasum", c("-a", "256", shQuote(gpath)), stdout = TRUE), " ")[[1]][1]
row <- data.frame(file = "tsmm_boundary.csv", sha256 = sha, rows = as.character(nrow(out)),
                  dpprior = "DPprior 2.0.0 (load_all; DPprior_fit for reference only)", r_version = paste("R", getRversion()),
                  method = "14_golden_tsmm_boundary.R: u-space integrate (alpha = qgamma(u, a, b)); profile bound by uniroot; (a, b) by nested root finding (inner Newton on log b for the mean, outer uniroot on log a for the variance)",
                  M = "integrate on 18 u panels, rel.tol 1e-12", seed = "NA", eps_alpha = "none (u-space)",
                  int_rel_tol = "1e-12", generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
                  notes = "an oracle for TSMM near the profile bound, below mu_K - 1, at high variance and outside the support")
tc <- textConnection("newline", "w", local = TRUE)
utils::write.table(row, tc, sep = ",", row.names = FALSE, col.names = FALSE, qmethod = "double")
close(tc)
writeLines(c(lines, newline), man_path)
cat(sprintf("golden_manifest.csv: %d files\n", nrow(utils::read.csv(man_path, stringsAsFactors = FALSE))))
cat(sprintf("done in %.1f s\n", as.numeric(difftime(Sys.time(), t0, units = "secs"))))
