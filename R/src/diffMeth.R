# Prototype: Differential Methylation Analysis using limma on promoter-level M-values
# Reads promoter H5 file (from createHdf5ForDnaMeth.py --format promoter)
# Input: JSON from stdin with case/control sample names and H5 file path
# Output: JSON with differential methylation results per promoter
#
# Why limma and not edgeR?
#   edgeR uses a negative binomial model designed for discrete count data (RNA-seq).
#   M-values are continuous and approximately normally distributed (they are the
#   logit transform of beta values: M = log2(beta / (1 - beta))), so limma's
#   linear modeling framework is the statistically appropriate choice here.
#   No CPM filtering or TMM normalization is needed because methylation data is
#   already on a bounded scale (beta 0-1, M-value roughly -12 to +9).
#
# Test syntax:
#   echo '{"case":"sample1,sample2","control":"sample3,sample4","input_file":"/path/to/promoter_avg_mval.h5","min_samples_per_group":3}' | Rscript diffMeth.R
#   echo '{"case":"SJMB093963,SJMB084394,SJMB032134,SJMB030919,SJMB033810,PASNPK","control":"PAPFRT,PASTNK,PASVAR,PASVLL,PASXSE,PATERP","input_file":"promoter_avg_mval.h5","min_samples_per_group":3}' | Rscript proteinpaint/R/src/diffMeth.R

# Memory probe: returns peak MB used since the last call (gc reset = TRUE
# captures the high-water mark, then resets the counter). gc(full=TRUE) forces
# a full collection so freed objects from rm() are accounted for. Each call
# costs a few ms; negligible relative to the steps we wrap.
#
# gc() returns a matrix with several "(Mb)" columns (current used, gc trigger,
# max used). The LAST "(Mb)" column is always max-used-Mb across R versions
# (newer R adds a "limit (Mb)" column that shifts numeric indices). We sum
# Ncells + Vcells from that column.
mem_probe <- function() {
  g <- gc(verbose = FALSE, full = TRUE, reset = TRUE)
  mb_cols <- which(colnames(g) == "(Mb)")
  unname(sum(g[, mb_cols[length(mb_cols)]]))
}
invisible(mem_probe()) # establish a baseline before any work is timed

###############################################################################
# Step 1: Load required R packages
###############################################################################
# suppressWarnings / suppressPackageStartupMessages prevent noisy library
# loading messages from contaminating our JSON output on stdout.
pkg_load_time <- system.time({
  suppressWarnings({
    library(jsonlite) # fromJSON() / toJSON() for reading input and writing output
    library(rhdf5) # h5read() for reading HDF5 files from Bioconductor
    library(stringr) # string utilities (not heavily used yet, kept for parity with edge.R)
    suppressPackageStartupMessages(library(matrixStats)) # rowVars() — orders of magnitude faster than apply(..., var)
    suppressPackageStartupMessages(library(limma)) # lmFit(), eBayes(), topTable() for differential analysis
    suppressPackageStartupMessages(library(dplyr)) # data manipulation utilities
  })
})
pkg_load_mem <- mem_probe()

###############################################################################
# Step 2: Read JSON input from stdin
###############################################################################
# The server pipes a JSON object into this script via stdin (same pattern as edge.R).
# Expected JSON fields:
#   case:                  comma-separated sample names for the "diseased" / treatment group
#   control:               comma-separated sample names for the reference / control group
#   input_file:            absolute path to the promoter-level M-value HDF5 file
#   min_samples_per_group: (optional, default 3) minimum non-NA samples required per group
#   conf1:                 (optional) array of confounding variable 1 values, one per sample
#   conf1_mode:            (optional) "continuous" or "discrete" — type of conf1
#   conf2:                 (optional) array of confounding variable 2 values
#   conf2_mode:            (optional) "continuous" or "discrete" — type of conf2
read_json_time <- system.time({
  con <- file("stdin", "r") # Open a connection to stdin
  json <- readLines(con, warn = FALSE) # Read all lines (the JSON is a single line)
  close(con) # Close the stdin connection
  input <- fromJSON(json) # Parse JSON string into an R list
  cases <- unlist(strsplit(input$case, ",")) # Split comma-separated case sample names into a vector
  controls <- unlist(strsplit(input$control, ",")) # Split comma-separated control sample names into a vector
})
read_json_mem <- mem_probe()

###############################################################################
# Step 3: Read M-values from the promoter HDF5 file
###############################################################################
# The H5 file was created by createHdf5ForDnaMeth.py --format promoter.
# Its internal structure:
#   /beta/values                 {n_promoters, n_samples}  float32  — the M-value matrix
#   /meta/gene_names             {n_promoters}             str      — comma-separated gene symbols per promoter
#   /meta/samples/names          {n_samples}               str      — sample identifiers (column headers)
#   /meta/promoter/promoterID    {n_promoters}             str      — ENCODE CRE IDs (e.g. EH38E2776539)
#   /meta/start                  {n_promoters}             int      — promoter start coordinate (0-based)
#   /meta/stop                   {n_promoters}             int      — promoter end coordinate (exclusive)
#   /meta/num_cpg_sites          {n_promoters}             int      — how many CpG probes fell in this promoter
read_data_time <- system.time({
  h5_file <- input$input_file # Path to the HDF5 file from the JSON input

  # Read metadata vectors we need:
  all_samples <- h5read(h5_file, "meta/samples/names") # All 1,544 sample names in the H5
  gene_names <- h5read(h5_file, "meta/gene_names") # Gene annotation per promoter (e.g. "TP53" or "TP53,TP53-AS1")
  promoter_ids <- h5read(h5_file, "meta/promoter/promoterID") # ENCODE CRE ID per promoter (used as row identifier)
  chrs <- h5read(h5_file, "meta/chr")     # Chromosome per promoter (e.g. "chr1")
  starts <- h5read(h5_file, "meta/start") # Promoter start coordinate (0-based)
  stops <- h5read(h5_file, "meta/stop")   # Promoter end coordinate (exclusive)

  # match() returns the positional index of each case/control sample within all_samples.
  # These indices are used to read only the relevant columns from the H5 matrix,
  # avoiding loading all 1,544 samples into memory.
  case_indices <- match(cases, all_samples)
  control_indices <- match(controls, all_samples)

  # Validate that every requested sample was found in the H5 file.
  # If not, stop with an error listing the missing sample names.
  if (any(is.na(case_indices))) {
    missing_cases <- cases[is.na(case_indices)]
    stop(paste(missing_cases, "not found"))
  }
  if (any(is.na(control_indices))) {
    missing_controls <- controls[is.na(control_indices)]
    stop(paste(missing_controls, "not found"))
  }

  # Combine case + control indices into one vector. Cases come first, controls second.
  # This ordering must stay consistent with the conditions vector built later.
  sample_indices <- c(case_indices, control_indices)
  n_promoters <- length(gene_names) # Total promoter count in the H5 (e.g. 47,532)

  # Read the FULL M-value matrix from HDF5, then subset in R.
  #
  # Why not pass index = list(sample_indices, 1:n_promoters)? rhdf5's index
  # codepath is dramatically slower than a plain full read on this dataset
  # (~11s vs ~1s for a 62K x 1544 matrix) — the per-element selection
  # overhead dominates even though only ~12 columns are wanted. Reading the
  # whole matrix and subsetting in R bypasses that codepath entirely.
  #
  # HDF5 stores data in row-major order (C convention), but R uses column-major
  # (Fortran convention). rhdf5's h5read() transposes dimensions during the read,
  # so what is {n_promoters, n_samples} on disk appears as {n_samples, n_promoters}
  # in R. We row-subset (cheap) then transpose to get our desired
  # {n_promoters, n_samples_subset} matrix.
  full_matrix <- h5read(h5_file, "beta/values") # {n_samples_total, n_promoters} in R view
  mvalues <- t(full_matrix[sample_indices, , drop = FALSE])
  rm(full_matrix) # release the ~780MB full matrix as soon as the subset is taken

  # Label columns with sample names and rows with ENCODE CRE IDs.
  # These labels are used by limma and carried through to topTable() output.
  colnames(mvalues) <- c(cases, controls)
  rownames(mvalues) <- promoter_ids
})
read_data_mem <- mem_probe()

###############################################################################
# Step 4: Filter out promoters with insufficient data or no variance
###############################################################################
# Two filtering criteria:
#   1. Each group (case and control) must have at least min_samples_per_group
#      non-NA values for a given promoter. Promoters where most of one group
#      is NA would produce unreliable differential estimates.
#   2. Promoters with zero variance across all selected samples are uninformative
#      (limma can't estimate differential methylation if all values are identical).
filter_time <- system.time({
  # Use the input parameter if provided, otherwise default to 3
  min_samples_per_group <- if (!is.null(input$min_samples_per_group)) {
    input$min_samples_per_group
  } else {
    3
  }

  n_cases <- length(cases)
  n_controls <- length(controls)

  # Count non-NA values per promoter (row) within each group.
  # Columns 1:n_cases are the case samples; the rest are controls.
  # drop = FALSE ensures the result stays a matrix even if there's only 1 sample.
  case_non_na <- rowSums(!is.na(mvalues[, 1:n_cases, drop = FALSE]))
  control_non_na <- rowSums(
    !is.na(mvalues[, (n_cases + 1):(n_cases + n_controls), drop = FALSE])
  )

  # A promoter passes if BOTH groups meet the minimum non-NA threshold
  keep <- (case_non_na >= min_samples_per_group) &
    (control_non_na >= min_samples_per_group)

  # Compute per-row variance (ignoring NAs). Promoters where all values are
  # identical (var = 0) or all NA (var = NA) are removed.
  # matrixStats::rowVars runs in C in a single pass — much faster than
  # apply(mvalues, 1, var, ...), which transposes the matrix and dispatches
  # var() in R for every row.
  row_vars <- rowVars(mvalues, na.rm = TRUE)
  keep <- keep & !is.na(row_vars) & (row_vars > 0)

  # Subset the matrix and metadata vectors to only the promoters that passed filtering
  mvalues <- mvalues[keep, , drop = FALSE]
  gene_names_filtered <- gene_names[keep]
  promoter_ids_filtered <- promoter_ids[keep]
  chrs_filtered <- chrs[keep]
  starts_filtered <- starts[keep]
  stops_filtered <- stops[keep]
})
filter_mem <- mem_probe()

# If nothing survived filtering, exit gracefully with an informative error
if (nrow(mvalues) == 0) {
  stop("Number of promoters after filtering = 0, cannot proceed")
}

###############################################################################
# Step 5: Build the conditions vector and design matrix
###############################################################################
# The conditions factor tells limma which samples are cases vs controls.
# "Control" is set as the reference level so the "conditionsDiseased" coefficient
# represents the change FROM control TO diseased (positive logFC = higher
# methylation in diseased group = hypermethylation).
design_time <- system.time({
  conditions <- factor(
    c(rep("Diseased", n_cases), rep("Control", n_controls)),
    levels = c("Control", "Diseased")
  )

  # The design matrix encodes the statistical model for limma.
  # Without confounders: ~ conditions (simple two-group comparison)
  # With confounders: ~ conditions + conf1 (+ conf2) to adjust for batch effects,
  #   age, sex, etc. This is the same design matrix approach used in edge.R.
  if (length(input$conf1) == 0) {
    # No confounding variables — simple case vs control comparison
    design <- model.matrix(~conditions)
  } else {
    # First confounding variable is present
    if (input$conf1_mode == "continuous") {
      conf1 <- as.numeric(input$conf1) # e.g. age: 5.2, 7.1, 3.8, ...
    } else {
      conf1 <- as.factor(input$conf1) # e.g. sex: "Male", "Female", "Male", ...
    }

    if (length(input$conf2) == 0) {
      # Only one confounding variable
      design <- model.matrix(~ conditions + conf1)
    } else {
      # Second confounding variable is also present
      if (input$conf2_mode == "continuous") {
        conf2 <- as.numeric(input$conf2)
      } else {
        conf2 <- as.factor(input$conf2)
      }
      # Model adjusts for both confounders simultaneously
      design <- model.matrix(~ conditions + conf1 + conf2)
    }
  }
})
design_mem <- mem_probe()

###############################################################################
# Step 6: Impute remaining NAs with group means
###############################################################################
# After filtering (Step 4), some promoters may still have NAs in individual
# samples (we only required min_samples_per_group non-NAs, not all).
# NAs arise from different array types (450K vs EPIC vs EPIC 2) covering
# different probe sets. Rather than dropping these promoters entirely — which
# causes biologically important promoters (e.g. PTCH1) to disappear from the
# analysis — we impute remaining NAs with the group mean (Maksimovic et al.
# 2016, F1000Research). This is conservative: it shrinks the imputed sample's
# contribution toward the group average, slightly reducing power but not
# inflating false positives. Step 4 already guarantees at least
# min_samples_per_group non-NA values per group, so group means are always
# computable.
impute_time <- system.time({
  na_mask <- is.na(mvalues)
  if (any(na_mask)) {
    # Compute each row's group mean once (NA-aware), then build a fill matrix
    # the same shape as mvalues by recycling the per-row means across the
    # group's columns. Replace NAs in one vectorized assignment. This avoids
    # the per-row R loop and its repeated mean() / subscript operations.
    case_cols <- 1:n_cases
    control_cols <- (n_cases + 1):(n_cases + n_controls)
    case_means <- rowMeans(mvalues[, case_cols, drop = FALSE], na.rm = TRUE)
    control_means <- rowMeans(mvalues[, control_cols, drop = FALSE], na.rm = TRUE)
    fill <- cbind(
      matrix(case_means, nrow = nrow(mvalues), ncol = n_cases),
      matrix(control_means, nrow = nrow(mvalues), ncol = n_controls)
    )
    mvalues[na_mask] <- fill[na_mask]
  }
})
impute_mem <- mem_probe()

###############################################################################
# Step 7: Fit linear model and run empirical Bayes moderation (limma)
###############################################################################
# lmFit() fits a separate linear model to each promoter (row), regressing the
# M-values against the design matrix. This gives a coefficient estimate for
# "conditionsDiseased" (the logFC between groups) for every promoter.
#
# eBayes() applies empirical Bayes moderation to the fitted model. This
# "borrows strength" across all promoters to produce more stable variance
# estimates, especially important when sample sizes are small. It shrinks
# each promoter's variance toward a common prior, which improves the
# reliability of the t-statistics and p-values.
fit_time <- system.time({
  suppressWarnings({
    suppressMessages({
      fit <- lmFit(mvalues, design) # Ordinary least squares fit per promoter
      fit <- eBayes(fit) # Empirical Bayes shrinkage of variances
    })
  })
})
fit_mem <- mem_probe()

###############################################################################
# Step 8: Extract results with topTable()
###############################################################################
# topTable() extracts the results for the "conditionsDiseased" coefficient:
#   logFC:     log2 fold change in M-value (Diseased - Control). Positive = hypermethylated in cases.
#   P.Value:   raw p-value from the moderated t-test
#   adj.P.Val: p-value adjusted for multiple testing using Benjamini-Hochberg FDR
#
# number = Inf returns ALL promoters (not just a top subset).
# Results are sorted by p-value (most significant first).
results_time <- system.time({
  suppressWarnings({
    suppressMessages({
      top_table <- topTable(
        fit,
        coef = "conditionsDiseased",
        number = Inf,
        adjust.method = "fdr"
      )
    })
  })
})
results_mem <- mem_probe()

###############################################################################
# Step 9: Build output data frame and emit JSON
###############################################################################
# topTable() stores the ENCODE CRE IDs (our rownames) as its own rownames.
# We use these to look up the corresponding gene names from our filtered
# metadata vector via match().
output_time <- system.time({
  result_promoter_ids <- rownames(top_table)
  result_indices <- match(result_promoter_ids, promoter_ids_filtered)
  result_gene_names <- gene_names_filtered[result_indices]
  result_chrs <- chrs_filtered[result_indices]
  result_starts <- starts_filtered[result_indices]
  result_stops <- stops_filtered[result_indices]

  # Assemble the output data frame. Field names are kept agnostic since these are
  # promoter-level results (not gene-level like DE): the primary ID is an ENCODE
  # CRE promoter ID, not a gene ID.
  output <- data.frame(
    promoter_id = result_promoter_ids, # ENCODE CRE ID (e.g. "EH38E3756858")
    gene_name = result_gene_names, # Gene symbol(s) (e.g. "TP53" or "TP53,TP53-AS1" or "")
    chr = result_chrs, # Chromosome (e.g. "chr1")
    start = result_starts, # Promoter start coordinate (0-based)
    stop = result_stops, # Promoter end coordinate (exclusive)
    fold_change = top_table$logFC, # M-value difference (positive = hypermethylated in cases)
    original_p_value = top_table$P.Value, # Raw p-value from moderated t-test
    adjusted_p_value = top_table$adj.P.Val # FDR-adjusted p-value (Benjamini-Hochberg)
  )

  # Wrap in a list with $promoter_data key. This differs from the DE pipeline's
  # $gene_data key because these are promoter-level results, not gene-level.
  # The server route for differential methylation will need to handle this key.
  final_output <- list()
  final_output$promoter_data <- output
})
output_mem <- mem_probe()

# Per-stage elapsed times (seconds). Reported as part of the JSON so the
# server can log them without parsing stderr. Use elapsed (index 3), not
# user/system CPU time.
elapsed <- function(t) unbox(unname(t["elapsed"]))
final_output$timings <- list(
  pkg_load    = elapsed(pkg_load_time),    # library() calls
  read_json   = elapsed(read_json_time),   # parse stdin JSON
  read_data   = elapsed(read_data_time),   # h5read of metadata + M-value matrix
  filter      = elapsed(filter_time),      # NA-count and variance filtering
  design      = elapsed(design_time),      # build conditions + design matrix
  impute      = elapsed(impute_time),      # group-mean NA imputation
  fit         = elapsed(fit_time),         # lmFit + eBayes
  results     = elapsed(results_time),     # topTable
  output      = elapsed(output_time)       # data.frame assembly
)

# Per-stage peak memory (MB). Each value is the high-water mark of total R
# heap usage during that step (Ncells + Vcells, "max used" from gc()).
# Useful for spotting transient spikes — e.g. read_data peaks at ~780MB
# while the full HDF5 matrix is held before being subset and rm()'d.
mem <- function(m) unbox(round(m, 1))
final_output$memory_mb <- list(
  pkg_load    = mem(pkg_load_mem),
  read_json   = mem(read_json_mem),
  read_data   = mem(read_data_mem),
  filter      = mem(filter_mem),
  design      = mem(design_mem),
  impute      = mem(impute_mem),
  fit         = mem(fit_mem),
  results     = mem(results_mem),
  output      = mem(output_mem)
)

# Write the result as a single JSON string to stdout.
# digits = NA: use maximum floating-point precision (no rounding of p-values)
# na = "string": encode any R NA values as the JSON string "NA" (instead of null)
toJSON(final_output, digits = NA, na = "string")
