# DMRCate: Locus-specific differential methylation region analysis
#
# Reads pre-computed genome-wide per-CpG limma statistics from a JSON cache
# (produced by probeLimma.R), subsets to the query region, constructs a
# CpGannotated object, and runs DMRCate (dmrcate + extractRanges).
# Also reads probe-level beta values from HDF5 to compute per-CpG group
# means for the diagnostic scatter plot.
#
# The genome-wide limma cache ensures proper eBayes variance moderation
# and BH FDR correction (Smyth 2004; Phipson et al. 2016).
#
# Input: JSON from stdin with fields:
#   cache_file, probe_h5_file, chr, start, stop, case, control,
#   fdr_cutoff, lambda, C, min_samples_per_group
# Output: JSON to stdout with { dmrs, diagnostic }

###############################################################################
# Step 1: Load required R packages
###############################################################################
start_time <- proc.time()
suppressWarnings({
  library(jsonlite)
  library(rhdf5)
  suppressPackageStartupMessages(library(DMRcate))
  suppressPackageStartupMessages(library(limma))
  suppressPackageStartupMessages(library(GenomicRanges))
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
query_chrom <- input$chr
query_start <- as.integer(input$start)
query_stop <- as.integer(input$stop)
h5_file <- input$probe_h5_file
cache_file <- input$cache_file

fdr_cutoff <- if (!is.null(input$fdr_cutoff)) input$fdr_cutoff else 0.05
lambda <- if (!is.null(input$lambda)) as.integer(input$lambda) else 1000L
C_param <- if (!is.null(input$C)) input$C else 2

###############################################################################
# Step 3: Read cached genome-wide limma results and subset to query region
###############################################################################
if (!file.exists(cache_file)) {
  cat(toJSON(list(error = "Probe-level limma cache not found. Run differential methylation analysis first."), auto_unbox = TRUE))
  quit(save = "no")
}

all_probes <- fromJSON(cache_file)

# Subset to query region
region_mask <- all_probes$chr == query_chrom &
  all_probes$start >= query_start &
  all_probes$start <= query_stop
region_probes <- all_probes[region_mask, ]

if (nrow(region_probes) < 3) {
  cat(toJSON(list(error = paste0("Too few probes in region (", nrow(region_probes), "). Need at least 3.")), auto_unbox = TRUE))
  quit(save = "no")
}

###############################################################################
# Step 4: Read beta values from HDF5 for diagnostic per-CpG group means
###############################################################################
all_sample_names <- h5read(h5_file, "meta/samples/names")
start_pos <- h5read(h5_file, "meta/start")
probe_ids <- h5read(h5_file, "meta/probe/probeID")

chrom_lengths_json <- h5readAttributes(h5_file, "/")$chrom_lengths
chrom_lengths <- fromJSON(chrom_lengths_json)

# Find HDF5 row range for query chromosome
all_chromosomes <- names(chrom_lengths)
prefix_sums <- c(0, cumsum(unlist(chrom_lengths)))
chrom_idx <- which(all_chromosomes == query_chrom)
chrom_row_start <- prefix_sums[chrom_idx] + 1
chrom_row_end <- prefix_sums[chrom_idx + 1]
chrom_start_pos <- start_pos[chrom_row_start:chrom_row_end]

# Binary search for probes within [query_start, query_stop]
left <- findInterval(query_start, chrom_start_pos)
right <- findInterval(query_stop, chrom_start_pos)
if (left < 1) left <- 1
if (chrom_start_pos[left] < query_start && left < length(chrom_start_pos)) left <- left + 1

n_cases <- length(cases)
n_controls <- length(controls)

# Default empty group means (populated below if HDF5 read succeeds)
filtered_mean_group1 <- numeric(0)
filtered_mean_group2 <- numeric(0)

if (right >= left) {
  abs_left <- chrom_row_start + left - 1
  abs_right <- chrom_row_start + right - 1

  case_indices <- match(cases, all_sample_names)
  control_indices <- match(controls, all_sample_names)
  sample_indices <- c(case_indices, control_indices)

  beta_matrix <- t(h5read(
    h5_file,
    "beta/values",
    index = list(sample_indices, abs_left:abs_right)
  ))

  h5_probe_ids <- probe_ids[abs_left:abs_right]

  # Match cached probe IDs to HDF5 probe IDs for consistent ordering
  h5_match <- match(region_probes$probe_id, h5_probe_ids)
  matched <- !is.na(h5_match)

  if (any(matched)) {
    beta_matched <- beta_matrix[h5_match[matched], , drop = FALSE]
    filtered_mean_group1 <- rowMeans(beta_matched[, (n_cases + 1):(n_cases + n_controls), drop = FALSE], na.rm = TRUE)
    filtered_mean_group2 <- rowMeans(beta_matched[, 1:n_cases, drop = FALSE], na.rm = TRUE)
  }
}

# If we couldn't match all probes, pad with NA
if (length(filtered_mean_group1) != nrow(region_probes)) {
  filtered_mean_group1 <- rep(NA_real_, nrow(region_probes))
  filtered_mean_group2 <- rep(NA_real_, nrow(region_probes))
}

###############################################################################
# Step 5: Construct CpGannotated object from cached stats and run DMRCate
###############################################################################
cpg_ranges <- GRanges(
  seqnames = region_probes$chr,
  ranges = IRanges(start = region_probes$start, width = 1)
)
mcols(cpg_ranges)$stat <- region_probes$t_stat
mcols(cpg_ranges)$diff <- region_probes$logFC
mcols(cpg_ranges)$ind.fdr <- region_probes$adj_p_value
mcols(cpg_ranges)$is.sig <- region_probes$adj_p_value < fdr_cutoff

cpg_annotated <- new("CpGannotated", ranges = cpg_ranges)

# Run DMRCate kernel smoothing
dmr_output <- tryCatch({
  dmrcate(cpg_annotated, lambda = lambda, C = C_param)
}, error = function(e) {
  NULL
})

###############################################################################
# Step 6: Extract DMR ranges and build output
###############################################################################
dmrs <- list()
if (!is.null(dmr_output)) {
  dmr_ranges <- tryCatch({
    extractRanges(dmr_output, genome = "hg38")
  }, error = function(e) NULL)

  if (!is.null(dmr_ranges) && length(dmr_ranges) > 0) {
    for (i in seq_along(dmr_ranges)) {
      r <- dmr_ranges[i]
      dmrs[[i]] <- list(
        chr = as.character(seqnames(r)),
        start = as.integer(start(r)),
        stop = as.integer(end(r)),
        no_cpgs = mcols(r)$no.cpgs,
        min_smoothed_fdr = mcols(r)$min_smoothed_fdr,
        HMFDR = mcols(r)$HMFDR,
        maxdiff = mcols(r)$maxdiff,
        meandiff = mcols(r)$meandiff,
        direction = ifelse(mcols(r)$meandiff >= 0, "hyper", "hypo"),
        overlapping_genes = as.character(mcols(r)$overlapping.genes)
      )
    }
  }
}

###############################################################################
# Step 6b: Proximity-based fallback when DMRCate finds no DMRs
###############################################################################
# If DMRCate's kernel smoothing found no DMRs but there are individually
# significant CpGs, fall back to a simple proximity-based grouping consistent
# with EWAS consensus practice (Karakachoff et al. 2021 Clinical Epigenetics;
# Rakyan et al. 2011 Nature Reviews Genetics; dmrff approach by Suderman et al.).
#
# Algorithm: group significant CpGs (FDR < cutoff AND |delta-beta| >= 0.05)
# within max_gap bp of each other that share the same direction of effect.
# Require min_cpgs per group. The delta-beta filter ensures only probes with
# meaningful effect sizes contribute (EWAS consensus, Karakachoff et al. 2021).
if (length(dmrs) == 0) {
  min_delta_beta <- 0.05
  delta_betas <- filtered_mean_group2 - filtered_mean_group1
  sig_mask <- region_probes$adj_p_value < fdr_cutoff & abs(delta_betas) >= min_delta_beta
  if (sum(sig_mask) >= 2) {
    sig_probes <- region_probes[sig_mask, ]
    sig_directions <- ifelse(sig_probes$logFC >= 0, "hyper", "hypo")
    sig_positions <- sig_probes$start
    sig_mean_g1 <- filtered_mean_group1[sig_mask]
    sig_mean_g2 <- filtered_mean_group2[sig_mask]

    max_gap <- lambda  # use same bandwidth as DMRCate for consistency

    # Group consecutive significant probes by proximity + direction
    groups <- list()
    current_group <- list(indices = 1)
    for (j in seq_along(sig_positions)[-1]) {
      prev <- current_group$indices[length(current_group$indices)]
      same_dir <- sig_directions[j] == sig_directions[prev]
      close_enough <- (sig_positions[j] - sig_positions[prev]) <= max_gap
      if (same_dir && close_enough) {
        current_group$indices <- c(current_group$indices, j)
      } else {
        groups <- c(groups, list(current_group))
        current_group <- list(indices = j)
      }
    }
    groups <- c(groups, list(current_group))

    # Convert groups with >= 2 CpGs into DMR calls
    min_cpgs_fallback <- 2
    for (grp in groups) {
      idx <- grp$indices
      if (length(idx) < min_cpgs_fallback) next

      grp_logFC <- sig_probes$logFC[idx]
      grp_fdr <- sig_probes$adj_p_value[idx]
      grp_beta_g1 <- sig_mean_g1[idx]
      grp_beta_g2 <- sig_mean_g2[idx]
      mean_delta <- mean(grp_beta_g2 - grp_beta_g1, na.rm = TRUE)
      max_delta <- if (mean_delta >= 0) max(grp_beta_g2 - grp_beta_g1, na.rm = TRUE) else min(grp_beta_g2 - grp_beta_g1, na.rm = TRUE)

      dmrs[[length(dmrs) + 1]] <- list(
        chr = as.character(sig_probes$chr[idx[1]]),
        start = as.integer(sig_positions[idx[1]]),
        stop = as.integer(sig_positions[idx[length(idx)]]),
        no_cpgs = length(idx),
        min_smoothed_fdr = min(grp_fdr),
        HMFDR = 1 / mean(1 / grp_fdr),  # harmonic mean
        maxdiff = max_delta,
        meandiff = mean_delta,
        direction = ifelse(mean_delta >= 0, "hyper", "hypo"),
        overlapping_genes = NA_character_
      )
    }
  }
}

###############################################################################
# Step 7: Build diagnostic output
###############################################################################
probe_spacings <- if (nrow(region_probes) > 1) diff(region_probes$start) else integer(0)

elapsed_ms <- as.integer((proc.time() - start_time)["elapsed"] * 1000)
# gc() returns cells; Vcells are 8 bytes each, Ncells are 56 bytes each
gc_info <- gc(reset = FALSE)
peak_mem_mb <- round((gc_info[1, "max used"] * 56 + gc_info[2, "max used"] * 8) / 1048576, 1)

diagnostic <- list(
  probes = list(
    positions = as.integer(region_probes$start),
    mean_group1 = round(as.numeric(filtered_mean_group1), 4),
    mean_group2 = round(as.numeric(filtered_mean_group2), 4),
    fdr = as.numeric(region_probes$adj_p_value),
    logFC = round(as.numeric(region_probes$logFC), 4)
  ),
  probe_spacings = as.integer(probe_spacings),
  total_probes_analyzed = nrow(all_probes),
  elapsed_ms = elapsed_ms,
  peak_memory_mb = peak_mem_mb
)

###############################################################################
# Step 8: Output JSON
###############################################################################
output <- list(dmrs = dmrs, diagnostic = diagnostic)
cat(toJSON(output, auto_unbox = TRUE, digits = NA, na = "null"))
