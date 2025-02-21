# Test syntax: cat ~/sjpp/test.txt | time Rscript corr.R

# Load required packages
suppressWarnings({
    library(jsonlite)
})

# Read JSON input from stdin
con <- file("stdin", "r")
json <- readLines(con, warn=FALSE)
close(con)
input <- fromJSON(json)

ids <- input$terms$id
v1 <- input$terms$v1
v2 <- input$terms$v2

coeffs <- c()
pvalues <- c()
sample_sizes <- c()
for (i in 1:length(v1)) {
    suppressWarnings({
        cor <- cor.test(as.numeric(unlist(v1[i])), as.numeric(unlist(v2[i])), method = input$method)
    })
    coeffs <- c(coeffs, cor$estimate)
    pvalues <- c(pvalues, cor$p.value)
    sample_sizes <- c(sample_sizes, length(as.numeric(unlist(v1[i]))))
}

# Adjusting for multiple testing correction
adjust_p_values <- p.adjust(pvalues, method = "fdr")
output <- data.frame(ids, coeffs, pvalues, adjust_p_values, sample_sizes)
names(output)[1] <- "id"
names(output)[2] <- "correlation"
names(output)[3] <- "original_p_value"
names(output)[4] <- "adjusted_p_value"
names(output)[5] <- "sample_size"

# Output results
cat(paste0("output_string:",toJSON(output)))
