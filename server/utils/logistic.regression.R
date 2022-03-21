##############################
# LOGISTIC REGRESSION ANALYSIS
##############################

###########
# USAGE
###########

# Usage: Rscript logistic.regression.R in.json > results

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
#       "sampleSize": sample size of analysis
#       "residuals": { "header": [], "rows": [] },
#       "coefficients": { "header": [], "rows": [] },
#       "type3": { "header": [], "rows": [] },
#       "other": { "header": [], "rows": [] },
#       "warnings": [] warning messages
#     },
#   }
# ]


###########
# CODE
###########

library(jsonlite)
source("server/utils/regression.utils.R")


#############
# FUNCTIONS #
#############

# function to run logistic regression
logisticRegression <- function(formula, dat, outcome, splineVariables) {
  res <- glm(formula, family = binomial(link='logit'), data = dat, na.action = na.omit)
  sampleSize <- res$df.residual + length(res$coefficients[!is.na(res$coefficients)])
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
  res_summ <- summary(res)
  # prepare residuals table
  residuals_table <- list("header" = c("Minimum","1st quartile","Median","3rd quartile","Maximum"), "rows" = unname(round(fivenum(res_summ$deviance.resid),3)))
  # prepare coefficients table
  coefficients_table <- build_coef_table(res_summ)
  colnames(coefficients_table)[1] <- "Log odds"
  # compute odds ratio
  coefficients_table <- cbind("Odds ratio" = exp(coef(res)), coefficients_table)
  # compute confidence intervals of odds ratios
  ci <- exp(suppressMessages(confint(res)))
  colnames(ci) <- c("95% CI (low)","95% CI (high)")
  coefficients_table <- cbind(coefficients_table, ci)
  coefficients_table <- coefficients_table[,c(1,6,7,2,3,4,5)]
  # prepare type III statistics table
  type3_table <- as.matrix(drop1(res, scope = ~., test = "LRT"))
  type3_table[,c("Deviance","AIC")] <- round(type3_table[,c("Deviance","AIC")], 1)
  type3_table[,"LRT"] <- round(type3_table[,"LRT"], 3)
  type3_table[,"Pr(>Chi)"] <- signif(type3_table[,"Pr(>Chi)"], 4)
  # prepare other summary stats table
  other_table <- list(
    "header" = c("Dispersion parameter", "Null deviance", "Null deviance degrees of freedom", "Residual deviance", "Residual deviance degrees of freedom", "AIC"),
    "rows" = round(c(res_summ$dispersion, res_summ$null.deviance, res_summ$df.null, res_summ$deviance, res_summ$df.residual, res_summ$aic), 1)
  )
  # export the results tables
  out <- list("res" = res, "sampleSize" = unbox(sampleSize), "residuals" = residuals_table, "coefficients" = coefficients_table, "type3" = type3_table, "other" = other_table)
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
  results <- withCallingHandlers(logisticRegression(formula, dat, outcome, splineVariables), warning = handleWarns)
  if (length(warns) > 0) results[["warnings"]] <- warns
  return(results)
}


################
# PREPARE DATA #
################

args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("Usage: Rscript logistic.regression.R in.json > results")
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