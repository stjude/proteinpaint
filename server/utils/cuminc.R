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

# data preparation
con <- file("stdin","r")
dat <- stream_in(con, verbose = F)
dat$event <- as.factor(dat$event)
dat$series <- as.factor(dat$series)

# compute cumulative incidence
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
  pairs <- combn(levels(dat$series), 2, simplify = F)
  pvals <- vector(mode = "numeric")
  for (i in 1:length(pairs)) {
    pair <- pairs[[i]]
    res <- cuminc(ftime = dat$time, fstatus = dat$event, group = dat$series, cencode = 0, subset = dat$series %in% pair)
    # retrieve estimates for each series within the pair
    for (series in pair) {
      if (series %in% names(out$estimates)) next
      seriesRes <- as.data.frame(res[[paste(series,1)]])
      seriesRes <- compute_ci(seriesRes)
      out$estimates[[series]] <- seriesRes
    }
    # retrieve p-value of the pair
    pvals <- c(pvals, res$Tests[1,"pv"])
  }
  # store tests
  tests <- data.frame("seriesIds" = 1:length(pairs), "pval" = pvals)
  tests$seriesIds <- pairs # create a list column here (not in the data.frame call)
  out[["tests"]] <- tests
}

# output results in json format
cat(toJSON(out, digits = NA, na = "string"), file = "", sep = "")

close(con)
