# _paths.R: where the r-export scripts read and write (since 1.1.0). Every numbered script
# sources it first; run the scripts from this folder (r-export/). README.md lists what each needs.
#   DPPRIOR_PKG   the DPprior 2.0.0 source tree; a script that needs it loads it with
#                 pkgload::load_all() in its own Rscript process, never the installed DPprior
#   REPL_DIR      a checkout of https://github.com/joonho112/DPprior-paper-replication
#   EXPLORER_DIR  the root of this repository, where every output goes (default "..")
# DPPRIOR_PKG and REPL_DIR have no defaults: a script that needs one stops with a message.
need_dir <- function(var, what) {
  v <- Sys.getenv(var, "")
  if (!nzchar(v)) stop(sprintf("set %s to %s (see r-export/README.md)", var, what), call. = FALSE)
  if (!dir.exists(v)) stop(sprintf("%s = \"%s\" is not a folder", var, v), call. = FALSE)
  v
}
EXPL <- Sys.getenv("EXPLORER_DIR", "..")
if (!file.exists(file.path(EXPL, "CONTRACT.md")) || !dir.exists(file.path(EXPL, "verification", "golden"))) {
  stop(sprintf("EXPLORER_DIR = \"%s\" is not the dpprior-explorer root; run the scripts from r-export/", EXPL), call. = FALSE)
}
