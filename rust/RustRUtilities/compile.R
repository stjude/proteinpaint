# Syntax: Rscript compile.R

library(rextendr)
library(gtools)
rextendr::document() # Compiles Rust code
#devtools::load_all(".") # Loads rust code as an R package

time0 <- Sys.time()
suppressWarnings({
  suppressPackageStartupMessages(library(edgeR))
  #suppressPackageStartupMessages(library("BiocParallel"))
  #suppressPackageStartupMessages(library(glmGamPoi))
})
library(doParallel)
library(parallel)
library(foreach)
devtools::load_all(".") # Loads rust code as an R package

print ("Adding numbers 3 and 4 in rust")
add(3,4)

print ("Printing 'Hello world!' in rust")
hello_world()
