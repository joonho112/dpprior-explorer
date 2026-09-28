#!/usr/bin/env Rscript
# =============================================================================
# 09_irw_respondents.R  (Step 5.12; data behind catalog A-13 and the vocabulary pages)
#
# Anonymous respondent-level derived values for the vocabulary Rasch application: raw
# score, Warm WLE, its standard error and a perfect-score flag for each of the N = 500
# sampled respondents (user decision 2026-09-24: anonymous respondent-level derived values
# may be released; the replication package itself releases score groups only).
#
# Source: the public Item Response Warehouse table gcbs_brotherton_2013_vcl (IRW Data
# Dictionary: Public; derived licence CC BY 4.0), read from a LOCAL copy given in IRW_RDS
# (long format: id, item, resp). No network access is attempted.
# Sampling: the replication package's rasch/data-contract.yml (character-sorted IDs,
#   Mersenne-Twister / Inversion / Rejection, seed 81770971, sort(sample.int(2495, 500)),
#   then drop the nonwords VCL6, VCL9, VCL12).
# Scoring: the replication package's common/R/wle.R (Warm's equation) with the Dual-Anchor
#   posterior-mean item difficulties held fixed (data-frozen/rasch/wle_item_difficulties.csv).
#
# Writes data/released/rasch_respondents.{json,js} and merges that file
# and its respondent-level allowlist into data_contract.json. Nothing else leaves this
# script: no responses, no source IDs, no ages. Rows are sorted by raw score and numbered
# 1..500 afterwards, so the row order carries nothing from the source order.
#
# Run from r-export/:
#   IRW_RDS=/path/to/gcbs_brotherton_2013_vcl.rds Rscript 09_irw_respondents.R
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
source("_rights.R")  # license_scope, upstream and rights_record of every released table (data_rights.csv)
REPL <- need_dir("REPL_DIR", "a checkout of DPprior-paper-replication")
SRC <- Sys.getenv("IRW_RDS", "")
if (!nzchar(SRC) || !file.exists(SRC)) {
  stop("Set IRW_RDS to a local copy of the IRW table gcbs_brotherton_2013_vcl (long format: id, item, resp). ",
       "This script never downloads it.", call. = FALSE)
}
OUT <- file.path(EXPL, "data", "released")
CANONICAL_SHA <- "431ce8ff8efe821c26cd078ece0e3e9f08c5bab0c2a0f630dd1ecf06d583e621" # replication DATA_ACCESS.md
sha <- function(path) strsplit(system2("shasum", c("-a", "256", shQuote(path)), stdout = TRUE), " ")[[1]][1]

# --- the sampling contract of the replication package -------------------------------------
spec <- yaml::read_yaml(file.path(REPL, "rasch", "data-contract.yml"))
stopifnot(spec$sampling$seed == 81770971, spec$source_rows == 2495, spec$analysis_rows == 500)

# --- source table (local copy) --------------------------------------------------------------
src_sha <- sha(SRC)
x <- readRDS(SRC)
stopifnot(is.data.frame(x), all(c("id", "item", "resp") %in% names(x)))
x <- x[, c("id", "item", "resp")] # nothing else is read further
items16 <- sprintf("VCL%d", 1:16)
ids <- sort(unique(as.character(x$id)), method = "radix") # character order, locale-free
stopifnot(length(ids) == spec$source_rows, setequal(unique(x$item), items16))
m <- matrix(NA_integer_, length(ids), length(items16), dimnames = list(NULL, items16))
m[cbind(match(as.character(x$id), ids), match(x$item, items16))] <- as.integer(x$resp)
stopifnot(!anyNA(m), all(m %in% 0:1))
rm(x)

# --- sample, drop nonwords, score ------------------------------------------------------------
set.seed(spec$sampling$seed, kind = spec$sampling$rng_kind, normal.kind = spec$sampling$normal_kind,
         sample.kind = spec$sampling$sample_kind)
pos <- sort(sample.int(spec$source_rows, spec$analysis_rows))
keep <- unlist(spec$items)
stopifnot(length(keep) == 13, !any(unlist(spec$sampling$exclude_after_sampling) %in% keep))
raw <- as.integer(rowSums(m[pos, keep, drop = FALSE]))
rm(m)
freq <- tabulate(raw + 1L, nbins = 14L)
if (!identical(freq, as.integer(unlist(spec$frequencies)))) {
  stop("raw-score frequencies differ from rasch/data-contract.yml: ", paste(freq, collapse = ", "), call. = FALSE)
}

# --- Warm WLE with the Dual-Anchor item difficulties held fixed --------------------------------
source(file.path(REPL, "common", "R", "wle.R"))
it <- utils::read.csv(file.path(REPL, "data-frozen", "rasch", "wle_item_difficulties.csv"), stringsAsFactors = FALSE)
it <- it[it$role == "Dual-Anchor", ]
it <- it[order(it$item_order), ]
stopifnot(nrow(it) == 13, identical(it$item, keep))
by_score <- t(vapply(0:13, function(r) wle_score(it$posterior_mean_difficulty, r), numeric(3)))
stopifnot(max(abs(by_score[, "residual"])) < 1e-8)
ref <- utils::read.csv(file.path(REPL, "data-derived", "rasch", "wle_scores.csv"), stringsAsFactors = FALSE)
ref <- ref[ref$role == "Dual-Anchor", ]
ref <- ref[order(ref$raw_score), ]
d_wle <- max(abs(by_score[, "wle"] - ref$wle))
d_se <- max(abs(by_score[, "standard_error"] - ref$standard_error))
stopifnot(d_wle < 1e-6, d_se < 1e-6, identical(as.integer(ref$n), freq))

# --- rows: sorted by raw score, then numbered -------------------------------------------------
ord <- order(raw)
out <- data.frame(
  row_id = seq_along(raw),
  raw_score = raw[ord],
  wle = signif(by_score[raw[ord] + 1L, "wle"], 10),
  se = signif(by_score[raw[ord] + 1L, "standard_error"], 10),
  perfect = raw[ord] == 13L
)
n_perfect <- sum(out$perfect)
se_perfect <- unique(out$se[out$perfect])
stopifnot(n_perfect == 63, length(se_perfect) == 1, abs(se_perfect - 1.733) < 5e-4)

json <- jsonlite::toJSON(out, dataframe = "rows", digits = NA, auto_unbox = TRUE)
path <- file.path(OUT, "rasch_respondents.json")
writeLines(json, path)
writeLines(c("// written by r-export/09_irw_respondents.R from the IRW table gcbs_brotherton_2013_vcl (CC BY 4.0); do not edit",
             paste0("export default ", json, ";")), file.path(OUT, "rasch_respondents.js"))

# --- merge into the data contract ------------------------------------------------------------
cpath <- file.path(OUT, "data_contract.json")
contract <- jsonlite::read_json(cpath)
cols <- names(out)
contract$files[["rasch_respondents.json"]] <- list(
  source = paste0("IRW table gcbs_brotherton_2013_vcl (local copy; SHA-256 ",
                  if (identical(src_sha, CANONICAL_SHA)) "matches the replication package's canonical RDS" else paste("differs from the canonical RDS:", src_sha),
                  "); sample and WLE per the replication package's rasch/data-contract.yml and common/R/wle.R (Dual-Anchor item difficulties)"),
  level = "respondent (anonymous derived values)",
  rows = nrow(out),
  columns = as.list(cols),
  license = "CC BY 4.0",
  caption = "Anonymous derived values for the N = 500 vocabulary sample: raw score on 13 words, Warm WLE and its SE under the Dual-Anchor item difficulties, and a perfect-score flag. No responses and no source IDs; rows are ordered by raw score. Collected by the Open-Source Psychometrics Project, distributed by the Item Response Warehouse (CC BY 4.0).",
  sha256 = sha(path)
)
contract$respondent_level_allowlist <- list(rasch_respondents.json = as.list(cols))
contract$license <- CONTRACT_LICENSE
contract$license_scopes <- LICENSE_SCOPES
contract$files <- apply_rights(contract$files)
writeLines(jsonlite::toJSON(contract, auto_unbox = TRUE, pretty = TRUE, digits = NA), cpath)
# the contract's .js twin (Step 9.1), as in 07_export_released_summaries.R
writeLines(c("// written from data_contract.json by r-export/07, 09, 10, 11 or 12; do not edit",
             paste0("export default ", paste(readLines(cpath, warn = FALSE), collapse = "\n"), ";")),
           file.path(OUT, "data_contract.js"))

cat(sprintf("source %s canonical RDS; %d x %d before sampling\n", if (identical(src_sha, CANONICAL_SHA)) "matches the" else "DIFFERS FROM the",
            spec$source_rows, length(items16)))
cat(sprintf("raw-score frequencies (0..13): %s\n", paste(freq, collapse = " ")))
cat(sprintf("WLE vs replication wle_scores.csv (Dual-Anchor): max |dWLE| %.2e, max |dSE| %.2e\n", d_wle, d_se))
cat(sprintf("perfect scores: %d, SE %.5f\n", n_perfect, se_perfect))
cat(sprintf("rasch_respondents.json: %d rows, %.1f KB; contract updated; done in %.1f s\n", nrow(out),
            file.size(path) / 1024, as.numeric(difftime(Sys.time(), t0, units = "secs"))))
