#!/usr/bin/env Rscript
# =============================================================================
# 15_oracle_u_space.R  (release 1.1.0)
#
# An independent oracle for Gamma mixtures: E K_J, Var K_J, P(K_J = 1) and Pr(alpha < .1) for the
# priors the site shows (the paper's headline priors, the applications, the method solutions) and
# for the edges of the engine's quadrature (a = 0.037 and a = 0.01 with tiny b; a from 1e4 to 1e8,
# where dp-core switches to its concentrated grid). The integrals run over u in (0, 1) with
# alpha = qgamma(u, a, b) (_oracle.R), which shares nothing with the engine's log-alpha grid or
# with the log-alpha panels of _helpers.R used by the other golden files.
# Also used by verification/check_readouts.mjs as the authority for the displayed prior numbers.
# No package code is used (DPprior is not loaded); exact (a, b) are read from the golden files.
# Output: verification/golden/oracle_u_space.csv (+ its golden_manifest.csv row)
# Run from r-export/:  Rscript 15_oracle_u_space.R
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
source("_oracle.R")
GOLD <- file.path(EXPL, "verification", "golden")

fits <- utils::read.csv(file.path(GOLD, "tsmm_fits.csv"), stringsAsFactors = FALSE)
da <- utils::read.csv(file.path(GOLD, "dual_anchor.csv"), stringsAsFactors = FALSE)
fit <- function(case) { r <- fits[fits$case == case, ]; c(as.numeric(r$a), as.numeric(r$b)) }
sel <- da[da$mode == "dual_soft" & da$selected == "TRUE", ]
hard <- da[da$mode == "dual_hard", ]

cases <- list(
  list("Gamma(1,1)", 1, 1, c(48, 50, 79, 100, 500, 2000, 5000)),
  list("Gamma(1.6,1.22) Fig 1", 1.6, 1.22, 50),
  list("Gamma(2,4)", 2, 4, c(100, 1000, 10000)),
  list("Gamma(1,3)", 1, 3, c(100, 500)),
  list("Gamma(0.037,0.037) SCAL shortcut", 0.037, 0.037, 100),
  list("Gamma(0.01,0.0001) diffuse", 0.01, 1e-4, 100),
  list("Gamma(0.445,0.003) diffuse", 0.445, 0.003, 100),
  list("TSMM J50", fit("J50")[1], fit("J50")[2], 50),
  list("Dual-Anchor J50 lambda .30", as.numeric(sel$a), as.numeric(sel$b), 50),
  list("hard J50", as.numeric(hard$a), as.numeric(hard$b), 50),
  list("Table 2 VIF 1.25", fit("J100_VIF1.25")[1], fit("J100_VIF1.25")[2], 100),
  list("Table 2 VIF 1.5", fit("J100_VIF1.5")[1], fit("J100_VIF1.5")[2], 100),
  list("Table 2 VIF 2.5", fit("J100_VIF2.5")[1], fit("J100_VIF2.5")[2], 100),
  list("Table 2 VIF 5", fit("J100_VIF5")[1], fit("J100_VIF5")[2], 100),
  list("STAR TSMM", fit("STAR")[1], fit("STAR")[2], 79),
  list("SSI-Weight", 2.179, 0.78, 100),
  list("Vocab hard (concentrated)", 3268991.12646551, 1634495.21665859, c(79, 500)),
  list("concentrated a = 1e4", 1e4, 1e4 / 1.2, 50),
  list("concentrated a = 1e6", 1e6, 1e6 / 1.2, 50),
  list("concentrated a = 1e8", 1e8, 1e8 / 1.2, 50)
)

rows <- list()
for (cs in cases) {
  for (J in cs[[4]]) {
    a <- cs[[2]]; b <- cs[[3]]
    m <- moments(J, a, b)
    p1 <- u_expect(function(al) pk1(al, J), a, b)
    rows[[length(rows) + 1]] <- data.frame(label = cs[[1]], a = a, b = b, J = J, E_K = m[["M1"]], Var_K = m[["V"]],
                                           P_K1 = p1, pr_alpha_lt_0.1 = pgamma(0.1, shape = a, rate = b))
    cat(sprintf("%-34s J=%5d  E %.10f  Var %.10f  P1 %.10f\n", cs[[1]], J, m[["M1"]], m[["V"]], p1))
  }
}
gold <- do.call(rbind, rows)
out <- gold
for (cn in c("a", "b", "E_K", "Var_K", "P_K1", "pr_alpha_lt_0.1")) out[[cn]] <- sprintf("%.17g", out[[cn]])
gpath <- file.path(GOLD, "oracle_u_space.csv")
utils::write.csv(out, gpath, row.names = FALSE)
cat(sprintf("wrote %s (%d rows)\n", gpath, nrow(out)))

# Exact Pr(W_max > t), t >= 1/2 (Proposition 1's integral; OSM E): with u = -log(1 - w) the
# Gamma-mixed size-biased density is a b^a / (b + u)^(a + 1), and Pr(W_max > t) is its integral
# divided by w = 1 - e^(-u), from u = -log(1 - t) to infinity (R integrate; the engine uses Simpson
# on log u). Replaces the "bounds only" rows of wmax_mc.csv, where DPprior returned no estimate.
wmax_exact <- function(t, a, b, U = 60) {
  # finite part on v = log u (panels one unit wide), then the exact tail beyond u = U, where
  # 1 - e^(-u) = 1 to double precision: the integral of a b^a / (b + u)^(a + 1) is (b / (b + U))^a
  ct <- -log1p(-t)
  g <- function(v) { u <- exp(v); exp(log(a) - log(b + u) - a * log1p(u / b) - log(-expm1(-u)) + v) }
  edges <- unique(c(seq(log(ct), log(U), by = 1), log(U)))
  s <- 0
  for (i in seq_len(length(edges) - 1)) s <- s + stats::integrate(g, edges[i], edges[i + 1], rel.tol = 1e-13, abs.tol = 0, subdivisions = 2000L)$value
  s + exp(-a * log1p(U / b))
}
wcases <- list(list("Gamma(1,1)", 1, 1), list("Gamma(1.6,1.22) Fig 1", 1.6, 1.22), list("TSMM J50", fit("J50")[1], fit("J50")[2]),
               list("Dual-Anchor J50 lambda .30", as.numeric(sel$a), as.numeric(sel$b)), list("SCAL shortcut m100", 0.037, 0.037),
               list("Gamma(0.467,0.007)", 0.467, 0.007), list("Gamma(0.445,0.003)", 0.445, 0.003))
wrows <- list()
for (wc in wcases) for (tt in c(0.5, 0.6, 0.75, 0.9)) {
  v <- wmax_exact(tt, wc[[2]], wc[[3]])
  wrows[[length(wrows) + 1]] <- data.frame(label = wc[[1]], a = wc[[2]], b = wc[[3]], t = tt, wmax_tail = v)
  cat(sprintf("W_max %-28s t=%.2f  %.12f\n", wc[[1]], tt, v))
}
wg <- do.call(rbind, wrows)
for (cn in c("a", "b", "t", "wmax_tail")) wg[[cn]] <- sprintf("%.17g", wg[[cn]])
wpath <- file.path(GOLD, "oracle_wmax.csv")
utils::write.csv(wg, wpath, row.names = FALSE)
cat(sprintf("wrote %s (%d rows)\n", wpath, nrow(wg)))

man_path <- file.path(GOLD, "golden_manifest.csv")
lines <- readLines(man_path, warn = FALSE)
lines <- lines[!startsWith(lines, "\"oracle_u_space.csv\",") & !startsWith(lines, "\"oracle_wmax.csv\",")]
sha <- strsplit(system2("shasum", c("-a", "256", shQuote(gpath)), stdout = TRUE), " ")[[1]][1]
row <- data.frame(file = "oracle_u_space.csv", sha256 = sha, rows = as.character(nrow(out)),
                  dpprior = "none (base R only)", r_version = paste("R", getRversion()),
                  method = "15_oracle_u_space.R: u-space integrate (alpha = qgamma(u, a, b); _oracle.R) of kappa_J, kappa_J^2, v_J and P(K_J = 1 | alpha); Pr(alpha < .1) by pgamma",
                  M = "integrate on 18 u panels, rel.tol 1e-12", seed = "NA", eps_alpha = "none (u-space)",
                  int_rel_tol = "1e-12", generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
                  notes = "an oracle independent of the log-alpha quadrature, incl. diffuse and concentrated priors")
wsha <- strsplit(system2("shasum", c("-a", "256", shQuote(wpath)), stdout = TRUE), " ")[[1]][1]
wrow <- row
wrow$file <- "oracle_wmax.csv"; wrow$sha256 <- wsha; wrow$rows <- as.character(nrow(wg))
wrow$method <- "15_oracle_u_space.R: exact Pr(W_max > t) for t >= 1/2 by R integrate of the Gamma-mixed size-biased density over u = -log(1 - w) divided by w"
wrow$M <- "integrate on (-log(1 - t), Inf), rel.tol 1e-12"
wrow$notes <- "replaces the bounds-only rows of wmax_mc.csv as parity comparisons"
tc <- textConnection("newline", "w", local = TRUE)
utils::write.table(rbind(row, wrow), tc, sep = ",", row.names = FALSE, col.names = FALSE, qmethod = "double")
close(tc)
writeLines(c(lines, newline), man_path)
cat(sprintf("done in %.1f s\n", as.numeric(difftime(Sys.time(), t0, units = "secs"))))
