# Shared numerical helpers for r-export scripts 02+ (01_golden_closed_forms.R keeps its own
# copy so that the Phase 1 golden files stay byte-identical). Same rules as CONTRACT.md:
# Gamma mixtures by integrate() on log-alpha panels cut at gamma quantiles; the mass on
# [0, 1e-12] goes to the alpha -> 0 limit; never Gauss-Laguerre M = 80.
EPS_ALPHA <- 1e-12
PANEL_PROBS <- c(1e-15, 1e-12, 1e-9, 1e-6, 1e-4, 1e-3, 0.01, 0.05,
                 seq(0.1, 0.9, by = 0.1), 0.95, 0.99, 0.999,
                 1 - 1e-4, 1 - 1e-6, 1 - 1e-9, 1 - 1e-12, 1 - 1e-15)

panel_edges <- function(a, b) {
  q <- qgamma(PANEL_PROBS, shape = a, rate = b)
  hi <- qgamma(1 - 1e-15, shape = a, rate = b)
  x <- sort(unique(log(c(EPS_ALPHA, q[q > EPS_ALPHA & q < hi], hi))))
  out <- x[1]
  for (i in seq_len(length(x) - 1)) {
    n_sub <- max(1, ceiling((x[i + 1] - x[i]) / 0.5))
    out <- c(out, seq(x[i], x[i + 1], length.out = n_sub + 1)[-1])
  }
  out
}

mix_expect <- function(h, a, b, h0) {
  total <- h0 * pgamma(EPS_ALPHA, shape = a, rate = b)
  edges <- panel_edges(a, b)
  f <- function(x) { al <- exp(x); h(al) * exp(dgamma(al, shape = a, rate = b, log = TRUE) + x) }
  for (i in seq_len(length(edges) - 1)) {
    total <- total + stats::integrate(f, edges[i], edges[i + 1], rel.tol = 1e-11, abs.tol = 1e-16,
                                      subdivisions = 2000L, stop.on.error = FALSE)$value
  }
  total
}

kappa_dg <- function(alpha, J) alpha * (digamma(alpha + J) - digamma(alpha))

# marginal pmf P(K_J = k), k = 1..kmax, under Gamma(a, b) (logS: package Stirling table)
marginal_pmf <- function(J, a, b, logS, kmax = J) {
  L <- logS[J + 1, (1:J) + 1]
  vapply(seq_len(kmax), function(k) {
    h <- function(al) exp(L[k] + k * log(al) + lgamma(al) - lgamma(al + J))
    mix_expect(h, a, b, h0 = as.numeric(k == 1))
  }, 0)
}
marginal_mean <- function(J, a, b) mix_expect(function(al) kappa_dg(al, J), a, b, h0 = 1)
wsb_tail <- function(t, a, b) exp(-a * log1p(-log1p(-t) / b))

# --- priors on alpha beyond the Gamma (Steps 7.3, 7.9) -------------------------------------------
# A prior is list(type = "gamma", a, b) | list(type = "point", alpha) | list(type = "jeffreys", n) |
# list(type = "sg", a, b, m) (Stirling-gamma, Zito, Rigon and Dunson 2024). Jeffreys and
# Stirling-gamma densities are known up to a constant: E[h(alpha)] integrates h f / integral f on
# log alpha in unit panels over [-40, 40] plus the two infinite end panels (the integrands decay
# exponentially in log alpha there), after scaling f by its maximum on a grid.
LOG_EDGES <- seq(-40, 40, by = 1)

# log of the rising factorial (alpha)_J = Gamma(alpha + J) / Gamma(alpha): lgamma difference up to
# alpha = 1e3, the direct sum of log(alpha + j) above (the lgamma difference cancels catastrophically
# at alpha ~ 1e17, where the log-alpha integrals reach)
log_rising_any <- function(al, J) {
  out <- lgamma(al + J) - lgamma(al)
  big <- al > 1e3
  if (any(big)) out[big] <- colSums(log(outer(0:(J - 1), al[big], "+")))
  out
}
# E(K_J | alpha) for any alpha: digamma form, or J - sum j / (alpha + j) above 1e4 (cancellation)
kappa_any <- function(al, J) {
  out <- rep(1, length(al)) # alpha -> 0 (exp(x) underflows to 0 far out on the log-alpha line)
  pos <- al > 0
  out[pos] <- kappa_dg(al[pos], J)
  big <- al > 1e4
  if (any(big)) out[big] <- J - colSums((0:(J - 1)) / outer(0:(J - 1), al[big], "+"))
  out
}
jeffreys_logf <- function(n) {
  j <- seq_len(n - 1)
  function(al) 0.5 * log(colSums(j / outer(j, al, "+")^2) / al) # I(alpha) = sum j/(alpha+j)^2 / alpha
}
sg_logf <- function(a, b, m) function(al) (a - 1) * log(al) - b * log_rising_any(al, m)

prior_setup <- function(prior) {
  if (prior$type %in% c("jeffreys", "sg")) {
    prior$logf <- if (prior$type == "jeffreys") jeffreys_logf(prior$n) else sg_logf(prior$a, prior$b, prior$m)
    xs <- seq(-40, 40, by = 0.02)
    prior$shift <- max(prior$logf(exp(xs)) + xs)
    prior$Z <- dens_integral(prior, function(al) rep(1, length(al)))
  }
  prior
}
dens_integral <- function(prior, h) {
  g <- function(x) {
    v <- numeric(length(x))
    ok <- is.finite(x) # integrate() may probe x = +-Inf on the end panels
    al <- exp(x[ok])
    v[ok] <- h(al) * exp(prior$logf(al) - prior$shift + x[ok])
    v[!is.finite(v)] <- 0
    v
  }
  e <- c(-Inf, LOG_EDGES, Inf)
  total <- 0
  for (i in seq_len(length(e) - 1)) {
    total <- total + stats::integrate(g, e[i], e[i + 1], rel.tol = 1e-11, abs.tol = 1e-16,
                                      subdivisions = 2000L, stop.on.error = FALSE)$value
  }
  total
}
# E[h(alpha)] under any prior; h0 = h(0+) for the Gamma floor mass
prior_expect <- function(prior, h, h0) {
  switch(prior$type,
         gamma = mix_expect(h, prior$a, prior$b, h0),
         point = h(prior$alpha),
         dens_integral(prior, h) / prior$Z)
}
prior_mean_K <- function(prior, J) prior_expect(prior, function(al) kappa_any(al, J), h0 = 1)
prior_pK1 <- function(prior, J) {
  if (J == 1) return(1)
  # P(K_J = 1 | alpha) = alpha (J - 1)! / (alpha)_J
  prior_expect(prior, function(al) exp(log(al) + lgamma(J) - log_rising_any(al, J)), h0 = 1)
}
prior_wsb_tail <- function(prior, t) {
  if (prior$type == "gamma") return(wsb_tail(t, prior$a, prior$b))
  prior_expect(prior, function(al) exp(al * log1p(-t)), h0 = 1)
}
prior_pmf <- function(prior, J, logS, kmax = J) {
  if (prior$type == "gamma") return(marginal_pmf(J, prior$a, prior$b, logS, kmax))
  L <- logS[J + 1, (1:J) + 1]
  vapply(seq_len(kmax), function(k) {
    h <- function(al) exp(L[k] + k * log(al) - log_rising_any(al, J))
    prior_expect(prior, h, h0 = as.numeric(k == 1))
  }, 0)
}
# discrete quantile: min k with cdf(k) >= p
pmf_q <- function(p, prob) which(cumsum(p) >= prob - 1e-12)[1]
