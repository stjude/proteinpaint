library(jsonlite)
library(ggplot2)
# This script reads in a json string from stdin, calculates the densities of each plot and returns the densities as a json string
# The input json string is a dictionary where each field maps to an array of numbers
# The output json string is a dictionary  with the density for each plot. The density is represented like {x: [x density values], y: [y density values]}
# In order to test it you can run this from the command line replacing the arrays with your own: 
# echo "{plotA: [1.2, 2, 3], plotB: [4.5, 5, 6]}" | Rscript ./density.R

con <- file("stdin", "r")
json <- readLines(con)
close(con)
data <- fromJSON(json)
densities <- list()
for(plot in names(data)){
    values = data[[plot]]
    if(length(values) <= 5){
        y = rep(0, length(values))
        densities[[plot]] <- list(x=values, y=y)
        next
    }
    den = density(x = values)
    x = den$x
    y = den$y
    result = list(x=x, y=y) #This is an object  with two keys x and y that are number arrays
    densities[[plot]] <- result
}
toJSON(densities, digits = NA, na = "string") # will  return a json like { plotA: {x:[...], y: [...]}}


