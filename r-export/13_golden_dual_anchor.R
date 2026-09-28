#!/usr/bin/env Rscript
# =============================================================================
# 13_golden_dual_anchor.R  (Step 11.1)
#
# Dual-Anchor golden rows for the paper's J = 50 worked example (mu_K = 5, var_K = 10), recomputed
# with DPprior 2.0.0 (pkgload::load_all, this process only) through the replication package's own
# calibration code (calibration/policy_helpers.R, policy.yml):
#   dual_soft  the 29-point lambda grid of compute_tradeoff_curve (W_SB tail at .5, soft target .25,
#              M_fit 160 / M_verify 320 as in the policy), with the policy's selected lambda;
#   dual_hard  DPprior_dual_hard with S(.5) <= .25 (the hard-bound sensitivity).
# Per row: (a, b), S(.5) = Pr(W_SB > .5) in closed form, and E K_50, Var K_50 by integrate() on
# log-alpha panels (_helpers.R; never Gauss-Laguerre), plus the package's own M-node count summaries
# for reference. The parity runner compares the engine's wsbTail and mixMoments at these (a, b), and
# the released dual_anchor_grid.json (what C-08 reads) against these (a, b).
# The other two golden families named in the Step 11.1 plan already exist: W_max bounds
# (wmax_tail_bounds) are in wmax_mc.csv and the count-target conversions (vif_to_variance,
# confidence_to_vif) in elicitation_conversions.csv (Step 1.3-1.4).
# Output: verification/golden/dual_anchor.csv (+ its golden_manifest.csv row)
# Run from r-export/:  Rscript 13_golden_dual_anchor.R
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
PKG <- need_dir("DPPRIOR_PKG", "the DPprior 2.0.0 source tree")
REPL <- need_dir("REPL_DIR", "a checkout of DPprior-paper-replication")
stopifnot(read.dcf(file.path(PKG, "DESCRIPTION"), fields = "Version")[1, 1] == "2.0.0")
if ("package:DPprior" %in% search()) stop("an installed DPprior is attached; run in a fresh Rscript")
suppressMessages(pkgload::load_all(PKG, export_all = TRUE, helpers = FALSE, quiet = TRUE))
source("_helpers.R")
source(file.path(REPL, "calibration", "policy_helpers.R"))
policy <- pcv_load_policy(file.path(REPL, "calibration", "policy.yml"))

spec <- list(spec_id = "worked-J50", J = 50L, mu_K = 5, var_K = 10)
J <- spec$J
k_fit <- pcv_fit_k_target(spec, policy)
soft <- pcv_soft_curve_select(k_fit, spec, policy)
hard <- pcv_fit_hard_sensitivity(k_fit, spec, policy)
stopifnot(nrow(soft$curve) == 29L, !is.null(hard$fit))

second_moment <- function(al) vapply(al, function(x) var_K_given_alpha(J, x) + mean_K_given_alpha(J, x)^2, 0)
summaries <- function(a, b) {
  m <- marginal_mean(J, a, b)
  m2 <- mix_expect(second_moment, a, b, h0 = 1)
  c(S50 = wsb_tail(0.5, a, b), E_K = m, Var_K = m2 - m^2)
}
cv <- soft$curve
rows <- lapply(seq_len(nrow(cv)), function(i) {
  s <- summaries(cv$a[i], cv$b[i])
  data.frame(mode = "dual_soft", lambda = cv$lambda[i], a = cv$a[i], b = cv$b[i], S50 = s[["S50"]], E_K = s[["E_K"]], Var_K = s[["Var_K"]],
             mu_K_pkg = cv$mu_K[i], var_K_pkg = cv$var_K[i], selected = isTRUE(cv$selected[i]), boundary_class = cv$boundary_class[i])
})
hp <- hard$fit$parameters
hs <- summaries(hp$a, hp$b)
rows[[length(rows) + 1]] <- data.frame(mode = "dual_hard", lambda = NA_real_, a = hp$a, b = hp$b, S50 = hs[["S50"]], E_K = hs[["E_K"]], Var_K = hs[["Var_K"]],
                                       mu_K_pkg = hard$fit$achieved$K$mean, var_K_pkg = hard$fit$achieved$K$variance, selected = FALSE,
                                       boundary_class = hard$gate$boundary$class)
gold <- do.call(rbind, rows)

sel <- gold[gold$selected, ]
cat(sprintf("selected lambda %.2f: (%.4f, %.4f), S(.5) %.3f, E K %.2f (policy rule: %s)\n", sel$lambda, sel$a, sel$b, sel$S50, sel$E_K, soft$selection_reason))
cat(sprintf("hard: (%.4f, %.4f), S(.5) %.3f, E K %.2f\n", hp$a, hp$b, hs[["S50"]], hs[["E_K"]]))
cat(sprintf("largest |integrate - package M-node| over the grid: E K %.1e, Var K %.1e\n",
            max(abs(gold$E_K - gold$mu_K_pkg)), max(abs(gold$Var_K - gold$var_K_pkg))))

num_cols <- c("lambda", "a", "b", "S50", "E_K", "Var_K", "mu_K_pkg", "var_K_pkg")
out <- gold
for (cn in num_cols) out[[cn]] <- ifelse(is.na(out[[cn]]), "NA", sprintf("%.17g", out[[cn]]))
gpath <- file.path(EXPL, "verification", "golden", "dual_anchor.csv")
utils::write.csv(out, gpath, row.names = FALSE)
cat(sprintf("wrote %s (%d rows)\n", gpath, nrow(out)))

man_path <- file.path(EXPL, "verification", "golden", "golden_manifest.csv")
# edit the manifest as text: drop this file's old line and append the new one, so every other line
# (written by scripts 01, 05, ...) stays byte-identical
lines <- readLines(man_path, warn = FALSE)
lines <- lines[!startsWith(lines, "\"dual_anchor.csv\",")]
sha <- strsplit(system2("shasum", c("-a", "256", shQuote(gpath)), stdout = TRUE), " ")[[1]][1]
row <- data.frame(file = "dual_anchor.csv", sha256 = sha, rows = as.character(nrow(out)),
                  dpprior = "DPprior 2.0.0 (load_all)", r_version = paste("R", getRversion()),
                  method = "13_golden_dual_anchor.R: compute_tradeoff_curve (29 lambdas) and DPprior_dual_hard through the replication's policy_helpers.R (J = 50, mu_K = 5, var_K = 10; W_SB tail .5, soft target .25, hard bound .25)",
                  M = "solver M_fit 160 / M_verify 320 (policy); count summaries by integrate", seed = "NA", eps_alpha = "1e-12",
                  int_rel_tol = "1e-11", generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
                  notes = "golden rows for the Dual-Anchor frontier (C-08) and the released dual_anchor_grid.json (Step 11.1)")
tc <- textConnection("newline", "w", local = TRUE)
utils::write.table(row, tc, sep = ",", row.names = FALSE, col.names = FALSE, qmethod = "double")
close(tc)
writeLines(c(lines, newline), man_path)
man <- utils::read.csv(man_path, stringsAsFactors = FALSE)
cat(sprintf("golden_manifest.csv: %d files\n", nrow(man)))
cat(sprintf("done in %.1f s\n", as.numeric(difftime(Sys.time(), t0, units = "secs"))))
