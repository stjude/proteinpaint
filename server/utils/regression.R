#######################
# Regression analysis
#######################

###########
# Usage
###########

# Usage: Rscript regression.R <stdin> [<regression type> <variable classes> <reference categories> <scaling factors>] <stdout>
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
#
#   - output: 
#       - <stdout>: [string] output summary statistics of the regression analysis streamed to stdout. The output will consist of different tables of summary statistics where the tables are delimited by header lines (i.e. lines beginning with "#"). Each header line has the following format: #<type of table (matrix or vector)>#<name of table>.


###########
# Code
###########

#TODO: are we still inputting variables with whitespace/commas? If not, then the commands for handling variables with whitespace are not necessary (see "sprintf" and "gsub" commands. Any others?).
#TODO: should we use "|" instead of "," for delimiting values within arguments?


args <- commandArgs(trailingOnly = T)
if (length(args) != 5){
  stop("Usage: Rscript regression.R <stdin> [<regression type> <variable classes> <reference categories> <scaling factors> <model>] <stdout>")
}
regressionType <- args[1]
variableClasses <- strsplit(args[2], split = ",")[[1]]
refCategories <- strsplit(args[3], split = ",")[[1]]
scalingFactors <- strsplit(args[4], split = ",")[[1]]
modelStr <- args[5]


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

#Perform the regression analysis
names(dat) <- paste(names(dat), "___", sep = "")
outcomeVar <- names(dat)[1]
#independentVars <- names(dat)[-1]
#model <- as.formula(paste(sprintf("`%s`", outcomeVar), paste(sprintf("`%s`", independentVars), collapse = " + "), sep = " ~ "))
model <- as.formula(modelStr)
if (regressionType == "linear"){
  # linear regression
  if (!is.integer(dat[,outcomeVar]) & !is.numeric(dat[,outcomeVar])){
    stop("outcome variable needs to be numeric for linear regression")
  }
  # fit linear model
  res <- lm(model, data = dat)
  res_summ <- summary(res)
  # prepare residuals table
  residuals_table <- round(data.frame(as.list(fivenum(res_summ$residuals))), 3)
  colnames(residuals_table) <- c("Minimum","1st quartile","Median","3rd quartile","Maximum")
  # prepare coefficients table
  coefficients_table <- cbind(res_summ$coefficients, suppressMessages(confint(res)))
  colnames(coefficients_table)[1] <- "Beta"
  colnames(coefficients_table)[5:6] <- c("95% CI (low)","95% CI (high)")
  # type III statistics
  typeIII_table <- as.data.frame(drop1(res, test = "F"))
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
  res <- glm(model, family=binomial(link='logit'), data = dat)
  res_summ <- summary(res)
  # prepare residuals table
  residuals_table <- round(data.frame(as.list(fivenum(res_summ$deviance.resid))), 3)
  colnames(residuals_table) <- c("Minimum","1st quartile","Median","3rd quartile","Maximum")
  # prepare coefficients table
  coefficients_table <- res_summ$coefficients
  coefficients_table <- cbind(coefficients_table, "Odds ratio" = exp(coef(res)), exp(suppressMessages(confint(res))))
  colnames(coefficients_table)[1] <- "Log Odds"
  colnames(coefficients_table)[6:7] <- c("95% CI (low)","95% CI (high)")
  # type III statistics
  typeIII_table <- as.data.frame(drop1(res, test = "LRT"))
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


#Reformat the coefficients table
#Round the non-p-value columns to 3 decimal places
pvalueCol <- grepl("^Pr\\(>", colnames(coefficients_table))
coefficients_table[,!pvalueCol] <- round(coefficients_table[,!pvalueCol], 3)
#Round the p-value column to 4 significant digits
coefficients_table[,pvalueCol] <- signif(coefficients_table[,pvalueCol], 4)
#Re-arrange columns
coefficients_table <- as.data.frame(coefficients_table)
coefficients_table<- cbind("Variable" = "", "Category" = "", coefficients_table, stringsAsFactors = F)
var_and_cat <- strsplit(row.names(coefficients_table), split = "___")
for(x in 1:length(var_and_cat)){
  coefficients_table[x,"Variable"] <- gsub("`","",var_and_cat[[x]][1])
  if(length(var_and_cat[[x]]) > 1){
    coefficients_table[x,"Category"] <- gsub("`","",var_and_cat[[x]][2])
  } else{
    coefficients_table[x,"Category"] <- ""
  }
}

#Reformat the type III statistics table
#Round the non-p-value columns to 3 decimal places
pvalueCol <- grepl("^Pr\\(>", colnames(typeIII_table))
typeIII_table[,!pvalueCol] <- round(typeIII_table[,!pvalueCol], 3)
#Round the p-value column to 4 significant digits
typeIII_table[,pvalueCol] <- signif(typeIII_table[,pvalueCol], 4)
#Re-arrange columns
typeIII_table <- cbind("Variable" = gsub("`", "", gsub("___", "", row.names(typeIII_table))), typeIII_table, stringsAsFactors = F)


#Output summary statistics
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
