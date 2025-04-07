# Usage: echo <in_json> | Rscript hclust.R > <out_json>

#   in_json: [string] input data in JSON format. Streamed through stdin.
#   out_json: [string] clustering results in JSON format. Streamed to stdout.

# Image is in Rplots.pdf

############################
#      !!! NOTE !!!        #
############################
# must not auto-install missing package in any R script!
# declare required packages in dockerfile
# at 2023/12, a problem emerged for pp container running in gdc qa-pink
# since the docker images lacks the packages, but the auto-install was prevented due to container safety (no internet query)
# this script will not run, leading to hard to decipher crashing

# To plot the heatmap uncomment line `library(ggplot2) and lines after "Visualization" comment

suppressWarnings({
  suppressPackageStartupMessages(library(jsonlite))
})
#library(flashClust)
#library(ggplot2) # Uncomment this line to plot heatmap in R

# Distance matrix
con <- file("stdin", "r")
json <- readLines(con)
close(con)
input <- fromJSON(json)

#if (length(input$valueIsTransformed) == 0 || input$valueIsTransformed == FALSE) {
# normalized_matrix <- t(scale(t(input$matrix))) # Applying z-score normalization
#} else { # No normalization
# normalized_matrix <- input$matrix
#}

#rownames(normalized_matrix) <- input$row_names
#colnames(normalized_matrix) <- input$col_names
#normalized_matrix <- na.omit(normalized_matrix) # Removes rows with NA values

#print ("normalized_matrix")
#print (dim(normalized_matrix))

# For Rows (i.e genes)
RowDist <- dist(input$matrix, method = tolower(input$distance_method)) # Transposing the matrix
# Hierarchical clustering
RowDend <- hclust(RowDist, method = input$cluster_method)
#RowDend <- flashClust(RowDist, method = input$cluster_method)
RowDendMergeDf <- as.data.frame(RowDend$merge)
colnames(RowDendMergeDf) <- c("n1","n2")
#print ("merge")
#print (RowDendMergeDf)

#print ("height")
RowDendOrderHeight <- as.data.frame(RowDend$height)
colnames(RowDendOrderHeight) <- "height"
#print (RowDendOrderHeight)

# For columns (i.e samples)
ColumnDist <- dist(t(input$matrix), method = tolower(input$distance_method)) # Transposing the matrix

# Hierarchical clustering

ColumnDend <- hclust(ColumnDist, method = input$cluster_method)
#ColumnDend <- flashClust(ColumnDist,method = input$cluster_method)

ColumnDendMergeDf <- as.data.frame(ColumnDend$merge)
colnames(ColumnDendMergeDf) <- c("n1","n2")
#print ("merge")
#print (ColumnDendMergeDf)

#print ("height")
ColumnDendOrderHeight <- as.data.frame(ColumnDend$height)
colnames(ColumnDendOrderHeight) <- "height"
#print (ColumnDendOrderHeight)

SortedRowNames <- input$row_names[RowDend$order]
SortedColumnNames <- input$col_names[ColumnDend$order]

output_df <- list()
output_df$method <- input$cluster_method
output_df$RowMerge <- RowDendMergeDf
output_df$RowHeight <- RowDendOrderHeight
output_df$ColumnMerge <- ColumnDendMergeDf
output_df$ColumnHeight <- ColumnDendOrderHeight

sorted_row_names_df2 <- as.data.frame(SortedRowNames)
colnames(sorted_row_names_df2) <- c("name")
output_df$RowOrder <- sorted_row_names_df2

sorted_col_names_df2 <- as.data.frame(SortedColumnNames)
colnames(sorted_col_names_df2) <- c("name")
output_df$ColOrder <- sorted_col_names_df2


toJSON(output_df, digits = NA, na = "string") # Setting digits = NA makes toJSON() use the max precision. na='string' causes any "not a number" to be reported as string. This from ?toJSON() documentation


# Visualization of heatmap, uncomment code below to get ggplot2 image of heatmap

#SortedMatrix  <- input$matrix[RowDend$order, ColumnDend$order]
#SortedRowNames <- rownames(input$matrix)[RowDend$order]
#SortedColumnNames <- colnames(input$matrix)[ColumnDend$order]
#
#matrix_melt <- melt(SortedMatrix)
#ggplot(data = matrix_melt, aes(x = X1, y = X2, fill = value)) +
#  geom_tile() + scale_fill_gradient(low="blue", high="red")

#ggsave("heatmap.png")

