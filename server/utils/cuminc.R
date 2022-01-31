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

# data preparation
con <- file("stdin","r")
dat <- stream_in(con, verbose = F)
dat$event <- as.factor(dat$event)
dat$series <- as.factor(dat$series)

# compute cumulative incidence
out <- list()
res <- cuminc(ftime = dat$time, fstatus = dat$event, group = dat$series, cencode = 0)
out[["estimates"]] <- list()
for (series in levels(dat$series)) {
  seriesRes <- as.data.frame(res[[paste(series,1)]])
  low <- seriesRes$est - (1.96 * sqrt(seriesRes$var))
  low[low < 0] <- 0
  up <- seriesRes$est + (1.96 * sqrt(seriesRes$var))
  seriesRes["low"] <- low
  seriesRes["up"] <- up
  out[["estimates"]][[series]] <- seriesRes
}
if ("Tests" %in% names(res)) out[["tests"]] <- as.data.frame(res$Tests)

# output results in json format
cat(toJSON(out, digits = NA, na = "string"), file = "", sep = "")

close(con)
