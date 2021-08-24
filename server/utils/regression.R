#######################
# Regression analysis
#######################

# Usage: Rscript regression.R <regression type> <variable classes> < input
#   - input: tab-delimited table of regression variables streamed from stdin. First line must be a header (i.e. column names). First column must be the outcome variable. All other columns are independent variables. All variables in table are included in the regression analysis (see example below).
#   - arguments:
#       - <regression type>: string indicating regression type ("linear" or "logistic"). Linear regression should be used if the outcome is a continuous variable. Logistic regression should be used if the outcome is a categorical variable. Currently, logistic regression can only be performed on binary outcome variables (e.g. "no/yes", "no condition/condition", "0/1").
#       - <variable classes>: string listing the R class of each variable. Classes are comma separated and their order should match the order of variables in the table (e.g. "numeric,integer,factor,factor,factor,numeric"). Variables that have integer or numeric classes will be treated as continuous variables, while variables that have a factor class will be treated as categorical variables.
#
#
# Example input dataset ("pcs" will be treated as the outcome variable):
#   
#   pcs     gender  race    age	    brainrt_yn  neckrt_yn
#   39.04   Male    White   50+     1           1
#   39.55   Female  White   50+     0           0
#   57.54   Female  Other   40-49   1           0
#   32.26   Male    Other   50+     0           0
#   ...
#

#Parse input arguments
args <- commandArgs(trailingOnly = T)
if (length(args) != 2){
  stop("Usage: Rscript regression.R <regression type> <variable classes> < input")
}
regressionType <- args[1]
variableClasses <- strsplit(args[2], split = ",")[[1]]

#Read in input data
con <- file("stdin","r")
dat <- read.table(con, header = T, sep = "\t", quote = "", colClasses = variableClasses, stringsAsFactors = F, check.names = F)

#Perform regression analysis
names(dat) <- paste(names(dat), "___", sep = "")
outcomeVar <- names(dat)[1]
independentVars <- names(dat)[-1]
model <- as.formula(paste(sprintf("`%s`", outcomeVar), paste(sprintf("`%s`", independentVars), collapse = " + "), sep = " ~ "))
if(regressionType == "linear"){
  res <- glm(model, data = dat)
  out <- cbind("beta" = coef(res), suppressMessages(confint(res)), "pvalue" = summary(res)$coefficients[,4])
} else if (regressionType == "logistic"){
  if(!is.factor(dat[,outcomeVar]) | nlevels(dat[,outcomeVar]) != 2){
    stop("outcome is not a binary categorical variable")
  }
  res <- glm(model, family=binomial(link='logit'), data = dat)
  out <- cbind("or" = exp(coef(res)), exp(suppressMessages(confint(res))), "pvalue" = summary(res)$coefficients[,4])
} else{
  stop("regression type is not recognized")
}

#Round the beta/or and ci values to 3 decimal places 
out[,1:3] <- round(out[,1:3],3)
#Round the p-values to 4 significant digits
out[,4] <- signif(out[,4],4)

#Reformat results table
out <- as.data.frame(out)
names(out)[2:3] <- c("95% CI (low)","95% CI (high)")
out[,c("variable","category")] <- ""
var_and_cat <- strsplit(row.names(out), split = "___")
for(x in 1:length(var_and_cat)){
  out[x,"variable"] <- gsub("`","",var_and_cat[[x]][1])
  if(length(var_and_cat[[x]]) > 1){
    out[x,"category"] <- gsub("`","",var_and_cat[[x]][2])
  } else{
    out[x,"category"] <- ""
  }
}
out <- out[,c(5,6,1:4)]
row.names(out) <- 1:nrow(out)

#Output results
write.table(out, file = "", sep = "\t", quote = F, row.names = F)
close(con)
