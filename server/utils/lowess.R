library(jsonlite)

# read in data
con <- file("stdin", "r")
json <- readLines(con)
close(con)
data <- fromJSON(json)
result = lowess(data$X, data$Y)
toJSON(result)
