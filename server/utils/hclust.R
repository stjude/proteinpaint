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

#ggplot2_path <- system.file(package='ggplot2')
#if (nchar(ggplot2_path) == 0) {
#  install.packages("ggplot2", repos='https://cran.case.edu/')
#}
#
#jsonlite_path <- system.file(package='jsonlite')
#if (nchar(jsonlite_path) == 0) {
#  install.packages("jsonlite", repos='https://cran.case.edu/')
#}
#
#dendextend_path <- system.file(package='dendextend')
#if (nchar(dendextend_path) == 0) {
#  install.packages("dendextend", repos='https://cran.case.edu/')
#}
#
#reshape_path <- system.file(package='reshape')
#if (nchar(reshape_path) == 0) {
#  install.packages("reshape", repos='https://cran.case.edu/')
#}

#flashClust_path <- system.file(package='flashClust')
#if (nchar(flashClust_path) == 0) {
#  install.packages("flashClust", repos='https://cran.case.edu/')
#}

suppressPackageStartupMessages(library(dendextend))
library(jsonlite)
#library(flashClust)
library(dendextend)
library(reshape)
library(ggplot2)

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
#print (RowDend$order)
#print ("Merge")
#print (RowDend$merge)
#print ("Height")
#print (RowDend$height)
#print ("Labels")
#print (RowDend$labels)
#print ("Calls")
#print (RowDend$call)
#print ("Attributes")
#attributes(RowDend)
#print ("methods")
#methods(class=class(RowDend))
RowDendro <- as.dendrogram(RowDend)
#print ("Attributes as.dendrogram")
#attributes(RowDendro)
#plot(RowDendro)

row_node_coordinates <- get_nodes_xy(
  RowDendro,
  type = "rectangle"
)

row_node_df <- as.data.frame(row_node_coordinates)
colnames(row_node_df) <- c("x","y")

#row_node_transform <- apply(row_node_coordinates, 1, function(row){
#    lapply(c(1,2), function(col_index){
#        if (col_index == 1) {
#          list(x=row[col_index])
#        } else if (col_index == 2) {
#          list(y=row[col_index])
#        }
#    })
#})

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
#output_df$RowDendOrder <- {lapply(1:length(RowDend$order), function(y){
#    list(i=RowDend$order[y])
#})}
row_dend_order_df <- as.data.frame(RowDend$order)
colnames(row_dend_order_df) <- c("ind")
output_df$RowDendOrder <- row_dend_order_df

col_dend_order_df <- as.data.frame(ColumnDend$order)
colnames(col_dend_order_df) <- c("ind")
output_df$ColumnDendOrder <- col_dend_order_df

#output_df$SortedRowNames <- {lapply(1:length(SortedRowNames), function(y){
#    list(gene=SortedRowNames[y])
#})}

sorted_row_names_df <- as.data.frame(SortedRowNames)
colnames(sorted_row_names_df) <- c("gene")
output_df$SortedRowNames <- sorted_row_names_df

sorted_col_names_df <- as.data.frame(SortedColumnNames)
colnames(sorted_col_names_df) <- c("sample")
output_df$SortedColumnNames <- sorted_col_names_df

# Converting to data frame does not work for the raw counts since the key of the json needs to be unique.

#output_matrix_df <- as.data.frame(normalized_matrix)
#colnames(output_matrix_df) <- c(rep("elem",dim(normalized_matrix)[2]))
#print (output_matrix_df)
#output_df$OutputMatrix <- output_matrix_df

toJSON(output_df)

#cat("rowindexes",RowDend$order,"\n",sep="\t") # Prints out row indices
#cat("colindexes",ColumnDend$order,"\n",sep="\t") # Prints out column indicies
#cat("rownames",SortedRowNames,"\n",sep="\t") # Prints out row names
#cat("colnames",SortedColumnNames,"\n",sep="\t") # Prints out column names
#cat ("OutputMatrix",normalized_matrix,"\n",sep="\t") # This outputs the 2D array in 1D column-wise. This is later converted to 2D array in nodejs.


#df  <- melt(m)
#colnames(df) <- c("Genes", "Samples", "value")

#ggplot(df, aes(x = Genes, y = Samples, fill = value)) + geom_tile() + scale_fill_gradient(low="blue", high="red") + theme(axis.text.x = element_text(angle = 90, vjust = 0.5, hjust=1))

#ggsave("heatmap.png")


##print (SortedMatrix)
#df  <- as.data.frame(SortedMatrix)
#rownames(df)  <- SortedRowNames
#colnames(df)  <- SortedColumnNames
#print ("DataFrame")
#print (df)
##plt <- ggplot(as.data.frame(SortedMatrix), aes(SortedColumnNames,SortedRowNames)) + geom_tile() + theme_minimal()
#plt <- ggplot(df,aes(x=colname,y=rownames(df))) + geom_tile() + theme_minimal()
#
## setting gradient color as red and white
#plt <- plt + scale_fill_gradient(low="blue", high="red")
#
## setting the title and subtitles using
## title and subtitle
#plt <- plt + labs(title = "Heatmap")
#plt <- plt + labs(subtitle = "A simple heatmap using geom_tile()")
#
## setting x and y labels using labs
#plt <- plt + labs(x ="Samples", y ="Genes")
#
## plotting the Heatmap
#plt
#png("heatmap.png")
#dev.off()
