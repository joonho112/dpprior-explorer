# 11_export_rasch_posterior.R  (Step 9.5)
#
# Posterior summaries of the vocabulary Rasch application, one row per fit (main arm: vague,
# litdef = Gamma(1, 3), tsmm, dasoft, dahard; sens arm: the Count-25 sensitivity of TSMM), from
# the replication package's data-derived/rasch/posterior_reportable.csv: the calibrated (a, b),
# E(K | y) with its 95% interval, P(K = 1 | y), E(alpha | y) with its 95% interval, the largest
# observed share and population atom weight, and the score-shift summaries against the reference
# fit (RMSD and the largest absolute shift of a score-group ability, in logits). No person-level
# fields. For the A-04 badges and the A-05 tiles.
#
# Writes data/released/rasch_posterior.json and rasch_gaussian.json (the Gaussian
# benchmark density, Step 9.6) with their .js twins, merges the
# entry into data_contract.json (keeping every other entry) and rewrites data_contract.js.
# Usage (from r-export/): Rscript 11_export_rasch_posterior.R      (REPL_DIR required)

suppressPackageStartupMessages({ library(jsonlite) })
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
source("_rights.R")  # license_scope, upstream and rights_record of every released table (data_rights.csv)
REPL <- need_dir("REPL_DIR", "a checkout of DPprior-paper-replication")
OUT <- file.path(EXPL, "data", "released")
sig <- function(df, digits = 8) { for (n in names(df)) if (is.double(df[[n]])) df[[n]] <- signif(df[[n]], digits); df }
sha <- function(path) strsplit(system2("shasum", c("-a", "256", shQuote(path)), stdout = TRUE), " ")[[1]][1]

src <- "data-derived/rasch/posterior_reportable.csv"
p <- utils::read.csv(file.path(REPL, src), stringsAsFactors = FALSE)
stopifnot(nrow(p) == 6, all(p$gate_pass))
keep <- c("arm", "role", "a", "b", "E_K", "q025_K", "q975_K", "p_K1", "alpha_mean", "alpha_q025", "alpha_q975",
          "observed_largest_share_mean", "population_largest_atom_weight_mean", "p_population_largest_atom_weight_gt_05",
          "rmsd_vs_reference", "max_abs_delta_r", "max_abs_delta_r_score")
out <- sig(p[, keep])
json <- toJSON(out, dataframe = "rows", na = "null", digits = NA, auto_unbox = TRUE)
path <- file.path(OUT, "rasch_posterior.json")
writeLines(json, path)
writeLines(c(sprintf("// written by r-export/11_export_rasch_posterior.R from %s (CC BY 4.0); do not edit", src),
             paste0("export default ", json, ";")), file.path(OUT, "rasch_posterior.js"))

# the Gaussian-ability benchmark density on the same grid as rasch_density.json (Step 9.6: the grey
# band of the A-05 density panel)
gsrc <- "data-derived/rasch/gaussian.csv"
g <- sig(utils::read.csv(file.path(REPL, gsrc)))
stopifnot(identical(names(g), c("x", "mean", "lower", "upper")))
gjson <- toJSON(g, dataframe = "rows", na = "null", digits = NA, auto_unbox = TRUE)
gpath <- file.path(OUT, "rasch_gaussian.json")
writeLines(gjson, gpath)
writeLines(c(sprintf("// written by r-export/11_export_rasch_posterior.R from %s (CC BY 4.0); do not edit", gsrc),
             paste0("export default ", gjson, ";")), file.path(OUT, "rasch_gaussian.js"))

cpath <- file.path(OUT, "data_contract.json")
contract <- read_json(cpath)
contract$files[["rasch_posterior.json"]] <- list(
  source = src,
  level = "fit (arm / prior)",
  rows = nrow(out),
  columns = as.list(names(out)),
  license = "CC BY 4.0",
  caption = "Posterior summaries of the vocabulary Rasch application (N = 500 of 2,495 respondents; 13 words), one row per fit, released by the replication package (CC BY 4.0 under the Item Response Warehouse's derived licence, subject to upstream rights). Read, not recomputed.",
  sha256 = sha(path))
contract$files[["rasch_gaussian.json"]] <- list(
  source = gsrc,
  level = "grid",
  rows = nrow(g),
  columns = as.list(names(g)),
  license = "CC BY 4.0",
  caption = "Fitted ability density of the Gaussian benchmark model for the vocabulary Rasch application (mean and 95% band on a grid of theta), released by the replication package (CC BY 4.0 under the Item Response Warehouse's derived licence, subject to upstream rights). Read, not recomputed.",
  sha256 = sha(gpath))
contract$license <- CONTRACT_LICENSE
contract$license_scopes <- LICENSE_SCOPES
contract$files <- apply_rights(contract$files)
writeLines(toJSON(contract, auto_unbox = TRUE, pretty = TRUE, digits = NA), cpath)
writeLines(c("// written from data_contract.json by r-export/07, 09, 10, 11 or 12; do not edit",
             paste0("export default ", paste(readLines(cpath, warn = FALSE), collapse = "\n"), ";")),
           file.path(OUT, "data_contract.js"))
cat(sprintf("rasch_posterior.json: %d rows; E(alpha | y) %s; contract now %d files\n", nrow(out),
            paste(sprintf("%s/%s %.3f", out$arm, out$role, out$alpha_mean), collapse = ", "), length(contract$files)))
