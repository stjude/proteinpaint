#########################
# COX REGRESSION ANALYSIS
#########################

###########
# USAGE
###########

# Usage: Rscript cox.regression.R in.json > results

# Input data is in JSON format and is read in from <in.json> file.
# Regression results are written in JSON format to stdout.

# Input JSON specifications:
# {
#   "data": [{}] per-sample data values
#   "metadata": {
#     "type": regression type (linear/logistic/cox)
#     "variables": [
#       {
#         "id": variable id
#         "name": variable name
#         "type": variable type ("outcome", "snplocus", "spline", "independent")
#         "rtype": R variable type ("numeric", "factor")
#         "timeToEvent": {} (for cox outcome variable)
#           timeId: id of time variable,
#           eventId: if of event variable
#         "refGrp": reference group (required for factor variables)
#         "interactions": [] ids of interacting variables
#         "categories": {} (only for logistic outcome)
#           "ref": reference category of outcome
#           "nonref": non-reference category of outcome
#         "spline": {} cubic spline settings (only for spline variable)
#           "knots": [] knot values
#           "plotfile": output png file of spline plot
#         "scale": scaling factor. Data values of variable will be divided by this number (optional)
#       }
#     ]
#   }
# }
#
#
# Output JSON specifications:
# [
#   {
#     "id": id of snplocus term (empty when no snplocus terms are present)
#     "data": {
#       "sampleSize": sample size of analysis,
#       "eventCnt": number of events,
#       "coefficients": { "header": [], "rows": [] },
#       "type3": { "header": [], "rows": [] },
#       "tests": { "header": [], "rows": [] },
#       "other": { "header": [], "rows": [] },
#       "warnings": [] warning messages
#     },
#   }
# ]


###########
# CODE
###########

library(jsonlite)
library(survival)
source("server/utils/regression.utils.R")


#############
# FUNCTIONS #
#############

# function to run logistic regression
coxRegression <- function(formula, dat, outcome, splineVariables) {
  res <- coxph(formula, data = dat)
  
  # check for spline variables
  if (nrow(splineVariables) > 0) {
    # model contains spline variables(s)
    # plot spline regression for each spline term
    # do not plot if term is missing plot file (to hide plot
    # when snplocus terms are present)
    for (r in 1:nrow(splineVariables)) {
      splineVariable <- splineVariables[r,]
      if ("plotfile" %in% names(splineVariable$spline)) {
        plot_spline(splineVariable, dat, outcome, res, "logistic")
      }
    }
  }
  
  # extract summary object
  res_summ <- summary(res)
  
  # numbers of samples and events
  sampleSize <- res_summ$n
  eventCnt <- res_summ$nevent
  
  # coefficients table
  coefficients_table <- res_summ$coefficients
  # add in confidence intervals
  confint_table <- res_summ$conf.int
  coefficients_table <- cbind(coefficients_table, confint_table[,c("lower .95", "upper .95")])
  # rename and reorder columns
  colnames(coefficients_table)[colnames(coefficients_table) == "coef"] <- "Beta"
  colnames(coefficients_table)[colnames(coefficients_table) == "exp(coef)"] <- "HR"
  colnames(coefficients_table)[colnames(coefficients_table) == "se(coef)"] <- "Std. Error"
  colnames(coefficients_table)[colnames(coefficients_table) == "lower .95"] <- "95% CI (low)"
  colnames(coefficients_table)[colnames(coefficients_table) == "upper .95"] <- "95% CI (high)"
  coefficients_table <- coefficients_table[,c(2,6,7,1,3,4,5)]
  
  # type III statistics table
  type3_table <- as.matrix(drop1(res, scope = ~., test = "Chisq"))
  type3_table[,"AIC"] <- round(type3_table[,"AIC"], 1)
  type3_table[,"LRT"] <- round(type3_table[,"LRT"], 3)
  type3_table[,"Pr(>Chi)"] <- signif(type3_table[,"Pr(>Chi)"], 4)
  
  # statistical tests table
  tests_table <- rbind(res_summ$logtest, res_summ$waldtest, res_summ$sctest)
  colnames(tests_table) <- c("Test statistic", "Df", "P-value")
  tests_table[,"Test statistic"] <- round(tests_table[,"Test statistic"], 2)
  tests_table[,"Df"] <- round(tests_table[,"Df"], 0)
  tests_table[,"P-value"] <- signif(tests_table[,"P-value"], 4)
  tests_table <- cbind("Test" = c("Likelihood ratio test", "Wald test", "Score (log rank) test"), tests_table)
  tests_table <- list("header" = colnames(tests_table), "rows" = tests_table)
  
  # other summary stats table
  other_table <- list(
    "header" = c("Concordance", "Concordance standard error"),
    "rows" = c(unname(round(res_summ$concordance["C"], 3)), unname(round(res_summ$concordance["se(C)"], 3)))
  )
  
  # export the results tables
  out <- list("res" = res, "sampleSize" = unbox(sampleSize), "eventCnt" = unbox(eventCnt),"coefficients" = coefficients_table, "type3" = type3_table, "tests" = tests_table, "other" = other_table)
  return(out)
}

# function to run regression analysis
runRegression <- function(formula, dat, outcome, splineVariables) {
  warns <- vector(mode = "character")
  handleWarns <- function(w) {
    # handler for warning messages
    warns <<- c(warns, conditionMessage(w))
    invokeRestart("muffleWarning")
  }
  results <- withCallingHandlers(coxRegression(formula, dat, outcome, splineVariables), warning = handleWarns)
  if (length(warns) > 0) results[["warnings"]] <- warns
  return(results)
}


################
# PREPARE DATA #
################

args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("Usage: Rscript cox.regression.R in.json > results")
infile <- args[1]

# read in json input
input <- fromJSON(infile)
dat <- input$data # data table
variables <- input$metadata$variables # variable metadata

# prepare data table
lst <- prepareDataTable(dat, variables, input$metadata$type)
dat <- lst$dat
variables <- lst$variables


##################
# BUILD FORMULAS #
##################

lst <- buildFormulas(variables, input$metadata$type)
formulas <- lst$formulas
splineVariables <- lst$splineVariables


##################
# RUN REGRESSION #
##################

# Run a separate regression analysis for each formula
out <- list()
outcome <- variables[variables$type == "outcome",]
for (i in 1:length(formulas)) {
  id <- formulas[[i]]$id
  formula <- formulas[[i]]$formula
  results <- runRegression(formula, dat, outcome, splineVariables)
  results$coefficients <- formatCoefficients(results$coefficients, results$res, input$metadata$type)
  results$type3 <- formatType3(results$type3)
  out[[length(out)+1]] <- list("id" = unbox(id), "data" = results[names(results) != "res"])
}


##################
# EXPORT RESULTS #
##################

# Export results as json to stdout
cat(toJSON(out, digits = NA, na = "string"), file = "", sep = "")