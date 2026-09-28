#!/usr/bin/env Rscript
# =============================================================================
# 07_export_released_summaries.R  (Step 5.1; catalog A-13)
#
# Copies selected CC BY 4.0 summary tables (15 files; confidence_levels added in Step 5.8) from the replication package
# (joonho112/DPprior-paper-replication, data-derived/) into browser JSON:
#   data/released/<name>.json  and a <name>.js twin (export default)
#   data/released/data_contract.json
# Only school-, study-, cell- and score-group-level columns are exported. No pupil-level
# STAR data, no response-level IRW data, no individual posterior draws, and nothing from
# OCRS (out of scope for this pool). Values are copied, not recomputed (MCMC is never rerun).
# Run from r-export/:  Rscript 07_export_released_summaries.R    (no DPprior needed)
# =============================================================================
options(warn = 1)
t0 <- Sys.time()
source("_paths.R")  # DPPRIOR_PKG, REPL_DIR (required where used), EXPLORER_DIR (default "..")
source("_rights.R")  # license_scope, upstream and rights_record of every released table (data_rights.csv)
REPL <- need_dir("REPL_DIR", "a checkout of DPprior-paper-replication")
OUT <- file.path(EXPL, "data", "released")
DD <- file.path(REPL, "data-derived")
stopifnot(dir.exists(DD))
dir.create(OUT, showWarnings = FALSE, recursive = TRUE)
rd <- function(...) utils::read.csv(file.path(DD, ...), stringsAsFactors = FALSE, check.names = FALSE)
sig <- function(df, digits = 8) { for (n in names(df)) if (is.double(df[[n]])) df[[n]] <- signif(df[[n]], digits); df }
sha <- function(path) strsplit(system2("shasum", c("-a", "256", shQuote(path)), stdout = TRUE), " ")[[1]][1]

CAP_SIM <- "Posterior summaries from the paper's simulation study, released by the replication package (CC BY 4.0). Read, not recomputed. The 45 main cells retain 8,607 of 9,000 planned fits (57,151 of 64,400 across all suites)."
CAP_APP <- "School- or study-level posterior summaries released by the replication package (CC BY 4.0 for the author's results; the source data keep their own terms). Read, not recomputed. K_J is the number of fitted components among the J units."
CAP_RASCH <- "Score-group and posterior summaries of the vocabulary Rasch application (N = 500 of 2,495 respondents; 13 words), released by the replication package (CC BY 4.0 under the Item Response Warehouse's derived licence, subject to upstream rights). Read, not recomputed."
CAP_CAL <- "Calibration tables for the J = 50 worked example, released by the replication package (CC BY 4.0). Read, not recomputed."
CAP_T2 <- "Confidence-level calibrations of paper Table 2 (J = 100, mu_K = 5; TSMM at VIF 1.25, 1.5, 2.5 and 5, and the Gamma(1, 1) default), released by the replication package (CC BY 4.0). Read, not recomputed."

contract <- list()
write_json <- function(df, name, source, level, caption) {
  df <- sig(df)
  json <- jsonlite::toJSON(df, dataframe = "rows", na = "null", digits = NA, auto_unbox = TRUE)
  path <- file.path(OUT, paste0(name, ".json"))
  writeLines(json, path)
  writeLines(c(sprintf("// written by r-export/07_export_released_summaries.R from %s (CC BY 4.0); do not edit", source),
               paste0("export default ", json, ";")), file.path(OUT, paste0(name, ".js")))
  contract[[paste0(name, ".json")]] <<- list(source = source, level = level, rows = nrow(df), columns = names(df),
                                             license = "CC BY 4.0", caption = caption, sha256 = sha(path))
  cat(sprintf("  %-26s %5d rows %3d cols %7.1f KB\n", paste0(name, ".json"), nrow(df), ncol(df), file.size(path) / 1024))
}

prior_name <- function(x) {
  map <- c("Dual-Soft-Selected" = "Dual-Anchor", "Dual-Hard-Sensitivity" = "Dual-Anchor (hard)")
  ifelse(x %in% names(map), map[x], x)
}

# --- applications: STAR and Bangert-Drowns units (primary analysis only) -------------------------
ud <- rd("applications", "unit_detail.csv")
units <- function(app_code) {
  u <- ud[ud$app == app_code & ud$analysis_spec == "primary_scale_aligned", ]
  data.frame(unit = u$unit, prior = prior_name(u$prior_label), posterior_mean = u$posterior_mean,
             posterior_sd = u$posterior_sd, q025 = u$q025, q975 = u$q975, tau_hat = u$tau_hat, se = u$se,
             n_j = suppressWarnings(as.numeric(u$n_j)), shift = u$posterior_mean_shift_from_vague,
             stringsAsFactors = FALSE)
}
write_json(units("star"), "star_units", "data-derived/applications/unit_detail.csv (app = star, primary_scale_aligned)", "school", CAP_APP)
write_json(units("bd"), "bd_units", "data-derived/applications/unit_detail.csv (app = bd, primary_scale_aligned)", "study", CAP_APP)

# --- simulation ------------------------------------------------------------------------------
sim_cols <- c("suite", "design", "J", "K_true", "weights", "dominant_share", "I_target", "prior", "r", "mu_K", "VIF",
              "dual_lambda", "selected_lambda", "is_headline", "grand_mean_label", "grand_mean_variance",
              "n_manifest", "n_scientific_eligible", "mean_E_K", "sd_between_E_K", "se_mean_E_K", "q10_E_K",
              "median_E_K", "q90_E_K", "rmse_E_K", "mean_q025_K", "mean_q975_K", "mean_p_K1", "mean_p_K_le2",
              "mean_alpha_mean", "mean_K_bias", "mean_tau_rmse", "coverage95_K")
simsel <- function(df) df[, intersect(sim_cols, names(df))]
write_json(simsel(rd("simulation", "cell_summary.csv")), "cell_summary", "data-derived/simulation/cell_summary.csv", "cell", CAP_SIM)
write_json(simsel(rd("simulation", "headline_primary.csv")), "headline_primary", "data-derived/simulation/headline_primary.csv", "cell", CAP_SIM)
mis <- do.call(rbind, lapply(c("balanced", "blocked", "medium", "medium_balanced"), function(v) {
  d <- simsel(rd("simulation", paste0("misspecification_", v, ".csv"))); d$variant <- v; d
}))
write_json(mis, "misspecification", "data-derived/simulation/misspecification_{balanced,blocked,medium,medium_balanced}.csv", "cell", CAP_SIM)
ds <- rbind(transform(simsel(rd("simulation", "design_size_balanced.csv")), variant = "balanced"),
            transform(simsel(rd("simulation", "design_size_J200.csv")), variant = "J200"))
write_json(ds, "design_size", "data-derived/simulation/design_size_{balanced,J200}.csv", "cell", CAP_SIM)
write_json(simsel(rd("simulation", "unequal_weights.csv")), "unequal_weights", "data-derived/simulation/unequal_weights.csv", "cell", CAP_SIM)
write_json(simsel(rd("simulation", "fixed_lambda.csv")), "fixed_lambda", "data-derived/simulation/fixed_lambda.csv", "cell", CAP_SIM)

# --- Rasch -----------------------------------------------------------------------------------------
write_json(rd("rasch", "pmf.csv"), "rasch_pmf", "data-derived/rasch/pmf.csv", "score-group / prior", CAP_RASCH)
write_json(rd("rasch", "density.csv"), "rasch_density", "data-derived/rasch/density.csv", "grid", CAP_RASCH)
w <- rd("rasch", "wle_scores.csv")
write_json(w[, c("role", "raw_score", "n", "wle", "standard_error")], "rasch_wle", "data-derived/rasch/wle_scores.csv", "score-group", CAP_RASCH)

# --- calibration ---------------------------------------------------------------------------------
nt <- rd("calibration", "newton_trace.csv")
write_json(nt[, c("iter", "a", "b", "M1", "V", "residual", "step_norm", "det_Jlog", "reciprocal_condition")],
           "newton_trace", "data-derived/calibration/newton_trace.csv", "iteration", CAP_CAL)
dg <- rd("calibration", "dual_anchor_grid.csv")
write_json(dg[, c("lambda", "mode", "a", "b", "mu_K", "var_K", "achieved_weight", "K_loss", "weight_loss", "total_loss",
                  "w1_prob_gt_50", "E_w1", "boundary_class", "selected")],
           "dual_anchor_grid", "data-derived/calibration/dual_anchor_grid.csv", "lambda", CAP_CAL)
cl <- rd("calibration", "confidence_levels.csv")
write_json(cl[, c("setting", "VIF", "target_variance", "a", "b", "mean_alpha", "tail_05", "tail_09", "p_alpha_lt_01")],
           "confidence_levels", "data-derived/calibration/confidence_levels.csv", "setting", CAP_T2)

# --- application priors (Table 4) and posterior summaries (Table 5) --------------------------------
pr <- rd("applications", "primary.csv")
pr <- pr[pr$app %in% c("star", "bd") & pr$analysis_spec == "primary_scale_aligned", ]
app <- data.frame(
  app = ifelse(pr$app == "star", "STAR", "Bangert-Drowns"), J = pr$J, prior = prior_name(pr$prior_label),
  a = pr$manifest_a, b = pr$manifest_b, lambda = suppressWarnings(as.numeric(pr$manifest_selected_lambda)),
  prior_EK = pr$manifest_prior_EK, prior_pK1 = pr$manifest_prior_pK1,
  post_EK = pr$E_K, post_q025_K = pr$q025_K, post_q975_K = pr$q975_K, post_pK1 = pr$p_K1,
  observed_largest_share = pr$observed_largest_share_mean,
  population_largest_weight = pr$population_largest_occupied_weight_mean,
  p_population_largest_weight_gt_05 = pr$p_population_largest_occupied_weight_gt_05,
  alpha_only_p_wsb_gt_05 = pr$alpha_only_prior_form_p_first_size_biased_weight_gt_05,
  rms_unit_shift_from_vague = pr$rmse_unit_shift_from_vague, max_abs_unit_shift_from_vague = pr$max_abs_unit_shift_from_vague,
  stringsAsFactors = FALSE)
rp <- rd("rasch", "posterior_reportable.csv")
rp <- rp[rp$arm == "main", ]
role_name <- c(vague = "Vague", litdef = "Literature default", tsmm = "TSMM", dasoft = "Dual-Anchor", dahard = "Dual-Anchor (hard)")
voc <- data.frame(app = "Vocabulary", J = 500, prior = unname(role_name[rp$role]), a = rp$a, b = rp$b, lambda = NA,
                  prior_EK = NA, prior_pK1 = NA, post_EK = rp$E_K, post_q025_K = rp$q025_K, post_q975_K = rp$q975_K,
                  post_pK1 = rp$p_K1, observed_largest_share = rp$observed_largest_share_mean,
                  population_largest_weight = rp$population_largest_occupied_weight_mean,
                  p_population_largest_weight_gt_05 = rp$p_population_largest_occupied_weight_gt_05,
                  alpha_only_p_wsb_gt_05 = rp$alpha_only_prior_form_p_first_size_biased_weight_gt_05,
                  rms_unit_shift_from_vague = NA, max_abs_unit_shift_from_vague = NA, stringsAsFactors = FALSE)
write_json(rbind(app, voc), "app_priors", "data-derived/applications/primary.csv (star, bd; primary) + data-derived/rasch/posterior_reportable.csv (main arm)", "application / prior", CAP_APP)

# the contract's .js twin, so the site can import it from file:// (Step 9.1)
write_contract_twin <- function(out) {
  writeLines(c("// written from data_contract.json by r-export/07, 09, 10, 11 or 12; do not edit",
               paste0("export default ", paste(readLines(file.path(out, "data_contract.json"), warn = FALSE), collapse = "\n"), ";")),
             file.path(out, "data_contract.js"))
}

# --- contract ----------------------------------------------------------------------------------
# keep entries that other scripts merged in (09_irw_respondents.R: rasch_respondents.json and
# its respondent-level allowlist), so either script can be rerun alone
cpath <- file.path(OUT, "data_contract.json")
extra_files <- list()
allow <- structure(list(), names = character(0))
if (file.exists(cpath)) {
  old <- jsonlite::read_json(cpath)
  for (nm in setdiff(names(old$files), names(contract))) extra_files[[nm]] <- old$files[[nm]]
  if (length(old$respondent_level_allowlist)) allow <- old$respondent_level_allowlist
}
repl_desc <- tryCatch(read.dcf(file.path(REPL, "DESCRIPTION"), fields = "Version")[1, 1], error = function(e) NA)
contract_doc <- list(
  schema = "dpprior-explorer data contract v1 (CONTRACT.md section 9)",
  generated_by = "r-export/07_export_released_summaries.R",
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
  source_repository = "https://github.com/joonho112/DPprior-paper-replication",
  license = CONTRACT_LICENSE,
  license_scopes = LICENSE_SCOPES,
  forbidden_field_patterns = c("student", "pupil", "respondent", "person", "child", "stuid", "studentid", "response", "item_response", "draw"),
  respondent_level_allowlist = allow,
  max_total_bytes = 3000000,
  files = apply_rights(c(contract, extra_files)))
writeLines(jsonlite::toJSON(contract_doc, auto_unbox = TRUE, pretty = TRUE, digits = NA), file.path(OUT, "data_contract.json"))
write_contract_twin(OUT)
tot <- sum(file.size(list.files(OUT, pattern = "\\.json$", full.names = TRUE)))
cat(sprintf("data_contract.json: %d files (%d kept from other scripts); released JSON total %.2f MB; done in %.1f s\n", length(contract) + length(extra_files), length(extra_files), tot / 1e6,
            as.numeric(difftime(Sys.time(), t0, units = "secs"))))
