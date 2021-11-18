#######################
# Regression analysis
#######################

###########
# Usage
###########

# Usage: Rscript regression.R <stdin> [<regression type> <variable classes> <reference categories> <scaling factors> <formula>] <stdout>
#
# Parameters:
#   - <stdin>: [string] tab-delimited table of regression variables streamed from stdin. First line must be a header (i.e. column names). First column must be the outcome variable. All other columns are independent variables. All variables in the table are included in the regression analysis. Here is an example input where the "score" variable will be treated as the outcome variable:
#
#       score   gender   race    age	    treatment1   treatment2
#       10.56   Male     White   10-20    1            1
#       7.24    Female   White   10-20    0            0
#       12.71   Female   Other   20-30    1            0
#       16.23   Male     Other   20-30    0            0
#       ...
#
#   - arguments:
#       - <regression type>: [string] type of regression analysis ("linear" or "logistic"). Linear regression should be used if the outcome is a continuous variable. Logistic regression should be used if the outcome is a categorical variable. Currently, logistic regression can only be performed on binary outcome variables (e.g. "no/yes", "no condition/condition", "0/1").
#       - <variable classes>: [string] a comma-delimited list of R classes for each variable (e.g. "numeric,integer,factor,factor,factor,numeric"). The number and order of classes should match that of variables in the table. Variables with integer or numeric classes will be treated as continuous variables, while variables with a factor class will be treated as categorical variables.
#       - <reference categories>: [string] a comma-delimited list of reference categories for each variable (same format as <variable classes>). For categorical variables, specify the desired reference category. For continuous variables, use an 'NA' string.
#       - <scaling factors>: [string] a comma-delimited list of scaling factors for each variable (same format as <variable classes>). Values of each variable will be divided by the corresponding scaling factor. Use the 'NA' string to indicate that a variable should not be scaled.
#       - <formula>: [string] a formula for fitting the regression model (e.g. 'outcome ~ id0 + id1 + id0:id1')
#
#   - output: 
#       - <stdout>: [string] output summary statistics of the regression analysis streamed to stdout. The output will consist of different tables of summary statistics where the tables are delimited by header lines (i.e. lines beginning with "#"). Each header line has the following format: #<name of table>


###########
# Code
###########

#TODO: should we use "|" instead of "," for delimiting values within arguments? Use JSON input for arguments.


args <- commandArgs(trailingOnly = T)
if (length(args) != 5){
  stop("Usage: Rscript regression.R <stdin> [<regression type> <variable classes> <reference categories> <scaling factors> <formula>] <stdout>")
}
regressionType <- args[1]
variableClasses <- strsplit(args[2], split = ",")[[1]]
refCategories <- strsplit(args[3], split = ",")[[1]]
scalingFactors <- strsplit(args[4], split = ",")[[1]]
formulaStr <- args[5]


#Read in input data and assign variable classes
con <- file("stdin","r")
dat <- read.table(con, header = T, sep = "\t", quote = "", colClasses = variableClasses, check.names = F)

if(length(variableClasses) != ncol(dat)){
  stop("Number of variable classes does not match the number of variables")
}
if(length(refCategories) != ncol(dat)){
  stop("Number of reference categories does not match the number of variables")
}
if(length(scalingFactors) != ncol(dat)){
  stop("Number of scaling factors does not match the number of variables")
}

#Assign the reference categories of categorical variables.
for(i in 1:ncol(dat)) {
  if(is.factor(dat[,i])) {
    dat[,i] <- relevel(dat[,i], ref = refCategories[i])
  }
}

#Scale those variables that have scaling factors
for(i in 1:length(scalingFactors)) {
  if(scalingFactors[i] != "NA") {
    scalingFactor <- as.numeric(scalingFactors[i])
    dat[,i] <- dat[,i]/scalingFactor
  }
}


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
outcomeVar <- names(dat)[1]
if (regressionType == "linear"){
  # linear regression
  if (!is.integer(dat[,outcomeVar]) & !is.numeric(dat[,outcomeVar])){
    stop("outcome variable needs to be numeric for linear regression")
  }
  # fit linear model
  res <- lm(as.formula(formulaStr), data = dat)
  res_summ <- summary(res)
  # residuals table
  residuals_table <- round(data.frame(as.list(fivenum(res_summ$residuals))), 3)
  colnames(residuals_table) <- c("Minimum","1st quartile","Median","3rd quartile","Maximum")
  # coefficients table
  coefficients_table <- build_coef_table(res_summ)
  colnames(coefficients_table)[1] <- "Beta"
  # compute confidence intervals of beta values
  ci <- suppressMessages(confint(res))
  colnames(ci) <- c("95% CI (low)","95% CI (high)")
  coefficients_table <- cbind(coefficients_table, ci)
  coefficients_table <- coefficients_table[,c(1,5,6,2,3,4)]
  # type III statistics
  typeIII_table <- as.data.frame(drop1(res, scope = ~., test = "F"))
  # other summary stats
  other_table <- c(
    "Residual standard error" = round(res_summ$sigma, 2),
    "Residual degrees of freedom" = round(res$df.residual, 0),
    "R-squared" = round(res_summ$r.squared, 5),
    "Adjusted R-squared" = round(res_summ$adj.r.squared, 5),
    "F-statistic" = round(unname(res_summ$fstatistic[1]), 2),
    "P-value" = signif(unname(pf(res_summ$fstatistic[1], res_summ$fstatistic[2], res_summ$fstatistic[3], lower.tail = F)), 4)
  )
} else if (regressionType == "logistic"){
  # logistic regression
  if (!is.factor(dat[,outcomeVar])){
    stop("outcome variable needs to be a factor for logistic regression")
  }
  if (nlevels(dat[,outcomeVar]) != 2){
    stop("outcome variable is not binary")
  }
  # fit logistic model
  res <- glm(as.formula(formulaStr), family=binomial(link='logit'), data = dat)
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
  # type III statistics
  typeIII_table <- as.data.frame(drop1(res, scope = ~., test = "LRT"))
  # other summary stats
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
