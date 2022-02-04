#################################
# Cumulative incidence analysis #
#################################

#########
# Usage #
#########

# Usage: Rscript cuminc.R < jsonIn > jsonOut

# Parameters:
#   - jsonIn: [json string] input data streamed from standard input. Each element of array is time/event/series data for a given sample.
#
#     [
#       {
#         time: [number] time to event
#         event: [number] event code (0 = censored, 1 = event).
#         series: [string] series ID. If empty string, then "series" in output json will be "1".
#       }
#     ]
#
#   - jsonOut: [json string] cumulative incidence results streamed to standard out.
#
#     {
#       "estimates": {
#         <series>: [
#           {
#             "time": [array] times where estimates are computed
#             "est": [array] estimated cumulative incidence values
#             "var": [array] variances of cumulative incidence values
#             "low": [array] 95% confidence intervals - lower bounds
#             "up": [array] 95% confidence intervals - upper bounds
#           }  
#         ],
#       "tests": [
#          {
#            "stat": [number] test statistic
#            "pv": [number] p-value
#            "df": [number] degrees of freedom
#          }
#        ]
#       }
#     }


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

# discard series with no events
toKeep <- vector(mode = "character")
for (series in unique(dat$series)) {
  if (any(dat[dat$series == series, "event"] == 1)) toKeep <- c(toKeep, series)
}
dat <- dat[dat$series %in% toKeep,]

# compute cumulative incidence
dat$event <- as.factor(dat$event)
dat$series <- as.factor(dat$series)
out <- list(estimates = list())
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
