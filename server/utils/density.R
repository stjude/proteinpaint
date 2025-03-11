library(jsonlite)
library(ggplot2)
# This script reads in a json string from stdin, calculates the density of the data and returns the density as a json string
# The input json string should be a list of numbers
# The output json string will be a dictionary with two keys x and y that are number arrays
# The x array will contain the x values of the density
# The y array will contain the y values of the density
# In order to test it you can try from the command line you can try: echo "[1.2, 2, 3]" | Rscript ./density.R

con <- file("stdin", "r")
json <- readLines(con)
close(con)
data <- fromJSON(json)
den = density(x = data)
x = den$x
y = den$y
result = list(x=x, y=y)#dictionary with two keys x and y that are number arrays
toJSON(result, digits = NA, na = "string") # will  return a json like {x:[...], y: [...]}
