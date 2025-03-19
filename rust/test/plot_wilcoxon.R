# Plots JSON output both from R (wilcoxontest.R) and wilcoxon.rs
# step 1: time Rscript wilcoxontest.R > r_wilcoxon.txt
# step 2: cat r_wilcoxon.txt | rust/target/release/wilcoxon > rust_wilcoxon.txt
# step 3: Rscript plot_wilcoxon.R
library(jsonlite)

# Read lines from the R json file
r_lines <- readLines("r_wilcoxon.txt")
r_results <- (fromJSON(r_lines))
r_pvalues <- as.numeric(r_results$R_pvalue)
#print (r_pvalues)

# Read lines from the Rust json file
rust_lines <- readLines("rust_wilcoxon.txt")
rust_results <- (fromJSON(rust_lines))
rust_pvalues <- as.numeric(rust_results$pvalue)
#print (rust_pvalues)

# Calculate pearson correlation coefficient
correlation_coeff <- cor(r_pvalues, rust_pvalues, method = "pearson")
print(paste0("pearson correlation coefficient:",correlation_coeff))

# Create a scatter plot
png("wilcoxon.png")
plot(r_pvalues, rust_pvalues,
     main = "Wilcoxon scatter Plot",        # Title of the plot
     xlab = "R pvalues",        # Label for the x-axis
     ylab = "Rust pvalues",        # Label for the y-axis
     pch = 19,                     # Point type (19 is a solid circle)
     col = "blue")                 # Color of the points
dev.off()
