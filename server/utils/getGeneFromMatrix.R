library(jsonlite)
library(Matrix)

args <- commandArgs(trailingOnly = TRUE)
if (length(args) == 0) {
  stop("No arguments provided.")
}

# str
file_path <- args[1]
# str
gene_name <- args[2]

data <- tryCatch({
  readRDS(file_path)
}, error = function(e) {
  # Show error if file is not found or cannot be read 
  # (i.e. not an RDS file)
  stop(paste("Error reading RDS file:", e$message))
})

# Show error if gene not found
if (!(gene_name %in% rownames(data))) {
  stop(paste("Gene", gene_name, "not found in the matrix."))
}

# Extract the gene data and filter out zero values
gene_data <- data[gene_name, ]
non_zero_indices <- gene_data != 0
filtered_samples <- colnames(data)[non_zero_indices]
filtered_values <- as.numeric(gene_data[non_zero_indices])

# Create a JSON object with the samples as the keys and the
# values as the values, e.g. {"sample1": 1, "sample2": 2, ...n }
result <- setNames(as.list(filtered_values), filtered_samples)
toJSON(result, pretty = TRUE, auto_unbox = TRUE)