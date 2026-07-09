# Test syntax: cat ~/sjpp/test.txt | time Rscript edge_newh5.R

# Memory probe: returns peak MB used since the last call (gc reset = TRUE
# captures the high-water mark, then resets the counter). gc(full=TRUE) forces
# a full collection so freed objects from rm() are accounted for. Each call
# costs a few ms; negligible relative to the steps we wrap.
#
# We compute MB from the "max used" cell counts (Ncells row 1, Vcells row 2)
# rather than indexing the "(Mb)" formatted columns, because the number and
# layout of "(Mb)" columns varies across R versions (e.g. newer R adds a
# "limit (Mb)" column). The "max used" column name and the Ncells/Vcells row
# names are stable. Cell sizes (56 / 8 bytes) match 64-bit R conventions and
# mirror the conversion used in dmrcate_full.R. Wrapped in tryCatch so any
# unexpected gc() shape returns NA instead of crashing the analysis.
mem_probe <- function() {
  tryCatch(
    {
      g <- gc(verbose = FALSE, full = TRUE, reset = TRUE)
      unname((g[1, "max used"] * 56 + g[2, "max used"] * 8) / 1048576)
    },
    error = function(e) NA_real_
  )
}
invisible(mem_probe()) # establish a baseline before any work is timed

# Load required packages
pkg_load_time <- system.time({
  suppressWarnings({
    library(jsonlite)
    library(rhdf5)
    suppressPackageStartupMessages(library(edgeR))
  })
})
pkg_load_mem <- mem_probe()

# Filter based on CPM
filter_using_cpm <- function(y, gene_cpm_cutoff, sample_cpm_cutoff, count_cpm_cutoff) {
  selr <- rowSums(cpm(y$counts)>gene_cpm_cutoff)>=sample_cpm_cutoff
  selc <- colSums(cpm(y$counts))>=count_cpm_cutoff
  y <- y[selr, selc]
}

# Read JSON input from stdin
read_json_time <- system.time({
  con <- file("stdin", "r")
  json <- readLines(con, warn=FALSE)
  close(con)
  input <- fromJSON(json)
  cases <- unlist(strsplit(input$case, ","))
  controls <- unlist(strsplit(input$control, ","))
  cpm_cutoff <- input$cpm_cutoff
})
read_json_mem <- mem_probe()
#cat("Time to read JSON: ", as.difftime(read_json_time, units = "secs")[3], " seconds\n")

# Read counts data
read_counts_time <- system.time({
  geneNames <- h5read(input$input_file, "item")
  samples <- h5read(input$input_file, "samples")

  # Find indices of case and control samples in the HDF5 file
  case_indices <- match(cases, samples)
  control_indices <- match(controls, samples)

  # Check for missing samples
  #if (any(is.na(case_indices))) {
  #  missing_cases <- cases[is.na(case_indices)]
  #  stop(paste(missing_cases, "not found"))
  #}
  #if (any(is.na(control_indices))) {
  #  missing_controls <- controls[is.na(control_indices)]
  #  stop(paste(missing_controls, "not found"))
  #}

  # Removing missing samples from cases
  keep_cases <- !is.na(case_indices)
  cases <- cases[keep_cases]
  case_indices <- case_indices[keep_cases]

  # Removing missing samples from controls
  keep_controls <- !is.na(control_indices)
  controls <- controls[keep_controls]
  control_indices <- control_indices[keep_controls]

  samples_indices <- c(case_indices, control_indices)
  read_counts <- as.data.frame(t(h5read(input$input_file, "matrix", index = list(samples_indices, 1:length(geneNames)))))
  colnames(read_counts) <- c(cases, controls)
})
read_counts_mem <- mem_probe()
#cat("Time to read counts data: ", as.difftime(read_counts_time, units = "secs")[3], " seconds\n")

# Create conditions vector
conditions <- c(rep("Diseased", length(cases)), rep("Control", length(controls)))

# Create DGEList object
dge_list_time <- system.time({
  y <- DGEList(counts = read_counts, group = conditions, genes = geneNames)
})
dge_list_mem <- mem_probe()
#cat("Time to generate DGEList: ", as.difftime(dge_list_time, units = "secs")[3], " seconds\n")

# Filter and normalize counts
filter_time <- system.time({
  keep <- filterByExpr(y, min.count = input$min_count, min.total.count = input$min_total_count)
})
filter_mem <- mem_probe()
#cat("Time to filter by expression: ", as.difftime(filter_time, unit = "secs")[3], " seconds\n")

normalization_time <- system.time({
  y <- y[keep, keep.lib.sizes = FALSE]
  y <- normLibSizes(y) # Using TMM method for normalization
})
normalization_mem <- mem_probe()
#cat("Normalization time: ", as.difftime(normalization_time, units = "secs")[3], " seconds\n")

# Cutoffs for cpm, will add them as UI options later
# Get the number of cases and controls
n_cases <- length(cases)
n_controls <- length(controls)
# Choose the smaller group size
sample_cpm_cutoff <- min(n_cases,n_controls)

keep_genes <- rowSums(cpm(y$counts)>cpm_cutoff)>=sample_cpm_cutoff
y <- y[keep_genes,]

#if (length(samples_indices) > 100) {
#  gene_cpm_cutoff <- 15
#  sample_cpm_cutoff <- 30
#  count_cpm_cutoff <- 100000
#} else {
#  gene_cpm_cutoff <- 5
#  sample_cpm_cutoff <- 15
#  count_cpm_cutoff <- 100000
#}

#filter_using_cpm_time <- system.time({
#  y <- filter_using_cpm(y, gene_cpm_cutoff, sample_cpm_cutoff, count_cpm_cutoff) # Filtering counts matrix based on gene_cpm_cutoff, sample_cpm_cutoff and count_cpm_cutoff
#})
#cat("Filter using cpm time: ", as.difftime(filter_using_cpm_time, units = "secs")[3], " seconds\n")

if (dim(y)[1]==0) { # Its possible after filtering there might not be any genes left in the matrix, in such a case the R code must exit gracefully with an error.
  stop("Number of genes after filtering = 0, cannot proceed any further") 
}  
if (dim(y)[2]==0) { # Its possible after filtering there might not be any samples left in the matrix, in such a case the R code must exit gracefully with an error.
  stop("Number of samples after filtering = 0, cannot proceed any further") 
}

# Saving MDS plot image

if (dim(read_counts)[1] * dim(read_counts)[2] < as.numeric(input$mds_cutoff)) { # If the dimensions of the read counts matrix is below this threshold, only then the mds image will be generated as its very compute intensive
  mds_plot_time <- system.time({
    # PNG goes straight into the JSON output as base64 — no on-disk
    # artifact. tempfile() lives just long enough for plotMDS to write
    # bytes we read back and unlink. capture.output(try(dev.off()))
    # swallows the "null device 1" auto-print that would corrupt JSON.
    mds_tmp <- tempfile(fileext = ".png")
    png(filename = mds_tmp, width = 1000, height = 1000, res = 200)
    par(oma = c(0, 0, 0, 0)) # Creating a margin
    mds_conditions <- c(rep("T", length(cases)), rep("C", length(controls))) # Case samples are labelled "T" and control samples are labelled "C". Single-letter labelling added because otherwise labels get overwritten on each other.
    plotMDS(y, labels = mds_conditions) # Plot the edgeR MDS plot
    invisible(capture.output(try(dev.off(), silent = TRUE)))
    mds_image_b64 <- base64_enc(readBin(mds_tmp, "raw", n = file.info(mds_tmp)$size))
    unlink(mds_tmp)
  })
  mds_plot_mem <- mem_probe()
  #cat("mds plot time: ", as.difftime(mds_plot_time, units = "secs")[3], " seconds\n")
}

# Differential expression analysis
if (length(input$conf1) == 0) { # No adjustment of confounding factors
  design <- model.matrix(~conditions) # Based on the protocol defined in section 1.4 of edgeR manual https://bioconductor.org/packages/release/bioc/vignettes/edgeR/inst/doc/edgeRUsersGuide.pdf
} else { # Adjusting for confounding factors
  # Check the type of confounding variable
  if (input$conf1_mode == "continuous") { # If this is float, the input conf1 vector should be converted into a numeric vector
    conf1 <- as.numeric(input$conf1)
  } else { # When input$conf1_mode == "discrete" keep the vector as string.
    conf1 <- as.factor(input$conf1)
  }

  if (length(input$conf2) == 0) { # No adjustment of confounding factor 2
    y$samples <- data.frame(y$samples, conditions = conditions, conf1 = conf1)
    model_gen_time <- system.time({
      design <- model.matrix(~ conditions + conf1, data = y$samples)
    })
    model_gen_mem <- mem_probe()
    #cat("Time for making design matrix: ", as.difftime(model_gen_time, units = "secs")[3], " seconds\n")
  } else {
    # Check the type of confounding variable 2
    if (input$conf2_mode == "continuous") { # If this is float, the input conf2 vector should be converted into a numeric vector
      conf2 <- as.numeric(input$conf2)
    } else { # When input$conf2_mode == "discrete" keep the vector as string.
      conf2 <- as.factor(input$conf2)
    }
    y$samples <- data.frame(y$samples, conditions = conditions, conf1 = conf1, conf2 = conf2)
    model_gen_time <- system.time({
      design <- model.matrix(~ conditions + conf1 + conf2, data = y$samples)
    })
    model_gen_mem <- mem_probe()
    #cat("Time for making design matrix: ", as.difftime(model_gen_time, units = "secs")[3], " seconds\n")

  }
}

DE_method <- input$DE_method
if (DE_method == "edgeR") {

  # extract common dispersion and BCV(Biological coefficient of variation)
  y <- estimateDisp(y,design)
  common_disp <- y$common.dispersion
  bcv <- sqrt(common_disp)

  fit_time <- system.time({
    suppressWarnings({
      suppressMessages({
        fit <- glmQLFit(y,design) # The glmQLFit() replaces glmFit() which implements the quasi-likelihood function. This is better able to account for overdispersion as it employs a more lenient approach where variance is not a fixed function of the mean.
      })
    })
  })
  fit_mem <- mem_probe()
  #cat("QL fit time: ", as.difftime(fit_time, units = "secs")[3], " seconds\n")
  test_time <- system.time({
    suppressWarnings({
      suppressMessages({
        et <- glmQLFTest(fit, coef = "conditionsDiseased")
      })
    })
  })
  test_mem <- mem_probe()
  #cat("QL test time: ", as.difftime(test_time, units = "secs")[3], " seconds\n")
  
  # Saving QL fit image
  ql_plot_time <- system.time({
    # PNG goes straight into the JSON output as base64 — see the MDS
    # block above for the rationale on tempfile + capture.output.
    ql_tmp <- tempfile(fileext = ".png")
    png(filename = ql_tmp, width = 1000, height = 1000, res = 200)
    par(oma = c(0, 0, 0, 0)) # Creating a margin
    plotQLDisp(fit) # Plot the edgeR fit
    invisible(capture.output(try(dev.off(), silent = TRUE)))
    ql_image_b64 <- base64_enc(readBin(ql_tmp, "raw", n = file.info(ql_tmp)$size))
    unlink(ql_tmp)
  })
  ql_plot_mem <- mem_probe()
  #cat("ql plot time: ", as.difftime(ql_plot_time, units = "secs")[3], " seconds\n")
  logfc <- et$table$logFC
  logcpm <- et$table$logCPM
  pvalues <- et$table$PValue
  geneNames <- unlist(et$genes)
  adjust_p_values <- p.adjust(pvalues, method = "fdr")
} else if (DE_method == "limma") {
  # Do voom transformation and fit linear model
  voom_transformation_lmfit_time <- system.time({
    suppressWarnings({
      suppressMessages({
        # PNG is captured by the voomLmFit(..., plot = TRUE) call below
        # and streamed back as base64 in the JSON output — see the MDS
        # block above for rationale.
        ql_tmp <- tempfile(fileext = ".png")
        png(filename = ql_tmp, width = 1000, height = 1000, res = 200)
        par(oma = c(0, 0, 0, 0)) # Creating a margin
        suppressWarnings({
          suppressMessages({
            fit <- voomLmFit(y, design, plot = TRUE) # This is base don the recommendation of the edgeR limma/voom authors https://support.bioconductor.org/p/9161585/
          })
        })
        invisible(capture.output(try(dev.off(), silent = TRUE)))
        ql_image_b64 <- base64_enc(readBin(ql_tmp, "raw", n = file.info(ql_tmp)$size))
        unlink(ql_tmp)
      })
    })
  })
  voom_transformation_lmfit_mem <- mem_probe()
  #cat("voom transformation + limma fit time: ", as.difftime(voom_transformation_lmfit_time, units = "secs")[3], " seconds\n")

  # Saving mean-difference plot (aka MA plot)
  #set.seed(as.integer(Sys.time())) # Set the seed according to current time
  #cachedir <- input$cachedir # Importing serverconfig.cachedir
  #random_number <- runif(1, min = 0, max = 1) # Generating random number
  #md_image_name <- paste0("limma_md_temp_",random_number,".png") # Generating random image name so that simultaneous server side requests do NOT generate the same edgeR file name
  #png(filename = paste0(cachedir,"/",md_image_name), width = 1000, height = 1000, res = 200) # Opening a png device
  #par(oma = c(0, 0, 0, 0)) # Creating a margin
  #plotMD(fit) # Plot the limma fit
  ## dev.off() # Gives a null device message which breaks JSON. Commenting it out for now, will investigate it later

  # Empirical Bayes smoothing
  empirical_smoothing_time <- system.time({
    suppressWarnings({
      suppressMessages({
        tmp <- eBayes(fit)
      })
    })
  })
  empirical_smoothing_mem <- mem_probe()
  #cat("Empirical smoothing time: ", as.difftime(empirical_smoothing_time, units = "secs")[3], " seconds\n")

  # Time for selecting top genes
  top_genes_selection_time <- system.time({
    suppressWarnings({
      suppressMessages({
        top_table <- topTable(tmp, coef = "conditionsDiseased", number = Inf, adjust.method = "fdr") # The coeff needs to be specified in topTable() because it needs to know for which contrast the logFC needs to be calculated https://www.biostars.org/p/160465/
        logfc <- top_table$logFC
        pvalues <- top_table$P.Value
        geneNames <- unlist(top_table$genes)
        adjust_p_values <- top_table$adj.P.Val
      })
    })
  })
  top_genes_selection_mem <- mem_probe()
  #cat("Time for selecting top genes: ", as.difftime(top_genes_selection_time, units = "secs")[3], " seconds\n")
} else { # Should not happen
  stop(paste0("Unknown method:", DE_method))
}

final_data_generation_time <- system.time({
  output <- data.frame(geneNames, logfc, pvalues, adjust_p_values)
  names(output)[1] <- "gene_name"
  names(output)[2] <- "fold_change"
  names(output)[3] <- "original_p_value"
  names(output)[4] <- "adjusted_p_value"
})
final_data_generation_mem <- mem_probe()
final_output <- c()
final_output$gene_data <- output
final_output$num_cases <- length(cases)
final_output$num_controls <- length(controls)

# BCV is available only for edgeR
if (DE_method == "edgeR") {
  final_output$bcv <- bcv
}
# Diagnostic PNGs ride along in the JSON output as base64 strings. ql is
# always present for edgeR/limma; mds is only present when the read
# counts matrix fits under input$mds_cutoff.
if (exists("ql_image_b64")) final_output$ql_image_b64 <- unbox(ql_image_b64)
if (exists("mds_image_b64")) final_output$mds_image_b64 <- unbox(mds_image_b64)
#cat("Time for generating final dataframe: ", as.difftime(final_data_generation_time, unit = "secs")[3], " seconds\n")

# Per-stage elapsed times (seconds). Reported as part of the JSON so the
# server can log them without parsing stderr. Use elapsed (index 3), not
# user/system CPU time. Method-specific stages (edgeR vs limma) and
# conditional stages (mds_plot, model_gen) are only included when they ran.
elapsed <- function(t) unbox(unname(t["elapsed"]))
timings <- list(
  pkg_load = elapsed(pkg_load_time),
  read_json = elapsed(read_json_time),
  read_counts = elapsed(read_counts_time),
  dge_list = elapsed(dge_list_time),
  filter = elapsed(filter_time),
  normalization = elapsed(normalization_time),
  final_data = elapsed(final_data_generation_time)
)
if (exists("mds_plot_time")) timings$mds_plot <- elapsed(mds_plot_time)
if (exists("model_gen_time")) timings$model_gen <- elapsed(model_gen_time)
if (exists("fit_time")) timings$fit <- elapsed(fit_time)
if (exists("test_time")) timings$test <- elapsed(test_time)
if (exists("ql_plot_time")) timings$ql_plot <- elapsed(ql_plot_time)
if (exists("voom_transformation_lmfit_time")) timings$voom_transformation_lmfit <- elapsed(voom_transformation_lmfit_time)
if (exists("empirical_smoothing_time")) timings$empirical_smoothing <- elapsed(empirical_smoothing_time)
if (exists("top_genes_selection_time")) timings$top_genes_selection <- elapsed(top_genes_selection_time)
final_output$timings <- timings

# Per-stage peak memory (MB). Each value is the high-water mark of total R
# heap usage during that step (Ncells + Vcells, "max used" from gc()).
mem <- function(m) unbox(round(m, 1))
memory_mb <- list(
  pkg_load = mem(pkg_load_mem),
  read_json = mem(read_json_mem),
  read_counts = mem(read_counts_mem),
  dge_list = mem(dge_list_mem),
  filter = mem(filter_mem),
  normalization = mem(normalization_mem),
  final_data = mem(final_data_generation_mem)
)
if (exists("mds_plot_mem")) memory_mb$mds_plot <- mem(mds_plot_mem)
if (exists("model_gen_mem")) memory_mb$model_gen <- mem(model_gen_mem)
if (exists("fit_mem")) memory_mb$fit <- mem(fit_mem)
if (exists("test_mem")) memory_mb$test <- mem(test_mem)
if (exists("ql_plot_mem")) memory_mb$ql_plot <- mem(ql_plot_mem)
if (exists("voom_transformation_lmfit_mem")) memory_mb$voom_transformation_lmfit <- mem(voom_transformation_lmfit_mem)
if (exists("empirical_smoothing_mem")) memory_mb$empirical_smoothing <- mem(empirical_smoothing_mem)
if (exists("top_genes_selection_mem")) memory_mb$top_genes_selection <- mem(top_genes_selection_mem)
final_output$memory_mb <- memory_mb

# Output results
toJSON(final_output, digits = NA, na = "string") # Setting digits = NA makes toJSON() use the max precision. na='string' causes any "not a number" to be reported as string. This from ?toJSON() documentation
