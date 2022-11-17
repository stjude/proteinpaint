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
  if (length(x$group1values) == 0 || length(x$group2values) == 0) {
    # all samples fall in one group
    # return NA p-value
    return(unbox("NA"))
  }
  
  # perform Wilcox test between groups
  # suppress warnings because a warning message will be
  # generated when sample size is small (<50) and ties
  # are present because an exact p-value cannot be computed
  # it is fine to ignore this message because a p-value will
  # still be computed using a normal approximation
  # NOTE: do not set exact=TRUE because this will use large
  # amounts of memory when sample sizes are large
  wt <- suppressWarnings(wilcox.test(x$group1values, x$group2values))
  
  # return p-value
  return(unbox(wt$p.value))
}

# compute Wilcox p-value for each data entry
pvalues <- lapply(dat, getPvalue)

# output p-values
toJSON(pvalues)
