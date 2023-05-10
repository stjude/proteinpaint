library(jsonlite)

# read in data
args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("input coordinates needed")
infile <- args[1]
data <- fromJSON(infile)
result = lowess(data$X, data$Y)
toJSON(result)
