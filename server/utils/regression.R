#######################
# Regression analysis
#######################

###########
# Usage
###########

# Usage: Rscript regression.R < jsonIn > jsonOut

# Parameters:
#   - jsonIn: [string] JSON-formatted input data for regression analysis streamed from standard input. Ensure that the JSON string does not contain any newline characters, because newline characters are treated as separators of JSON records (trailing newline characters are ok).
#     
#     JSON input specifications:
#     {
#       "type": [string] regression type (e.g. "linear", "logistic")
#       "formula": [string] formula of regression model (e.g. "outcome ~ id0 + id1 + id2").
#       "outcome": {
#         "id": [string] term id (e.g. "outcome")
#         "type": [string] termdb term type (e.g. "integer", "float", "categorical", "condition")
#         "values": [array] data values
#         "refGrp": [string] reference value of the term (required for categorical/condition term)
#       }
#       "independent": [
#         {
#           "id": [string] term id (e.g. "id0", "id1")
#           "type": [string] termdb term type (e.g. "integer", "float", "categorical", "condition")
#           "values": [array] data values
#           "refGrp": [string] reference value of the term (required for categorical/condition term)
#           "scale": [number] scaling factor of the term. All term values will be divided by this number (optional)
#         },
#         {...}
#        ]
#     }
#
#
#   - jsonOut: [string] JSON-formatted results from the regression analysis streamed to standard output. The various results tables are stored as separate keys in the JSON object.
#     
#     JSON output specifications:
#     {
#       "type": [string] regression type (e.g. "linear", "logistic")
#       "residuals": {
#           "header": []
#           "rows": []
#       }
#       "coefficients": {
#           "header": []
#           "rows": []
#       }
#       "type3": {
#           "header": []
#           "rows": []
#       }
#       "other": {
#           <label>: <value>
#           <label>: <value>
#           ...
#       }
#     }


###########
# Code
###########

######## Data preparation ##########

args <- commandArgs(trailingOnly = T)
if (length(args) != 0) stop("Usage: Rscript regression.R < jsonIn > jsonOut")

# read in json input
library(jsonlite)
con <- file("stdin","r")
lst <- stream_in(con, verbose = F, simplifyVector = T, simplifyDataFrame = F, simplifyMatrix = F)
if (length(lst) != 1) stop("input json does not have 1 record")
lst <- lst[[1]]

# build data table
#  - variable ids as column names
#  - variable values as column values
#  - assign variable types (e.g. numeric, factor)
#  - assign reference groups and scale values (if applicable)
dat <- as.data.frame(matrix(data = NA, nrow = length(lst$outcome$values), ncol = length(lst$independent) + 1))
for (i in 1:ncol(dat)) {
  if (i == 1) {
    term <- lst$outcome
  } else {
    term <- lst$independent[[i - 1]]
  }
  colnames(dat)[i] <- term$id
  if (term$type == "integer" | term$type == "float") {
    # numeric term
    if ("scale" %in% names(term)) {
      dat[,i] <- term$values/term$scale
    } else {
      dat[,i] <- term$values
    }
  } else if (term$type == "categorical" | term$type == "condition") {
    # categorical/condition term
    dat[,i] <- relevel(factor(term$values), ref = term$refGrp)
  } else {
    stop(paste0("term type '", term$type, "' is not recognized"))
  }
}


########## Regression analysis ###########

# function to build coefficients table
build_coef_table <- function(res_summ) {
  coefficients_table <- res_summ$coefficients
  if (any(aliased <- res_summ$aliased)) {
    # to keep coefficients with "NA" estimates in the table
    cn <- names(aliased)
    coefficients_table <- matrix(NA, length(aliased), 4, dimnames = list(cn, colnames(coefficients_table)))
    coefficients_table[!aliased, ] <- res_summ$coefficients
  }
  return(coefficients_table)
}

# perform the regression analysis
if (lst$type == "linear"){
  # linear regression
  if (!is.numeric(dat$outcome)){
    stop("linear regression requires a numeric outcome variable")
  }
  # fit linear model
  res <- lm(as.formula(lst$formula), data = dat)
  res_summ <- summary(res)
  # prepare residuals table
  residuals_table <- list("header" = c("Minimum","1st quartile","Median","3rd quartile","Maximum"), "rows" = unname(round(fivenum(res_summ$residuals),3)))
  # prepare coefficients table
  coefficients_table <- build_coef_table(res_summ)
  colnames(coefficients_table)[1] <- "Beta"
  # compute confidence intervals of beta values
  ci <- suppressMessages(confint(res))
  colnames(ci) <- c("95% CI (low)","95% CI (high)")
  coefficients_table <- cbind(coefficients_table, ci)
  coefficients_table <- coefficients_table[,c(1,5,6,2,3,4)]
  # prepare type III statistics table
  typeIII_table <- as.matrix(drop1(res, scope = ~., test = "F"))
  typeIII_table[,c("Sum of Sq","RSS","AIC")] <- round(typeIII_table[,c("Sum of Sq","RSS","AIC")], 1)
  typeIII_table[,"F value"] <- round(typeIII_table[,"F value"], 3)
  typeIII_table[,"Pr(>F)"] <- signif(typeIII_table[,"Pr(>F)"], 4)
  # prepare other summary stats table
  other_table <- list(
    "Residual standard error" = round(res_summ$sigma, 2),
    "Residual degrees of freedom" = round(res$df.residual, 0),
    "R-squared" = round(res_summ$r.squared, 5),
    "Adjusted R-squared" = round(res_summ$adj.r.squared, 5),
    "F-statistic" = round(unname(res_summ$fstatistic[1]), 2),
    "P-value" = signif(unname(pf(res_summ$fstatistic[1], res_summ$fstatistic[2], res_summ$fstatistic[3], lower.tail = F)), 4)
  )
} else if (lst$type == "logistic"){
  # logistic regression
  if (!is.factor(dat$outcome)){
    stop("logistic regression requires a factor outcome variable")
  }
  if (nlevels(dat$outcome) != 2){
    stop("outcome variable is not binary")
  }
  # fit logistic model
  res <- glm(as.formula(lst$formula), family=binomial(link='logit'), data = dat)
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
  typeIII_table <- as.matrix(drop1(res, scope = ~., test = "LRT"))
  typeIII_table[,c("Deviance","AIC")] <- round(typeIII_table[,c("Deviance","AIC")], 1)
  typeIII_table[,"LRT"] <- round(typeIII_table[,"LRT"], 3)
  typeIII_table[,"Pr(>Chi)"] <- signif(typeIII_table[,"Pr(>Chi)"], 4)
  # prepare other summary stats table
  other_table <- list(
    "Dispersion parameter" = round(res_summ$dispersion, 1),
    "Null deviance" = round(res_summ$null.deviance, 1),
    "Null deviance degrees of freedom" = round(res_summ$df.null, 1),
    "Residual deviance" = round(res_summ$deviance, 1),
    "Residual deviance degrees of freedom" = round(res_summ$df.residual, 1),
    "AIC" = round(res_summ$aic, 1)
  )
} else{
  stop("regression type is not recognized")
}


########## Formatting regression results ############

# reformat the coefficients table
# round the non-p-value columns to 3 decimal places and the p-value columns to 4 significant digits
pvalueCol <- grepl("^Pr\\(>", colnames(coefficients_table))
coefficients_table[,!pvalueCol] <- round(coefficients_table[,!pvalueCol], 3)
coefficients_table[,pvalueCol] <- signif(coefficients_table[,pvalueCol], 4)
# add variable and category columns
vCol <- c("Intercept")
cCol <- c("")
vlst <- attr(res$terms, "term.labels", exact = T)
for (v in vlst) {
  if (grepl(":", v, fixed = T)) {
    # interacting variables
    v1 <- strsplit(v, split = ":", fixed = T)[[1]][1]
    v2 <- strsplit(v, split = ":", fixed = T)[[1]][2]
    clst1 <- ""
    clst2 <- ""
    if (v1 %in% names(res$xlevels)) {
      clst1 <- res$xlevels[[v1]][-1] # extract categories (without reference category)
    }
    if (v2 %in% names(res$xlevels)) {
      clst2 <- res$xlevels[[v2]][-1] # extract categories (without reference category)
    }
    for (c1 in clst1) {
      for (c2 in clst2) {
        cCol <- c(cCol, paste(c1, c2, sep = ":"))
        vCol <- c(vCol, v)
      }
    }
  } else {
    # single variable
    if (v %in% names(res$xlevels)) {
      clst <- res$xlevels[[v]][-1] # extract categories (without reference category)
      for (c in clst) {
        vCol <- c(vCol, v)
        cCol <- c(cCol, c)
      }
    } else {
      vCol <- c(vCol, v)
      cCol <- c(cCol, "")
    }
  }
}
coefficients_table <- cbind("Variable" = vCol, "Category" = cCol, coefficients_table)
coefficients_table <- list("header" = colnames(coefficients_table), "rows" = coefficients_table)

# reformat the type III statistics table
# add a variable column
typeIII_table <- cbind("Variable" = row.names(typeIII_table), typeIII_table)
typeIII_table <- list("header" = colnames(typeIII_table), "rows" = typeIII_table)


########## Export regression results ############

# combine the results tables into a list
out_lst <- list("type" = lst$type, "residuals" = residuals_table, "coefficients" = coefficients_table, "type3" = typeIII_table, "other" = other_table)

if (length(warnings()) > 0) {
  warnings_table <- capture.output(summary(warnings()))
  out_lst[["warnings"]] <- warnings_table
}

# convert to json
out_json <- toJSON(out_lst, digits = NA, na = "string", auto_unbox = T)

# output json to stdout
cat(out_json, file = "", sep = "")

close(con)
