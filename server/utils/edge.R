
# Usage: echo <in_json> | Rscript edge.R > <out_json>

#   in_json: [string] input data in JSON format. Streamed through stdin.
#   out_json: [string] clustering results in JSON format. Streamed to stdout.

# Load necessary libraries
library(jsonlite)
library(rhdf5)
library(stringr)
library(ggplot2)
library(readr)
suppressWarnings({
    suppressPackageStartupMessages(library(edgeR))
    suppressPackageStartupMessages(library(dplyr))
})

# Read input JSON from stdin
con <- file("stdin", "r")
json <- readLines(con, warn=FALSE)
close(con)
input <- fromJSON(json)

# Parse case and control sample IDs
cases <- unlist(strsplit(input$case, ","))
controls <- unlist(strsplit(input$control, ","))
combined <- c("geneID", "geneSymbol", cases, controls)

# Initialize sample lists
case_sample_list <- c()
control_sample_list <- c()

# Check storage type and read data accordingly
if (exists(input$storage_type) == FALSE) {
    if (input$storage_type == "HDF5") {
        # Read data from HDF5 file
        geneIDs <- h5read(input$input_file, "gene_names")
        geneSymbols <- h5read(input$input_file, "gene_symbols")
        samples <- h5read(input$input_file, "samples")

        # Get indices for case and control samples
        samples_indicies <- c()
        for (sample in cases) {
            sample_index <- which(samples == sample)
            if (length(sample_index) == 1) {
                samples_indicies <- c(samples_indicies, sample_index)
                case_sample_list <- c(case_sample_list, sample)
            } else {
                print(paste(sample, "not found"))
                quit(status = 1)
            }
        }

        for (sample in controls) {
            sample_index <- which(samples == sample)
            if (length(sample_index) == 1) {
                samples_indicies <- c(samples_indicies, sample_index)
                control_sample_list <- c(control_sample_list, sample)
            } else {
                print(paste(sample, "not found"))
                quit(status = 1)
            }
        }
        read_counts <- t(h5read(input$input_file, "counts", index = list(samples_indicies, 1:length(geneIDs))))
        colnames(read_counts) <- c(cases,controls)
        rownames(read_counts) <- geneSymbols
    } else if (input$storage_type == "text") {
        # Read data from text file
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
        print("Unknown storage type")
    }
} else {
    # Default to reading data from text file if storage type is not defined
    suppressWarnings({
        suppressMessages({
            read_counts <- read_tsv(input$input_file, col_names = TRUE, col_select = combined)
        })
    })
    geneIDs <- unlist(read_counts[1])
    geneSymbols <- unlist(read_counts[2])
    read_counts <- select(read_counts, -geneID)
    read_counts <- select(read_counts, -geneSymbol)
}

# Define conditions for case and control samples
diseased <- rep("Diseased", length(cases))
control <- rep("Control", length(controls))
conditions <- c(diseased, control)
tabs <- rep("\t", length(geneIDs))
gene_id_symbols <- paste0(geneIDs, tabs, geneSymbols)


# Define file paths from command-line arguments
confounders_file <- "/Users/rpaul1/Documents/test/conf_adj/confounders.tsv" # Change this path to where your resapective confounders.tsv file is located
edgeR_results_file <- "edgeR_results.txt"
edgeR_volcano_file <- "volcano.png"

confounders <- read.delim(file=confounders_file, header = TRUE, check.names = FALSE)

# Remove the suffix '_D1' from the column names of counts
sample_names <- colnames(read_counts)
#colnames(counts) <- sample_names

# Print the number of samples in the counts data and confounders data
cat("Number of samples in counts data:", ncol(read_counts), "\n")
cat("Number of samples in confounders data:", nrow(confounders), "\n")

# Check for mismatches
missing_in_counts <- setdiff(confounders$Sample_name, sample_names)
missing_in_confounders <- setdiff(sample_names, confounders$Sample_name)

if (length(missing_in_counts) > 0) {
  cat("Samples in confounders but not in counts:\n")
  print(missing_in_counts)
}

if (length(missing_in_confounders) > 0) {
  cat("Samples in counts but not in confounders:\n")
  print(missing_in_confounders)
}

# Filter the confounders data to include only the samples that are present in the counts data
confounders <- confounders[confounders$Sample_name %in% sample_names, ]

# Print the number of samples after filtering confounders
cat("Number of samples in confounders data after filtering:", nrow(confounders), "\n")

# Filter the counts data to include only the samples that are present in the confounders data
read_counts <- read_counts[, sample_names %in% confounders$Sample_name]

# Ensure the order of samples in counts matches the order in confounders
confounders <- confounders[match(colnames(read_counts), confounders$Sample_name), ]

# Check if the sample names are now aligned
if (!all(colnames(read_counts) == confounders$Sample_name)) {
  stop("Sample names in counts and confounders data do not match after alignment.")
}

print ("Dim of counts")
print (dim(read_counts))
# Create a DGEList object
dge <- DGEList(counts = read_counts, group = confounders$Condition)

# Filter out lowly expressed genes
keep <- filterByExpr(dge)
dge <- dge[keep, keep.lib.sizes = FALSE]
dge <- calcNormFactors(dge, method = "TMM")
print ("for estimate disp")
print (dge$samples)

# Add sample information to the DGEList object
dge$samples <- data.frame(group = confounders$Condition, cov2 = confounders$Molecular_subtype)
print ("dge$samples")
print (dge$samples)
# Create a design matrix
#design <- model.matrix(~ group + cov2 + cov1, data = dge$samples)
design <- model.matrix(~ cov2 + group, data = dge$samples)

# Estimate dispersion
dge <- estimateDisp(dge, design)

# Fit the model
fit <- glmFit(dge, design)

# Perform likelihood ratio test
lrt <- glmLRT(fit, coef = 2)  # coef = 2 corresponds to the 'treatment' vs 'control' comparison

# Extract the top differentially expressed genes
topTags <- topTags(lrt, n = Inf)

results <- topTags$table

# Adjust p-values for multiple testing using FDR
results$FDR <- p.adjust(results$PValue, method = "fdr")

# Output results based on FDR threshold
fdrThres <- 0.05
significantResults <- results[results$FDR < fdrThres, ]

# Write the updated results to a new file
write.table(results, file = edgeR_results_file, sep = "\t", quote = FALSE, row.names = TRUE, col.names = TRUE)

# Generate volcano plot
results$logP <- -log10(results$PValue)
results$Significant <- results$FDR < fdrThres

volcano_plot <- ggplot(results, aes(x = logFC, y = logP)) +
  geom_point(aes(color = Significant), alpha = 0.5) +
  scale_color_manual(values = c("lightgrey", "red")) +
  theme_minimal() +
  labs(title = "Volcano Plot", x = "Log2 Fold Change", y = "-Log10 P-Value") +
  theme(legend.position = "none")

# Save the plot
ggsave(edgeR_volcano_file, plot = volcano_plot)
