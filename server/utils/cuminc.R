#################################
# Cumulative incidence analysis #
#################################

#########
# Usage #
#########

# Usage: Rscript cuminc.R in.json > results

# Input data is in JSON format and is read in from <in.json> file.
# Cuminc results are written in JSON format to stdout.

# Input JSON specifications:
# [
#   {
#     time: time to event
#     event: event code (0 = censored, 1 = event)
#     series: series ID
#   }
# ]
#
# Output JSON specifications:
# {
#   "estimates": {
#     <series>: [
#       {
#         "time": time when estimate is computed
#         "est": estimated cumulative incidence value
#         "var": variance of cumulative incidence value
#         "low": 95% confidence interval - lower bound
#         "up": 95% confidence intervals - upper bound
#       }
#     ]
#   },
#   "tests": [
#     {
#       "series1": first series of test,
#       "series2": second series of test,
#       "pvalue": p-value of test
#     }
#   ]
# }


########
# Code #
########

library(jsonlite)
suppressPackageStartupMessages(library(cmprsk))

# function to compute 95% confidence intervals
compute_ci <- function(res) {
  low <- res$est - (1.96 * sqrt(res$var))
  low[low < 0] <- 0
  up <- res$est + (1.96 * sqrt(res$var))
  res["low"] <- low
  res["up"] <- up
  return(res)
}

# read in data
args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("Usage: Rscript cuminc.R in.json > results")
infile <- args[1]
dat <- fromJSON(infile)

# compute cumulative incidence
dat$event <- as.factor(dat$event)
dat$series <- as.factor(dat$series)
out <- list()
out[["estimates"]] <- list()
if (length(levels(dat$series)) == 1) {
  # single series
  res <- cuminc(ftime = dat$time, fstatus = dat$event, cencode = 0)
  seriesRes <- as.data.frame(res[[1]])
  seriesRes <- compute_ci(seriesRes)
  out$estimates[[levels(dat$series)[1]]] <- seriesRes
} else {
  # multiple series
  # compute cumulative incidence for each pairwise combination of series
  pairs <- combn(levels(dat$series), 2)
  pvalues <- vector(mode = "numeric")
  series1s <- vector(mode = "character")
  series2s <- vector(mode = "character")
  for (i in 1:ncol(pairs)) {
    pair <- pairs[,i]
    series1s <- c(series1s, pair[1])
    series2s <- c(series2s, pair[2])
    res <- cuminc(ftime = dat$time, fstatus = dat$event, group = dat$series, cencode = 0, subset = dat$series %in% pair)
    # retrieve estimates for each series within the pair
    for (series in pair) {
      if (series %in% names(out$estimates)) next
      seriesRes <- as.data.frame(res[[paste(series,1)]])
      seriesRes <- compute_ci(seriesRes)
      out$estimates[[series]] <- seriesRes
    }
    # retrieve p-value of the pair
    pvalues <- c(pvalues, signif(res$Tests[1,"pv"], 2))
  }
  # store tests
  out[["tests"]] <- data.frame("series1" = series1s, "series2" = series2s, "pvalue" = pvalues)
}

# output results in json format
cat(toJSON(out, digits = NA, na = "string"), file = "", sep = "")
