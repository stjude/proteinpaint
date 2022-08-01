#####################
# Survival analysis #
#####################

#########
# Usage #
#########

# Usage: Rscript survival.R in.json > results

# Input data is in JSON format and is read in from <in.json> file.
# Survival results are written in JSON format to stdout.

# Input JSON:
# [
#   {
#     time: time to event
#     status: event code (0 = censored, 1 = dead)
#     series: series ID
#   }
# ]
#
# Output JSON:
# {
#   estimates: [{ series, time, surv, lower, upper, nevent, ncensor, nrisk }],
#   tests: [{ series1, series2, pvalue }]
# }


########
# Code #
########

library(jsonlite)
library(survival)

# read in data
args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("one argument needed")
infile <- args[1]
dat <- fromJSON(infile)

# perform survival analysis
dat$series <- as.factor(dat$series)
if (length(levels(dat$series)) == 1) {
  # single series
  results <- survfit(Surv(time, status) ~ 1, data = dat)
  # get survival estimates
  estimates <- data.frame("series" = levels(dat$series), "time" = results$time, "surv" = results$surv, "lower" = results$lower, "upper" = results$upper, "nevent" = results$n.event, "ncensor" = results$n.censor, "nrisk" = results$n.risk, stringsAsFactors = F)
} else {
  # multiple series
  # generate pairwise combinations of series
  pairs <- combn(levels(dat$series), 2)
  # initialize table for survival estimates
  estimates <- data.frame("series" = character(), "time" = double(), "surv" = double(), "lower" = double(), "upper" = double(), "nevent" = double(), "ncensor" = double(), "nrisk" = double(), stringsAsFactors = F)
  # initialize table for log-rank tests
  tests <- data.frame("series1" = character(length = ncol(pairs)), "series2" = character(length = ncol(pairs)), "pvalue" = double(length = ncol(pairs)), stringsAsFactors = F)
  # compute survival curves for each pairwise combination of series
  for (i in 1:ncol(pairs)) {
    pair <- pairs[,i]
    results <- survfit(Surv(time, status) ~ series, data = dat, subset = dat$series %in% pair)
    # get survival estimates for each series within pair
    for (series in pair) {
      if (series %in% estimates$series) next
      results_series <- results[paste0("series=",series)]
      estimates_series <- data.frame("series" = series, "time" = results_series$time, "surv" = results_series$surv, "lower" = results_series$lower, "upper" = results_series$upper, "nevent" = results_series$n.event, "ncensor" = results_series$n.censor, "nrisk" = results_series$n.risk, stringsAsFactors = F)
      estimates <- rbind(estimates, estimates_series)
    }
    # test for difference between survival curves using log-rank test
    test <- survdiff(Surv(time, status) ~ series, data = dat, subset = dat$series %in% pair)
    # compute p-value (see: https://www.emilyzabor.com/tutorials/survival_analysis_in_r_tutorial.html#Extracting_information_from_a_survdiff_object)
    pvalue <- 1 - pchisq(test$chisq, length(test$n) - 1)
    tests[i,] <- c(pair, signif(pvalue, 2))
  }
}

# output results
out <- list(estimates = estimates)
if (length(levels(dat$series)) > 1) out[["tests"]] <- tests
toJSON(out, digits = NA, na = "string")