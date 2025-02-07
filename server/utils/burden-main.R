rm(list=ls())

suppressPackageStartupMessages({
  library(dplyr)  ### Qi changed to load plyr first, due to R message: If you need functions from both plyr and dplyr, please load plyr first, then dplyr:
  library(survival)
  library(jsonlite)
  library(parallel)
  library(doParallel)
})

options(warn=-1)

# stream in json input data
con <- file("stdin", "r")
json <- readLines(con)
close(con)
input <- fromJSON(json)
# handle input arguments
args <- commandArgs(trailingOnly = T)
if (length(args) != 0) stop("Usage: echo <in_json> | Rscript burden.R > <out_json>")

# register the parallel backend (used by foreach() for parallelization)
availCores <- detectCores()
if (is.na(availCores)) stop("cannot detect number of available cores")
registerDoParallel(cores = availCores - 1) # use all available cores except one

chc_nums <- c(1:32)[-c(2,5,14,20,23,26)] # CHCs. 6 out of 32 CHCs not used.

#####################
# Functions for our method
# Ref: https://stats.stackexchange.com/questions/46532/cox-baseline-hazard
#####################
# setwd("R:/Biostatistics/Biostatistics2/Qi/QiCommon/St Jude/Nature Review/CHCs/App/Rdata")

# import get_burden() function
source(file.path(input$binpath, "utils/getBurden.R"))

# compute main burden estimate
# parallelize across CHCs
f <- input$datafiles
fitsData <- file.path(f$dir, f$files$fit)
survData <- file.path(f$dir, f$files$surv)
sampleData <- file.path(f$dir, f$files$sample) # dataframe with all the X's needed, and X's are updated by input values
person_burden <- get_burden(fitsData, survData, sampleData, TRUE)

toJSON(person_burden, digits = NA, na = "string")
