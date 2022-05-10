#################################
# Cumulative incidence analysis #
#################################

#########
# Usage #
#########

# Usage: Rscript cuminc.R in.json > results

# Input data is in JSON format and is read in from <in.json> file.
# Cuminc results are written in JSON format to stdout.

# Input JSON:
# {
#   chartId: [
#     {
#       time: time to event
#       event: event code (0 = censored, 1 = event)
#       series: series ID
#     }
#   ]
# }
#
# Output JSON:
# {
#   chartId: {
#     estimates: {
#       seriesId: [
#         {
#           time: time when estimate is computed
#           est: estimated cumulative incidence value
#           var: variance of cumulative incidence value
#           low: 95% confidence interval - lower bound
#           up: 95% confidence intervals - upper bound
#         }
#       ]
#     },
#     tests: [
#       {
#         series1: first series of test,
#         series2: second series of test,
#         pvalue: p-value of test
#       }
#     ]
#   }
# }


########
# Code #
########

library(jsonlite)
suppressPackageStartupMessages(library(cmprsk))

# function to run cumulative incidence analysis on data from a chart
run_cuminc <- function(chart) {
  chart$event <- as.factor(chart$event)
  chart$series <- as.factor(chart$series)
  estimates <- list()
  if (length(levels(chart$series)) == 1) {
    # single series
    res <- cuminc(ftime = chart$time, fstatus = chart$event, cencode = 0)
    seriesRes <- as.data.frame(res[[1]])
    seriesRes <- compute_ci(seriesRes)
    estimates[[levels(chart$series)]] <- seriesRes
    out <- list("estimates" = estimates)
  } else {
    # multiple series
    # compute cumulative incidence for each pairwise combination of series
    pairs <- combn(levels(chart$series), 2)
    # initialize table for Gray's tests
    tests <- data.frame("series1" = character(length = ncol(pairs)), "series2" = character(length = ncol(pairs)), "pvalue" = double(length = ncol(pairs)), stringsAsFactors = F)
    for (i in 1:ncol(pairs)) {
      pair <- pairs[,i]
      res <- cuminc(ftime = chart$time, fstatus = chart$event, group = chart$series, cencode = 0, subset = chart$series %in% pair)
      # retrieve estimates for each series within the pair
      for (series in pair) {
        if (series %in% names(estimates)) next
        seriesRes <- as.data.frame(res[[paste(series,1)]])
        seriesRes <- compute_ci(seriesRes)
        estimates[[series]] <- seriesRes
      }
      # retrieve p-value of the pair
      pvalue <- signif(res$Tests[1,"pv"], 2)
      if (pvalue == 0) pvalue <- "<1e-16" # see https://stacks.cdc.gov/view/cdc/22757/cdc_22757_DS11.pdf
      tests[i,] <- c(pair, pvalue)
    }
    out <- list("estimates" = estimates, "tests" = tests)
  }
  return(out)
}

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
ci_results <- lapply(dat, run_cuminc)

# output results in json format
toJSON(ci_results, digits = NA, na = "string")
