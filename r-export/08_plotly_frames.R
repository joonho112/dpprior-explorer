#!/usr/bin/env Rscript
# =============================================================================
# 08_plotly_frames.R  (Step 10.4, catalog X-02)
#
# The alpha sweep at J = 100 as R htmlwidgets, to compare with the site's dp-core widgets:
#   - plotly 4.12 animation frames: the conditional pmf of K_100 given alpha (bars) and the
#     size-biased weight density f_SB(w | alpha) = alpha (1 - w)^(alpha - 1) (line), one frame
#     per alpha on a 40-point grid from 0.1 to 20 (log-spaced, with 1 and 10 added);
#   - ggiraph 0.9.6: E[K_100 | alpha] against alpha with hover tooltips (E K_100, Pr(W_SB > .5)).
# Conditional pmf and mean from DPprior 2.0.0 (pkgload::load_all, this process only; the installed
# DPprior 1.1.0 is not touched). E[K_100 | alpha = 1] is checked against the golden
# cond_moments.csv (5.1873775176396197).
# Writes
#   data/precomputed/alpha_sweep_J100.json
#   apps/htmlwidgets/plotly-alpha-sweep.html + lib/ (MIT libraries) and ggiraph-alpha-sweep.png
# and measures the self-contained variants in a temporary folder (sizes printed to the log).
# Run from r-export/:  Rscript 08_plotly_frames.R
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
PKG <- need_dir("DPPRIOR_PKG", "the DPprior 2.0.0 source tree")
SITE <- EXPL
stopifnot(read.dcf(file.path(PKG, "DESCRIPTION"), fields = "Version")[1, 1] == "2.0.0")
suppressMessages(pkgload::load_all(PKG, export_all = TRUE, helpers = FALSE, quiet = TRUE))
suppressPackageStartupMessages({
  library(jsonlite)
  library(ggplot2)
  library(plotly)
  library(ggiraph)
  library(htmlwidgets)
})
cat(sprintf("plotly %s, ggiraph %s, htmlwidgets %s\n", packageVersion("plotly"), packageVersion("ggiraph"), packageVersion("htmlwidgets")))

J <- 100
ALPHA <- sort(unique(c(exp(seq(log(0.1), log(20), length.out = 38)), 1, 10)))
stopifnot(length(ALPHA) == 40)
KSHOW <- 60                                   # K_100 above 60 has probability < 1e-6 on this grid
logS <- compute_log_stirling(J)

moments <- data.frame(alpha = ALPHA,
                      EK = vapply(ALPHA, function(a) mean_K_given_alpha(J, a), 0),
                      S5 = 0.5^ALPHA,          # Pr(W_SB > .5 | alpha): W_SB ~ Beta(1, alpha)
                      Ew1 = 1 / (1 + ALPHA))
golden <- utils::read.csv(file.path(SITE, "verification", "golden", "cond_moments.csv"))
g1 <- golden$mean[golden$J == J & abs(golden$alpha - 1) < 1e-12]
d1 <- abs(moments$EK[moments$alpha == 1] - g1)
cat(sprintf("E[K_100 | alpha = 1] = %.10f, golden %.10f, |diff| = %.1e\n", moments$EK[moments$alpha == 1], g1, d1))
stopifnot(d1 < 1e-9)

pmf <- do.call(rbind, lapply(ALPHA, function(a) {
  p <- pmf_K_given_alpha(J, a, logS)[-1]      # index 1 is K = 0
  data.frame(alpha = a, k = seq_len(KSHOW), p = p[seq_len(KSHOW)])
}))
tail_mass <- tapply(pmf$p, pmf$alpha, function(x) 1 - sum(x))
cat(sprintf("largest pmf mass above K = %d: %.2e\n", KSHOW, max(tail_mass)))
W <- seq(0.005, 0.995, by = 0.01)
fsb <- do.call(rbind, lapply(ALPHA, function(a) data.frame(alpha = a, w = W, f = pmin(a * (1 - W)^(a - 1), 12))))

dir.create(file.path(SITE, "data", "precomputed"), showWarnings = FALSE)
out <- list(J = J, source = "r-export/08_plotly_frames.R (DPprior 2.0.0 via load_all)", note = "f capped at 12 for display",
            moments = moments, pmf = pmf[pmf$p > 1e-9, ], fsb = fsb)
write_json(out, file.path(SITE, "data", "precomputed", "alpha_sweep_J100.json"), digits = NA, auto_unbox = TRUE, dataframe = "rows")
cat(sprintf("wrote alpha_sweep_J100.json (%.0f KB)\n", file.size(file.path(SITE, "data", "precomputed", "alpha_sweep_J100.json")) / 1024))

# ---- plotly: one frame per alpha --------------------------------------------------------
pmf$frame <- signif(pmf$alpha, 3)
fsb$frame <- signif(fsb$alpha, 3)
bars <- plot_ly(pmf, x = ~k, y = ~p, frame = ~frame, type = "bar", name = "Pr(K_100 = k | alpha)",
                marker = list(color = "#2e64ce"), hovertemplate = "k = %{x}<br>Pr = %{y:.3f}<extra></extra>") |>
  layout(xaxis = list(title = "K_100 (clusters among 100 units)", range = c(0.5, KSHOW + 0.5)),
         yaxis = list(title = "Pr(K_100 = k | alpha)", range = c(0, 1)))
line <- plot_ly(fsb, x = ~w, y = ~f, frame = ~frame, type = "scatter", mode = "lines", name = "f_SB(w | alpha)",
                line = list(color = "#d72438", width = 3), hovertemplate = "w = %{x:.2f}<br>density = %{y:.2f}<extra></extra>") |>
  layout(xaxis = list(title = "W_SB, the size-biased weight", range = c(0, 1)),
         yaxis = list(title = "density (capped at 12)", range = c(0, 12)))
pw <- subplot(bars, line, nrows = 1, widths = c(0.6, 0.4), titleX = TRUE, titleY = TRUE, margin = 0.07) |>
  layout(title = list(text = "One alpha, two lenses at J = 100: the count K_100 and the weight W_SB", x = 0.02),
         showlegend = FALSE, margin = list(t = 60)) |>
  animation_opts(frame = 500, transition = 250, redraw = FALSE) |>
  animation_slider(pad = list(t = 70), currentvalue = list(prefix = "alpha = ", xanchor = "left", font = list(size = 15))) |>  # below the axis titles
  config(displaylogo = FALSE)

gg <- ggplot(moments, aes(alpha, EK)) +
  geom_line(colour = "#2e64ce", linewidth = 1) +
  geom_point_interactive(aes(tooltip = sprintf("alpha = %s\nE[K_100 | alpha] = %.2f\nPr(W_SB > .5 | alpha) = %s", signif(alpha, 3), EK, sub("^0", "", sprintf("%.3f", S5))),
                             data_id = alpha), colour = "#2e64ce", size = 2.6) +
  scale_x_log10("alpha (log scale)", breaks = c(0.1, 0.3, 1, 3, 10, 20), labels = c("0.1", "0.3", "1", "3", "10", "20")) +
  scale_y_continuous("E[K_100 | alpha]") +
  labs(title = "E[K_100 | alpha] across alpha (J = 100)", caption = "DPprior 2.0.0 mean_K_given_alpha; Pr(W_SB > .5 | alpha) = .5^alpha. DPprior Explorer, X-02.") +
  theme_DPprior(base_size = 13)
# Fonts: girafe's default font set embeds the Liberation families (3 x 6.2 MB) and a system font set
# would copy system font files; neither is shipped. The SVG names Helvetica and the browser falls
# back to its own sans-serif, so the widget carries no font files (its only own dependency is the font).
gi <- girafe(ggobj = gg, width_svg = 9, height_svg = 4.8, font_set = gdtools::font_set(sans = "Helvetica"), check_fonts_dependencies = FALSE,
             options = list(opts_hover(css = "fill:#d72438;stroke:#d72438;"), opts_tooltip(css = "background:white;color:#111;border:1px solid #999;padding:4px 6px;font-family:sans-serif;"),
                            opts_sizing(rescale = TRUE)))
stopifnot(all(vapply(gi$dependencies, function(d) d$name, "") == "helvetica"))
gi$dependencies <- list()
# standalone page: no 40 px body padding (it pushed the scaled SVG past the edges of an iframe)
gi$sizingPolicy$padding <- 0
gi$sizingPolicy$browser$padding <- 0
gi$sizingPolicy$browser$fill <- TRUE

APPS <- file.path(SITE, "apps", "htmlwidgets")
dir.create(APPS, recursive = TRUE, showWarnings = FALSE)
save_both <- function(w, name, title) {
  saveWidget(w, file.path(normalizePath(APPS), paste0(name, ".html")), selfcontained = FALSE, libdir = "lib", title = title)
  tmp <- file.path(tempdir(), paste0(name, "-selfcontained.html"))
  saveWidget(w, tmp, selfcontained = TRUE, title = title)
  file.size(tmp)
}
sc_plotly <- save_both(pw, "plotly-alpha-sweep", "alpha sweep at J = 100 (plotly)")
# Licences (Step 11.7): the site's code is MIT. ggiraph's JavaScript (ggiraphjs, girafe binding) is
# GPL-3 and htmltools' fill.css is GPL (>= 2), so neither is shipped: the plotly page loses the
# fill.css link (it lays out without it), and the ggiraph chart goes on the site as a static PNG of
# the same ggplot. The interactive ggiraph page is still built and measured, in a temporary folder.
plotly_page <- file.path(APPS, "plotly-alpha-sweep.html")
html <- readLines(plotly_page, warn = FALSE)
html <- html[!grepl("htmltools-fill-", html, fixed = TRUE)]
writeLines(html, plotly_page)
unlink(file.path(APPS, "lib", "htmltools-fill-0.5.9"), recursive = TRUE)
gtmp <- file.path(tempdir(), "ggiraph-alpha-sweep.html")
sc_ggiraph <- { saveWidget(gi, gtmp, selfcontained = TRUE, title = "E[K_100 | alpha] (ggiraph)"); file.size(gtmp) }
ggsave(file.path(APPS, "ggiraph-alpha-sweep.png"), gg, width = 9, height = 4.8, dpi = 110, bg = "white")
stopifnot(!any(grepl("ggiraph|girafe|htmltools-fill", list.files(file.path(APPS, "lib")))))
lib_size <- function(d) sum(file.size(list.files(d, recursive = TRUE, full.names = TRUE)))
libs <- list.dirs(file.path(APPS, "lib"), recursive = FALSE)
for (d in libs) cat(sprintf("lib %-28s %8.0f KB\n", basename(d), lib_size(d) / 1024))
cat(sprintf("site files: plotly page %.0f KB, ggiraph static PNG %.0f KB; lib/ total %.2f MB (MIT libraries only)\n",
            file.size(file.path(APPS, "plotly-alpha-sweep.html")) / 1024, file.size(file.path(APPS, "ggiraph-alpha-sweep.png")) / 1024,
            lib_size(file.path(APPS, "lib")) / 1e6))
cat(sprintf("self-contained single files: plotly %.2f MB, ggiraph %.2f MB\n", sc_plotly / 1e6, sc_ggiraph / 1e6))
cat(sprintf("done in %.1f s\n", as.numeric(difftime(Sys.time(), t0, units = "secs"))))
