# 12_export_app_sensitivity.R  (Step 9.10)
#
# Specification sensitivity of the two applications used on the site (Project STAR, J = 79 schools;
# Bangert-Drowns, J = 48 studies), from the replication package's
# data-derived/applications/sensitivity.csv: for each prior, the primary scale-aligned fit
# (reference) against (a) the joint wide-scale sensitivity (grand-mean prior N(0, 100); STAR and BD)
# and (b) the schoolwise OLS/HC3 uncertainty input (STAR only). Per row: E(K | y) with its 95%
# interval, Pr(K = 1 | y), Pr(K <= 2 | y), the largest observed allocation share, the largest
# population atom weight and E(alpha | y) under both specifications, and the unit-level summaries
# of the change (RMS and largest absolute shift of the unit posterior means, the number of 95% unit
# intervals excluding zero under each specification and the number of decisions that change). The
# OCRS rows are dropped: the site does not use the OCRS application. No unit-level fields.
# For A-11 (the primary partition summaries) and A-12.
#
# Writes data/released/app_sensitivity.json with its .js twin, merges the entry
# into data_contract.json (keeping every other entry) and rewrites data_contract.js.
# Usage (from r-export/): Rscript 12_export_app_sensitivity.R      (REPL_DIR required)

suppressPackageStartupMessages({ library(jsonlite) })
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
source("_rights.R")  # license_scope, upstream and rights_record of every released table (data_rights.csv)
REPL <- need_dir("REPL_DIR", "a checkout of DPprior-paper-replication")
OUT <- file.path(EXPL, "data", "released")
sig <- function(df, digits = 8) { for (n in names(df)) if (is.double(df[[n]])) df[[n]] <- signif(df[[n]], digits); df }
sha <- function(path) strsplit(system2("shasum", c("-a", "256", shQuote(path)), stdout = TRUE), " ")[[1]][1]

src <- "data-derived/applications/sensitivity.csv"
s <- utils::read.csv(file.path(REPL, src), stringsAsFactors = FALSE)
s <- s[s$app %in% c("star", "bd"), ]
stopifnot(nrow(s) == 15, all(s$admitted_fit_count == s$fit_denominator),
          setequal(unique(s$comparison), c("primary_vs_wide_scale", "star_primary_vs_hc3")))
spec <- c(primary_vs_wide_scale = "wide_scale", star_primary_vs_hc3 = "hc3")
metric <- c(E_K = "E_K", q025_K = "q025_K", q975_K = "q975_K", p_K1 = "p_K1", p_K_le2 = "p_K_le2",
            observed_largest_share = "observed_largest_share_mean",
            population_largest_atom_weight = "population_largest_atom_weight_mean", alpha_mean = "alpha_mean")
out <- data.frame(comparison = s$comparison, spec = unname(spec[s$comparison]), app = s$app,
                  prior = s$display_label, prior_role = s$prior_role, publication_role = s$publication_role,
                  units = s$unit_denominator, admitted = s$admitted_fit_count, fits = s$fit_denominator,
                  stringsAsFactors = FALSE)
for (side in c("reference", "sensitivity")) for (m in names(metric))
  out[[paste0(if (side == "reference") "ref_" else "sens_", m)]] <- s[[paste0(side, "_", metric[[m]])]]
out$rms_unit_shift <- s$rmse_unit_mean_shift
out$max_abs_unit_shift <- s$max_abs_unit_mean_shift
out$ref_intervals_excluding_zero <- s$reference_interval_excludes_zero_count
out$sens_intervals_excluding_zero <- s$sensitivity_interval_excludes_zero_count
out$interval_decisions_changed <- s$interval_decision_changed_count
out$interpretation <- s$interpretation
out <- sig(out)
json <- toJSON(out, dataframe = "rows", na = "null", digits = NA, auto_unbox = TRUE)
path <- file.path(OUT, "app_sensitivity.json")
writeLines(json, path)
writeLines(c(sprintf("// written by r-export/12_export_app_sensitivity.R from %s (CC BY 4.0); do not edit", src),
             paste0("export default ", json, ";")), file.path(OUT, "app_sensitivity.js"))

cpath <- file.path(OUT, "data_contract.json")
contract <- read_json(cpath)
contract$files[["app_sensitivity.json"]] <- list(
  source = paste0(src, " (app = star, bd)"),
  level = "application / prior / specification",
  rows = nrow(out),
  columns = as.list(names(out)),
  license = "CC BY 4.0",
  caption = "Specification sensitivity of the Project STAR and Bangert-Drowns applications (wide-scale grand-mean prior; STAR also the OLS/HC3 uncertainty input) against the primary scale-aligned fits, per prior, released by the replication package (CC BY 4.0 for the author's results; the source data keep their own terms). Read, not recomputed.",
  sha256 = sha(path))
contract$license <- CONTRACT_LICENSE
contract$license_scopes <- LICENSE_SCOPES
contract$files <- apply_rights(contract$files)
writeLines(toJSON(contract, auto_unbox = TRUE, pretty = TRUE, digits = NA), cpath)
writeLines(c("// written from data_contract.json by r-export/07, 09, 10, 11 or 12; do not edit",
             paste0("export default ", paste(readLines(cpath, warn = FALSE), collapse = "\n"), ";")),
           file.path(OUT, "data_contract.js"))
da <- out[out$prior == "Dual-Anchor", ]
cat(sprintf("app_sensitivity.json: %d rows; Dual-Anchor %s; HC3 RMS unit shift %s; contract now %d files\n", nrow(out),
            paste(sprintf("%s/%s E(K) %.2f -> %.2f, P(K = 1) %.3f -> %.3f", da$app, da$spec, da$ref_E_K, da$sens_E_K, da$ref_p_K1, da$sens_p_K1), collapse = "; "),
            paste(sprintf("%.3f", range(out$rms_unit_shift[out$spec == "hc3"])), collapse = " to "), length(contract$files)))
