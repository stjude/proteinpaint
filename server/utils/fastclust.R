# Usage:
# time Rscript fastclust.R in.json

# Image is in Rplots.pdf

# Checking if all R packages are installed or not, if not installing each one of them

ggplot2_path <- system.file(package='ggplot2')
if (nchar(ggplot2_path) == 0) {
  install.packages("ggplot2", repos='https://cran.case.edu/')
}

jsonlite_path <- system.file(package='jsonlite')
if (nchar(jsonlite_path) == 0) {
  install.packages("jsonlite", repos='https://cran.case.edu/')
}

dendextend_path <- system.file(package='dendextend')
if (nchar(dendextend_path) == 0) {
  install.packages("dendextend", repos='https://cran.case.edu/')
}

reshape_path <- system.file(package='reshape')
if (nchar(reshape_path) == 0) {
  install.packages("reshape", repos='https://cran.case.edu/')
}

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

# For columns (i.e samples)
RowDist <- dist(input$matrix, method = "euclidean") # Transposing the matrix

# Hierarchical clustering
print (input$cluster_method)
RowDend <- hclust(RowDist, method = tolower(input$cluster_method))
#RowDend <- flashClust(RowDist, method = tolower(input$cluster_method))
print (RowDend$order)
print ("Merge")
print (RowDend$merge)
print ("Height")
print (RowDend$height)
print ("Labels")
print (RowDend$labels)
print ("Calls")
print (RowDend$call)
print ("Attributes")
attributes(RowDend)
print ("methods")
#methods(class=class(RowDend))
RowDendro <- as.dendrogram(RowDend)
#print ("Attributes as.dendrogram")
#attributes(RowDendro)
plot(RowDendro)

xy <- get_nodes_xy(
  RowDendro,
  type = "rectangle"
)
print ("node coordinates")
#print (xy)

for (i in 1:(nrow(xy) - 1)) {
  arrows(xy[i, 1], xy[i, 2],
    angle = 17,
    length = .5,
    xy[i + 1, 1], xy[i + 1, 2],
    lty = 1, col = 3, lwd = 1.5
  )
}
points(xy, pch = 19, cex = 4)
text(xy, labels = 1:nnodes(RowDendro), cex = 1.2, col = "white", adj = c(0.4, 0.4))


get_leaves_branches_attr(RowDendro, "lty")

#RowDendro %>% unclass %>% str

# For columns (i.e samples)
ColumnDist <- dist(t(input$matrix), method = "euclidean") # Transposing the matrix

# Hierarchical clustering

ColumnDend <- hclust(ColumnDist, method = tolower(input$cluster_method))
#ColumnDend <- flashClust(ColumnDist,method = tolower(input$cluster_method))
ColumnDendro <- as.dendrogram(ColumnDend)
plot (ColumnDendro)

# Sorting the matrix

SortedMatrix  <- input$matrix[RowDend$order, ColumnDend$order]
SortedRowNames <- input$row_names[RowDend$order]
SortedColumnNames <- input$col_names[ColumnDend$order]

m <- matrix(SortedMatrix,length(SortedRowNames),length(SortedColumnNames))
colnames(m) <- SortedColumnNames
rownames(m) <- SortedRowNames

df  <- melt(m)
colnames(df) <- c("Genes", "Samples", "value")

ggplot(df, aes(x = Genes, y = Samples, fill = value)) +
    geom_tile() + scale_fill_gradient(low="blue", high="red")

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
