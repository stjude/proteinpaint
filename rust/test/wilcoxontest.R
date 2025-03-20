# This script generates random values for two vectors for testing the rust wilcoxon test. This also generates the R wilcoxon p-value using wilcox.test(). Then the p-values from both implementations are plotted using plot_wilcoxon.R
# Syntax: time Rscript wilcoxontest.R | ../target/release/wilcoxon
library(jsonlite)

generate_data <- function(iter) {
    n1 <- 500 # Generate n1 random numbers from a normal distribution
    n2 <- 500    # Generate n2 random numbers from a uniform distribution
    group1_values <- rnorm(n1)
    group2_values <- runif(n2)
    pvalue <- wilcox.test(group1_values,group2_values)$p.value
    # Create a list to store the vectors
    my_df <- list(group1_id = paste0("group1_id_iter",iter), group1_values = group1_values, group2_id = paste0("group2_id_iter",iter), group2_values = group2_values, R_pvalue = pvalue)
    #print (my_df)
    return (my_df)
}


num_tests <- 1 # Increase the number to get more cases to be plotted by plot_wilcoxon.R
initial_df <- list()
for (i in 1:num_tests) {
    new_df <- generate_data(i)
    initial_df <- rbind(initial_df, new_df)
}

initial_df <- as.data.frame(initial_df)
final_df <- data.frame()
for (i in 1:nrow(initial_df)) {
    item <- initial_df[i,]
    item$group1_id <- as.character(item$group1_id[1])
    item$group2_id <- as.character(item$group2_id[1])
    item$R_pvalue <- as.numeric(item$R_pvalue[1])
    final_df <- rbind(final_df,item)
}

rownames(final_df) <- NULL
toJSON(final_df)

