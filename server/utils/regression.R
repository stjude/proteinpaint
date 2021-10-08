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

args <- commandArgs(trailingOnly = T)
if (length(args) != 4){
  stop("Usage: Rscript regression.R <stdin> [<regression type> <variable classes> <reference categories> <scaling factors>] <stdout>")
}
regressionType <- args[1]
variableClasses <- strsplit(args[2], split = ",")[[1]]
refCategories <- strsplit(args[3], split = ",")[[1]]
scalingFactors <- strsplit(args[4], split = ",")[[1]]

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

#Assign the reference categories of categorical variables. For binned categorical variables, ensure the order of categories follows a numeric order. 
for(i in 1:ncol(dat)) {
  if(is.factor(dat[,i])) {
    if(any(grepl(">|<|≥", dat[,i]))) {
      levels(dat[,i]) <- levels(dat[,i])[order(gsub(">|<|≥", "", levels(dat[,i])))]
    }
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
independentVars <- names(dat)[-1]
model <- as.formula(paste(sprintf("`%s`", outcomeVar), paste(sprintf("`%s`", independentVars), collapse = " + "), sep = " ~ "))
if (regressionType == "linear"){
  res <- glm(model, data = dat)
  res_summ <- summary(res)
  coefficients_summ <- cbind(res_summ$coefficients, suppressMessages(confint(res)))
  colnames(coefficients_summ)[1] <- "Beta"
  colnames(coefficients_summ)[5:6] <- c("95% CI (low)","95% CI (high)")
} else if (regressionType == "logistic"){
  if (!is.factor(dat[,outcomeVar]) | nlevels(dat[,outcomeVar]) != 2){
    stop("Outcome variable is not binary. Logistic regression requires a binary outcome variable.")
  }
  res <- glm(model, family=binomial(link='logit'), data = dat)
  res_summ <- summary(res)
  coefficients_summ <- res_summ$coefficients
  coefficients_summ <- cbind(coefficients_summ, "Odds ratio" = exp(coef(res)), exp(suppressMessages(confint(res))))
  colnames(coefficients_summ)[1] <- "Log Odds"
  colnames(coefficients_summ)[6:7] <- c("95% CI (low)","95% CI (high)")
} else{
  stop("regression type is not recognized")
}

#Reformat the coefficients table
#Round the non-p-value columns to 3 decimal places
pvalueCol <- grepl("^Pr\\(>", colnames(coefficients_summ))
coefficients_summ[,!pvalueCol] <- round(coefficients_summ[,!pvalueCol], 3)
#Round the p-value column to 4 significant digits
coefficients_summ[,pvalueCol] <- signif(coefficients_summ[,pvalueCol], 4)
#Re-arrange columns
coefficients_summ <- as.data.frame(coefficients_summ)
coefficients_summ<- cbind("Variable" = "", "Category" = "", coefficients_summ, stringsAsFactors = F)
var_and_cat <- strsplit(row.names(coefficients_summ), split = "___")
for(x in 1:length(var_and_cat)){
  coefficients_summ[x,"Variable"] <- gsub("`","",var_and_cat[[x]][1])
  if(length(var_and_cat[[x]]) > 1){
    coefficients_summ[x,"Category"] <- gsub("`","",var_and_cat[[x]][2])
  } else{
    coefficients_summ[x,"Category"] <- ""
  }
}

#Type III statistics.
#For each variable, compare the complete model (i.e. model with all variables) to the model without the variable. This analysis will test whether the model changes significantly in the absence of each variable.
#Use the F test for linear regression and use the likelihood ratio test for logistic regression.
if (regressionType == "linear") {
  typeIIIstats <- as.data.frame(drop1(res, test = "F"))
} else {
  typeIIIstats <- as.data.frame(drop1(res, test = "LRT"))
}
#Round the non-p-value columns to 3 decimal places
pvalueCol <- grepl("^Pr\\(>", colnames(typeIIIstats))
typeIIIstats[,!pvalueCol] <- round(typeIIIstats[,!pvalueCol], 3)
#Round the p-value column to 4 significant digits
typeIIIstats[,pvalueCol] <- signif(typeIIIstats[,pvalueCol], 4)
#Re-arrange columns
typeIIIstats <- cbind("Variable" = gsub("`", "", gsub("___", "", row.names(typeIIIstats))), typeIIIstats, stringsAsFactors = F)

#Compute summary stats of deviance residuals
deviance_resid_summ <- round(data.frame(as.list(fivenum(res_summ$deviance.resid))), 3)
colnames(deviance_resid_summ) <- c("Minimum","1st quartile","Median","3rd quartile","Maximum")

#Extract other summary stats
other_summ <- matrix(, nrow = 6, dimnames = list(c("Dispersion parameter","Null deviance","Null deviance df", "Residual deviance","Residual deviance df", "AIC")))
other_summ["Dispersion parameter",] <- res_summ$dispersion
other_summ["Null deviance",] <- res_summ$null.deviance
other_summ["Null deviance df",] <- res_summ$df.null
other_summ["Residual deviance",] <- res_summ$deviance
other_summ["Residual deviance df",] <- res_summ$df.residual
other_summ["AIC",] <- res_summ$aic
other_summ <- round(other_summ, 1)

#Output summary statistics to stdout.
cat("#matrix#Deviance Residuals\n", file = "", sep = "")
write.table(deviance_resid_summ, file = "", sep = "\t", quote = F, row.names = F)
cat("#matrix#Coefficients\n", file = "", sep = "")
write.table(coefficients_summ, file = "", sep = "\t", quote = F, row.names = F)
cat("#matrix#Type III statistics\n", file = "", sep = "")
write.table(typeIIIstats, file = "", sep = "\t", quote = F, row.names = F)
cat("#vector#Other summary statistics\n", file = "", sep = "")
write.table(other_summ, file = "", sep = "\t", quote = F, row.names = T, col.names = F)
close(con)
