library(jsonlite)

# read in data
args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("input coordinates needed")
infile <- args[1]
data <- fromJSON(infile)
df <- data.frame(x=data[0], y=data[1])
result = lowess(df$x, df$y)
toJSON(result)
