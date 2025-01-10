
# Usage: echo <in_json> | Rscript edge.R > <out_json>

#   in_json: [string] input data in JSON format. Streamed through stdin.
#   out_json: [string] clustering results in JSON format. Streamed to stdout.

# Load necessary libraries
library(jsonlite)
library(rhdf5)
library(stringr)
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

# Create DGEList object
y <- DGEList(counts = as.matrix(read_counts), group = conditions, genes = gene_id_symbols)

# Filter lowly expressed genes
# keep <- filterByExpr(y, min.count = input$min_count, min.total.count = input$min_total_count)
keep <- filterByExpr(y)
y <- y[keep, keep.lib.sizes = FALSE]

# Normalize data
y <- calcNormFactors(y, method = "TMM")

# Differential expression analysis
if (length(input$conf1) == 0) {
    # No adjustment for confounding factors
    suppressWarnings({
        suppressMessages({
            dge <- estimateDisp(y = y)
        })
    })
    et <- exactTest(object = dge)
} else {
    # Adjust for confounding factors
    y$samples$conditions <- conditions
    y$samples$conf1 <- input$conf1
    design <- model.matrix(~ conf1 + conditions, data = y$samples)
    y <- estimateDisp(y, design)
    fit <- glmFit(y, design)
    et <- glmLRT(fit, coef = 2)
}

# Extract results
logfc <- et$table$logFC
logcpm <- et$table$logCPM
pvalues <- et$table$PValue
genes_matrix <- str_split_fixed(unlist(et$genes), "\t", 2)
geneids <- unlist(genes_matrix[, 1])
genesymbols <- unlist(genes_matrix[, 2])
adjust_p_values <- p.adjust(pvalues, method = "fdr")

# Prepare output data frame
output <- data.frame(geneids, genesymbols, logfc, -log10(pvalues), -log10(adjust_p_values))
names(output)[1] <- "gene_name"
names(output)[2] <- "gene_symbol"
names(output)[3] <- "fold_change"
names(output)[4] <- "original_p_value"
names(output)[5] <- "adjusted_p_value"

# Output results as JSON
cat(paste0("adjusted_p_values:", toJSON(output)))