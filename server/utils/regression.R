#######################
# REGRESSION ANALYSIS
#######################

###########
# USAGE
###########

# Usage: Rscript regression.R in.json > results

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
#         "timeToEvent": {} (only for cox outcome)
#           timeScale: year/age
#           timeId: id of time variable (for 'year' time scale)
#           agestartId: id of age start variable (for 'age' time scale)
#           ageendId: id of age end variable (for 'age' time scale)
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
#       "eventCnt": number of events (only for cox regression),
#       "residuals": { "header": [], "rows": [] },
#       "coefficients": { "header": [], "rows": [] },
#       "type3": { "header": [], "rows": [] },
#       "tests": { "header": [], "rows": [] } (only for cox regression),
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


################
# PREPARE DATA #
################

args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("Usage: Rscript linear.regression.R in.json > results")
infile <- args[1]

# read in json input
input <- fromJSON(infile)
regtype <- input$metadata$type # regression type
dat <- input$data # data table
variables <- input$metadata$variables # variable metadata

# prepare data table
lst <- prepareDataTable(dat, variables, regtype)
dat <- lst$dat
variables <- lst$variables


##################
# BUILD FORMULAS #
##################

lst <- buildFormulas(variables)
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
  results <- runRegression(regtype, formula, dat, outcome, splineVariables)
  results$coefficients <- formatCoefficients(results$coefficients, results$res, regtype)
  results$type3 <- formatType3(results$type3)
  out[[length(out)+1]] <- list("id" = unbox(id), "data" = results[names(results) != "res"])
}


##################
# EXPORT RESULTS #
##################

# Export results as json to stdout
cat(toJSON(out, digits = NA, na = "string"), file = "", sep = "")