library(jsonlite)
library(ggplot2)
# This script reads in a json string from stdin, calculates the density of the data and returns the density as a json string
# The input json string is an array of numbers
# The output json string is an object with the following fields {x: [x density values], y: [y density values]}
# In order to test it you can run from the command line: echo "[1.2, 2, 3]" | Rscript ./density.R

con <- file("stdin", "r")
json <- readLines(con)
close(con)
valuesPerPlot <- fromJSON(json)
for(i in 1:length(valuesPerPlot)){
  data = valuesPerPlot[[i]]
}
den = density(x = data)
x = den$x
y = den$y
result = list(x=x, y=y)#This will be read in javascript like a dictionary with two keys x and y that are number arrays
toJSON(result, digits = NA, na = "string") # will  return a json like {x:[...], y: [...]}
