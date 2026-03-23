# Full DMR analysis: genome-wide limma eBayes + regional DMRCate
#
# Single synchronous script that runs the complete pipeline:
# 1. Genome-wide chromosome-chunked limma (Smyth 2004; Phipson et al. 2016)
# 2. Regional DMRCate kernel smoothing (Peters et al. 2015)
# 3. Proximity-based fallback for sparse regions
#
# Input: JSON from stdin with fields:
#   probe_h5_file, chr, start, stop, case, control,
#   fdr_cutoff, lambda, C, min_samples_per_group
# Output: JSON to stdout with { dmrs, diagnostic }

start_time <- proc.time()
suppressWarnings({
  library(jsonlite)
  library(rhdf5)
  suppressPackageStartupMessages(library(limma))
  suppressPackageStartupMessages(library(DMRcate))
  suppressPackageStartupMessages(library(GenomicRanges))
})

con <- file("stdin", "r")
json <- readLines(con, warn = FALSE)
close(con)
input <- fromJSON(json)

cases <- unlist(strsplit(input$case, ","))
controls <- unlist(strsplit(input$control, ","))
h5_file <- input$probe_h5_file
query_chrom <- input$chr
query_start <- as.integer(input$start)
query_stop <- as.integer(input$stop)
fdr_cutoff <- if (!is.null(input$fdr_cutoff)) input$fdr_cutoff else 0.05
lambda <- if (!is.null(input$lambda)) as.integer(input$lambda) else 1000L
C_param <- if (!is.null(input$C)) input$C else 2
min_spg <- if (!is.null(input$min_samples_per_group)) input$min_samples_per_group else 3

n_cases <- length(cases)
n_controls <- length(controls)

on_error <- function(msg) {
  cat(toJSON(list(error = msg), auto_unbox = TRUE))
  quit(save = "no")
}

###############################################################################
# Step 1: Read HDF5 metadata and map samples
###############################################################################
all_sample_names <- h5read(h5_file, "meta/samples/names")
start_pos <- h5read(h5_file, "meta/start")
probe_ids <- h5read(h5_file, "meta/probe/probeID")
chrom_lengths <- fromJSON(h5readAttributes(h5_file, "/")$chrom_lengths)

case_indices <- match(cases, all_sample_names)
control_indices <- match(controls, all_sample_names)
if (any(is.na(case_indices))) on_error(paste("Case samples not found:", paste(cases[is.na(case_indices)], collapse = ", ")))
if (any(is.na(control_indices))) on_error(paste("Control samples not found:", paste(controls[is.na(control_indices)], collapse = ", ")))
sample_indices <- c(case_indices, control_indices)

conditions <- factor(
  c(rep("Diseased", n_cases), rep("Control", n_controls)),
  levels = c("Control", "Diseased")
)
design <- model.matrix(~conditions)

###############################################################################
# Step 2: Chromosome-chunked lmFit
###############################################################################
all_chromosomes <- names(chrom_lengths)
prefix_sums <- c(0, cumsum(unlist(chrom_lengths)))
coef_col <- "conditionsDiseased"

all_sigmas <- numeric(0)
all_df_residual <- numeric(0)
all_coef <- numeric(0)
all_stdev_unscaled <- numeric(0)
all_chr <- character(0)
all_start <- integer(0)
all_probe_id <- character(0)

for (ci in seq_along(all_chromosomes)) {
  chrom <- all_chromosomes[ci]
  row_start <- prefix_sums[ci] + 1
  row_end <- prefix_sums[ci + 1]
  if (row_end < row_start) next

  beta_chunk <- t(h5read(h5_file, "beta/values", index = list(sample_indices, row_start:row_end)))
  colnames(beta_chunk) <- c(cases, controls)
  rownames(beta_chunk) <- probe_ids[row_start:row_end]

  beta_chunk[beta_chunk <= 0] <- 0.001
  beta_chunk[beta_chunk >= 1] <- 0.999
  m_chunk <- log2(beta_chunk / (1 - beta_chunk))
  rm(beta_chunk)

  # Filter: all selected samples must be non-NA, variance > 0
  no_na <- rowSums(is.na(m_chunk)) == 0
  rv <- apply(m_chunk, 1, var, na.rm = TRUE)
  keep <- no_na & !is.na(rv) & (rv > 0)
  m_chunk <- m_chunk[keep, , drop = FALSE]
  if (nrow(m_chunk) < 1) next

  suppressWarnings(suppressMessages({ fit_chunk <- lmFit(m_chunk, design) }))

  all_sigmas <- c(all_sigmas, fit_chunk$sigma)
  all_df_residual <- c(all_df_residual, fit_chunk$df.residual)
  all_coef <- c(all_coef, fit_chunk$coefficients[, coef_col])
  all_stdev_unscaled <- c(all_stdev_unscaled, fit_chunk$stdev.unscaled[, coef_col])

  kept_indices <- which(keep)
  abs_indices <- (row_start:row_end)[kept_indices]
  all_chr <- c(all_chr, rep(chrom, length(kept_indices)))
  all_start <- c(all_start, start_pos[abs_indices])
  all_probe_id <- c(all_probe_id, probe_ids[abs_indices])

  rm(m_chunk, fit_chunk)
}

n_total <- length(all_sigmas)
if (n_total < 10) on_error(paste0("Too few probes genome-wide after filtering (", n_total, ")"))

###############################################################################
# Step 3: Genome-wide eBayes
###############################################################################
all_var <- all_sigmas^2
fit_f <- suppressWarnings(suppressMessages(fitFDist(all_var, df1 = all_df_residual)))
s2_prior <- fit_f$scale
df_prior <- fit_f$df2
s2_post <- (df_prior * s2_prior + all_df_residual * all_var) / (df_prior + all_df_residual)
mod_t <- all_coef / (all_stdev_unscaled * sqrt(s2_post))
raw_p <- 2 * pt(abs(mod_t), df = df_prior + all_df_residual, lower.tail = FALSE)
adj_p <- p.adjust(raw_p, method = "BH")

###############################################################################
# Step 4: Subset to query region
###############################################################################
region_mask <- all_chr == query_chrom & all_start >= query_start & all_start <= query_stop
region_probes <- data.frame(
  probe_id = all_probe_id[region_mask],
  chr = all_chr[region_mask],
  start = all_start[region_mask],
  t_stat = mod_t[region_mask],
  logFC = all_coef[region_mask],
  adj_p_value = adj_p[region_mask],
  stringsAsFactors = FALSE
)

if (nrow(region_probes) < 3) on_error(paste0("Too few probes in region (", nrow(region_probes), "). Need at least 3."))

###############################################################################
# Step 5: Read beta values for diagnostic group means
###############################################################################
chrom_idx <- which(all_chromosomes == query_chrom)
chrom_row_start <- prefix_sums[chrom_idx] + 1
chrom_row_end <- prefix_sums[chrom_idx + 1]
chrom_start_pos <- start_pos[chrom_row_start:chrom_row_end]

left <- findInterval(query_start, chrom_start_pos)
right <- findInterval(query_stop, chrom_start_pos)
if (left < 1) left <- 1
if (chrom_start_pos[left] < query_start && left < length(chrom_start_pos)) left <- left + 1

filtered_mean_group1 <- numeric(0)
filtered_mean_group2 <- numeric(0)

if (right >= left) {
  abs_left <- chrom_row_start + left - 1
  abs_right <- chrom_row_start + right - 1
  beta_matrix <- t(h5read(h5_file, "beta/values", index = list(sample_indices, abs_left:abs_right)))
  h5_probe_ids <- probe_ids[abs_left:abs_right]
  h5_match <- match(region_probes$probe_id, h5_probe_ids)
  matched <- !is.na(h5_match)
  if (any(matched)) {
    beta_matched <- beta_matrix[h5_match[matched], , drop = FALSE]
    filtered_mean_group1 <- rowMeans(beta_matched[, (n_cases + 1):(n_cases + n_controls), drop = FALSE], na.rm = TRUE)
    filtered_mean_group2 <- rowMeans(beta_matched[, 1:n_cases, drop = FALSE], na.rm = TRUE)
  }
}
if (length(filtered_mean_group1) != nrow(region_probes)) {
  filtered_mean_group1 <- rep(NA_real_, nrow(region_probes))
  filtered_mean_group2 <- rep(NA_real_, nrow(region_probes))
}

###############################################################################
# Step 6: Construct CpGannotated and run DMRCate
###############################################################################
cpg_ranges <- GRanges(seqnames = region_probes$chr, ranges = IRanges(start = region_probes$start, width = 1))
mcols(cpg_ranges)$stat <- region_probes$t_stat
mcols(cpg_ranges)$diff <- region_probes$logFC
mcols(cpg_ranges)$ind.fdr <- region_probes$adj_p_value
mcols(cpg_ranges)$is.sig <- region_probes$adj_p_value < fdr_cutoff
cpg_annotated <- new("CpGannotated", ranges = cpg_ranges)

dmr_output <- tryCatch({
  suppressWarnings(suppressMessages(
    dmrcate(cpg_annotated, lambda = lambda, C = C_param)
  ))
}, error = function(e) NULL)

dmrs <- list()
if (!is.null(dmr_output)) {
  genome_build <- if (!is.null(input$genome)) input$genome else "hg38"
  dmr_ranges <- tryCatch({
    suppressWarnings(suppressMessages(
      extractRanges(dmr_output, genome = genome_build)
    ))
  }, error = function(e) NULL)
  if (!is.null(dmr_ranges) && length(dmr_ranges) > 0) {
    for (i in seq_along(dmr_ranges)) {
      r <- dmr_ranges[i]
      dmrs[[i]] <- list(
        chr = as.character(seqnames(r)), start = as.integer(start(r)), stop = as.integer(end(r)),
        no_cpgs = mcols(r)$no.cpgs, min_smoothed_fdr = mcols(r)$min_smoothed_fdr,
        HMFDR = mcols(r)$HMFDR, maxdiff = mcols(r)$maxdiff, meandiff = mcols(r)$meandiff,
        direction = ifelse(mcols(r)$meandiff >= 0, "hyper", "hypo"),
        overlapping_genes = as.character(mcols(r)$overlapping.genes)
      )
    }
  }
}

###############################################################################
# Step 7: Proximity-based fallback
###############################################################################
if (length(dmrs) == 0) {
  min_delta_beta <- 0.05
  delta_betas <- filtered_mean_group2 - filtered_mean_group1
  sig_mask <- region_probes$adj_p_value < fdr_cutoff & abs(delta_betas) >= min_delta_beta
  if (sum(sig_mask) >= 2) {
    sig_probes <- region_probes[sig_mask, ]
    sig_dirs <- ifelse(sig_probes$logFC >= 0, "hyper", "hypo")
    sig_pos <- sig_probes$start
    sig_g1 <- filtered_mean_group1[sig_mask]
    sig_g2 <- filtered_mean_group2[sig_mask]
    groups <- list(); grp <- list(idx = 1)
    for (j in seq_along(sig_pos)[-1]) {
      prev <- grp$idx[length(grp$idx)]
      if (sig_dirs[j] == sig_dirs[prev] && (sig_pos[j] - sig_pos[prev]) <= lambda) {
        grp$idx <- c(grp$idx, j)
      } else { groups <- c(groups, list(grp)); grp <- list(idx = j) }
    }
    groups <- c(groups, list(grp))
    for (g in groups) {
      if (length(g$idx) < 2) next
      d <- sig_g2[g$idx] - sig_g1[g$idx]; md <- mean(d)
      dmrs[[length(dmrs) + 1]] <- list(
        chr = as.character(sig_probes$chr[g$idx[1]]),
        start = as.integer(sig_pos[g$idx[1]]), stop = as.integer(sig_pos[g$idx[length(g$idx)]]),
        no_cpgs = length(g$idx), min_smoothed_fdr = min(sig_probes$adj_p_value[g$idx]),
        HMFDR = length(g$idx) / sum(1 / pmax(sig_probes$adj_p_value[g$idx], 1e-300)),
        maxdiff = if (md >= 0) max(d) else min(d), meandiff = md,
        direction = ifelse(md >= 0, "hyper", "hypo"), overlapping_genes = NA_character_
      )
    }
  }
}

###############################################################################
# Step 8: Output
###############################################################################
elapsed_ms <- as.integer((proc.time() - start_time)["elapsed"] * 1000)
gc_info <- gc(reset = FALSE)
peak_mem_mb <- round((gc_info[1, "max used"] * 56 + gc_info[2, "max used"] * 8) / 1048576, 1)

output <- list(
  dmrs = dmrs,
  diagnostic = list(
    probes = list(
      positions = as.integer(region_probes$start),
      mean_group1 = round(as.numeric(filtered_mean_group1), 4),
      mean_group2 = round(as.numeric(filtered_mean_group2), 4),
      fdr = as.numeric(region_probes$adj_p_value),
      logFC = round(as.numeric(region_probes$logFC), 4)
    ),
    probe_spacings = as.integer(if (nrow(region_probes) > 1) diff(region_probes$start) else integer(0)),
    total_probes_analyzed = n_total,
    elapsed_ms = elapsed_ms,
    peak_memory_mb = peak_mem_mb
  )
)
cat(toJSON(output, auto_unbox = TRUE, digits = NA, na = "null"))
