# Usage:
# time Rscript hclust.R in.json

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



suppressPackageStartupMessages(library(dendextend))
library(jsonlite)
#library(flashClust)
library(dendextend)
library(reshape)
#library(ggplot2) # Uncomment this line to plot heatmap in R 

# Distance matrix
args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("Usage: Rscript test.R in.json > results")
infile <- args[1]
input <- fromJSON(infile)

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

# For columns (i.e samples)
RowDist <- dist(input$matrix, method = "euclidean") # Transposing the matrix


# Hierarchical clustering
RowDend <- hclust(RowDist, method = tolower(input$cluster_method))
#RowDend <- flashClust(RowDist, method = tolower(input$cluster_method))
RowDendro <- as.dendrogram(RowDend)

row_node_coordinates <- get_nodes_xy(
  RowDendro,
  type = "rectangle"
)

row_node_df <- as.data.frame(row_node_coordinates)
colnames(row_node_df) <- c("x","y")

# For columns (i.e samples)
ColumnDist <- dist(t(input$matrix), method = "euclidean") # Transposing the matrix

# Hierarchical clustering

ColumnDend <- hclust(ColumnDist, method = tolower(input$cluster_method))
#ColumnDend <- flashClust(ColumnDist,method = tolower(input$cluster_method))
ColumnDendro <- as.dendrogram(ColumnDend)
#plot (ColumnDendro)

#print ("ColumnCoordinates")
col_node_coordinates <- get_nodes_xy(
  ColumnDendro,
  type = "rectangle"
)

col_node_df <- as.data.frame(col_node_coordinates)
colnames(col_node_df) <- c("x","y")

# Sorting the matrix

#SortedMatrix  <- normalized_matrix[RowDend$order, ColumnDend$order]
SortedRowNames <- input$row_names[RowDend$order]
SortedColumnNames <- input$col_names[ColumnDend$order]

#m <- matrix(SortedMatrix,length(SortedRowNames),length(SortedColumnNames))
#colnames(m) <- SortedColumnNames
#rownames(m) <- SortedRowNames

output_df <- list()
output_df$method <- input$cluster_method
output_df$RowNodeJson <- row_node_df
output_df$ColNodeJson <- col_node_df

row_dend_order_df <- as.data.frame(RowDend$order)
colnames(row_dend_order_df) <- c("ind")
output_df$RowDendOrder <- row_dend_order_df

col_dend_order_df <- as.data.frame(ColumnDend$order)
colnames(col_dend_order_df) <- c("ind")
output_df$ColumnDendOrder <- col_dend_order_df

sorted_row_names_df <- as.data.frame(SortedRowNames)
colnames(sorted_row_names_df) <- c("gene")
output_df$SortedRowNames <- sorted_row_names_df

sorted_col_names_df <- as.data.frame(SortedColumnNames)
colnames(sorted_col_names_df) <- c("sample")
output_df$SortedColumnNames <- sorted_col_names_df
toJSON(output_df)


# Visualization of heatmap, uncomment code below to get ggplot2 image of heatmap

#SortedMatrix  <- input$matrix[RowDend$order, ColumnDend$order]
#SortedRowNames <- rownames(input$matrix)[RowDend$order]
#SortedColumnNames <- colnames(input$matrix)[ColumnDend$order]
#
#matrix_melt <- melt(SortedMatrix)
#ggplot(data = matrix_melt, aes(x = X1, y = X2, fill = value)) +
#  geom_tile() + scale_fill_gradient(low="blue", high="red")

#ggsave("heatmap.png")

