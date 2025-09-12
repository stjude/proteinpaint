# Test syntax: cat ~/sjpp/test.txt | time Rscript edge.R

# Load required packages
suppressWarnings({
  library(jsonlite)
  library(rhdf5)
  library(stringr)
  library(readr)
  suppressPackageStartupMessages(library(edgeR))
  suppressPackageStartupMessages(library(dplyr))
})

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
  combined <- c("geneSymbol", cases, controls)
})
#cat("Time to read JSON: ", as.difftime(read_json_time, units = "secs")[3], " seconds\n")

# Read counts data
read_counts_time <- system.time({
  if (input$storage_type == "HDF5") {
    geneNames <- h5read(input$input_file, "item")
    samples <- h5read(input$input_file, "samples")

    # Find indices of case and control samples in the HDF5 file
    case_indices <- match(cases, samples)
    control_indices <- match(controls, samples)

    # Check for missing samples
    if (any(is.na(case_indices))) {
      missing_cases <- cases[is.na(case_indices)]
      stop(paste(missing_cases, "not found"))
    }
    if (any(is.na(control_indices))) {
      missing_controls <- controls[is.na(control_indices)]
      stop(paste(missing_controls, "not found"))
    }

    samples_indices <- c(case_indices, control_indices)
    read_counts <- as.data.frame(t(h5read(input$input_file, "matrix", index = list(samples_indices, 1:length(geneNames)))))
    colnames(read_counts) <- c(cases, controls)
  } else if (input$storage_type == "text") {
    suppressWarnings({
      suppressMessages({
        read_counts <- read_tsv(input$input_file, col_names = TRUE, col_select = combined)
      })
    })
    geneNames <- unlist(read_counts[1])
    read_counts <- select(read_counts, -geneSymbol)
  } else {
    stop("Unknown storage type")
  }
})
#cat("Time to read counts data: ", as.difftime(read_counts_time, units = "secs")[3], " seconds\n")

# Create conditions vector
conditions <- c(rep("Diseased", length(cases)), rep("Control", length(controls)))

# Create DGEList object
dge_list_time <- system.time({
  y <- DGEList(counts = read_counts, group = conditions, genes = geneNames)
})
#cat("Time to generate DGEList: ", as.difftime(dge_list_time, units = "secs")[3], " seconds\n")

# Filter and normalize counts
filter_time <- system.time({
  keep <- filterByExpr(y, min.count = input$min_count, min.total.count = input$min_total_count)
})
#cat("Time to filter by expression: ", as.difftime(filter_time, unit = "secs")[3], " seconds\n")

normalization_time <- system.time({
  y <- y[keep, keep.lib.sizes = FALSE]
  y <- normLibSizes(y) # Using TMM method for normalization
})
#cat("Normalization time: ", as.difftime(normalization_time, units = "secs")[3], " seconds\n")

# Cutoffs for cpm, will add them as UI options later
if (length(samples_indices) > 100) {
  gene_cpm_cutoff <- 15
  sample_cpm_cutoff <- 30
  count_cpm_cutoff <- 100000
} else {
  gene_cpm_cutoff <- 5
  sample_cpm_cutoff <- 15
  count_cpm_cutoff <- 100000
}

filter_using_cpm_time <- system.time({
  y <- filter_using_cpm(y, gene_cpm_cutoff, sample_cpm_cutoff, count_cpm_cutoff) # Filtering counts matrix based on gene_cpm_cutoff, sample_cpm_cutoff and count_cpm_cutoff
})
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
    set.seed(as.integer(Sys.time())) # Set the seed according to current time
    cachedir <- input$cachedir # Importing serverconfig.cachedir
    random_number <- runif(1, min = 0, max = 1) # Generating random number
    mds_image_name <- paste0("edgeR_mds_temp_",random_number,".png") # Generating random image name so that simultaneous server side requests do NOT generate the same edgeR file name
    png(filename = paste0(cachedir,"/",mds_image_name), width = 1000, height = 1000, res = 200) # Opening a png device
    par(oma = c(0, 0, 0, 0)) # Creating a margin
    mds_conditions <- c(rep("T", length(cases)), rep("C", length(controls))) # Case samples are labelled "T" and control samples are labelled "C". Single-letter labelling added because otherwise labels get overwritten on each other.
    plotMDS(y, labels = mds_conditions) # Plot the edgeR MDS plot
    # dev.off() # Gives a null device message which breaks JSON. Commenting it out for now, will investigate it later
  })
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
    #cat("Time for making design matrix: ", as.difftime(model_gen_time, units = "secs")[3], " seconds\n")

  }
}

DE_method <- input$DE_method
if (DE_method == "edgeR") {
  fit_time <- system.time({
    suppressWarnings({
      suppressMessages({
        fit <- glmQLFit(y,design) # The glmQLFit() replaces glmFit() which implements the quasi-likelihood function. This is better able to account for overdispersion as it employs a more lenient approach where variance is not a fixed function of the mean.
      })
    })
  })
  #cat("QL fit time: ", as.difftime(fit_time, units = "secs")[3], " seconds\n")
  test_time <- system.time({
    suppressWarnings({
      suppressMessages({
        et <- glmQLFTest(fit, coef = "conditionsDiseased")
      })
    })
  })
  #cat("QL test time: ", as.difftime(test_time, units = "secs")[3], " seconds\n")    
  
  # Saving QL fit image
  ql_plot_time <- system.time({
    set.seed(as.integer(Sys.time())) # Set the seed according to current time
    cachedir <- input$cachedir # Importing serverconfig.cachedir
    random_number <- runif(1, min = 0, max = 1) # Generating random number
    fit_image_name <- paste0("edgeR_ql_temp_",random_number,".png") # Generating random image name so that simultaneous server side requests do NOT generate the same edgeR file name
    png(filename = paste0(cachedir,"/",fit_image_name), width = 1000, height = 1000, res = 200) # Opening a png device
    par(oma = c(0, 0, 0, 0)) # Creating a margin
    plotQLDisp(fit) # Plot the edgeR fit
    # dev.off() # Gives a null device message which breaks JSON. Commenting it out for now, will investigate it later
  })
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
        set.seed(as.integer(Sys.time())) # Set the seed according to current time
        cachedir <- input$cachedir # Importing serverconfig.cachedir
        random_number <- runif(1, min = 0, max = 1) # Generating random number
        fit_image_name <- paste0("limma_voom_temp_",random_number,".png") # Generating random image name so that simultaneous server side requests do NOT generate the same edgeR file name
        png(filename = paste0(cachedir,"/",fit_image_name), width = 1000, height = 1000, res = 200) # Opening a png device
        par(oma = c(0, 0, 0, 0)) # Creating a margin
        suppressWarnings({
          suppressMessages({
            fit <- voomLmFit(y, design, plot = TRUE) # This is base don the recommendation of the edgeR limma/voom authors https://support.bioconductor.org/p/9161585/
          })
        })
        dev.off() # Gives a null device message which breaks JSON. Commenting it out for now, will investigate it later
      })
    })
  })
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
final_output <- c()
final_output$gene_data <- output
final_output$edgeR_ql_image_name <- fit_image_name
if (dim(read_counts)[1] * dim(read_counts)[2] < as.numeric(input$mds_cutoff)) { # If the dimensions of the read counts matrix is below this threshold, only then the mds image will be generated as its very compute intensive
  final_output$edgeR_mds_image_name <- mds_image_name
}
#cat("Time for generating final dataframe: ", as.difftime(final_data_generation_time, unit = "secs")[3], " seconds\n")

# Output results
toJSON(final_output, digits = NA, na = "string") # Setting digits = NA makes toJSON() use the max precision. na='string' causes any "not a number" to be reported as string. This from ?toJSON() documentation
