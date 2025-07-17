library(Matrix)

df <- read.delim("sample1.104.geneCounts.txt", header = TRUE)
gene_symbol <- df$geneSymbol
samples <- colnames(df)
samples <- samples[-c(1:4)]
print (gene_symbol)
print (samples)
df <- df[, -c(1:4)] # Remove first 4 columns from R data frame

# Convert the data frame to a dgCMatrix
dgC_matrix <- as(as.matrix(df), "dgCMatrix")
rownames(dgC_matrix) <- gene_symbol
colnames(dgC_matrix) <- samples
# Check the result
print("dgCMatrix:")
print(dgC_matrix)
saveRDS(dgC_matrix, file = "termdb_scrna.rds")
