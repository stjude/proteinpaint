################################
# Cumulative incidence analysis
################################

###########
# Usage
###########

# Usage: Rscript cuminc.R < jsonIn > jsonOut

# Parameters:
#   - jsonIn: [json string] input data streamed from standard input. The json string should not contain any newline characters, because newline characters are treated as separators of json records (trailing newline characters are ok).
#     
#     JSON input specifications:
#     {
#       "times": [array] times to events
#       "events": [array] event codes (e.g. 0, 1). An event code of 0 indicates  a censored event. An event code of 1 indicates an event of interest.
#     }
#
#   - jsonOut: [json string] cumulative incidence results streamed to standard out.
#
#     JSON output specifications:
#     {
#       "time": [array] times where estimates are computed
#       "est": [array] estimated cumulative incidence values
#       "var": [array] variances of cumulative incidence values
#       "low": [array] 95% confidence intervals - lower bounds
#       "up": [array] 95% confidence intervals - upper bounds
#     }


###########
# Code
###########

library(jsonlite)
suppressPackageStartupMessages(library(cmprsk))

# data preparation
con <- file("stdin","r")
lst <- stream_in(con, verbose = F, simplifyVector = T, simplifyDataFrame = F, simplifyMatrix = F)
if (length(lst) != 1) stop("input json must have only 1 record")
lst <- lst[[1]]
lst$events <- as.factor(lst$events)

# compute cumulative incidence
res <- cuminc(ftime = lst$times, fstatus = lst$events, cencode = 0)

# extract cumulative incidence of event of interest
out <- res[[1]]

# 95% confidence intervals
low <- out$est - (1.96 * sqrt(out$var))
low[low < 0] <- 0
up <- out$est + (1.96 * sqrt(out$var))
out[["low"]] <- low
out[["up"]] <- up

# output results in json format
cat(toJSON(out, digits = NA, na = "string"), file = "", sep = "")

close(con)
