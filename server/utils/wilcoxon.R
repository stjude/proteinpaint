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
#   id: { # "id" is required for each entry
#     group1values: [] vector of numeric values for the 1st group
#     group2values: [] vector of numeric values for the 2nd group
#   }
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

# compute wilcox p-value for each snp
pvalues <- lapply(dat, function(item) unbox(wilcox.test(item$group1values, item$group2values)$p.value))

# output p-values
toJSON(pvalues)
