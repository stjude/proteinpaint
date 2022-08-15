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
#           nrisk: # at-risk samples at timepoint
#         }
#       ]
#     },
#     tests: [
#       {
#         series1: first series of test,
#         series2: second series of test,
#         pvalue: p-value of test,
#         permutation: logical for whether permutation test was used
#       }
#     ]
#   }
# }


########
# Code #
########

library(parallel)
library(jsonlite)
suppressPackageStartupMessages(library(cmprsk))

# function to run cumulative incidence analysis on data for a chart
run_cuminc <- function(chart) {
  chart$event <- as.factor(chart$event)
  chart$series <- as.factor(chart$series)
  estimates <- list()
  if (length(levels(chart$series)) == 1) {
    # single series
    res <- cuminc(ftime = chart$time, fstatus = chart$event, cencode = 0)
    seriesRes <- as.data.frame(res[[1]])
    # compute confidence intervals
    seriesRes <- compute_ci(seriesRes)
    # compute at-risk counts
    # at-risk count is the number of samples
    # that have not experienced an event or
    # have not been censored by this time
    seriesRes$nrisk <- apply(seriesRes, 1, function(row) length(which(chart$time >= row["time"])))
    estimates[[levels(chart$series)]] <- seriesRes
    out <- list("estimates" = estimates)
  } else {
    # multiple series
    # compute cumulative incidence for each pairwise combination of series
    pairs <- combn(levels(chart$series), 2)
    # vectors for storing results of Gray's tests
    series1s <- character(length = ncol(pairs))
    series2s <- character(length = ncol(pairs))
    pvalues <- double(length = ncol(pairs))
    usedPermutation <- logical(length = ncol(pairs))
    # compute cumulative incidence for each pair
    for (i in 1:ncol(pairs)) {
      pair <- pairs[,i]
      series1s[i] <- pair[1]
      series2s[i] <- pair[2]
      pairDat <- chart[chart$series %in% pair,]
      pairDat$series <- droplevels(pairDat$series)
      res <- cuminc(ftime = pairDat$time, fstatus = pairDat$event, group = pairDat$series, cencode = 0)
      
      # get curve estimates
      for (series in pair) {
        if (series %in% names(estimates)) next
        seriesRes <- as.data.frame(res[[paste(series,1)]])
        # compute confidence intervals
        seriesRes <- compute_ci(seriesRes)
        # compute at-risk counts
        # at-risk count is the number of samples
        # that have not experienced an event or
        # have not been censored by this time
        seriesRes$nrisk <- apply(seriesRes, 1, function(row) length(which(chart$series == series & chart$time >= row["time"])))
        estimates[[series]] <- seriesRes
      }
      
      # Gray's test
      # the cuminc() function performed Gray's test between the pair of curves
      # before using the results of the test, first check if permutation test is needed
      # build an event-series contingency table
      # if expected count of any cell in table is <5, then permutation test is needed
      tbl <- table(pairDat$event, pairDat$series)
      rmarg <- rowSums(tbl)
      cmarg <- colSums(tbl)
      tmarg <- sum(tbl)
      E <- (rmarg %o% cmarg)/tmarg
      if (any(E < 5)) {
        # expected count of at least one cell in table is <5
        # perform permutation test
        usedPermutation[i] <- TRUE
        tsO <- res$Tests[1,"stat"] # test statistic of original data
        pvalue <- permutationTest(pairDat, tsO)
      } else {
        # expected counts of all cells in table are >=5
        # permutation test is not needed
        # use computed p-value from Gray's test
        usedPermutation[i] <- FALSE
        pvalue <- signif(res$Tests[1,"pv"], 2)
      }
      if (pvalue == 0) pvalue <- "<1e-16" # see https://stacks.cdc.gov/view/cdc/22757/cdc_22757_DS11.pdf
      pvalues[i] <- pvalue
    }
    tests <- data.frame("series1" = series1s, "series2" = series2s, "pvalue" = pvalues, "permutation" = usedPermutation, stringsAsFactors = F)
    out <- list("estimates" = estimates, "tests" = tests)
  }
  return(out)
}

# function to perform permutation test
permutationTest <- function(dat, tsO) {
  tsPs <- runPermutations(100, dat) # start with 100 permutations
  pvalue <- getPermutePvalue(tsPs, tsO)
  if (pvalue <= 0.2) {
    # p-value is <=0.2, so additional permutations are
    # needed to get more accurate p-value to determine
    # if p-value is significant
    tsPs <- c(tsPs, runPermutations(100, dat))
    pvalue <- getPermutePvalue(tsPs, tsO)
    if (pvalue <= 0.1) {
      # additional permutations are needed
      tsPs <- c(tsPs, runPermutations(300, dat))
      pvalue <- getPermutePvalue(tsPs, tsO)
      if (pvalue <= 0.05) {
        # additional permutations are needed
        tsPs <- c(tsPs, runPermutations(500, dat))
        pvalue <- getPermutePvalue(tsPs, tsO)
        # no need to run more than a total of 1000 permutations
      }
    }
  }
  return(pvalue)
}

# function to perform permutations
# for each permutation:
#   - shuffle series assignments of samples
#   - perform cumulative incidence analysis
#   - compute the test statistic of Gray's test
# return all permuted test statistics
runPermutations <- function(M, dat) {
  tsPs <- replicate(M, cuminc(ftime = dat$time, fstatus = dat$event, group = sample(dat$series), cencode = 0)$Tests[1,"stat"], simplify = T)
  return(tsPs)
}

# function to compute p-value for permutation test
# perform two-tailed test
getPermutePvalue <- function(tsPs, tsO) {
  B_left <- sum(tsPs <= -abs(tsO))
  B_right <- sum(tsPs >= abs(tsO))
  B <- B_left + B_right
  pvalue <- signif((B+1)/(length(tsPs)+1), 2)
  return(pvalue)
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

# perform cumulative incidence analysis
# parallelize the analysis across charts/variants
cores <- detectCores()
if (is.na(cores)) stop("unable to detect number of cores")
ci_results <- mclapply(dat, run_cuminc, mc.cores = cores)

# output results in json format
toJSON(ci_results, digits = NA, na = "string")
