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
#       "type": [string] regression type (e.g. "linear" or "logistic")
#       "outcome": {
#         "id": [string] variable id (e.g. "outcome")
#         "rtype": [string] R variable type (e.g. "numeric" or "factor")
#         "values": [array] data values
#         "refGrp": [string] reference group (required for factor variables)
#       }
#       "independent": [
#         {
#           "id": [string] variable id (e.g. "id0", "id1")
#           "rtype": [string] R variable type (e.g. "numeric" or "factor")
#           "values": [array] data values
#           "refGrp": [string] reference group (required for factor variables)
#           "interactions": [array] ids of interacting variables
#           "spline": {
#             "knots": [array] knot values
#             "plotfile": [string] output png file of spline plot
#           }
#           "scale": [number] scaling factor. All data values will be divided by this number (optional)
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
#       "residuals": {
#           "header": []
#           "rows": []
#       },
#       "coefficients": {
#           "header": []
#           "rows": []
#       },
#       "type3": {
#           "header": []
#           "rows": []
#       },
#       "other": {
#           "header": []
#           "rows": []
#       },
#       "plots": []
#     }


###########
# Code
###########

# TODO: warning/error using these conditions: outcome = blood pressure; independent variables= age at last sjlife assessment

library(jsonlite)


########## Functions ############

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

# function to generate cubic spline
# args: values = variable values; knots = knot values
cubic_spline <- function(values, knots) {
  nknots <- length(knots) # there will be (nknots-1) cubic spline functions
  f <- matrix(nrow = length(values), ncol = (nknots-1))
  f[,1] <- values
  for (j in 1:(nknots-2)) {
    for (i in 1:length(values)) {
      f[i,(j+1)] <- max(0,(values[i]-knots[j])^3)-max(0,(values[i]-knots[nknots-1])^3)*(knots[nknots]-knots[j])/(knots[nknots]-knots[nknots-1])+
        max(0,(values[i]-knots[nknots])^3)*(knots[nknots-1]-knots[j])/(knots[nknots]-knots[nknots-1])
    }
  }
  return(f)
}

# function to plot spline regression
plot_spline <- function(splineTerm, lst, dat, res) {
  ## prepare test data
  sampleSize <- 1000
  # newdat: test data table for predicting model outcome values
  # columns are all independent variables
  # for spline variables, use regularly spaced data; for continuous variables, use data median; for categorical variables, use reference category
  newdat <- dat[1:sampleSize, -1, drop = F]
  # newdat2: test data table for adjusting model outcome values
  # columns are the proportions and effect sizes of non-reference categorical coefficients 
  newdat2 <- matrix(data = NA, nrow = 0, ncol = 2, dimnames = list(c(),c("prop", "effectSize")))
  # populate the test data tables
  for (term in colnames(newdat)) {
    if (term == splineTerm$id) {
      newdat[,term] <- seq(from = min(dat[,term]), to = max(dat[,term]), length.out = sampleSize)
    } else if (is.factor(dat[,term])) {
      ref <- levels(dat[,term])[1]
      newdat[,term] <- ref
      props <- table(dat[,term], exclude = ref)/length(dat[,term])
      for (category in names(props)) {
        newdat2 <- rbind(newdat2, c(props[category], res$coefficients[paste0(term,category)]))
      }
    } else {
      newdat[,term] <- median(dat[,term])
    }
  }
  
  ## test model
  # predict outcome values of the model using the test data
  preddat <- predict(res, newdata = newdat, se.fit = T)
  # compute 95% confidence intervals
  ci_upr <- preddat$fit + (1.96 * preddat$se.fit)
  ci_lwr <- preddat$fit - (1.96 * preddat$se.fit)
  preddat_ci <- cbind("fit" = preddat$fit, "lwr" = ci_lwr, "upr" = ci_upr)
  # adjust the predicted values 
  # adjusted predicted values = predicted values + ((prop category A * coef category A) + (prop category B * coef category B) + etc.)
  preddat_ci_adj <- preddat_ci + sum(apply(newdat2, 1, prod))
  
  ## plot data
  if (lst$type == "linear") {
    pointtype <- 16
    pointsize <- 0.3
  } else {
    # for logistic regression, plot predicted probabilities
    preddat_ci_adj <- 1/(1+exp(-preddat_ci_adj))
    pointtype <- 124
    pointsize <- 0.7
  }
  plotfile <- splineTerm$spline$plotfile
  #png(filename = plotfile, width = 1100, height = 650, res = 200)
  png(filename = plotfile, width = 950, height = 550, res = 200)
  par(mar = c(3, 2.5, 1, 5), mgp = c(1, 0.5, 0), xpd = T)
  # plot coordinate space
  plot(dat[,splineTerm$id],
       dat[,"outcome"],
       cex.axis = 0.5,
       ann = F,
       type = "n"
  )
  # axis titles
  title(xlab = splineTerm$name,
        ylab = lst$outcome$name,
        line = 1.5,
        cex.lab = 0.5
  )
  # knots
  abline(v = splineTerm$spline$knots,
         col = "grey60",
         lty = 2,
         lwd = 0.8,
         xpd = F
  )
  # spline term vs. outcome term actual data
  points(dat[,splineTerm$id],
         dat[,"outcome"],
         pch = pointtype,
         cex = pointsize
  )
  # confidence intervals of regression line
  polygon(x = c(newdat[,splineTerm$id], rev(newdat[,splineTerm$id])),
          y = c(preddat_ci_adj[,"lwr"], rev(preddat_ci_adj[,"upr"])),
          col = adjustcolor("grey", alpha.f = 0.8),
          border = NA
  )
  # regression line
  lines(newdat[,splineTerm$id],
        preddat_ci_adj[,"fit"],
        col = "red",
        lwd = 2
  )
  # legend for lines
  legend("topright",
         cex = 0.5,
         inset = c(-0.3, 0.1),
         legend = c("knots", "cubic spline fit", "95% CI"),
         text.col = "white",
         lty = c(2, 1, NA),
         col = c("grey60", "red", NA)
  )
  # legend for ci
  legend("topright",
         cex = 0.5,
         inset = c(-0.3, 0.1),
         legend = c("knots", "cubic spline fit", "95% CI"),
         text.col = "black",
         bty = "n",
         fill = c(NA, NA, adjustcolor("grey", alpha.f = 0.8)),
         border = c(NA, NA, NA)
  )
  dev.off()
  return(plotfile)
}


######## Data preparation ##########

args <- commandArgs(trailingOnly = T)
if (length(args) != 0) stop("Usage: Rscript regression.R < jsonIn > jsonOut")

# read in json input
con <- file("stdin","r")
lst <- stream_in(con, verbose = F, simplifyVector = T, simplifyDataFrame = F, simplifyMatrix = F)
if (length(lst) != 1) stop("input json does not have 1 record")
lst <- lst[[1]]

# build data table
# first column is outcome variable, rest of columns are independent variables
# assign variable types, reference groups and scale values (if applicable)
dat <- as.data.frame(matrix(data = NA, nrow = length(lst$outcome$values), ncol = length(lst$independent) + 1))
colnames(dat)[1] <- lst$outcome$id
dat[,1] <- lst$outcome$values
for (i in 2:ncol(dat)) {
  term <- lst$independent[[i - 1]]
  colnames(dat)[i] <- term$id
  if (term$rtype == "numeric") {
    # numeric variable
    if ("scale" %in% names(term)) {
      dat[,i] <- term$values/term$scale
    } else {
      dat[,i] <- term$values
    }
  } else if (term$rtype == "factor") {
    # factor variable
    dat[,i] <- relevel(factor(term$values), ref = term$refGrp)
  } else {
    stop(paste0("term rtype '", term$rtype, "' is not recognized"))
  }
}

# build formula of regression model
# TODO: do we need to account for interaction with a spline term?
outcomeTerm <- "outcome"
independentTerms <- vector(mode = "character")
splineTerms <- list()
for (i in 1:length(lst$independent)) {
  term <- lst$independent[[i]]
  if ("spline" %in% names(term)) {
    splineTerms[[length(splineTerms) + 1]] <- term
    splineCmd <- paste0("cubic_spline(", term$id, ", ", paste0("c(", paste(term$spline$knots,collapse = ","), ")"), ")")
    independentTerms <- c(independentTerms, splineCmd)
  } else {
    independentTerms <- c(independentTerms, term$id)
  }
  for (intTerm in term$interactions) {
    # get unique set of interactions
    int1 <- paste(term$id, intTerm, sep = ":")
    int2 <- paste(intTerm, term$id, sep = ":")
    if (!(int1 %in% independentTerms) & !(int2 %in% independentTerms)) {
      independentTerms <- c(independentTerms, int1)
    }
  }
}

mod <- as.formula(paste(outcomeTerm, paste(independentTerms, collapse = "+"), sep = "~"))


########## Regression analysis ###########

plots <- vector(mode = "character")
if (lst$type == "linear"){
  # linear regression
  if (!is.numeric(dat$outcome)){
    stop("linear regression requires a numeric outcome variable")
  }
  # fit linear model
  res <- lm(mod, data = dat)
  if (length(splineTerms) > 0) {
    # model contains spline term(s)
    # plot spline regression for each spline term
    for (term in splineTerms) {
      plotfile <- plot_spline(term, lst, dat, res)
      plots <- c(plots, plotfile)
    }
  }
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
    "header" = c("Residual standard error", "Residual degrees of freedom", "R-squared", "Adjusted R-squared", "F-statistic", "P-value"),
    "rows" = c(round(res_summ$sigma, 2), round(res$df.residual, 0), round(res_summ$r.squared, 5), round(res_summ$adj.r.squared, 5), round(unname(res_summ$fstatistic[1]), 2), signif(unname(pf(res_summ$fstatistic[1], res_summ$fstatistic[2], res_summ$fstatistic[3], lower.tail = F)), 4))
    )
} else if (lst$type == "logistic"){
  # logistic regression
  if (length(unique(dat$outcome)) != 2){
    stop("outcome variable is not binary")
  }
  # fit logistic model
  res <- glm(mod, family = binomial(link='logit'), data = dat)
  if (length(splineTerms) > 0) {
    # model contains spline term(s)
    # plot spline regression for each spline term
    for (term in splineTerms) {
      plotfile <- plot_spline(term, lst, dat, res)
      plots <- c(plots, plotfile)
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
  typeIII_table <- as.matrix(drop1(res, scope = ~., test = "LRT"))
  typeIII_table[,c("Deviance","AIC")] <- round(typeIII_table[,c("Deviance","AIC")], 1)
  typeIII_table[,"LRT"] <- round(typeIII_table[,"LRT"], 3)
  typeIII_table[,"Pr(>Chi)"] <- signif(typeIII_table[,"Pr(>Chi)"], 4)
  # prepare other summary stats table
  other_table <- list(
    "header" = c("Dispersion parameter", "Null deviance", "Null deviance degrees of freedom", "Residual deviance", "Residual deviance degrees of freedom", "AIC"),
    "rows" = round(c(res_summ$dispersion, res_summ$null.deviance, res_summ$df.null, res_summ$deviance, res_summ$df.residual, res_summ$aic), 1)
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
    if (grepl("^cubic_spline", v)) {
      # spline variable
      vid <- sub("cubic_spline\\(", "", sub(", c\\(.*", "", v))
      clst <- paste("spline function", 1:ncol(res$model[,v])) # determine the number of spline functions
      for (c in clst) {
        vCol <- c(vCol, vid)
        cCol <- c(cCol, c)
      }
    } else if (v %in% names(res$xlevels)) {
      # categorical variable
      clst <- res$xlevels[[v]][-1] # extract non-ref categories
      for (c in clst) {
        vCol <- c(vCol, v)
        cCol <- c(cCol, c)
      }
    } else {
      # continuous variable
      vCol <- c(vCol, v)
      cCol <- c(cCol, "")
    }
  }
}
coefficients_table <- cbind("Variable" = vCol, "Category" = cCol, coefficients_table)
coefficients_table <- list("header" = colnames(coefficients_table), "rows" = coefficients_table)

# reformat the type III statistics table
# add a variable column
typeIII_table <- cbind("Variable" = sub("cubic_spline\\(", "", sub(", c\\(.*", "", row.names(typeIII_table))), typeIII_table)
typeIII_table <- list("header" = colnames(typeIII_table), "rows" = typeIII_table)


########## Export regression results ############

# combine the results tables into a list
out_lst <- list("residuals" = residuals_table, "coefficients" = coefficients_table, "type3" = typeIII_table, "other" = other_table)

if (length(plots) > 0) {
  out_lst[["plots"]] <- plots
}

if (length(warnings()) > 0) {
  warnings_table <- capture.output(summary(warnings()))
  out_lst[["warnings"]] <- warnings_table
}

# convert to json
out_json <- toJSON(out_lst, digits = NA, na = "string")

# output json to stdout
cat(out_json, file = "", sep = "")

close(con)
