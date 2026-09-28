# Independent quadrature for r-export scripts 14 and 15: every Gamma(a, b)
# expectation is an integral over u in (0, 1) with alpha = qgamma(u, a, b), on fixed u panels,
# with stats::integrate. It shares nothing with the log-alpha grid of dp-core or with the
# log-alpha panels of _helpers.R, so the golden values it writes are an independent check.

# conditional moments of K_J given alpha (finite sums; alpha = 0 and Inf are the limits)
kappa <- function(al, J) {
  r <- seq_len(J - 1)
  vapply(al, function(x) if (x <= 0) 1 else if (!is.finite(x)) J else 1 + sum(x / (x + r)), 0)
}
vcond <- function(al, J) {
  r <- seq_len(J - 1)
  vapply(al, function(x) if (x <= 0 || !is.finite(x)) 0 else sum(x * r / (x + r)^2), 0)
}
# alpha * kappa'(alpha) = sum alpha r / (alpha + r)^2, which equals vcond
dkappa_x <- function(al, J) vcond(al, J)
# P(K_J = 1 | alpha) = Gamma(J) Gamma(alpha + 1) / Gamma(alpha + J); 1 at alpha = 0
pk1 <- function(al, J) ifelse(al <= 0, 1, ifelse(is.finite(al), exp(lgamma(J) + lgamma(al + 1) - lgamma(al + J)), 0))

U_BREAKS <- c(0, 1e-12, 1e-9, 1e-6, 1e-4, 1e-3, 0.01, 0.05, 0.2, 0.5, 0.8, 0.95, 0.99, 0.999,
              1 - 1e-4, 1 - 1e-6, 1 - 1e-9, 1 - 1e-12, 1)
u_expect <- function(h, a, b) {
  f <- function(u) h(qgamma(u, shape = a, rate = b))
  s <- 0
  for (i in seq_len(length(U_BREAKS) - 1)) {
    s <- s + stats::integrate(f, U_BREAKS[i], U_BREAKS[i + 1], rel.tol = 1e-12, abs.tol = 1e-16,
                              subdivisions = 5000L, stop.on.error = FALSE)$value
  }
  s
}
moments <- function(J, a, b) {
  m1 <- u_expect(function(al) kappa(al, J), a, b)
  m2 <- u_expect(function(al) kappa(al, J)^2, a, b)
  ev <- u_expect(function(al) vcond(al, J), a, b)
  c(M1 = m1, V = ev + m2 - m1^2)
}
