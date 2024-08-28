#####################
# Survival analysis #
#####################

#########
# Usage #
#########

# Usage: echo <in_json> | Rscript survival.R > <out_json>

#   in_json: [string] input data in JSON format. Streamed through stdin.
#   out_json: [string] survival results in JSON format. Streamed to stdout.

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

# stream in json input
con <- file("stdin", "r")
json <- readLines(con)
close(con)
dat <- fromJSON(json)

# perform survival analysis
dat$series <- as.factor(dat$series)
if (length(levels(dat$series)) == 1) {
  # single series
  results <- survfit(Surv(time, status) ~ 1, data = dat)
  # get survival estimates
  # prepend a starting prob=1 data point that survfit() does not include
  estimates <- data.frame("series" = levels(dat$series), "time" = c(0,results$time), "surv" = c(1,results$surv), "lower" = c(1,results$lower), "upper" = c(1,results$upper), "nevent" = c(0,results$n.event), "ncensor" = c(0,results$n.censor), "nrisk" = c(results$n.risk[1],results$n.risk), stringsAsFactors = F)
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
    # prepend a starting prob=1 data point that survfit() does not include
    for (series in pair) {
      if (series %in% estimates$series) next
      results_series <- results[paste0("series=",series)]
      estimates_series <- data.frame("series" = series, "time" = c(0,results_series$time), "surv" = c(1,results_series$surv), "lower" = c(1,results_series$lower), "upper" = c(1,results_series$upper), "nevent" = c(0,results_series$n.event), "ncensor" = c(0,results_series$n.censor), "nrisk" = c(results_series$n.risk[1],results_series$n.risk), stringsAsFactors = F)
      estimates <- rbind(estimates, estimates_series)
    }
    # test for difference between survival curves using log-rank test
    df <- dat[dat$series %in% pair, c("time", "status")]
    if (all(apply(df, 2, function(x) length(unique(x)) == 1))) {
      # survival curves are identical
      # do not compare curves using survdiff() because it will error out
      # set pvalue to 1
      pvalue <- 1
    } else {
      # suppress warnings to prevent warnings when test is done between
      # curves with no events
      test <- suppressWarnings(survdiff(Surv(time, status) ~ series, data = dat, subset = dat$series %in% pair))
      # compute p-value (see: https://www.emilyzabor.com/tutorials/survival_analysis_in_r_tutorial.html#Extracting_information_from_a_survdiff_object)
      pvalue <- 1 - pchisq(test$chisq, length(test$n) - 1)
    }
    tests[i,] <- c(pair, signif(pvalue, 2))
  }
}

# output results
out <- list(estimates = estimates)
if (length(levels(dat$series)) > 1) out[["tests"]] <- tests
toJSON(out, digits = NA, na = "string")