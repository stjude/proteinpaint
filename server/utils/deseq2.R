# Test syntax: cat ~/sjpp/test.txt | time Rscript deseq2.R

# Load required packages
suppressWarnings({
    library(jsonlite)
    library(rhdf5)
    library(stringr)
    library(readr)
    suppressPackageStartupMessages(library(DESeq2))
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
cat("Time to read JSON: ", as.difftime(read_json_time, units = "secs")[3], " seconds\n")
cat("Number of samples in case data:",length(cases),"\n")
cat("Number of samples in control data:",length(controls),"\n")

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
cat("Time to read counts data: ", as.difftime(read_counts_time, units = "secs")[3], " seconds\n")

# Create conditions vector
conditions <- c(rep("Diseased", length(cases)), rep("Control", length(controls)))
gene_id_symbols <- paste0(geneIDs, "\t", geneSymbols)

if (length(input$conf1) == 0) { # No adjustment of confounding factors
      # Create a DESeq2 dataset object
      dds_time <- system.time({
         dds_time <- system.time({
              dds <- DESeqDataSetFromMatrix(countData = read_counts, design = ~ conditions)
         })
      })
      cat("Time for making DESeq2 dataset: ", as.difftime(dds_time, units = "secs")[3], " seconds\n")
} else {
    # Check the type of confounding variable
    if (input$conf1_mode == "continuous") { # If this is float, the input conf1 vector should be converted into a numeric vector
      conf1 <- as.numeric(input$conf1)
    } else { # When input$conf1_mode == "discrete" keep the vector as string.
      conf1 <- as.factor(input$conf1)
    }

    if (length(input$conf2) == 0) { # No adjustment of confounding factor 2
        dds_time <- system.time({
          colData <- data.frame(conditions = conditions, conf1 = conf1)
          # Create a DESeq2 dataset object
          dds <- DESeqDataSetFromMatrix(countData = read_counts, colData = colData, design = ~ conf1 + conditions)
        }) # Need detailed discussions on the design matrix for DESeq2. The "?DESeqDataSetFromMatrix" documentation states the conditions variable needs to be at the end (as per my interpretation)
        cat("Time for making DESeq2 dataset: ", as.difftime(dds_time, units = "secs")[3], " seconds\n")
    } else {
          # Check the type of confounding variable 2
          if (input$conf2_mode == "continuous") { # If this is float, the input conf2 vector should be converted into a numeric vector
            conf2 <- as.numeric(input$conf2)
          } else { # When input$conf2_mode == "discrete" keep the vector as string.
            conf2 <- as.factor(input$conf2)
          }

          dds_time <- system.time({
               colData <- data.frame(conditions = conditions, conf1 = conf1, conf2 = conf2)
               # Create a DESeq2 dataset object
               dds <- DESeqDataSetFromMatrix(countData = read_counts, colData = colData, design = ~ conf1 + conf2 + conditions) # Need detailed discussions on the design matrix for DESeq2. The "?DESeqDataSetFromMatrix" documentation states the conditions variable needs to be at the end (as per my interpretation)
          })
          cat("Time for making DESeq2 dataset: ", as.difftime(dds_time, units = "secs")[3], " seconds\n")
    }
}

filter_time <- system.time({
   # Filter out lowly expressed genes
   keep <- rowSums(counts(dds) >= 10) >= 15
   dds <- dds[keep, ]
})
cat("Filter time: ", as.difftime(filter_time, units = "secs")[3], " seconds\n")

normalize_time <- system.time({
   # Normalize the data
   dds <- estimateSizeFactors(dds)
})
cat("Normalization time: ", as.difftime(normalize_time, units = "secs")[3], " seconds\n")

de_time <- system.time({
   # Perform differential expression analysis
   dds <- DESeq(dds, parallel = TRUE)
})
cat("Differential gene expression time: ", as.difftime(de_time, units = "secs")[3], " seconds\n")

# Multiple testing correction
multiple_testing_correction_time <- system.time({
# Adjust p-values for multiple testing using FDR
res$FDR <- p.adjust(res$pvalue, method = "fdr")

# Sort results by FDR in ascending order
res <- res[order(res$FDR), ]

# Output results based on FDR threshold
fdrThres <- 0.05
significantResults <- res[res$FDR < fdrThres, ]
})
cat("Time for multiple testing correction: ", as.difftime(multiple_testing_correction_time, units = "secs")[3], " seconds\n")
