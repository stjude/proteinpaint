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
#   snpid: {
#     hasEffale: [] outcome values for samples with effect allele
#     noEffale: [] outcome values for samples without effect allele
#   }
# }
#
# Output JSON specifications:
# { snpid: p-value }


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
pvalues <- lapply(dat, function(snp) unbox(wilcox.test(snp$hasEffale, snp$noEffale)$p.value))

# output p-values
toJSON(pvalues)