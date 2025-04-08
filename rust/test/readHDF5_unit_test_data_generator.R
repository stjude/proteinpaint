# Load libraries
library(tidyverse)

# Create a sample genomic data frame
set.seed(123) # Set seed for reproducibility

# Initialize the data frame
genomic_df <- data.frame(
  chr = paste0("chr", sample(1:22, 35, replace = TRUE)),
  start = sample(1:100000000, 35, replace = TRUE),
  stop = numeric(35),
  gene = paste0("Gene", 1:35),
  Sample1 = rnorm(35, mean = 5, sd = 2),
  Sample2 = rnorm(35, mean = 6, sd = 1.5),
  Sample3 = rnorm(35, mean = 4.5, sd = 2.5),
  Sample4 = rnorm(35, mean = 7, sd = 1.8),
  Sample5 = rnorm(35, mean = 5.5, sd = 2.2)
)

# Calculate stop positions (start + random length between 100 and 10000)
genomic_df$stop <- genomic_df$start + sample(100:10000, 35, replace = TRUE)

# Sort by chromosome and start position
genomic_df <- genomic_df[order(genomic_df$chr, genomic_df$start), ]

# Add some known genes
known_genes <- read_tsv("35-random-genes.txt", col_names = FALSE)
colnames(known_genes) <- "gene"
genomic_df$gene <- known_genes$gene

# Print the first few rows
head(genomic_df)

# Write to a file if needed
write.table(genomic_df, "readHDF5_test_data.txt", sep = "\t", quote = FALSE, row.names = FALSE)
