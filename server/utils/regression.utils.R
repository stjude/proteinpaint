########################
# REGRESSION UTILITIES #
########################

####################
# LIST OF FUNCTIONS
####################

# prepareDataTable
# cubic_spline
# buildFormulas
# linearRegression
# logisticRegression
# coxRegression
# runRegression
# plot_spline
# build_coef_table
# formatCoefficients
# formatType3


#######
# CODE 
#######

# prepare data table
#   - set variable types and reference groups
#   - scale values (if applicable)
#   - validate data values
prepareDataTable <- function(dat, variables, regtype) {
  variables$toSkip <- vector(mode = "logical", length = nrow(variables))
  for (r in 1:nrow(variables)) {
    variable <- variables[r,]
    id <- variable$id
    if (variable$type == "outcome") {
      # outcome variable
      if (regtype == "logistic") {
        vals <- unique(dat[,id])
        if (!(length(vals) == 2 & all(c(0,1) %in% vals))) stop("outcome variable is not 0/1 binary")
      }
      if (regtype == "cox") {
        eventId <- variable$timeToEvent$eventId
        vals <- unique(dat[,eventId])
        if (!(length(vals) == 2 & all(c(0,1) %in% vals))) stop("outcome event variable is not 0/1 binary")
      }
    }
    if (variable$rtype == "numeric") {
      # numeric variable
      if ("scale" %in% colnames(variable)) {
        # scale variable values
        if (!is.na(variable$scale)) dat[,id] <- dat[,id]/variable$scale
      }
    } else if (variable$rtype == "factor") {
      # factor variable
      dat[,id] <- factor(dat[,id])
      if (length(levels(dat[,id])) < 2) {
        # factor variables with < 2 categories will
        # be skipped when building formula
        variables[r,"toSkip"] <- TRUE
        next
      }
      if (!(variable$refGrp %in% levels(dat[,id]))) stop(paste0("refGrp of '",variable$id,"' not found in data values"))
      dat[,id] <- relevel(dat[,id], ref = variable$refGrp)
    } else {
      stop(paste0("variable rtype '",variable$rtype,"' is not recognized"))
    }
  }
  return(list(dat = dat, variables = variables))
}

# compute cubic spline
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

# build formulas
buildFormulas <- function(variables) {
  # first collect outcome, independent, spline, and interacting
  # variables and format them for formula construction
  # set aside snplocus snps to be handled separately
  outcomeIds <- vector(mode = "character") # ids of outcome variables
  outcome <- vector(mode = "character") # ids of outcome variables formatted for formula
  independentIds <- vector(mode = "character") # ids of independent variables
  independents <- vector(mode = "character") # ids of independent variables formatted for formula
  interactions <- vector(mode = "character") # ids of interacting variables formatted for formula
  snpLocusSnps <- variables[0,]
  splineVariables <- variables[0,]
  for (r in 1:nrow(variables)) {
    variable <- variables[r,]
    if (variable$toSkip) {
      next
    }
    if (variable$type == "outcome") {
      # outcome variable
      if ("timeToEvent" %in% names(variable)) {
        # cox outcome variable
        # time-to-event data
        outcomeEventId <- variable$timeToEvent$eventId
        if (variable$timeToEvent$timeScale == "year") {
          outcomeTimeId <- variable$timeToEvent$timeId
          outcome <- paste0("Surv(",outcomeTimeId,", ",outcomeEventId,")")
          outcomeIds <- c(outcomeIds, outcomeTimeId, outcomeEventId)
        } else if (variable$timeToEvent$timeScale == "age") {
          outcomeAgeStartId <- variable$timeToEvent$agestartId
          outcomeAgeEndId <- variable$timeToEvent$ageendId
          outcome <- paste0("Surv(",outcomeAgeStartId,", ",outcomeAgeEndId,", ",outcomeEventId,")")
          outcomeIds <- c(outcomeIds, outcomeAgeStartId, outcomeAgeEndId, outcomeEventId)
        } else {
          stop ("unknown cox regression time scale")
        }
      } else {
        outcome <- variable$id
        outcomeIds <- c(outcomeIds, variable$id)
      }
      next
    } else if (variable$type == "spline") {
      # cubic spline variable
      # use call to cubic spline function in regression formula
      independentIds <- c(independentIds, variable$id)
      splineCmd <- paste0("cubic_spline(", variable$id, ", ", paste0("c(", paste(variable$spline$knots[[1]],collapse = ","), ")"), ")")
      independents <- c(independents, splineCmd)
      splineVariables <- rbind(splineVariables, variable)
    } else if (variable$type == "snplocus") {
      # snplocus snp
      # set aside so that separate formulas can be made for each snplocus snp
      snpLocusSnps <- rbind(snpLocusSnps, variable)
      next
    } else {
      # other independent variable
      independentIds <- c(independentIds, variable$id)
      independents <- c(independents, variable$id)
    }
    if (length(variable$interactions[[1]]) > 0) {
      # interactions
      if (variable$type == "spline") stop("interactions not allowed with spline variable")
      interactionIds <- variable$interactions[[1]]
      for (intId in interactionIds) {
        # get unique set of interactions
        int1 <- paste(variable$id, intId, sep = ":")
        int2 <- paste(intId, variable$id, sep = ":")
        if (!(int1 %in% interactions) & !(int2 %in% interactions)) {
          interactions <- c(interactions, int1)
        }
      }
    }
  }
  
  # combine variables into formula(s)
  # if snplocus snps are present, then prepare a
  # separate formula for each snplocus snp
  formulas <- list()
  if (nrow(snpLocusSnps) > 0) {
    # snplocus snps present
    # build separate formula for each snplocus snp
    tempIndependentIds <- vector(mode = "character")
    tempIndependents <- vector(mode = "character")
    tempInteractions <- vector(mode = "character")
    for (r in 1:nrow(snpLocusSnps)) {
      snp <- snpLocusSnps[r,]
      tempIndependentIds <- c(independentIds, snp$id)
      tempIndependents <- c(independents, snp$id)
      if (length(snp$interactions[[1]]) > 0) {
        # interactions
        interactionIds <- snp$interactions[[1]]
        for (intId in interactionIds) {
          # get unique set of interactions
          int1 <- paste(snp$id, intId, sep = ":")
          int2 <- paste(intId, snp$id, sep = ":")
          if (!(int1 %in% interactions) & !(int2 %in% interactions)) {
            tempInteractions <- c(interactions, int1)
          }
        }
      }
      formula <- as.formula(paste(outcome, paste(c(tempIndependents, tempInteractions), collapse = "+"), sep = "~"))
      entry <- length(formulas) + 1
      formulas[[entry]] <- list("id" = snp$id, "formula" = formula, "outcomeIds" = outcomeIds, "independentIds" = tempIndependentIds)
      if (nrow(splineVariables) > 0) {
        formulas[[entry]][["splineVariables"]] = splineVariables
      }
    }
  } else {
    # no snplocus snps
    # use single formula for all variables
    formula <- as.formula(paste(outcome, paste(c(independents, interactions), collapse = "+"), sep = "~"))
    formulas[[1]] <- list("id" = "", "formula" = formula, "outcomeIds" = outcomeIds, "independentIds" = independentIds)
    if (nrow(splineVariables) > 0) {
      formulas[[1]][["splineVariables"]] = splineVariables
    }
  }
  return(formulas)
}

# linear regression
linearRegression <- function(formula, fdat) {
  res <- lm(formula$formula, data = fdat)
  sampleSize <- res$df.residual + length(res$coefficients[!is.na(res$coefficients)])
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
  type3_table <- as.matrix(drop1(res, scope = ~., test = "F"))
  type3_table[,c("Sum of Sq","RSS","AIC")] <- round(type3_table[,c("Sum of Sq","RSS","AIC")], 1)
  type3_table[,"F value"] <- round(type3_table[,"F value"], 3)
  type3_table[,"Pr(>F)"] <- signif(type3_table[,"Pr(>F)"], 4)
  # prepare other summary stats table
  other_table <- list(
    "header" = c("Residual standard error", "Residual degrees of freedom", "R-squared", "Adjusted R-squared", "F-statistic", "P-value"),
    "rows" = c(round(res_summ$sigma, 2), round(res$df.residual, 0), round(res_summ$r.squared, 5), round(res_summ$adj.r.squared, 5))
  )
  # check for F-statistic
  # this statistic is not computed if variables have no variability
  if ("fstatistic" %in% names(res_summ)) {
    other_table[["rows"]] <- c(other_table[["rows"]], round(unname(res_summ$fstatistic[1]), 2), signif(unname(pf(res_summ$fstatistic[1], res_summ$fstatistic[2], res_summ$fstatistic[3], lower.tail = F)), 4))
  } else {
    other_table[["rows"]] <- c(other_table[["rows"]], NA, NA)
  }
  # export the results tables
  out <- list("res" = res, "sampleSize" = unbox(sampleSize), "residuals" = residuals_table, "coefficients" = coefficients_table, "type3" = type3_table, "other" = other_table)
  return(out)
}

# logistic regression
logisticRegression <- function(formula, fdat) {
  res <- glm(formula$formula, family = binomial(link='logit'), data = fdat)
  sampleSize <- res$df.residual + length(res$coefficients[!is.na(res$coefficients)])
  res_summ <- summary(res)
  # prepare residuals table
  residuals_table <- list("header" = c("Minimum","1st quartile","Median","3rd quartile","Maximum"), "rows" = unname(round(fivenum(res_summ$deviance.resid),3)))
  # prepare coefficients table
  coefficients_table <- build_coef_table(res_summ)
  colnames(coefficients_table)[1] <- "Log odds"
  # compute odds ratio
  coefficients_table <- cbind("Odds ratio" = exp(coef(res)), coefficients_table)
  # compute confidence intervals of odds ratios
  ci <- try(exp(suppressMessages(confint(res))), silent = T)
  if (identical(class(ci), "try-error")) {
    # confidence interval computation failed
    # likely because of small sample sizes of coefficients.
    # use custom confidence interval computation instead
    low <- coefficients_table[,"Log odds"] - (1.96 * coefficients_table[,"Std. Error"])
    up <- coefficients_table[,"Log odds"] + (1.96 * coefficients_table[,"Std. Error"])
    ci <- cbind(low,up)
    row.names(ci) <- row.names(coefficients_table)
    ci <- exp(ci)
  }
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

# cox regression
coxRegression <- function(formula, fdat) {  
  res <- coxph(formula$formula, data = fdat)
  
  # extract summary object
  res_summ <- summary(res)
  
  # numbers of samples and events
  sampleSize <- res_summ$n
  eventCnt <- res_summ$nevent
  
  # coefficients table
  coefficients_table <- res_summ$coefficients
  # add in confidence intervals
  confint_table <- res_summ$conf.int
  coefficients_table <- cbind(coefficients_table, confint_table[, c("lower .95", "upper .95"), drop = F])
  # rename and reorder columns
  colnames(coefficients_table)[colnames(coefficients_table) == "coef"] <- "Beta"
  colnames(coefficients_table)[colnames(coefficients_table) == "exp(coef)"] <- "HR"
  colnames(coefficients_table)[colnames(coefficients_table) == "se(coef)"] <- "Std. Error"
  colnames(coefficients_table)[colnames(coefficients_table) == "lower .95"] <- "95% CI (low)"
  colnames(coefficients_table)[colnames(coefficients_table) == "upper .95"] <- "95% CI (high)"
  coefficients_table <- coefficients_table[, c(2,6,7,1,3,4,5), drop = F]
  
  # type III statistics table
  type3_table <- as.matrix(drop1(res, scope = ~., test = "Chisq"))
  type3_table[,"AIC"] <- round(type3_table[,"AIC"], 1)
  type3_table[,"LRT"] <- round(type3_table[,"LRT"], 3)
  type3_table[,"Pr(>Chi)"] <- signif(type3_table[,"Pr(>Chi)"], 4)
  
  # statistical tests table
  tests_table <- rbind(res_summ$logtest, res_summ$waldtest, res_summ$sctest)
  colnames(tests_table) <- c("Test statistic", "Df", "P-value")
  tests_table[,"Test statistic"] <- round(tests_table[,"Test statistic"], 2)
  tests_table[,"Df"] <- round(tests_table[,"Df"], 0)
  tests_table[,"P-value"] <- signif(tests_table[,"P-value"], 4)
  tests_table <- cbind("Test" = c("Likelihood ratio test", "Wald test", "Score (log rank) test"), tests_table)
  tests_table <- list("header" = colnames(tests_table), "rows" = tests_table)
  
  # other summary stats table
  other_table <- list(
    "header" = c("Concordance", "Concordance standard error"),
    "rows" = c(unname(round(res_summ$concordance["C"], 3)), unname(round(res_summ$concordance["se(C)"], 3)))
  )
  
  # export the results tables
  out <- list("res" = res, "sampleSize" = unbox(sampleSize), "eventCnt" = unbox(eventCnt),"coefficients" = coefficients_table, "type3" = type3_table, "tests" = tests_table, "other" = other_table)
  return(out)
}

# run regression analysis
runRegression <- function(regtype, formula, fdat, outcome) {
  warns <- vector(mode = "character")
  handleWarns <- function(w) {
    # handler for warning messages
    warns <<- c(warns, conditionMessage(w))
    invokeRestart("muffleWarning")
  }
  if (regtype == "linear") {
    results <- withCallingHandlers(linearRegression(formula, fdat), warning = handleWarns)
  } else if (regtype == "logistic") {
    results <- withCallingHandlers(logisticRegression(formula, fdat), warning = handleWarns)
  } else if (regtype == "cox") {
    results <- withCallingHandlers(coxRegression(formula, fdat), warning = handleWarns)
  } else {
    stop("unknown regression type")
  }
  if ("splineVariables" %in% names(formula)) {
    # spline variables present
    # plot cubic spline for each spline variable
    # do not plot if variable is missing plot file (to hide plot
    # when snplocus terms are present)
    splineVariables <- formula$splineVariables
    for (r in 1:nrow(splineVariables)) {
      splineVariable <- splineVariables[r,]
      if ("plotfile" %in% names(splineVariable$spline)) {
        plot_spline(splineVariable, fdat, outcome, results$res, regtype)
      }
    }
  }
  if (length(warns) > 0) results[["warnings"]] <- warns
  return(results)
}

# generate cubic spline plot spline
plot_spline <- function(splineVariable, fdat, outcome, res, regtype) {
  ## prepare test data
  sampleSize <- 1000
  # newdat: test data table for predicting model outcome values
  # columns are all independent variables
  # for spline variables, use regularly spaced data; for continuous variables, use data median; for categorical variables, use reference category
  newdat <- fdat[1:sampleSize, -1, drop = F]
  # newdat2: test data table for adjusting model outcome values
  # columns are the proportions and effect sizes of non-reference categorical coefficients 
  newdat2 <- matrix(data = NA, nrow = 0, ncol = 2, dimnames = list(c(),c("prop", "effectSize")))
  # populate the test data tables
  for (term in colnames(newdat)) {
    if (term == splineVariable$id) {
      newdat[,term] <- seq(from = min(fdat[,term]), to = max(fdat[,term]), length.out = sampleSize)
    } else if (is.factor(fdat[,term])) {
      ref <- levels(fdat[,term])[1]
      newdat[,term] <- ref
      props <- table(fdat[,term], exclude = ref)/length(fdat[,term])
      for (category in names(props)) {
        newdat2 <- rbind(newdat2, c(props[category], res$coefficients[paste0(term,category)]))
      }
    } else {
      newdat[,term] <- median(fdat[,term])
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
  if (regtype == "linear") {
    pointtype <- 16
    pointsize <- 0.3
    ylab <- outcome$name
  } else {
    # for logistic regression, plot predicted probabilities
    preddat_ci_adj <- 1/(1+exp(-preddat_ci_adj))
    pointtype <- 124
    pointsize <- 0.7
    ylab <- paste0("Pr(", outcome$name, " ", outcome$categories$nonref, ")")
  }
  plotfile <- splineVariable$spline$plotfile
  png(filename = plotfile, width = 950, height = 550, res = 200)
  par(mar = c(3, 2.5, 1, 5), mgp = c(1, 0.5, 0), xpd = T)
  # plot coordinate space
  plot(fdat[,splineVariable$id],
       fdat[,outcome$id],
       cex.axis = 0.5,
       ann = F,
       type = "n"
  )
  # axis titles
  title(xlab = splineVariable$name,
        ylab = ylab,
        line = 1.5,
        cex.lab = 0.5
  )
  # knots
  abline(v = splineVariable$spline$knots[[1]],
         col = "grey60",
         lty = 2,
         lwd = 0.8,
         xpd = F
  )
  # spline term vs. outcome term actual data
  points(fdat[,splineVariable$id],
         fdat[,outcome$id],
         pch = pointtype,
         cex = pointsize
  )
  # confidence intervals of regression line
  polygon(x = c(newdat[,splineVariable$id], rev(newdat[,splineVariable$id])),
          y = c(preddat_ci_adj[,"lwr"], rev(preddat_ci_adj[,"upr"])),
          col = adjustcolor("grey", alpha.f = 0.8),
          border = NA
  )
  # regression line
  lines(newdat[,splineVariable$id],
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
}

# build coefficients table
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

# reformat the coefficients table
formatCoefficients <- function(coefficients_table, res, regtype) {
  # round all columns to 4 significant digits
  coefficients_table <- signif(coefficients_table, 4)
  # add variable and category columns
  if (regtype == "cox") {
    vCol <- vector(mode = "character")
    cCol <- vector(mode = "character")
  } else {
    vCol <- c("Intercept")
    cCol <- c("")
  }
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
  return(coefficients_table)
}

# reformat the type III statistics table
formatType3 <- function(type3_table) {
  # add a variable column
  type3_table <- cbind("Variable" = sub("cubic_spline\\(", "", sub(", c\\(.*", "", row.names(type3_table))), type3_table)
  type3_table <- list("header" = colnames(type3_table), "rows" = type3_table)
  return(type3_table)
}