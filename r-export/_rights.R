# _rights.R: the rights statement of every released table (since 1.1.0).
# data_rights.csv is the one place that says, per file, what the CC BY 4.0 grant covers
# (license_scope), where upstream material comes from and on what terms (upstream), which
# columns come straight from the upstream data (upstream.fields) and where the replication
# package records the rights (rights_record). 07 and 09-12 apply it to data_contract.json, so
# every run order gives the same statement. Wording after the replication package's
# LICENSE-SCOPE.md and provenance/data-rights.csv; a factual record, not a legal opinion.
RIGHTS <- utils::read.csv("data_rights.csv", stringsAsFactors = FALSE, colClasses = "character")
LICENSE_SCOPES <- list(
  author = "CC BY 4.0 covers the whole file: author-generated simulation or calibration output.",
  `author-contribution` = "CC BY 4.0 covers the author's contribution (posterior summaries and other results of the author's analyses). The upstream data keep their own terms and are not relicensed; upstream.fields lists the columns that come straight from the upstream data.",
  `irw-derived` = "CC BY 4.0 as the Item Response Warehouse's derived-license field states for this table, subject to upstream rights; the attribution in upstream.source is retained.")
CONTRACT_LICENSE <- "CC BY 4.0 for the author's contribution; each file's license_scope and upstream say what the grant covers (see LICENSE-DATA and ATTRIBUTION.md)"

apply_rights <- function(files) {
  for (nm in names(files)) {
    r <- RIGHTS[RIGHTS$file == nm, , drop = FALSE]
    if (nrow(r) != 1) stop(sprintf("data_rights.csv has %d rows for %s", nrow(r), nm), call. = FALSE)
    if (!r$license_scope %in% names(LICENSE_SCOPES)) stop(sprintf("data_rights.csv: unknown license_scope %s", r$license_scope), call. = FALSE)
    # the rights keys always come last and in this order, however often a file passes through here
    e <- files[[nm]]
    e <- e[setdiff(names(e), c("license_scope", "upstream", "rights_record"))]
    e$license <- "CC BY 4.0"
    e$license_scope <- r$license_scope
    if (r$license_scope != "author") {
      flds <- if (nzchar(r$upstream_fields)) strsplit(r$upstream_fields, ";", fixed = TRUE)[[1]] else character(0)
      e$upstream <- list(source = r$upstream_source, terms = r$upstream_terms, fields = I(flds))
    }
    e$rights_record <- r$rights_record
    files[[nm]] <- e
  }
  files
}
