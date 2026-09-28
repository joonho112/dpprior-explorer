# 10_export_bd_moderator.R  (Step 9.4)
#
# The Bangert-Drowns moderator summaries for the A-03 forest's moderator view: the replication
# package's posterior summaries of the unadjusted slope of the unit effects on grade and on
# length, under each of the five priors (data-derived/applications/bd_moderator.csv, 10 rows).
# These are the author's derived results (CC BY 4.0). Study names and the per-study grade and
# length come from metadat::dat.bangertdrowns2004 (GPL >= 2, upstream terms) and are not exported.
#
# Writes data/released/bd_moderator.json and its .js twin, merges the entry
# into data_contract.json (keeping every other entry) and rewrites data_contract.js.
# Usage (from r-export/): Rscript 10_export_bd_moderator.R      (REPL_DIR required)

suppressPackageStartupMessages({ library(jsonlite) })
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
source("_rights.R")  # license_scope, upstream and rights_record of every released table (data_rights.csv)
REPL <- need_dir("REPL_DIR", "a checkout of DPprior-paper-replication")
OUT <- file.path(EXPL, "data", "released")
sig <- function(df, digits = 8) { for (n in names(df)) if (is.double(df[[n]])) df[[n]] <- signif(df[[n]], digits); df }
sha <- function(path) strsplit(system2("shasum", c("-a", "256", shQuote(path)), stdout = TRUE), " ")[[1]][1]

src <- "data-derived/applications/bd_moderator.csv"
m <- utils::read.csv(file.path(REPL, src), stringsAsFactors = FALSE)
stopifnot(nrow(m) == 10, all(m$app == "bd"), all(m$final_diagnostic_pass))
out <- data.frame(
  prior = m$display_label, # the site's names (Dual-Anchor, Dual-Anchor (hard)), as in bd_units.json
  moderator = m$moderator,
  units = m$moderator_total_units,
  complete_units = m$moderator_complete_case_units,
  missing_units = m$moderator_missing_units,
  observed_slope = m$observed_unadjusted_slope,
  posterior_slope_mean = m$posterior_unadjusted_slope_mean,
  posterior_slope_q025 = m$posterior_unadjusted_slope_q025,
  posterior_slope_q975 = m$posterior_unadjusted_slope_q975,
  posterior_prob_positive = m$posterior_probability_positive,
  interpretation = m$interpretation,
  stringsAsFactors = FALSE)
out <- sig(out)
json <- toJSON(out, dataframe = "rows", na = "null", digits = NA, auto_unbox = TRUE)
path <- file.path(OUT, "bd_moderator.json")
writeLines(json, path)
writeLines(c(sprintf("// written by r-export/10_export_bd_moderator.R from %s (CC BY 4.0); do not edit", src),
             paste0("export default ", json, ";")), file.path(OUT, "bd_moderator.js"))

cpath <- file.path(OUT, "data_contract.json")
contract <- read_json(cpath)
contract$files[["bd_moderator.json"]] <- list(
  source = paste0(src, " (app = bd, primary_scale_aligned)"),
  level = "moderator / prior",
  rows = nrow(out),
  columns = as.list(names(out)),
  license = "CC BY 4.0",
  caption = "Posterior summaries of the unadjusted slope of the Bangert-Drowns study effects on grade and on length, under each prior, released by the replication package (CC BY 4.0 for the author's results; the source data keep their own terms). Read, not recomputed. Descriptive alignment, not causal moderation.",
  sha256 = sha(path))
contract$license <- CONTRACT_LICENSE
contract$license_scopes <- LICENSE_SCOPES
contract$files <- apply_rights(contract$files)
writeLines(toJSON(contract, auto_unbox = TRUE, pretty = TRUE, digits = NA), cpath)
writeLines(c("// written from data_contract.json by r-export/07, 09, 10, 11 or 12; do not edit",
             paste0("export default ", paste(readLines(cpath, warn = FALSE), collapse = "\n"), ";")),
           file.path(OUT, "data_contract.js"))
cat(sprintf("bd_moderator.json: %d rows (%s); contract now %d files\n", nrow(out), paste(unique(out$moderator), collapse = ", "), length(contract$files)))
