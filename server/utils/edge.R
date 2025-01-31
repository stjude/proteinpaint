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

filter_genes_time <- system.time({
if (length(input$VarGenes) != 0) { # Filter out variable genes for DE analysis
   #VarGenes <- unlist(strsplit(input$VarGenes, ","))
   #VarGenes_indices <- which(geneSymbols %in% VarGenes)
   #read_counts <- read_counts[VarGenes_indices, ]
   #geneSymbols <- geneSymbols[VarGenes_indices]
   #geneIDs <- geneIDs[VarGenes_indices]
   #gene_id_symbols <- gene_id_symbols[VarGenes_indices]

   # Calculate the standard deviation of each row
   row_sd <- apply(read_counts, 1, sd)
   # Add the standard deviation as a new column to the dataframe
   read_counts$Row_SD <- row_sd
   # Add the gene_id_symbols as a new column to the dataframe
   read_counts$gene_id_symbols <- gene_id_symbols
   # Sort the dataframe based on the standard deviation column
   read_counts <- read_counts[order(read_counts$Row_SD, decreasing = TRUE), ]
   # Select top 3000 rows
   read_counts <- head(read_counts,3000) # Currently hardcoded 3000 genes
   # Get gene id symbols corresponding to the reordered read count matrix
   gene_id_symbols <- read_counts$gene_id_symbols
   # Remove column Row_SD from read_counts dataframe
   read_counts <- read_counts[, !names(read_counts) %in% "Row_SD"]
   # Remove column gene_id_symbols from read_counts dataframe
   read_counts <- read_counts[, !names(read_counts) %in% "gene_id_symbols"]
}
})
#cat("Time to filter genes: ", filter_genes_time[3], " seconds\n")

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
    y <- calcNormFactors(y, method = "TMM")
})
#cat("Normalization time: ", normalization_time[3], " seconds\n")

# Differential expression analysis
if (length(input$conf1) == 0) { # No adjustment of confounding factors
    dispersion_time <- system.time({
        suppressWarnings({
            suppressMessages({
                y <- estimateDisp(y)
            })
        })
    })
    #cat("Dispersion time: ", dispersion_time[3], " seconds\n")

    exact_test_time <- system.time({
        et <- exactTest(y)
    })
    #cat("Exact test time: ", exact_test_time[3], " seconds\n")
} else { # Adjusting for confounding factors
    y$samples <- data.frame(conditions = conditions, conf1 = input$conf1)
    model_gen_time <- system.time({
        design <- model.matrix(~ conf1 + conditions, data = y$samples)
    })
    #cat("Time for making design matrix: ", model_gen_time[3], " seconds\n")

    dispersion_time <- system.time({
        y <- estimateDisp(y, design)
    })
    #cat("Dispersion time: ", dispersion_time[3], " seconds\n")

    fit_time <- system.time({
        fit <- glmFit(y, design)
    })
    #cat("Fit time: ", fit_time[3], " seconds\n")

    test_statistics_time <- system.time({
        et <- glmLRT(fit, coef = 2)
    })
    #cat("Test statistics time: ", test_statistics_time[3], " seconds\n")
}

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
#cat("Time for multiple testing correction: ", multiple_testing_correction_time[3], " seconds\n")

# Output results
toJSON(output)
