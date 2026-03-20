# DMRCate: Locus-specific differential methylation region analysis
# Reads probe-level beta values from HDF5, converts to M-values, runs limma + DMRCate
# on the queried region, and returns DMR calls with per-CpG diagnostic data.
#
# Input: JSON from stdin with fields:
#   probe_h5_file, chr, start, stop, case, control, fdr_cutoff, lambda, C, min_samples_per_group
# Output: JSON to stdout with { dmrs, diagnostic }

###############################################################################
# Step 1: Load required R packages
###############################################################################
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

fdr_cutoff <- if (!is.null(input$fdr_cutoff)) input$fdr_cutoff else 0.05
lambda <- if (!is.null(input$lambda)) as.integer(input$lambda) else 1000L
C_param <- if (!is.null(input$C)) input$C else 2
min_samples_per_group <- if (!is.null(input$min_samples_per_group)) input$min_samples_per_group else 3

###############################################################################
# Step 3: Read probe-level beta values from HDF5 for the query region
###############################################################################
# Read sample metadata
all_sample_names <- h5read(h5_file, "meta/samples/names")
start_pos <- h5read(h5_file, "meta/start")
probe_ids <- h5read(h5_file, "meta/probe/probeID")

# Read chromosome lengths from root attribute to find row range
chrom_lengths_json <- h5readAttributes(h5_file, "/")$chrom_lengths
chrom_lengths <- fromJSON(chrom_lengths_json)

if (!(query_chrom %in% names(chrom_lengths))) {
  cat(toJSON(list(error = paste0("Chromosome ", query_chrom, " not found in HDF5 file")), auto_unbox = TRUE))
  quit(save = "no")
}

# Compute row range for the query chromosome using prefix sums
all_chromosomes <- names(chrom_lengths)
prefix_sums <- c(0, cumsum(unlist(chrom_lengths)))
chrom_idx <- which(all_chromosomes == query_chrom)
chrom_row_start <- prefix_sums[chrom_idx] + 1  # R is 1-based
chrom_row_end <- prefix_sums[chrom_idx + 1]

# Get start positions for this chromosome's probes
chrom_start_pos <- start_pos[chrom_row_start:chrom_row_end]

# Binary search for probes within [query_start, query_stop]
left <- findInterval(query_start, chrom_start_pos)
right <- findInterval(query_stop, chrom_start_pos)

# Adjust: findInterval gives index where value would be inserted
if (left < 1) left <- 1
if (chrom_start_pos[left] < query_start && left < length(chrom_start_pos)) left <- left + 1
if (right < 1 || left > right) {
  cat(toJSON(list(error = "No probes found in the specified region"), auto_unbox = TRUE))
  quit(save = "no")
}

# Convert to absolute row indices in the HDF5 file
abs_left <- chrom_row_start + left - 1
abs_right <- chrom_row_start + right - 1
n_probes_in_region <- abs_right - abs_left + 1

if (n_probes_in_region < 3) {
  cat(toJSON(list(error = paste0("Too few probes in region (", n_probes_in_region, "). Need at least 3.")), auto_unbox = TRUE))
  quit(save = "no")
}

# Map case/control samples to column indices
case_indices <- match(cases, all_sample_names)
control_indices <- match(controls, all_sample_names)

if (any(is.na(case_indices))) {
  missing <- cases[is.na(case_indices)]
  cat(toJSON(list(error = paste0("Case samples not found: ", paste(missing, collapse = ", "))), auto_unbox = TRUE))
  quit(save = "no")
}
if (any(is.na(control_indices))) {
  missing <- controls[is.na(control_indices)]
  cat(toJSON(list(error = paste0("Control samples not found: ", paste(missing, collapse = ", "))), auto_unbox = TRUE))
  quit(save = "no")
}

sample_indices <- c(case_indices, control_indices)

# Read beta values for the region and selected samples
# HDF5 is row-major (Python convention), rhdf5 transposes on read
beta_matrix <- t(h5read(
  h5_file,
  "beta/values",
  index = list(sample_indices, abs_left:abs_right)
))

target_probe_ids <- probe_ids[abs_left:abs_right]
target_positions <- start_pos[abs_left:abs_right]

colnames(beta_matrix) <- c(cases, controls)
rownames(beta_matrix) <- target_probe_ids

###############################################################################
# Step 4: Convert beta to M-values, filter probes
###############################################################################
# Compute per-CpG group means from beta values BEFORE conversion (for diagnostic)
n_cases <- length(cases)
n_controls <- length(controls)
mean_group1 <- rowMeans(beta_matrix[, (n_cases + 1):(n_cases + n_controls), drop = FALSE], na.rm = TRUE)
mean_group2 <- rowMeans(beta_matrix[, 1:n_cases, drop = FALSE], na.rm = TRUE)

# Clamp beta to avoid Inf in M-value conversion
beta_matrix[beta_matrix <= 0] <- 0.001
beta_matrix[beta_matrix >= 1] <- 0.999
m_matrix <- log2(beta_matrix / (1 - beta_matrix))

# Filter: require min_samples_per_group non-NA in each group
case_non_na <- rowSums(!is.na(m_matrix[, 1:n_cases, drop = FALSE]))
control_non_na <- rowSums(!is.na(m_matrix[, (n_cases + 1):(n_cases + n_controls), drop = FALSE]))
keep <- (case_non_na >= min_samples_per_group) & (control_non_na >= min_samples_per_group)

# Filter zero-variance probes
row_vars <- apply(m_matrix, 1, var, na.rm = TRUE)
keep <- keep & !is.na(row_vars) & (row_vars > 0)

# Remove rows with any remaining NAs (limma cannot handle them)
na_rows <- rowSums(is.na(m_matrix)) > 0
keep <- keep & !na_rows

m_matrix <- m_matrix[keep, , drop = FALSE]
filtered_positions <- target_positions[keep]
filtered_probe_ids <- target_probe_ids[keep]
filtered_mean_group1 <- mean_group1[keep]
filtered_mean_group2 <- mean_group2[keep]

if (nrow(m_matrix) < 3) {
  cat(toJSON(list(error = paste0("Too few probes after filtering (", nrow(m_matrix), "). Need at least 3.")), auto_unbox = TRUE))
  quit(save = "no")
}

###############################################################################
# Step 5: Build design matrix and run limma + DMRCate
###############################################################################
# Case = "Diseased", Control = "Control" (same convention as diffMeth.R)
conditions <- factor(
  c(rep("Diseased", n_cases), rep("Control", n_controls)),
  levels = c("Control", "Diseased")
)
design <- model.matrix(~conditions)

# Fit limma
suppressWarnings(suppressMessages({
  fit <- lmFit(m_matrix, design)
  fit <- eBayes(fit)
}))

# Extract per-CpG stats for diagnostic
top_table <- suppressWarnings(suppressMessages(
  topTable(fit, coef = "conditionsDiseased", number = Inf, sort.by = "none", adjust.method = "fdr")
))

# Build CpGannotated object manually from limma results
cpg_ranges <- GRanges(
  seqnames = rep(query_chrom, nrow(m_matrix)),
  ranges = IRanges(start = filtered_positions, width = 1)
)
mcols(cpg_ranges)$stat <- top_table$t
mcols(cpg_ranges)$diff <- top_table$logFC
mcols(cpg_ranges)$ind.fdr <- top_table$adj.P.Val
mcols(cpg_ranges)$is.sig <- top_table$adj.P.Val < fdr_cutoff

cpg_annotated <- new("CpGannotated", ranges = cpg_ranges)

# Run DMRCate
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
# Step 7: Build diagnostic output
###############################################################################
probe_spacings <- if (length(filtered_positions) > 1) diff(filtered_positions) else integer(0)

diagnostic <- list(
  probes = list(
    positions = as.integer(filtered_positions),
    mean_group1 = round(as.numeric(filtered_mean_group1), 4),
    mean_group2 = round(as.numeric(filtered_mean_group2), 4),
    fdr = as.numeric(top_table$adj.P.Val),
    logFC = round(as.numeric(top_table$logFC), 4)
  ),
  probe_spacings = as.integer(probe_spacings)
)

###############################################################################
# Step 8: Output JSON
###############################################################################
output <- list(dmrs = dmrs, diagnostic = diagnostic)
cat(toJSON(output, auto_unbox = TRUE, digits = NA, na = "null"))
