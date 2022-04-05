#################################
# Cumulative incidence analysis #
#################################

#########
# Usage #
#########

# Usage: Rscript cuminc.R < jsonIn > jsonOut

# Input data is streamed as JSON from standard input and cumulative incidence results are streamed as JSON to standard output.

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
#   ],
#   "skippedSeries": [] series skipped due to absence of events
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
con <- file("stdin","r")
dat <- stream_in(con, verbose = F)

# discard any series that have no events
# keep track of which series are discarded
toKeep <- vector(mode = "character")
toSkip <- vector(mode = "character")
for (series in unique(dat$series)) {
  if (1 %in% dat[dat$series == series, "event"]) {
    toKeep <- c(toKeep, series)
  } else {
    toSkip <- c(toSkip, series)
  }
}
dat <- dat[dat$series %in% toKeep,]

out <- list()
if (length(toSkip) > 0) out[["skippedSeries"]] <- toSkip
if (nrow(dat) == 0) {
  # if all series are skipped, then
  # output the set of skipped series and
  # quit the R session
  cat(toJSON(out, digits = NA, na = "string"), file = "", sep = "")
  close(con)
  quit(save = "no")
}

# compute cumulative incidence
dat$event <- as.factor(dat$event)
dat$series <- as.factor(dat$series)
out[["estimates"]] <- list()
if (length(levels(dat$series)) == 1) {
  # single series
  res <- cuminc(ftime = dat$time, fstatus = dat$event, cencode = 0)
  seriesRes <- as.data.frame(res[[1]])
  seriesRes <- compute_ci(seriesRes)
  out$estimates[[""]] <- seriesRes
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

close(con)
