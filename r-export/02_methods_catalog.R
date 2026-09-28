#!/usr/bin/env Rscript
# =============================================================================
# 02_methods_catalog.R  (Step 4.6, extended in Step 7.3; feeds M-04 and the Phase 7 problems widgets)
#
# What published hyperprior rules imply. Every (a, b) is solved or taken from its source here,
# and every summary is computed here (integrate() on log-alpha panels, _helpers.R; never
# Gauss-Laguerre M = 80, so the shortcut's P(K_100 = 1) is .8336). J > 500 uses the digamma path.
#
# Legacy blocks (read by M-04, unchanged keys):
#   vague        Gamma(1, 1) at J = 100
#   doro[]       DORO-Unif at the design sizes (J = 48, 79, 100, 500): KL projection onto a uniform
#                count target on {1, ..., min(2 mu_K - 1, J)}; DPprior_a2_kl (M = 320) start, polished
#                by Nelder-Mead on the integrate() KL (Step 7.3; matches OSM Table F.4 at J = 100)
#   scal[]       SCAL m = 6, ..., 100: `exact` = the two tail equations solved (Step 7.3; was the
#                tabulated values), `published` = the tabulated (a, b), `shortcut` = exp(-0.033 m)
#   ssi          SSI-Weight solved from the replication policy (pcv_solve_ssi)
# Step 7.3 blocks:
#   records[]    one record per catalog point (family, a, b, J rule, year, source, E K_J and
#                P(K_J = 1) at J = 50, 100, 500, Pr(W_SB > .5), Pr(W_SB > .9), design-size summary,
#                one-line error); Jeffreys and Stirling-gamma are non-Gamma records
#   timeline[]   the nine nodes of the M-08 method timeline
# Outputs
#   data/precomputed/method_catalog.{json,js}
#   verification/golden/method_catalog.csv  (+ a golden_manifest.csv row)
# Run from r-export/:  Rscript 02_methods_catalog.R
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
f4 <- utils::read.csv(file.path(REPL, "docs", "artifacts", "osm-table-F.4.csv"), stringsAsFactors = FALSE)
logS <- compute_log_stirling(500)
r6 <- function(x) signif(x, 10)
summ <- function(J, a, b, kmax) {
  p <- marginal_pmf(J, a, b, logS, kmax)
  list(pmf = r6(p), pK1 = r6(p[1]), EK = r6(marginal_mean(J, a, b)), S50 = r6(wsb_tail(.5, a, b)), S90 = r6(wsb_tail(.9, a, b)))
}
golden <- list()
g <- function(method, key, n, quantity, value, note = "") {
  golden[[length(golden) + 1]] <<- data.frame(method = method, key = key, n = n, quantity = quantity, value = value, note = note)
}
kl_uniform <- function(J, a, b, top) {
  p <- marginal_pmf(J, a, b, logS, top)
  sum((1 / top) * log((1 / top) / p))
}
# Nelder-Mead on (log a, log b) in [-15, 15] (the engine's doroKL does the same)
doro_fit <- function(J, top, start) {
  f <- function(p) { p <- pmin(15, pmax(-15, p)); kl_uniform(J, exp(p[1]), exp(p[2]), top) }
  o <- stats::optim(log(start), f, method = "Nelder-Mead", control = list(reltol = 1e-12, maxit = 2000))
  list(a = exp(o$par[1]), b = exp(o$par[2]), kl = o$value, conv = o$convergence)
}
scal_tails <- function(m, a, b) {
  q <- ceiling(2 * log(m))
  p <- marginal_pmf(m, a, b, logS, q - 1)
  c(p1 = p[1], ptail = 1 - sum(p), q = q)
}
scal_fit <- function(m, start) {
  f <- function(p) { tl <- scal_tails(m, exp(p[1]), exp(p[2])); sum((tl[1:2] - c(0.34, 0.15))^2) }
  o <- stats::optim(log(start), f, method = "Nelder-Mead", control = list(reltol = 1e-14, maxit = 4000))
  c(a = exp(o$par[1]), b = exp(o$par[2]))
}

# --- Vague Gamma(1, 1) ------------------------------------------------------------------
v <- summ(100, 1, 1, 25)
vague <- c(list(a = 1, b = 1, J = 100), v)
g("vague", "Gamma(1,1)", 100, "pK1", v$pK1); g("vague", "Gamma(1,1)", 100, "EK", v$EK); g("vague", "Gamma(1,1)", 100, "S50", v$S50)

# --- DORO-Unif at the design sizes -------------------------------------------------------------
doro_cases <- data.frame(J = c(48, 79, 100, 500), muK = c(4, 5, 5, 5), label = c("Bangert-Drowns", "STAR", "J = 100", "vocabulary"))
doro <- lapply(seq_len(nrow(doro_cases)), function(i) {
  J <- doro_cases$J[i]; mu <- doro_cases$muK[i]
  top <- min(2 * mu - 1, J)
  target <- c(rep(1 / top, top), rep(0, J - top))
  pk <- DPprior_a2_kl(J, target, method = "pmf", M = 320L)$parameters
  fit <- doro_fit(J, top, c(pk$a, pk$b))
  a <- fit$a; b <- fit$b
  s <- summ(J, a, b, min(J, 30))
  p_full <- marginal_pmf(J, a, b, logS, top)
  kl <- sum((1 / top) * log((1 / top) / p_full))
  leak <- 1 - sum(p_full)
  cat(sprintf("DORO-Unif %-14s DPprior_a2_kl (%.5f, %.5f) -> Nelder-Mead (%.5f, %.5f), KL %.7f\n", doro_cases$label[i], pk$a, pk$b, a, b, kl))
  g("doro", doro_cases$label[i], J, "a", a); g("doro", doro_cases$label[i], J, "b", b)
  g("doro", doro_cases$label[i], J, "pK1", s$pK1); g("doro", doro_cases$label[i], J, "leak", leak)
  g("doro", doro_cases$label[i], J, "kl", kl); g("doro", doro_cases$label[i], J, "EK", s$EK)
  c(list(label = doro_cases$label[i], J = J, muK = mu, support_max = top, a = r6(a), b = r6(b), kl = r6(kl), leak = r6(leak),
         a2_kl_start = list(a = r6(pk$a), b = r6(pk$b))), s)
})

# --- SCAL: solved, published (tabulated) and shortcut ---------------------------------------------
published <- data.frame(m = c(6, 10, 25, 50, 75, 100), a = c(1, 0.66, 0.490, 0.466, 0.432, 0.403), b = c(1, 0.61, 0.438, 0.467, 0.420, 0.370))
scal <- lapply(seq_len(nrow(published)), function(i) {
  m <- published$m[i]
  ab <- scal_fit(m, c(published$a[i], published$b[i]))
  a <- ab[["a"]]; b <- ab[["b"]]
  q <- ceiling(2 * log(m))
  s <- summ(m, a, b, min(m, 30))
  pGEq <- scal_tails(m, a, b)[["ptail"]]
  sp <- summ(m, published$a[i], published$b[i], min(m, 30))
  pGEq_p <- scal_tails(m, published$a[i], published$b[i])[["ptail"]]
  sc <- exp(-0.033 * m)
  s2 <- summ(m, sc, sc, min(m, 30))
  pGEq_s <- scal_tails(m, sc, sc)[["ptail"]]
  g("scal_exact", paste0("m", m), m, "pK1", s$pK1); g("scal_exact", paste0("m", m), m, "pGEq", pGEq, paste0("q = ", q))
  g("scal_exact", paste0("m", m), m, "EK", s$EK); g("scal_exact", paste0("m", m), m, "S50", s$S50)
  g("scal_shortcut", paste0("m", m), m, "pK1", s2$pK1); g("scal_shortcut", paste0("m", m), m, "EK", s2$EK)
  list(m = m, q = q,
       exact = c(list(a = r6(a), b = r6(b), pGEq = r6(pGEq)), s),
       published = c(list(a = published$a[i], b = published$b[i], pGEq = r6(pGEq_p)), sp),
       shortcut = c(list(a = r6(sc), b = r6(sc), pGEq = r6(pGEq_s)), s2))
})

# --- SSI-Weight (replication policy: Pr(W_SB > .5) = .25, Pr(W_SB > .9) = .05) ----------------------
ssi_fit <- pcv_solve_ssi(policy)
ssi_a <- ssi_fit$a; ssi_b <- ssi_fit$b
ssi_J <- c(25, 48, 50, 79, 100, 200, 500, 1000, 2000, 5000)
ssi_EK <- vapply(ssi_J, function(J) marginal_mean(J, ssi_a, ssi_b), 0)
for (i in seq_along(ssi_J)) g("ssi", "SSI-Weight", ssi_J[i], "EK", ssi_EK[i], if (ssi_J[i] > 500) "digamma" else "")
g("ssi", "SSI-Weight", NA, "S50", wsb_tail(.5, ssi_a, ssi_b)); g("ssi", "SSI-Weight", NA, "S90", wsb_tail(.9, ssi_a, ssi_b))
ssi <- list(a = r6(ssi_a), b = r6(ssi_b), S50 = r6(wsb_tail(.5, ssi_a, ssi_b)), S90 = r6(wsb_tail(.9, ssi_a, ssi_b)),
            EK_by_J = lapply(seq_along(ssi_J), function(i) list(J = ssi_J[i], EK = r6(ssi_EK[i]))),
            pmf_J100 = summ(100, ssi_a, ssi_b, 30)$pmf)

# =============================================================================
# Step 7.3: records
# =============================================================================
J_SET <- c(50, 100, 500)
records <- list()
design_summary <- function(prior, J, extra = list()) {
  p <- prior_pmf(prior, J, logS)
  c(list(J = J, E_K = r6(sum(seq_along(p) * p)), q05 = pmf_q(p, .05), q95 = pmf_q(p, .95), P_K1 = r6(p[1])), extra)
}
add_record <- function(id, family, label, prior, J_rule, year, source, via = NULL, one_line_error, design = list(), extra = list()) {
  pr <- prior_setup(prior)
  EK <- vapply(J_SET, function(J) prior_mean_K(pr, J), 0)
  PK1 <- vapply(J_SET, function(J) prior_pK1(pr, J), 0)
  S50 <- prior_wsb_tail(pr, .5); S90 <- prior_wsb_tail(pr, .9)
  gamma <- prior$type == "gamma"
  E_alpha <- switch(prior$type, gamma = prior$a / prior$b, point = prior$alpha,
                    sg = prior_expect(pr, identity, 0), jeffreys = NA)
  rec <- list(id = id, family = family, label = label, gamma = gamma,
              a = if (gamma) r6(prior$a) else NULL, b = if (gamma) r6(prior$b) else NULL,
              prior = if (gamma) NULL else prior,
              J_rule = J_rule, year = year, source = source, via = via,
              E_alpha = if (is.na(E_alpha)) NULL else r6(E_alpha),
              E_K = setNames(as.list(r6(EK)), J_SET), P_K1 = setNames(as.list(r6(PK1)), J_SET),
              S50 = r6(S50), S90 = r6(S90),
              design = lapply(design, function(d) design_summary(pr, d$J, d$extra)),
              one_line_error = one_line_error)
  rec <- c(rec, extra)
  rec <- rec[!vapply(rec, is.null, TRUE)]
  records[[length(records) + 1]] <<- rec
  if (gamma || prior$type == "point") {
    for (i in seq_along(J_SET)) { g("record", id, J_SET[i], "EK", EK[i]); g("record", id, J_SET[i], "pK1", PK1[i]) }
    g("record", id, NA, "S50", S50); g("record", id, NA, "S90", S90)
  }
  cat(sprintf("%-26s %-18s E K %6.2f %6.2f %6.2f | P(K=1) %.4f %.4f %.4f | S(.5) %.4f S(.9) %.4f\n", id, family,
              EK[1], EK[2], EK[3], PK1[1], PK1[2], PK1[3], S50, S90))
  invisible(rec)
}
gam <- function(a, b) list(type = "gamma", a = a, b = b)
D <- function(J, ...) list(J = J, extra = list(...))

# Antoniak (1974): alpha fixed
add_record("fixed_alpha_1", "fixed-alpha", "fixed alpha = 1", list(type = "point", alpha = 1),
           "alpha fixed; no hyperprior", 1974, "Antoniak (1974): the count pmf P(K_J = k | alpha)",
           one_line_error = "One fixed alpha sets both lenses at once and carries no uncertainty: the count still grows with J while the weight tail is fixed.")
# Vague and literature defaults
add_record("vague", "vague", "Vague Gamma(1, 1)", gam(1, 1), "fixed (a, b) at every J", NA,
           "Common vague default (e.g., Ma and Chen, 2020; Cao, 2024; Mignemi, 2025); the paper's Vague",
           one_line_error = "Vague in alpha, not in clusters or weights: the expected count drifts with J while the majority-mass probability stays fixed.")
add_record("gamma_1_3", "literature-default", "Gamma(1, 3)", gam(1, 3), "fixed (a, b) at every J", 2023,
           "Paganin et al. (2023) real-data setting; DPMirt default", via = "the paper and the replication's rasch/priors.csv (Paganin et al. 2023 not in the reference folder)",
           one_line_error = "The 'conservative' default pools hardest: the smaller E(alpha), the larger the majority-mass probability, and the count still drifts with J.")
add_record("gamma_2_4", "literature-default", "Gamma(2, 4)", gam(2, 4), "fixed (a, b) at every J", 1995,
           "Escobar and West (1995); called the default by Zito, Rigon and Dunson (2024)",
           one_line_error = "Called the default, yet it gives a random unit a better-than-even chance of a majority-mass cluster, and E K_J keeps growing with J.")
# K_n-diffuse priors
add_record("kdiffuse_5_0.5_n74", "k-diffuse", "Gamma(5, 0.5) at n = 74", gam(5, 0.5), "chosen by eye at the study's n", 1993,
           "West and Escobar (1993)", via = "Vicentini and Jermyn (2025), footnote 1",
           one_line_error = "Diffuse in K means extreme in weights: a dominant cluster is all but ruled out.",
           design = list(D(74)))
add_record("kdiffuse_3.5_0.5_n53", "k-diffuse", "Gamma(3.5, 0.5) at n = 53", gam(3.5, 0.5), "chosen by eye at the study's n", 1994,
           "West, Mueller and Escobar (1994)", via = "Dorazio (2009), comparator for n = 53",
           one_line_error = "Chosen by eye for one n: there is no rule to carry it to another design, and it forbids dominance.",
           design = list(D(53)))
add_record("kdiffuse_10_1", "k-diffuse", "Gamma(10, 1)", gam(10, 1), "chosen by eye", 2025,
           "Vicentini and Jermyn (2025), Fig. 1 illustration",
           one_line_error = "The same (a, b) is diffuse at n = 10 but narrow and left-shifted relative to n at n = 100.",
           design = list(D(10), D(100)))
# DORO: uniform on {1, ..., n}; start from Dorazio's table (n <= 50), the previous solution otherwise
dorazio_start <- list(`5` = c(0.541, 0.096), `10` = c(0.525, 0.046), `20` = c(0.501, 0.021), `50` = c(0.467, 0.007))
prev <- c(0.5, 0.05)
for (n in c(5, 10, 20, 50, 53, 100)) {
  st <- if (!is.null(dorazio_start[[as.character(n)]])) dorazio_start[[as.character(n)]] else prev
  fit <- doro_fit(n, n, st)
  prev <- c(fit$a, fit$b)
  g("record", paste0("doro_n", n), n, "a", fit$a, "Nelder-Mead from Dorazio's table (n <= 50) or the previous n")
  g("record", paste0("doro_n", n), n, "b", fit$b)
  g("record", paste0("doro_n", n), n, "kl", fit$kl)
  add_record(paste0("doro_n", n), "doro", sprintf("DORO, n = %d", n), gam(fit$a, fit$b), "solved per n: KL to the uniform on {1, ..., n}", 2009,
             if (n == 53) "Dorazio (2009), fish application (n = 53)" else if (n == 100) "Dorazio (2009) rule; n = 100 as in Vicentini and Jermyn (2025), Table 1" else "Dorazio (2009), Table 1",
             one_line_error = "A flat count target is out of reach: the closest Gamma mixes a spike at one cluster with a hump near n, the gap grows with n and b goes to 0, so the prior expects about n / 2 clusters.",
             design = list(D(n, KL = r6(fit$kl), start_a = r6(st[1]), start_b = r6(st[2]))))
}
# DORO-Unif at J = 100 (mu_K = 5, 10, 30)
for (mu in c(5, 10, 30)) {
  top <- 2 * mu - 1
  st <- f4[f4$prior_label == "DORO-Unif" & f4$mu_K == mu, c("a", "b")]
  fit <- doro_fit(100, top, c(st$a, st$b))
  p_top <- marginal_pmf(100, fit$a, fit$b, logS, top)
  id <- paste0("doro_unif_mu", mu, "_J100")
  g("record", id, 100, "a", fit$a, "Nelder-Mead from OSM Table F.4"); g("record", id, 100, "b", fit$b)
  g("record", id, 100, "kl", fit$kl); g("record", id, 100, "leak", 1 - sum(p_top))
  add_record(id, "doro-unif", sprintf("DORO-Unif, mu_K = %d, J = 100", mu), gam(fit$a, fit$b),
             sprintf("solved per J: KL to the uniform on {1, ..., 2 mu_K - 1} = {1, ..., %d}", top), 2026,
             "The paper's DORO-Unif variant (OSM Table F.4)",
             one_line_error = "Even a flat target near mu_K cannot be met: mass piles at K = 1 and leaks beyond the target's support.",
             design = list(D(100, support_max = top, KL = r6(fit$kl), leak = r6(1 - sum(p_top)), F4_a = r6(st$a), F4_b = r6(st$b))))
}
# SCAL: solved at m = 6, ..., 100, the tabulated m = 100 and the shortcut at m = 100
for (s in scal) {
  add_record(paste0("scal_m", s$m), "scal", sprintf("SCAL, m = %d", s$m), gam(s$exact$a, s$exact$b),
             "solved per m: P(K_m = 1) = .34 and P(K_m >= ceil(2 ln m)) = .15", 2012,
             "Murugiah and Sweeting (2012); tabulated for m = 25 to 100 by Vicentini and Jermyn (2025), Table 2",
             one_line_error = "Transporting two count tails fixes a 34% prior on a single cluster at every m, and the weights are left uncontrolled.",
             design = list(D(s$m, q = s$q, P_tail = s$exact$pGEq, published_a = s$published$a, published_b = s$published$b)))
}
sp <- scal[[length(scal)]]
add_record("scal_published_m100", "scal", "SCAL, m = 100, tabulated", gam(sp$published$a, sp$published$b),
           "tabulated (a, b) at m = 100", 2012, "Vicentini and Jermyn (2025), Table 2 (Murugiah and Sweeting's rule)",
           one_line_error = "Fixing the count tails does not control the weights: the majority-mass probability exceeds the vague default's.",
           design = list(D(100, q = sp$q, P_tail = sp$published$pGEq)))
add_record("scal_shortcut_m100", "scal-shortcut", "SCAL shortcut, m = 100", gam(sp$shortcut$a, sp$shortcut$b),
           "a = b = exp(-0.033 m)", 2012, "Murugiah and Sweeting (2012), shortcut formula",
           one_line_error = "The shortcut collapses beyond m = 25: at m = 100 it is a quasi-degenerate prior that expects a single cluster.",
           design = list(D(100, q = sp$q, P_tail = sp$shortcut$pGEq)))
# SSI-Weight and the Vicentini and Jermyn (2025) exemplars (Gamma CDF at alpha = 1 and 2)
add_record("ssi_weight", "ssi", "SSI-Weight", gam(ssi_a, ssi_b), "J-invariant: Pr(W_SB > .5) = .25 and Pr(W_SB > .9) = .05", 2025,
           "The paper's SSI-Weight comparator (replication calibration/policy.yml), after Vicentini and Jermyn (2025)",
           one_line_error = "Fixing only the weight tails leaves the count unprotected: E K_J grows without bound as J grows.",
           design = list(D(25), D(100)), extra = list(E_K_more = lapply(c(25, 1000, 2000, 5000), function(J) list(J = J, E_K = r6(marginal_mean(J, ssi_a, ssi_b))))))
ssi_interval <- function(p1, p12, start) {
  f <- function(p) (pgamma(1, exp(p[1]), exp(p[2])) - p1)^2 + (pgamma(2, exp(p[1]), exp(p[2])) - p12)^2
  o <- stats::optim(log(start), f, method = "Nelder-Mead", control = list(reltol = 1e-16, maxit = 4000))
  c(a = exp(o$par[1]), b = exp(o$par[2]))
}
v1 <- ssi_interval(1 / 3, 2 / 3, c(1.814, 1.036))
add_record("ssi_thirds", "ssi-vicentini", "SSI (1/3, 1/3, 1/3)", gam(v1[["a"]], v1[["b"]]),
           "J-invariant: P(alpha in (0, 1], (1, 2], (2, inf)) = (1/3, 1/3, 1/3)", 2025, "Vicentini and Jermyn (2025), Table 4",
           one_line_error = "No n anywhere in the rule: the same prior expects a growing number of clusters as the design grows.")
v2 <- ssi_interval(1 / 2, 3 / 4, c(1, 0.693))
add_record("ssi_half", "ssi-vicentini", "SSI (1/2, 1/4, 1/4)", gam(v2[["a"]], v2[["b"]]),
           "J-invariant: P(alpha in (0, 1], (1, 2], (2, inf)) = (1/2, 1/4, 1/4)", 2025, "Vicentini and Jermyn (2025), Table 4",
           one_line_error = "Half the prior mass on alpha <= 1 makes a majority-mass cluster likely, and the count still drifts with J.")
# quasi-degenerate Gamma(eps, eps)
for (eps in c(0.1, 0.037, 0.01, 0.001)) {
  add_record(sprintf("quasi_%g", eps), "quasi-degenerate", sprintf("Gamma(%g, %g)", eps, eps), gam(eps, eps),
             "fixed (a, b) = (eps, eps) at every J", 1995,
             "Escobar and West (1995), a, b -> 0; BUGS Gamma(0.001, 0.001) (Lunn et al., 2012)",
             one_line_error = "Looks flat on log alpha, yet it is the most informative prior about K: it expects a single cluster.")
}
# Jeffreys (Rodriguez 2013, via Vicentini and Jermyn 2025)
for (n in c(10, 100)) {
  add_record(sprintf("jeffreys_n%d", n), "jeffreys", sprintf("Jeffreys, n = %d", n), list(type = "jeffreys", n = n),
             "depends on n only: p(alpha) proportional to sqrt(I_n(alpha))", 2013,
             "Rodriguez (2013)", via = "Vicentini and Jermyn (2025), Sec. 3.1.4 (Rodriguez 2013 not in the reference folder)",
             one_line_error = "The 'objective' prior is symmetric about n / 2 with spikes at one cluster and at all singletons, so it contradicts DORO's flat target.",
             design = list(D(n)))
}
# Stirling-gamma (Zito, Rigon and Dunson 2024), reference size m = 100
for (ab in list(c(4, 1), c(1, 0.25))) {
  add_record(sprintf("sg_%g_%g_m100", ab[1], ab[2]), "stirling-gamma", sprintf("Stirling-gamma Sg(%g, %g, 100)", ab[1], ab[2]),
             list(type = "sg", a = ab[1], b = ab[2], m = 100), "reference size m: E(K_m) = a / b exactly", 2024,
             "Zito, Rigon and Dunson (2024)",
             one_line_error = "Pins E(K_m) = a / b at the reference size and grows slowly beyond it, but its weight implications were not examined.",
             design = list(D(100)))
}
# DPprior's own calibrations at J = 100 (OSM Table F.4: mu_K = 5, VIF = 2.5)
ts <- f4[f4$prior_label == "TSMM" & f4$mu_K == 5 & f4$VIF == 2.5, ]
da <- f4[f4$prior_label == "Dual-Anchor" & f4$mu_K == 5 & f4$VIF == 2.5, ]
add_record("tsmm_J100", "dpprior", "TSMM, J = 100, mu_K = 5, VIF 2.5", gam(ts$a, ts$b), "solved per J: E(K_J) = 5, Var(K_J) = 10", 2026,
           "The paper, OSM Table F.4 (count-only calibration)",
           one_line_error = "Hits the count target exactly, and the weight prior it implies comes along unasked.",
           design = list(D(100)))
add_record("dual_anchor_J100", "dpprior", "Dual-Anchor, J = 100, lambda = .16", gam(da$a, da$b), "solved per J: count target plus Pr(W_SB > .5) <= .40", 2026,
           "The paper, OSM Table F.4 (Dual-Anchor, lambda = .16)",
           one_line_error = "Trades a little count accuracy for a stated weight bound, and stays in the few-clusters, little-dominance corner at J = 50, 100 and 500.",
           design = list(D(100, lambda = da$selected_lambda)))

# =============================================================================
# Step 7.3: the M-08 timeline (nine nodes); evidence entries point into records
# =============================================================================
ev <- function(record, q, J = NULL) c(list(record = record, q = q), if (!is.null(J)) list(J = J))
node <- function(id, year, title, records_, assumption, count, weight, j_dependence, one_line_error, evidence, explorers) {
  short <- c(antoniak = "Antoniak", kdiffuse = "K-diffuse", moments = "Moment matching", doro = "DORO", scal = "SCAL",
             jeffreys = "Jeffreys", defaults = "Defaults, Sg", ssi = "SSI", dpprior = "DPprior")[[id]]
  list(id = id, year = year, short = short, title = title, records = records_, assumption = assumption, count = count, weight = weight,
       j_dependence = j_dependence, one_line_error = one_line_error, evidence = evidence, explorers = explorers)
}
lnk <- function(id, href) list(id = id, href = href)
timeline <- list(
  node("antoniak", "1974", "Antoniak: the count given alpha", list("fixed_alpha_1"),
       "alpha is fixed, or given a prior", "E(K_J | alpha) = sum over i of alpha / (alpha + i - 1), about alpha log J",
       "W_SB ~ Beta(1, alpha): Pr(W_SB > t | alpha) = (1 - t)^alpha", "count: J-dependent; weights: J-invariant",
       "One number, alpha, sets both the count and the weights.",
       list(ev("fixed_alpha_1", "E_K", 50), ev("fixed_alpha_1", "E_K", 500), ev("fixed_alpha_1", "S50")),
       list(lnk("C-04", "pages/bridge/two-lenses.html"), lnk("M-07", "pages/bridge/gamma11.html"))),
  node("kdiffuse", "1993/95", "K_n-diffuse Gamma priors", list("kdiffuse_5_0.5_n74", "kdiffuse_3.5_0.5_n53", "kdiffuse_10_1"),
       "pick (a, b) by eye so K_n is spread over a wide range at the study's n", "wide at the chosen n; narrow and left-shifted relative to n elsewhere",
       "E(alpha) of 7 to 10: a dominant cluster is all but ruled out", "chosen for one n; no rule for another",
       "Diffuse in K means extreme in weights.",
       list(ev("kdiffuse_5_0.5_n74", "design.E_K", 74), ev("kdiffuse_5_0.5_n74", "S50")),
       list(lnk("M-13", "pages/problems/other-defaults.html#kn-diffuse"))),
  node("moments", "2007", "Moment matching", list("tsmm_J100"),
       "match approximate prior moments of K (Jara et al., 2007); the paper's TSMM is the exact version", "E(K_J) and Var(K_J) hit their targets at the design J",
       "not targeted: whatever Pr(W_SB > .5) the count target implies", "solved per J",
       "A count match leaves the weights to chance.",
       list(ev("tsmm_J100", "E_K", 100), ev("tsmm_J100", "S50")),
       list(lnk("M-16", "pages/problems/method-map.html#transported-vs-recalibrated"), lnk("M-03", "pages/problems/unintended-prior.html"))),
  node("doro", "2009", "DORO: KL to a uniform count", list("doro_n10", "doro_n50", "doro_n100", "doro_unif_mu5_J100"),
       "the least informative count prior is uniform on {1, ..., n} (Dorazio, 2009)", "a spike at K = 1 and a hump near n, never flat; mean about n / 2; the KL gap grows with n",
       "E(alpha) grows with n: little dominance", "solved per n",
       "A flat count target is out of reach; the closest Gamma expects about n / 2 clusters.",
       list(ev("doro_n100", "design.KL", 100), ev("doro_n100", "design.E_K", 100), ev("doro_unif_mu5_J100", "P_K1", 100)),
       list(lnk("M-09", "pages/problems/doro.html"), lnk("M-04", "pages/problems/method-problems-strip.html"))),
  node("scal", "2012", "SCAL: fixed count tails", list("scal_m100", "scal_published_m100", "scal_shortcut_m100"),
       "P(K_m = 1) = .34 and P(K_m >= ceil(2 ln m)) = .15 carried to every m (Murugiah and Sweeting, 2012)", "both tails clamped; the middle barely moves",
       "not targeted: Pr(W_SB > .5) exceeds the vague default's", "solved per m; the shortcut exp(-0.033 m) collapses",
       "Fixing count tails does not control the weights, and the shortcut collapses to one cluster.",
       list(ev("scal_published_m100", "S50"), ev("vague", "S50"), ev("scal_shortcut_m100", "P_K1", 100)),
       list(lnk("M-10", "pages/problems/scal.html"), lnk("M-12", "pages/problems/other-defaults.html#quasi-degenerate"))),
  node("jeffreys", "2013", "Jeffreys prior for alpha", list("jeffreys_n10", "jeffreys_n100"),
       "p(alpha) proportional to the square root of the Fisher information (Rodriguez, 2013)", "symmetric about n / 2: spikes at K = 1 and K = n over a nearly flat floor",
       "heavy tail in alpha: little dominance", "depends on n only",
       "Two 'objective' priors disagree: Jeffreys puts spikes at one cluster and at all singletons, DORO wants every count equally likely.",
       list(ev("jeffreys_n100", "design.E_K", 100), ev("jeffreys_n100", "design.P_K1", 100)),
       list(lnk("M-14", "pages/problems/other-defaults.html#objective-priors"))),
  node("defaults", "2023/24", "Defaults and the Stirling-gamma", list("vague", "gamma_1_3", "gamma_2_4", "sg_4_1_m100"),
       "fixed Gamma(1, 1), Gamma(1, 3), Gamma(2, 4) (Paganin et al., 2023; Zito et al., 2024); Sg(a, b, m) pins E(K_m)", "Gamma defaults drift like E(alpha) log J; Sg is pinned at its reference m",
       "Gamma(1, 3) and Gamma(2, 4) give a better-than-even chance of a majority-mass cluster", "fixed (a, b): J-dependent count, J-invariant weights",
       "'Conservative' defaults pool hardest, and every fixed Gamma drifts with J.",
       list(ev("gamma_1_3", "S50"), ev("gamma_2_4", "S50"), ev("vague", "E_K", 50), ev("vague", "E_K", 500)),
       list(lnk("M-01", "pages/problems/defaults-drift.html"), lnk("M-19", "pages/problems/other-defaults.html#stirling-gamma"))),
  node("ssi", "2025", "SSI: fixed weight tails", list("ssi_weight", "ssi_thirds", "ssi_half"),
       "state the weights (or alpha intervals), never n (Vicentini and Jermyn, 2025; the paper's SSI-Weight)", "E K_J grows without bound: about E(alpha) log J",
       "Pr(W_SB > .5) = .25 and Pr(W_SB > .9) = .05 at every J", "J-invariant by design",
       "A plausible weight judgment implies an implausible count as J grows.",
       list(ev("ssi_weight", "E_K", 50), ev("ssi_weight", "E_K", 500), ev("ssi_weight", "S50")),
       list(lnk("M-11", "pages/problems/ssi.html"))),
  node("dpprior", "2026", "DPprior: both lenses, per design", list("tsmm_J100", "dual_anchor_J100"),
       "state a count target at the design J, then bound the majority-mass probability", "E(K_J) near the target at the design J",
       "Pr(W_SB > .5) held at or below .40", "solved per J",
       "One alpha cannot buy few clusters and little dominance at no cost; the Dual-Anchor makes the trade explicit.",
       list(ev("dual_anchor_J100", "E_K", 100), ev("dual_anchor_J100", "S50"), ev("tsmm_J100", "S50")),
       list(lnk("M-15", "pages/problems/method-map.html")))
)

out <- list(
  source = "r-export/02_methods_catalog.R",
  dpprior = "DPprior 2.0.0 (load_all)", r_version = paste("R", getRversion()),
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
  method = "integrate() on log-alpha panels ([0, 1e-12] -> alpha -> 0 limit); DORO fits by Nelder-Mead on the integrate() KL (DPprior_a2_kl pmf M = 320 or published starts); SCAL by Nelder-Mead on the two tails; Jeffreys and Stirling-gamma by integrate() on log alpha over the whole line; J > 500 digamma",
  schema = "data/precomputed/method_catalog_schema.md",
  references = list(
    doro = "Dorazio (2009), uniform count target; DORO-Unif variant on {1, ..., min(2 mu_K - 1, J)} as in the paper's simulation",
    scal = "Murugiah & Sweeting (2012); tabulated (a, b) for m = 25, 50, 75, 100 as in Vicentini et al. (2025); exact = the two tail equations solved here",
    ssi = "SSI-Weight comparator of the paper (in the spirit of Vicentini et al., 2025), solved from the replication policy"),
  vague = vague, doro = doro, scal = scal, ssi = ssi,
  J_set = J_SET, records = records, timeline = timeline)
json <- jsonlite::toJSON(out, auto_unbox = TRUE, digits = NA, pretty = TRUE, null = "null")
dir.create(file.path(EXPL, "data", "precomputed"), showWarnings = FALSE, recursive = TRUE)
writeLines(json, file.path(EXPL, "data", "precomputed", "method_catalog.json"))
writeLines(c("// written by r-export/02_methods_catalog.R; do not edit", paste0("export default ", json, ";")),
           file.path(EXPL, "data", "precomputed", "method_catalog.js"))

gold <- do.call(rbind, golden)
gold$value <- sprintf("%.17g", gold$value)
gpath <- file.path(EXPL, "verification", "golden", "method_catalog.csv")
utils::write.csv(gold, gpath, row.names = FALSE)
man_path <- file.path(EXPL, "verification", "golden", "golden_manifest.csv")
man <- utils::read.csv(man_path, stringsAsFactors = FALSE, colClasses = "character")
man <- man[man$file != "method_catalog.csv", ]
sha <- strsplit(system2("shasum", c("-a", "256", shQuote(gpath)), stdout = TRUE), " ")[[1]][1]
man <- rbind(man, data.frame(file = "method_catalog.csv", sha256 = sha, rows = as.character(nrow(gold)),
                             dpprior = "DPprior 2.0.0 (load_all)", r_version = paste("R", getRversion()),
                             method = "02_methods_catalog.R: DORO/DORO-Unif (Nelder-Mead on the integrate() KL), SCAL solved/published/shortcut, SSI (pcv_solve_ssi), Vague, Step 7.3 records (Gamma and point-mass rows)",
                             M = "integrate (DORO-Unif starts: DPprior_a2_kl Gauss-Laguerre M = 320)", seed = "NA", eps_alpha = "1e-12",
                             int_rel_tol = "1e-11", generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
                             notes = "summary rows for M-04 and the Phase 7 records; parity rows in parity_spec.csv"))
utils::write.csv(man, man_path, row.names = FALSE)

cat(sprintf("Vague J=100: P(K=1) %.4f, E K %.4f, S(.5) %.4f\n", v$pK1, v$EK, v$S50))
for (d in doro) cat(sprintf("DORO %-14s J=%3d mu=%d -> (%.4f, %.4f): P(K=1) %.4f, leak %.4f, KL %.4f, E K %.3f\n", d$label, d$J, d$muK, d$a, d$b, d$pK1, d$leak, d$kl, d$EK))
for (s in scal) cat(sprintf("SCAL m=%3d q=%d exact (%.4f, %.4f): P(K=1) %.4f, P(K>=q) %.4f, E K %.3f, S(.5) %.3f | published (%.3f, %.3f) E K %.3f | shortcut %.4f: P(K=1) %.4f, E K %.3f\n",
                            s$m, s$q, s$exact$a, s$exact$b, s$exact$pK1, s$exact$pGEq, s$exact$EK, s$exact$S50, s$published$a, s$published$b, s$published$EK, s$shortcut$a, s$shortcut$pK1, s$shortcut$EK))
cat(sprintf("SSI (%.6f, %.6f): S(.5) %.4f S(.9) %.4f; E K_J %s\n", ssi_a, ssi_b, ssi$S50, ssi$S90, paste(sprintf("%d:%.2f", ssi_J, ssi_EK), collapse = " ")))
cat(sprintf("records: %d; timeline nodes: %d; golden rows: %d\n", length(records), length(timeline), nrow(gold)))
cat(sprintf("done in %.1f s\n", as.numeric(difftime(Sys.time(), t0, units = "secs"))))
