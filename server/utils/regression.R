#######################
# Regression analysis
#######################

###########
# Usage
###########

# Usage: Rscript regression.R < jsonIn > jsonOut
#
# Parameters:
#   - jsonIn: json-formatted input of regression analysis streamed from standard input.
#
#     jsonIn {}
#     .type: [string] regression type (e.g. "linear" or "logistic")
#     .formula: [string] formula of regression model (e.g. "outcome ~ id0 + id1 + id2"). All terms in the formula must be present in .terms{}.
#     .terms: {}
#       .id: [string] term id (e.g. "outcome", "id0", "id1", etc.). Must be present in .formula.
#       .type: [string] termdb term type (e.g. "integer", "float", "categorical", or "condition")
#       .values: [array] data values
#       .refGrp: [string (optional, but required for categorical/condition term)] reference value of the term
#       .scale: [number (optional)] scaling factor of the term. All term values will be divided by this number.
#   - output: 
#       - <stdout>: [string] output summary statistics of the regression analysis streamed to stdout. The output will consist of different tables of summary statistics where the tables are delimited by header lines (i.e. lines beginning with "#"). Each header line has the following format: #<name of table>


###########
# Code
###########

######## Data preparation ##########

args <- commandArgs(trailingOnly = T)
if (length(args) != 0){
  stop("Usage: Rscript regression.R < jsonIn > jsonOut")
}

library(jsonlite)


# read in json input
con <- file("stdin","r")
lst <- fromJSON(con, simplifyDataFrame = F, simplifyMatrix = F)

# prepare a data table to store term values
data <- as.data.frame(matrix(data = NA, nrow = length(lst$terms[[1]]$values), ncol = length(lst$terms)))

# populate the data table
for (i in 1:length(lst$terms)) {
  term <- lst$terms[[i]]
  colnames(data)[i] <- term$id
  if (term$type == "integer" | term$type == "float") {
    # numeric terms
    if ("scale" %in% names(term)) {
      data[,i] <- term$values/term$scale
    } else {
      data[,i] <- term$values
    }
  } else if (term$type == "categorical" | term$type == "condition") {
    # categorical/condition terms
    data[,i] <- relevel(factor(term$values), ref = term$refGrp)
  } else {
    stop(paste0("term type '", term$type, "' is not recognized"))
  }
}


######### Regression analysis ##########

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
  if (!is.numeric(data$outcome)){
    stop("linear regression requires a numeric outcome variable")
  }
  # fit linear model
  res <- lm(as.formula(lst$formula), data = data)
  res_summ <- summary(res)
  # prepare residuals table
  residuals_table <- round(data.frame(as.list(fivenum(res_summ$residuals))), 3)
  colnames(residuals_table) <- c("Minimum","1st quartile","Median","3rd quartile","Maximum")
  # prepare coefficients table
  coefficients_table <- build_coef_table(res_summ)
  colnames(coefficients_table)[1] <- "Beta"
  # compute confidence intervals of beta values
  ci <- suppressMessages(confint(res))
  colnames(ci) <- c("95% CI (low)","95% CI (high)")
  coefficients_table <- cbind(coefficients_table, ci)
  coefficients_table <- coefficients_table[,c(1,5,6,2,3,4)]
  # prepare type III statistics table
  typeIII_table <- as.data.frame(drop1(res, scope = ~., test = "F"))
  # prepare other summary stats table
  other_table <- c(
    "Residual standard error" = round(res_summ$sigma, 2),
    "Residual degrees of freedom" = round(res$df.residual, 0),
    "R-squared" = round(res_summ$r.squared, 5),
    "Adjusted R-squared" = round(res_summ$adj.r.squared, 5),
    "F-statistic" = round(unname(res_summ$fstatistic[1]), 2),
    "P-value" = signif(unname(pf(res_summ$fstatistic[1], res_summ$fstatistic[2], res_summ$fstatistic[3], lower.tail = F)), 4)
  )
} else if (lst$type == "logistic"){
  # logistic regression
  if (!is.factor(data$outcome)){
    stop("logistic regression requires a factor outcome variable")
  }
  if (nlevels(data$outcome) != 2){
    stop("outcome variable is not binary")
  }
  # fit logistic model
  res <- glm(as.formula(lst$formula), family=binomial(link='logit'), data = data)
  res_summ <- summary(res)
  # prepare residuals table
  residuals_table <- round(data.frame(as.list(fivenum(res_summ$deviance.resid))), 3)
  colnames(residuals_table) <- c("Minimum","1st quartile","Median","3rd quartile","Maximum")
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
  typeIII_table <- as.data.frame(drop1(res, scope = ~., test = "LRT"))
  # prepare other summary stats table
  other_table <- c(
    "Dispersion parameter" = res_summ$dispersion,
    "Null deviance" = res_summ$null.deviance,
    "Null deviance degrees of freedom" = res_summ$df.null,
    "Residual deviance" = res_summ$deviance,
    "Residual deviance degrees of freedom" = res_summ$df.residual,
    "AIC" = res_summ$aic
  )
  other_table <- round(other_table, 1)
} else{
  stop("regression type is not recognized")
}


######### Formatting regression results
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
coefficients_table <- cbind.data.frame("Variable" = vCol, "Category" = cCol, coefficients_table, stringsAsFactors = F)

# reformat the type III statistics table
# round the non-p-value columns to 3 decimal places and the p-value column to 4 significant digits
pvalueCol <- grepl("^Pr\\(>", colnames(typeIII_table))
typeIII_table[,!pvalueCol] <- round(typeIII_table[,!pvalueCol], 3)
typeIII_table[,pvalueCol] <- signif(typeIII_table[,pvalueCol], 4)
# add a variable column
typeIII_table <- cbind.data.frame("Variable" = row.names(typeIII_table), typeIII_table, stringsAsFactors = F)


# output regression results
if (length(warnings()) > 0){
  cat("#warnings\n", file = "", sep = "")
  warning_summ <- capture.output(summary(warnings()))
  for (l in warning_summ){
    cat(l, "\n", sep = "")
  }
}
cat("#residuals\n", file = "", sep = "")
write.table(residuals_table, file = "", sep = "\t", quote = F, row.names = F)
cat("#coefficients\n", file = "", sep = "")
write.table(coefficients_table, file = "", sep = "\t", quote = F, row.names = F)
cat("#type3\n", file = "", sep = "")
write.table(typeIII_table, file = "", sep = "\t", quote = F, row.names = F)
cat("#other\n", file = "", sep = "")
write.table(as.data.frame(other_table), file = "", sep = "\t", quote = F, row.names = T, col.names = F)
close(con)
