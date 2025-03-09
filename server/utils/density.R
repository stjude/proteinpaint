library(jsonlite)
library(ggplot2)

# read in data
con <- file("stdin", "r")
json <- readLines(con)
close(con)
data <- fromJSON(json)
den = density(x = data)
x = den$x
y = den$y

toJSON(list(x=x, y=y), digits = NA, na = "string") # will  return a json like {x:[...], y: [...]}
