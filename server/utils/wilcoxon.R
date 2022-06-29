##########################
# Wilcoxon rank sum test #
##########################

#########
# Usage #
#########

# Usage: Rscript wilcoxon.R in.json > results

# Input data is in JSON format and is read in from <in.json> file.
# Results are written in JSON format to stdout.

# Input JSON specifications:
# {
#   id: {} id of data entry
#     group1values: [] group 1 values
#     group2values: [] group 2 values
# }
#
# Output JSON specifications:
# { id: p-value }


########
# Code #
########

library(jsonlite)

# read in data
args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("one argument required")
infile <- args[1]
dat <- fromJSON(infile)

# function to compute wilcox p-value between two groups of values
getPvalue <- function(x) {
  # break any ties between values
  # this will allow exact p-values to be computed
  if(anyDuplicated(x$group1values)) x$group1values <- jitter(x$group1values)
  if(anyDuplicated(x$group2values)) x$group2values <- jitter(x$group2values)
  # perform wilcox test between groups and compute exact p-value
  wt <- wilcox.test(x$group1values, x$group2values, exact = T)
  # return p-value
  return(unbox(wt$p.value))
}

# compute wilcox p-value for each data entry
pvalues <- lapply(dat, getPvalue)

# output p-values
toJSON(pvalues)
