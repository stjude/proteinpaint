#######################
# Regression analysis
#######################

# Usage: Rscript regression.R <linear/logistic> < input
#   input: tab-delimited table of regression variables streamed from stdin
#     - First line must be a header (i.e. column names).
#     - First column must be the outcome variable. All other columns are independent variables. All variables in table are included in the regression analysis.
#     - For categorical variables, use either string values or 0/1 values.
#   <linear/logistic>: string indicating regression type
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
# Linear regression should be performed if the outcome is a continuous numeric cvariable and logistic regression should be performed if the outcome is a categorical variable. Currently, the only categorical outcome variables that are supported are binary variables (e.g. "no/yes", "no condition/condition", "0/1").


#Read in input data
con <- file("stdin","r")
dat <- read.table(con, header = T, sep = "\t", quote = "", stringsAsFactors = T)
args <- commandArgs(trailingOnly = T)
if (length(args) != 1){
  stop("Usage: Rscript regression.R <linear/logistic> < input")
}
regressionType <- args[1]

#Set variables with binary 0/1 values as categorical variables
for(column in 1:ncol(dat)){
  if(all(dat[,column] == 0 | dat[,column] == 1 | is.na(dat[,column]))){
    dat[,column] <- factor(dat[,column], levels = c(0,1))
  }
}

#Perform regression analysis
names(dat) <- paste(names(dat), "___", sep = "")
outcomeVar <- names(dat)[1]
independentVars <- names(dat)[-1]
model <- as.formula(paste(outcomeVar, paste(independentVars, collapse = " + "), sep = " ~ "))
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
names(out)[2:3] <- c("ci_low","ci_high")
out[,c("variable","category")] <- ""
var_and_cat <- strsplit(row.names(out), split = "___")
for(x in 1:length(var_and_cat)){
  out[x,"variable"] <- var_and_cat[[x]][1]
  if(length(var_and_cat[[x]]) > 1){
    out[x,"category"] <- var_and_cat[[x]][2]
  } else{
    out[x,"category"] <- ""
  }
}
out <- out[,c(5,6,1:4)]
row.names(out) <- 1:nrow(out)

#Output results
write.table(out, file = "", sep = "\t", quote = F, row.names = F)
close(con)
