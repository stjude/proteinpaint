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
    combined <- c("geneID", "geneSymbol", cases, controls)
})
#cat("Time to read JSON: ", read_json_time[3], " seconds\n")

# Read counts data
read_counts_time <- system.time({
    if (input$storage_type == "HDF5") {
        geneIDs <- h5read(input$input_file, "gene_names")
        geneSymbols <- h5read(input$input_file, "gene_symbols")
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
        read_counts <- as.data.frame(t(h5read(input$input_file, "counts", index = list(samples_indices, 1:length(geneIDs)))))
        colnames(read_counts) <- c(cases, controls)
    } else if (input$storage_type == "text") {
        suppressWarnings({
            suppressMessages({
                read_counts <- read_tsv(input$input_file, col_names = TRUE, col_select = combined)
            })
        })
        geneIDs <- unlist(read_counts[1])
        geneSymbols <- unlist(read_counts[2])
        read_counts <- select(read_counts, -geneID)
        read_counts <- select(read_counts, -geneSymbol)
    } else {
        stop("Unknown storage type")
    }
})
#cat("Time to read counts data: ", read_counts_time[3], " seconds\n")

# Create conditions vector
conditions <- c(rep("Diseased", length(cases)), rep("Control", length(controls)))
gene_id_symbols <- paste0(geneIDs, "\t", geneSymbols)

# Create DGEList object
dge_list_time <- system.time({
    y <- DGEList(counts = read_counts, group = conditions, genes = gene_id_symbols)
})
#cat("Time to generate DGEList: ", dge_list_time[3], " seconds\n")

# Filter and normalize counts
filter_time <- system.time({
    keep <- filterByExpr(y, min.count = input$min_count, min.total.count = input$min_total_count)
})
#cat("Time to filter by expression: ", filter_time[3], " seconds\n")

normalization_time <- system.time({
    y <- y[keep, keep.lib.sizes = FALSE]
    y <- normLibSizes(y) # Using TMM method for normalization
})
#cat("Normalization time: ", normalization_time[3], " seconds\n")

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
#cat("Filter using cpm time: ", filter_using_cpm_time[3], " seconds\n")

# Saving MDS plot image
set.seed(as.integer(Sys.time())) # Set the seed according to current time
cachedir <- input$cachedir # Importing serverconfig.cachedir
random_number <- runif(1, min = 0, max = 1) # Generating random number
mds_image_name <- paste0("edgeR_mds_temp_",random_number,".png") # Generating random image name so that simultaneous server side requests do NOT generate the same edgeR file name
png(filename = paste0(cachedir,"/",mds_image_name), width = 1000, height = 1000, res = 200) # Opening a png device
par(oma = c(0, 0, 0, 0)) # Creating a margin
mds_conditions <- c(rep("T", length(cases)), rep("C", length(controls))) # Case samples are labelled "T" and control samples are labelled "C". Single-letter labelling added because otherwise labels get overwritten on each other.
plotMDS(y, labels = mds_conditions) # Plot the edgeR MDS plot
# dev.off() # Gives a null device message which breaks JSON. Commenting it out for now, will investigate it later


# Differential expression analysis
if (length(input$conf1) == 0) { # No adjustment of confounding factors
    design <- model.matrix(~conditions) # Based on the protocol defined in section 1.4 of edgeR manual https://bioconductor.org/packages/release/bioc/vignettes/edgeR/inst/doc/edgeRUsersGuide.pdf
    fit_time <- system.time({
        suppressWarnings({
            suppressMessages({
                fit <- glmQLFit(y,design) # The glmQLFit() replaces glmFit() which implements the quasi-likelihood function. This is better able to account for overdispersion as it employs a more lenient approach where variance is not a fixed function of the mean.
            })
        })
    })
    #cat("QL fit time: ", fit_time[3], " seconds\n")

    test_time <- system.time({
        suppressWarnings({
            suppressMessages({
                et <- glmQLFTest(fit)
            })
        })
    })
    #cat("QL test time: ", test_time[3], " seconds\n")
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
          #cat("Time for making design matrix: ", model_gen_time[3], " seconds\n")
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
          #cat("Time for making design matrix: ", model_gen_time[3], " seconds\n")
    }

    fit_time <- system.time({
        suppressWarnings({
            suppressMessages({
                fit <- glmQLFit(y,design)
            })
        })
    })
    #cat("QL fit time: ", fit_time[3], " seconds\n")
    test_time <- system.time({
        suppressWarnings({
            suppressMessages({
                et <- glmQLFTest(fit, coef = "conditionsDiseased")
            })
        })
    })
    #cat("QL test time: ", test_time[3], " seconds\n")
}

# Saving QL fit image
set.seed(as.integer(Sys.time())) # Set the seed according to current time
cachedir <- input$cachedir # Importing serverconfig.cachedir
random_number <- runif(1, min = 0, max = 1) # Generating random number
ql_image_name <- paste0("edgeR_ql_temp_",random_number,".png") # Generating random image name so that simultaneous server side requests do NOT generate the same edgeR file name
png(filename = paste0(cachedir,"/",ql_image_name), width = 1000, height = 1000, res = 200) # Opening a png device
par(oma = c(0, 0, 0, 0)) # Creating a margin
plotQLDisp(fit) # Plot the edgeR fit
# dev.off() # Gives a null device message which breaks JSON. Commenting it out for now, will investigate it later

# Multiple testing correction
multiple_testing_correction_time <- system.time({
    logfc <- et$table$logFC
    logcpm <- et$table$logCPM
    pvalues <- et$table$PValue
    genes_matrix <- str_split_fixed(unlist(et$genes), "\t", 2)
    geneids <- unlist(genes_matrix[, 1])
    genesymbols <- unlist(genes_matrix[, 2])
    adjust_p_values <- p.adjust(pvalues, method = "fdr")
    output <- data.frame(geneids, genesymbols, logfc, -log10(pvalues), -log10(adjust_p_values))
    names(output)[1] <- "gene_name"
    names(output)[2] <- "gene_symbol"
    names(output)[3] <- "fold_change"
    names(output)[4] <- "original_p_value"
    names(output)[5] <- "adjusted_p_value"
})
final_output <- c()
final_output$gene_data <- output
final_output$edgeR_ql_image_name <- ql_image_name
final_output$edgeR_mds_image_name <- mds_image_name
#cat("Time for multiple testing correction: ", multiple_testing_correction_time[3], " seconds\n")

# Output results
toJSON(final_output)

#-----------------------------------#
# Will implement this later
filter_genes_by_group_variance <- function(read_counts, gene_id_symbols, num_variable_genes, cases, controls) {
    # Divide the read counts into two groups
    case_read_counts <- read_counts[, cases]
    control_read_counts <- read_counts[, controls]
}
