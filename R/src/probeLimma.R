# Genome-wide probe-level limma via chromosome chunking
#
# Processes probes one chromosome at a time to keep memory low (~50MB peak),
# then pools all residual variances for a single genome-wide fitFDist() call
# to estimate eBayes hyperparameters (s0^2, d0). This is mathematically
# equivalent to running lmFit + eBayes on all probes simultaneously
# (Smyth 2004; Phipson et al. 2016) because per-probe linear model fits
# are independent OLS — only the variance moderation requires genome-wide data.
#
# Input: JSON from stdin with fields:
#   probe_h5_file, case, control, min_samples_per_group,
#   conf1?, conf1_mode?, conf2?, conf2_mode?,
#   cache_file, running_file
# Output: JSON cache file with per-probe stats; removes running_file on completion

###############################################################################
# Step 1: Load required R packages
###############################################################################
suppressWarnings({
  library(jsonlite)
  library(rhdf5)
  suppressPackageStartupMessages(library(limma))
})

###############################################################################
# Step 2: Read JSON input from stdin
###############################################################################
con <- file("stdin", "r")
json <- readLines(con, warn = FALSE)
close(con)
input <- fromJSON(json)

cases <- unlist(strsplit(input$case, ","))
controls <- unlist(strsplit(input$control, ","))
h5_file <- input$probe_h5_file
cache_file <- input$cache_file
running_file <- input$running_file
min_spg <- if (!is.null(input$min_samples_per_group)) input$min_samples_per_group else 3

n_cases <- length(cases)
n_controls <- length(controls)

# Error handling wrapper — on failure, write error file and remove running file
on_error <- function(msg) {
  error_file <- paste0(cache_file, ".error")
  writeLines(msg, error_file)
  if (file.exists(running_file)) file.remove(running_file)
  quit(save = "no", status = 1)
}

tryCatch({

###############################################################################
# Step 3: Read metadata and map samples
###############################################################################
all_sample_names <- h5read(h5_file, "meta/samples/names")
start_pos <- h5read(h5_file, "meta/start")
probe_ids <- h5read(h5_file, "meta/probe/probeID")

chrom_lengths_json <- h5readAttributes(h5_file, "/")$chrom_lengths
chrom_lengths <- fromJSON(chrom_lengths_json)

case_indices <- match(cases, all_sample_names)
control_indices <- match(controls, all_sample_names)
if (any(is.na(case_indices))) on_error(paste("Case samples not found:", paste(cases[is.na(case_indices)], collapse = ", ")))
if (any(is.na(control_indices))) on_error(paste("Control samples not found:", paste(controls[is.na(control_indices)], collapse = ", ")))
sample_indices <- c(case_indices, control_indices)

# Build design matrix (same pattern as diffMeth.R)
conditions <- factor(
  c(rep("Diseased", n_cases), rep("Control", n_controls)),
  levels = c("Control", "Diseased")
)

if (length(input$conf1) == 0) {
  design <- model.matrix(~conditions)
} else {
  conf1 <- if (input$conf1_mode == "continuous") as.numeric(input$conf1) else as.factor(input$conf1)
  if (length(input$conf2) == 0) {
    design <- model.matrix(~ conditions + conf1)
  } else {
    conf2 <- if (input$conf2_mode == "continuous") as.numeric(input$conf2) else as.factor(input$conf2)
    design <- model.matrix(~ conditions + conf1 + conf2)
  }
}

###############################################################################
# Step 4: Chromosome-chunked lmFit — collect residual variances
###############################################################################
# We process one chromosome at a time, run lmFit, and collect:
#   - sigma (residual SD per probe)
#   - df.residual (degrees of freedom per probe)
#   - coefficients and stdev.unscaled for the coefficient of interest
# After all chromosomes, we pool the sigmas for genome-wide fitFDist.

all_chromosomes <- names(chrom_lengths)
prefix_sums <- c(0, cumsum(unlist(chrom_lengths)))

# Pre-allocate collectors
all_sigmas <- numeric(0)
all_df_residual <- numeric(0)
all_coef <- numeric(0)
all_stdev_unscaled <- numeric(0)
all_chr <- character(0)
all_start <- integer(0)
all_probe_id <- character(0)

coef_col <- "conditionsDiseased"

for (ci in seq_along(all_chromosomes)) {
  chrom <- all_chromosomes[ci]
  row_start <- prefix_sums[ci] + 1
  row_end <- prefix_sums[ci + 1]
  n_probes_chrom <- row_end - row_start + 1
  if (n_probes_chrom < 1) next

  # Read beta values for this chromosome
  beta_chunk <- t(h5read(
    h5_file,
    "beta/values",
    index = list(sample_indices, row_start:row_end)
  ))

  colnames(beta_chunk) <- c(cases, controls)
  rownames(beta_chunk) <- probe_ids[row_start:row_end]

  # Beta -> M-value conversion
  beta_chunk[beta_chunk <= 0] <- 0.001
  beta_chunk[beta_chunk >= 1] <- 0.999
  m_chunk <- log2(beta_chunk / (1 - beta_chunk))
  rm(beta_chunk)

  # Filter per-group: require min_spg non-NA in each group.
  # Only check the selected case/control columns (not all samples).
  # With mixed array types (450K/EPIC/EPICv2), probes may have NaN in
  # unselected samples from different platforms — those shouldn't disqualify
  # a probe that is well-measured in the comparison groups.
  case_cols <- 1:n_cases
  ctrl_cols <- (n_cases + 1):(n_cases + n_controls)
  case_ok <- rowSums(!is.na(m_chunk[, case_cols, drop = FALSE])) >= min_spg
  ctrl_ok <- rowSums(!is.na(m_chunk[, ctrl_cols, drop = FALSE])) >= min_spg
  # Also require zero NA in the selected samples (lmFit cannot handle NA)
  selected_na <- rowSums(is.na(m_chunk[, c(case_cols, ctrl_cols), drop = FALSE])) == 0
  rv <- apply(m_chunk, 1, var, na.rm = TRUE)
  keep <- case_ok & ctrl_ok & selected_na & !is.na(rv) & (rv > 0)

  cat(sprintf("  %s: %d probes, dim=%dx%d, case_ok=%d, ctrl_ok=%d, no_na=%d, var_ok=%d, keep=%d\n",
    chrom, n_probes_chrom, nrow(m_chunk), ncol(m_chunk),
    sum(case_ok), sum(ctrl_ok), sum(selected_na), sum(!is.na(rv) & rv > 0), sum(keep)),
    file = "/tmp/probeLimma_debug.log", append = TRUE)

  m_chunk <- m_chunk[keep, , drop = FALSE]
  if (nrow(m_chunk) < 1) next

  # Run lmFit on this chromosome
  suppressWarnings(suppressMessages({
    fit_chunk <- lmFit(m_chunk, design)
  }))

  # Collect per-probe statistics needed for genome-wide eBayes
  all_sigmas <- c(all_sigmas, fit_chunk$sigma)
  all_df_residual <- c(all_df_residual, fit_chunk$df.residual)
  all_coef <- c(all_coef, fit_chunk$coefficients[, coef_col])
  all_stdev_unscaled <- c(all_stdev_unscaled, fit_chunk$stdev.unscaled[, coef_col])

  # Collect probe metadata
  kept_indices <- which(keep)
  abs_indices <- (row_start:row_end)[kept_indices]
  all_chr <- c(all_chr, rep(chrom, length(kept_indices)))
  all_start <- c(all_start, start_pos[abs_indices])
  all_probe_id <- c(all_probe_id, probe_ids[abs_indices])

  rm(m_chunk, fit_chunk)
}

n_total <- length(all_sigmas)
if (n_total < 10) on_error(paste0("Too few probes genome-wide after filtering (", n_total, "). Need at least 10."))

###############################################################################
# Step 5: Genome-wide eBayes via fitFDist on pooled variances
###############################################################################
# This is the key step: fitFDist estimates s0^2 and d0 from ALL probe variances
# genome-wide, exactly as eBayes would if given the full matrix (Smyth 2004).
all_var <- all_sigmas^2
fit_f <- fitFDist(all_var, df1 = all_df_residual)
s2_prior <- fit_f$scale     # s0^2
df_prior <- fit_f$df2       # d0
cat(sprintf("eBayes: s2_prior=%.6e df_prior=%.4f df_residual=%.1f n_probes=%d\n",
    s2_prior, df_prior, all_df_residual[1], n_total), file = "/tmp/probeLimma_debug.log", append = TRUE)

# Compute posterior (moderated) variances per probe
s2_post <- (df_prior * s2_prior + all_df_residual * all_var) / (df_prior + all_df_residual)
df_total <- df_prior + all_df_residual

# Moderated t-statistic
mod_t <- all_coef / (all_stdev_unscaled * sqrt(s2_post))

# P-values from t-distribution with moderated df
raw_p <- 2 * pt(abs(mod_t), df = df_total, lower.tail = FALSE)

# Genome-wide BH FDR correction
adj_p <- p.adjust(raw_p, method = "BH")

###############################################################################
# Step 6: Write JSON cache
###############################################################################
result <- data.frame(
  probe_id = all_probe_id,
  chr = all_chr,
  start = all_start,
  t_stat = mod_t,
  logFC = all_coef,
  p_value = raw_p,
  adj_p_value = adj_p,
  stringsAsFactors = FALSE
)

# Write as JSON (not RDS) for direct consumption by Node.js
json_out <- toJSON(result, digits = NA, na = "null")
writeLines(json_out, cache_file)

# Remove the running marker
if (file.exists(running_file)) file.remove(running_file)

}, error = function(e) {
  on_error(paste("probeLimma failed:", e$message))
})
