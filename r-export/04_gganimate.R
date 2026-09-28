#!/usr/bin/env Rscript
# =============================================================================
# 04_gganimate.R  (Step 4.8, catalog P-17; Step 10.1, catalog A-16)
#
# stick  "Stick-breaking by alpha": 50 independent GEM(alpha) sticks, pieces ranked by size,
#        morphing through alpha = 0.5 -> 2 -> 10. Runtime-free fallback for the talk.
#          media/stick_alpha.mp4      1280 x 720, ~15 s, H.264 (ffmpeg)
#          media/stick_alpha_key.png  the three states side by side
# crp    (A-16) 79 customers arriving at a Chinese restaurant, alpha = 1 (the default Gamma(1, 1)
#        mean) next to alpha = 5, tables as circles with their occupancy, K_N counter and
#        E[K_N | alpha] (DPprior mean_K_given_alpha). One seating per panel, the first seed whose
#        final K_79 equals round(E[K_79 | alpha]).
#          media/crp_growth.mp4, crp_growth_key.png
# kprior (A-16) the prior pmf of K_J under Gamma(1, 1) as J sweeps 10 -> 500, mixed over alpha by
#        integrate() (the project's rule: no fixed-node quadrature for the golden-type numbers),
#        with Pr(W_SB > .5) = b^a / (b + log 2)^a = .591 noted as the same at every J.
#          media/k_prior_by_J.mp4, k_prior_by_J_key.png
# ANIM selects the pieces (default "stick,crp,kprior"); Step 10.1 ran ANIM=crp,kprior so the
# Step 4.8 video was not re-encoded.
# theme_DPprior comes from the DPprior 2.0.0 source via pkgload::load_all (this process only).
# Stick-breaking is simulated directly from its definition (V_k ~ Beta(1, alpha)); no
# code from Broderick's GPL-3 demos is used. Colours: the site's light-mode Broderick
# tokens (styles/tokens.css), grey for the leftover below 1e-3.
# Run from r-export/:  Rscript 04_gganimate.R      (ANIM=crp,kprior Rscript 04_gganimate.R)
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
PKG <- need_dir("DPPRIOR_PKG", "the DPprior 2.0.0 source tree")
OUT <- file.path(EXPL, "media")
dir.create(OUT, showWarnings = FALSE)
stopifnot(read.dcf(file.path(PKG, "DESCRIPTION"), fields = "Version")[1, 1] == "2.0.0")
suppressMessages(pkgload::load_all(PKG, export_all = TRUE, helpers = FALSE, quiet = TRUE))
suppressPackageStartupMessages({
  library(ggplot2)
  library(gganimate)
})

BROD <- c("#2e64ce", "#f28c21", "#3e9d57", "#8b60bc", "#d72438", "#e6c229")  # tokens.css --b-1..6 (light)
REST <- "#c3cbd0"                                                             # --b-unused
WHICH <- strsplit(Sys.getenv("ANIM", "stick,crp,kprior"), ",")[[1]]
MP4 <- function() ffmpeg_renderer(format = "mp4", options = list(pix_fmt = "yuv420p", vcodec = "libx264", crf = "26"))

if ("stick" %in% WHICH) {
  ALPHAS <- c(0.5, 2, 10)
  ROWS <- 50
  EPS <- 1e-3
  set.seed(20260926)

  gem <- function(alpha) {
    w <- numeric(0)
    rest <- 1
    while (rest >= EPS && length(w) < 5000) {
      v <- 1 - (1 - runif(1))^(1 / alpha)      # Beta(1, alpha) by inversion
      w <- c(w, rest * v)
      rest <- rest * (1 - v)
    }
    list(w = w, rest = rest)
  }

  label_of <- function(a) sprintf("alpha = %s     E[w1] = 1/(1 + alpha) = %s     Pr(w1 > .5) = 0.5^alpha = %s",
                                  format(a), sub("^0", "", sprintf("%.3f", 1 / (1 + a))),
                                  sub("^0", "", sprintf("%.3f", 0.5^a)))
  levels_lab <- vapply(ALPHAS, label_of, "")

  rows <- list()
  for (a in ALPHAS) {
    for (r in seq_len(ROWS)) {
      g <- gem(a)
      w <- sort(g$w, decreasing = TRUE)                 # ranked by size
      x1 <- cumsum(w)
      x0 <- c(0, head(x1, -1))
      k <- seq_along(w)
      rows[[length(rows) + 1]] <- data.frame(state = label_of(a), alpha = a, row = r, k = k,
                                             xmin = x0, xmax = x1, fill = BROD[(k - 1) %% 6 + 1])
      rows[[length(rows) + 1]] <- data.frame(state = label_of(a), alpha = a, row = r, k = 9999,
                                             xmin = 1 - g$rest, xmax = 1, fill = REST)
    }
  }
  df <- do.call(rbind, rows)
  df$state <- factor(df$state, levels = levels_lab)
  df$id <- paste(df$row, df$k)                            # the same (row, rank) morphs across states
  cat(sprintf("rects per state: %s\n", paste(table(df$alpha), collapse = " / ")))

  base <- ggplot(df) +
    geom_rect(aes(xmin = xmin, xmax = xmax, ymin = row - 0.42, ymax = row + 0.42, fill = fill, group = id),
              colour = "white", linewidth = 0.08) +
    scale_fill_identity() +
    scale_x_continuous("share of the stick (pieces ranked by size)", limits = c(0, 1), expand = c(0, 0),
                       breaks = c(0, .25, .5, .75, 1), labels = c("0", ".25", ".50", ".75", "1")) +
    scale_y_reverse(NULL, breaks = NULL, expand = c(0.01, 0.01)) +
    theme_DPprior(base_size = 15) +
    theme(plot.title = element_text(size = 19, hjust = 0), plot.subtitle = element_text(hjust = 0, colour = "grey25"),
          plot.caption = element_text(size = 10, colour = "grey35"), plot.margin = margin(14, 24, 10, 24),
          panel.grid = element_blank())

  anim <- base +
    labs(title = "Stick-breaking by alpha: 50 independent sticks, pieces ranked by size",
         subtitle = "{closest_state}",
         caption = "V_k ~ Beta(1, alpha), w_k = V_k x (what is left); grey = leftover below .001. After Broderick (MLSS 2016). DPprior Explorer, P-17.") +
    transition_states(state, transition_length = 3, state_length = 4, wrap = FALSE) +
    ease_aes("cubic-in-out") +
    enter_fade() + exit_fade()

  mp4 <- file.path(OUT, "stick_alpha.mp4")
  res <- animate(anim, nframes = 225, fps = 15, width = 1280, height = 720, res = 110,
                 renderer = ffmpeg_renderer(format = "mp4", options = list(pix_fmt = "yuv420p", vcodec = "libx264", crf = "26")))
  file.copy(as.character(res), mp4, overwrite = TRUE)
  cat(sprintf("wrote %s (%.2f MB)\n", mp4, file.size(mp4) / 1e6))

  key <- base +
    facet_wrap(~ state, ncol = 1) +
    labs(title = "Stick-breaking by alpha: 50 independent sticks per panel, pieces ranked by size",
         caption = "V_k ~ Beta(1, alpha); grey = leftover below .001. After Broderick (MLSS 2016). DPprior Explorer, P-17.") +
    theme(strip.text = element_text(hjust = 0, face = "bold", size = 12))
  ggsave(file.path(OUT, "stick_alpha_key.png"), key, width = 12.8, height = 10.8, dpi = 110, bg = "white")
  cat(sprintf("wrote %s\n", file.path(OUT, "stick_alpha_key.png")))
}

if (any(c("crp", "kprior") %in% WHICH)) logS <- compute_log_stirling(500)
theme_anim <- function() {
  theme_DPprior(base_size = 15) +
    theme(plot.title = element_text(size = 19, hjust = 0), plot.subtitle = element_text(hjust = 0, colour = "grey25"),
          plot.caption = element_text(size = 10, colour = "grey35", hjust = 0), plot.margin = margin(14, 24, 10, 24))
}

# ---- crp: 79 arrivals, alpha = 1 against alpha = 5 (A-16) --------------------------------
if ("crp" %in% WHICH) {
  J_CRP <- 79
  A_CRP <- c(1, 5)
  COLS <- 5
  seat <- function(alpha, n) {                 # the table of each customer, in arrival order
    tab <- integer(n)
    counts <- integer(0)
    for (i in seq_len(n)) {
      t <- sample.int(length(counts) + 1L, 1L, prob = c(counts, alpha))   # CRP: n_k / (i - 1 + alpha), alpha / (i - 1 + alpha)
      if (t > length(counts)) counts <- c(counts, 1L) else counts[t] <- counts[t] + 1L
      tab[i] <- t
    }
    tab
  }
  pick <- function(alpha) {                    # the first seed whose K_79 equals round(E[K_79 | alpha])
    target <- round(mean_K_given_alpha(J_CRP, alpha))
    for (sd in 1:10000) {
      set.seed(sd)
      tab <- seat(alpha, J_CRP)
      if (max(tab) == target) return(list(seed = sd, tab = tab, target = target))
    }
    stop("no seed reaches the target")
  }
  runs <- lapply(A_CRP, pick)
  panel_of <- function(a) if (a == 1) "alpha = 1   (the mean of the default Gamma(1, 1))" else sprintf("alpha = %s   (a calibrated contrast)", a)
  fr <- list()
  lb <- list()
  for (j in seq_along(A_CRP)) {
    a <- A_CRP[j]
    tab <- runs[[j]]$tab
    for (N in seq_len(J_CRP)) {
      cnt <- tabulate(tab[1:N])
      t <- seq_along(cnt)
      fr[[length(fr) + 1]] <- data.frame(panel = panel_of(a), N = N, table = t, n = cnt, x = (t - 1) %% COLS, y = -((t - 1) %/% COLS),
                                         fill = BROD[(t - 1) %% 6 + 1], newest = t == tab[N])
      lb[[length(lb) + 1]] <- data.frame(panel = panel_of(a), N = N,
                                         label = sprintf("N = %d customers     K_N = %d tables     E[K_N | alpha] = %.2f", N, length(cnt), mean_K_given_alpha(N, a)))
    }
    cat(sprintf("crp alpha = %s: seed %d, K_79 = %d (E = %.2f), largest table %d\n", a, runs[[j]]$seed, max(tab), mean_K_given_alpha(J_CRP, a), max(tabulate(tab))))
  }
  fr <- do.call(rbind, fr)
  lb <- do.call(rbind, lb)
  fr$panel <- factor(fr$panel, levels = vapply(A_CRP, panel_of, ""))
  lb$panel <- factor(lb$panel, levels = levels(fr$panel))
  rows_needed <- max(-fr$y) + 1
  crp_plot <- function(d, l) {
    ggplot(d) +
      geom_point(aes(x, y, size = n, fill = fill, group = table), shape = 21, colour = "white", stroke = 0.6) +
      geom_point(data = d[d$newest, ], aes(x, y, size = n, group = table), shape = 21, fill = NA, colour = "grey10", stroke = 1.6) +
      geom_text(aes(x, y + 0.42, label = n, group = table), colour = "grey10", size = 4.2, fontface = "bold", vjust = 0) +  # above the largest circle
      geom_text(data = l, aes(x = -0.45, y = 0.95, label = label), hjust = 0, size = 4.6, colour = "grey15") +
      scale_fill_identity() +
      scale_size_area(max_size = 24, limits = c(0, max(fr$n)), guide = "none") +
      scale_x_continuous(NULL, limits = c(-0.5, COLS - 0.5), breaks = NULL) +
      scale_y_continuous(NULL, limits = c(-(rows_needed - 1) - 0.6, 1.15), breaks = NULL) +
      facet_wrap(~ panel, ncol = 2) +
      theme_anim() +
      theme(panel.grid = element_blank(), strip.text = element_text(hjust = 0, face = "bold", size = 13))
  }
  cap <- sprintf("One seating per panel (seeds %d and %d: the first whose K_79 equals round(E[K_79 | alpha]) = %d and %d).\nCircle area = customers; the table that took the newest customer is outlined. E[K_N | alpha] from DPprior 2.0.0. DPprior Explorer, A-16.",
                 runs[[1]]$seed, runs[[2]]$seed, runs[[1]]$target, runs[[2]]$target)
  anim <- crp_plot(fr, lb) +
    labs(title = "The Chinese restaurant, 79 arrivals: alpha = 1 against alpha = 5",
         subtitle = "A new customer joins a table with probability proportional to its size, or opens a new one with weight alpha",
         caption = cap) +
    transition_states(N, transition_length = 1, state_length = 1, wrap = FALSE) +
    ease_aes("cubic-in-out") + enter_grow() + enter_fade()
  mp4 <- file.path(OUT, "crp_growth.mp4")
  res <- animate(anim, nframes = 240, fps = 16, end_pause = 32, width = 1280, height = 720, res = 110, renderer = MP4())
  file.copy(as.character(res), mp4, overwrite = TRUE)
  cat(sprintf("wrote %s (%.2f MB)\n", mp4, file.size(mp4) / 1e6))
  key <- crp_plot(fr[fr$N == J_CRP, ], lb[lb$N == J_CRP, ]) +
    labs(title = "The Chinese restaurant after 79 arrivals: alpha = 1 against alpha = 5", caption = cap)
  ggsave(file.path(OUT, "crp_growth_key.png"), key, width = 12.8, height = 7.2, dpi = 110, bg = "white")
  cat(sprintf("wrote %s\n", file.path(OUT, "crp_growth_key.png")))
}

# ---- kprior: the Gamma(1, 1) prior on K_J as J sweeps 10 -> 500 (A-16) ---------------------
if ("kprior" %in% WHICH) {
  A0 <- 1
  B0 <- 1
  JS <- c(10, 20, 30, 48, 79, 100, 200, 300, 500)
  KMAX <- 30
  S5 <- (B0 / (B0 + log(2)))^A0                  # Pr(W_SB > .5) = E[.5^alpha]: no J in it
  mix_pmf <- function(J) {                       # Pr(K_J = k), k = 1..min(J, KMAX), mixed over alpha by integrate()
    vapply(seq_len(min(J, KMAX)), function(k) {
      f <- function(al) vapply(al, function(a) exp(log_pmf_K_given_alpha(J, a, logS)[k + 1]), 0) * dgamma(al, A0, B0)
      integrate(f, 0, Inf, rel.tol = 1e-10, subdivisions = 1000L)$value
    }, 0)
  }
  mean_K <- function(J) integrate(function(al) vapply(al, function(a) mean_K_given_alpha(J, a), 0) * dgamma(al, A0, B0), 0, Inf, rel.tol = 1e-10)$value
  pf <- list()
  for (J in JS) {
    p <- mix_pmf(J)
    EK <- mean_K(J)
    pr <- function(x) sub("^0", "", sprintf("%.3f", x))
    tail_mass <- if (J > KMAX) max(0, 1 - sum(p)) else 0
    lab <- sprintf("J = %d:   E K_J = %.2f,   Pr(K_J = 1) = %s,   Pr(K_J > %d) %s", J, EK, pr(p[1]), KMAX,
                   if (tail_mass == 0) "= 0" else if (tail_mass < 5e-4) "< .001" else paste("=", pr(tail_mass)))
    pf[[length(pf) + 1]] <- data.frame(J = J, state = lab, k = seq_along(p), p = p, EK = EK)
    cat(sprintf("kprior J = %3d: E K = %.4f, P(K = 1) = %.4f, mass shown %.6f\n", J, EK, p[1], sum(p)))
  }
  pf <- do.call(rbind, pf)
  pf$state <- factor(pf$state, levels = unique(pf$state))
  note <- sprintf("Pr(W_SB > .5) = %s at every J: the stick-breaking tail has no J in it", sub("^0", "", sprintf("%.3f", S5)))
  kp_plot <- function(d) {
    ggplot(d) +
      geom_col(aes(k, p, group = k), fill = BROD[1], width = 0.8) +
      geom_vline(aes(xintercept = EK), linetype = "dashed", colour = "grey20") +
      annotate("label", x = KMAX, y = max(pf$p) * 1.02, label = note, hjust = 1, vjust = 1, size = 4.6, linewidth = 0.3, fill = "#fff8e6") +
      scale_x_continuous(sprintf("K_J, the number of clusters among J units (1 to %d)", KMAX), limits = c(0.4, KMAX + 0.6), breaks = c(1, 5, 10, 15, 20, 25, 30)) +
      scale_y_continuous("prior probability", limits = c(0, max(pf$p) * 1.05), expand = c(0, 0)) +
      theme_anim()
  }
  cap <- "Gamma(1, 1) on alpha, mixed by integrate() over the exact conditional pmf (DPprior 2.0.0, log Stirling numbers). Dashed line: E K_J. DPprior Explorer, A-16."
  anim <- kp_plot(pf) +
    labs(title = "The default Gamma(1, 1) says more clusters as J grows", subtitle = "{closest_state}", caption = cap) +
    transition_states(state, transition_length = 2, state_length = 3, wrap = FALSE) +
    ease_aes("cubic-in-out")
  mp4 <- file.path(OUT, "k_prior_by_J.mp4")
  res <- animate(anim, nframes = 225, fps = 15, end_pause = 20, width = 1280, height = 720, res = 110, renderer = MP4())
  file.copy(as.character(res), mp4, overwrite = TRUE)
  cat(sprintf("wrote %s (%.2f MB)\n", mp4, file.size(mp4) / 1e6))
  key <- kp_plot(pf[pf$J %in% c(10, 79, 500), ]) + facet_wrap(~ state, ncol = 1) +
    labs(title = "The default Gamma(1, 1): the prior on K_J at J = 10, 79 and 500", caption = cap) +
    theme(strip.text = element_text(hjust = 0, face = "bold", size = 12))
  ggsave(file.path(OUT, "k_prior_by_J_key.png"), key, width = 12.8, height = 10.8, dpi = 110, bg = "white")
  cat(sprintf("wrote %s\n", file.path(OUT, "k_prior_by_J_key.png")))
}

cat(sprintf("done in %.1f s\n", as.numeric(difftime(Sys.time(), t0, units = "secs"))))
