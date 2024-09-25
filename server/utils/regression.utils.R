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
prepareDataTable <- function(dat, independent) {
  for (r in 1:nrow(independent)) {
    variable <- independent[r,]
    id <- variable$id
    if (variable$rtype == "factor") {
      # factor variable
      # assign reference group
      dat[,id] <- factor(dat[,id])
      dat[,id] <- relevel(dat[,id], ref = variable$refGrp)
    }
  }
  return(dat)
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
buildFormulas <- function(outcome, independent, includeUnivariate) {
  # first, format variables for building formulas
  
  # declare new objects
  formula_outcome <- vector(mode = "character") # outcome variables formatted for formula
  formula_independent <- vector(mode = "character") # independent variables formatted for formula
  formula_interaction <- vector(mode = "character") # interacting variables formatted for formula
  snpLocusSnps <- independent[0,] # snplocus snps
  splineVariables <- independent[0,] # spline variables
  
  # outcome variable
  if ("timeToEvent" %in% names(outcome)) {
    # cox outcome variable
    # time-to-event data
    outcomeEventId <- outcome$timeToEvent$eventId
    if (outcome$timeToEvent$timeScale == "time") {
      outcomeTimeId <- outcome$timeToEvent$timeId
      formula_outcome <- paste0("Surv(",outcomeTimeId,", ",outcomeEventId,")")
    } else if (outcome$timeToEvent$timeScale == "age") {
      outcomeAgeStartId <- outcome$timeToEvent$agestartId
      outcomeAgeEndId <- outcome$timeToEvent$ageendId
      formula_outcome <- paste0("Surv(",outcomeAgeStartId,", ",outcomeAgeEndId,", ",outcomeEventId,")")
    } else {
      stop ("unknown cox regression time scale")
    }
  } else {
    # other outcome variable
    formula_outcome <- outcome$id
  }
  
  # independent variables
  for (r in 1:nrow(independent)) {
    variable <- independent[r,]
    if (variable$type == "spline") {
      # cubic spline variable
      # use call to cubic spline function in regression formula
      splineCmd <- paste0("cubic_spline(", variable$id, ", ", paste0("c(", paste(variable$spline$knots[[1]],collapse = ","), ")"), ")")
      formula_independent <- c(formula_independent, splineCmd)
      splineVariables <- rbind(splineVariables, variable)
    } else if (variable$type == "snplocus") {
      # snplocus snp
      # set aside so that separate formulas can be made for each snplocus snp
      snpLocusSnps <- rbind(snpLocusSnps, variable)
      next
    } else {
      # other independent variable
      formula_independent <- c(formula_independent, variable$id)
    }
    if ("interactions" %in% names(variable) & length(variable$interactions[[1]]) > 0) {
      # interactions
      if (variable$type == "spline") stop("interactions not allowed with spline variable")
      interactionIds <- variable$interactions[[1]]
      for (intId in interactionIds) {
        # get unique set of interactions
        int1 <- paste(variable$id, intId, sep = ":")
        int2 <- paste(intId, variable$id, sep = ":")
        if (!(int1 %in% formula_interaction) & !(int2 %in% formula_interaction)) {
          formula_interaction <- c(formula_interaction, int1)
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
    for (r in 1:nrow(snpLocusSnps)) {
      temp_formula_independent <- formula_independent
      temp_formula_interaction <- formula_interaction
      snp <- snpLocusSnps[r,]
      temp_formula_independent <- c(temp_formula_independent, snp$id)
      if ("interactions" %in% names(snp) & length(snp$interactions[[1]]) > 0) {
        # interactions
        interactionIds <- snp$interactions[[1]]
        for (intId in interactionIds) {
          # get unique set of interactions
          int1 <- paste(snp$id, intId, sep = ":")
          int2 <- paste(intId, snp$id, sep = ":")
          if (!(int1 %in% temp_formula_interaction) & !(int2 %in% temp_formula_interaction)) {
            temp_formula_interaction <- c(temp_formula_interaction, int1)
          }
        }
      }
      formula <- as.formula(paste(formula_outcome, paste(c(temp_formula_independent, temp_formula_interaction), collapse = "+"), sep = "~"))
      entry <- length(formulas) + 1
      formulas[[entry]] <- list("id" = snp$id, "formula" = formula)
      if (nrow(splineVariables) > 0) {
        formulas[[entry]][["splineVariables"]] = splineVariables
      }
    }
  } else {
    # no snplocus snps
    if (isTRUE(includeUnivariate)) {
      # include univariate formulas along with the multivariate formula
      if (length(formula_independent) < 2) stop("must have multiple covariates to build multivariate and univariate formulas")
      if (length(formula_interaction) > 0) stop("interactions not supported in univariate models")
      formula <- as.formula(paste(formula_outcome, paste(formula_independent, collapse = "+"), sep = "~"))
      formulas[[1]] <- list("id" = "", "type" = "multivariate", "formula" = formula)
      for (var in formula_independent) {
        formula <- as.formula(paste(formula_outcome, var, sep = "~"))
        formulas[[length(formulas) + 1]] <- list("id" = "", "type" = "univariate", "formula" = formula)
      }
    } else {
      # use single formula for all variables
      formula <- as.formula(paste(formula_outcome, paste(c(formula_independent, formula_interaction), collapse = "+"), sep = "~"))
      formulas[[1]] <- list("id" = "", "formula" = formula)
      if (nrow(splineVariables) > 0) {
        formulas[[1]][["splineVariables"]] = splineVariables
      }
    }
  }
  return(formulas)
}

# linear regression
linearRegression <- function(formula, dat) {
  res <- lm(formula$formula, data = dat)
  sampleSize <- res$df.residual + length(res$coefficients[!is.na(res$coefficients)])
  res_summ <- summary(res)
  
  # residuals table
  residuals_table <- list("header" = c("Minimum","1st quartile","Median","3rd quartile","Maximum"), "rows" = unname(round(fivenum(res_summ$residuals),3)))
  
  # coefficients table
  coefficients_table <- build_coef_table(res_summ)
  colnames(coefficients_table)[1] <- "Beta"
  # compute confidence intervals of beta values
  ci <- suppressMessages(confint(res))
  colnames(ci) <- c("95% CI (low)","95% CI (high)")
  coefficients_table <- cbind(coefficients_table, ci)
  coefficients_table <- coefficients_table[,c(1,5,6,2,3,4)]
  
  # type III statistics table
  type3_table <- as.matrix(drop1(res, scope = ~., test = "F"))
  # if there are interactions, then set the results
  # of the main effects to "NA" because these type III
  # stats cannot be accurately estimated
  ints <- grep(":", row.names(type3_table), value = T, fixed = T)
  intsIds <- unique(unlist(strsplit(ints, ":")))
  type3_table[intsIds,] <- NA
  # round values
  type3_table[,c("Sum of Sq","RSS","AIC")] <- round(type3_table[,c("Sum of Sq","RSS","AIC")], 1)
  type3_table[,"F value"] <- round(type3_table[,"F value"], 3)
  type3_table[,"Pr(>F)"] <- signif(type3_table[,"Pr(>F)"], 4)
  
  # total SNP effect table
  # if a snplocus snp has an interaction, then compute
  # the total effect of the snp on the model
  # by determining the combined effect of removing the
  # snp and all of its interactions from the model
  totalSnpEffect_table <- NULL
  if (formula$id != "" && length(ints) > 0 && any(grepl(formula$id, ints, fixed = T))) {
    snp_vars <- grep(formula$id, row.names(type3_table), value = T, fixed = T)
    formula_reduce <- update(formula$formula, paste0("~.",paste0("-", snp_vars, collapse = "")))
    res_reduce <- lm(formula_reduce, data = dat)
    totalSnpEffect_table <- as.matrix(anova(res, res_reduce, test = "F"))[2, c("Df","F","Pr(>F)"), drop = F]
    row.names(totalSnpEffect_table) <- "Total"
    totalSnpEffect_table[,"Df"] <- totalSnpEffect_table[,"Df"] * -1
    totalSnpEffect_table[,"F"] <- round(totalSnpEffect_table[,"F"], 3)
    totalSnpEffect_table[,"Pr(>F)"] <- signif(totalSnpEffect_table[,"Pr(>F)"], 4)
    totalSnpEffect_table <- cbind("Variable" = row.names(totalSnpEffect_table), totalSnpEffect_table, "VariableIDs" = paste(snp_vars, collapse = ";"))
    totalSnpEffect_table <- list("header" = colnames(totalSnpEffect_table), "rows" = totalSnpEffect_table)
  }
  
  # other summary stats table
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
  if (!is.null(totalSnpEffect_table)) out[["totalSnpEffect"]] <- totalSnpEffect_table
  return(out)
}

# logistic regression
logisticRegression <- function(formula, dat) {
  res <- glm(formula$formula, family = binomial(link='logit'), data = dat)
  sampleSize <- res$df.residual + length(res$coefficients[!is.na(res$coefficients)])
  res_summ <- summary(res)
  
  # residuals table
  residuals_table <- list("header" = c("Minimum","1st quartile","Median","3rd quartile","Maximum"), "rows" = unname(round(fivenum(res_summ$deviance.resid),3)))
  
  # coefficients table
  coefficients_table <- build_coef_table(res_summ)
  colnames(coefficients_table)[1] <- "Log odds"
  # compute odds ratio
  coefficients_table <- cbind("Odds ratio" = exp(coef(res)), coefficients_table)
  # compute confidence intervals of odds ratios
  ci <- tryCatch(
    exp(suppressMessages(confint(res))),
    error = function(err) {
      # computation of confidence intervals might fail
      # because of small sample sizes of coefficients.
      # use custom confidence interval computation instead
      low <- coefficients_table[,"Log odds"] - (1.96 * coefficients_table[,"Std. Error"])
      up <- coefficients_table[,"Log odds"] + (1.96 * coefficients_table[,"Std. Error"])
      ci <- cbind(low,up)
      row.names(ci) <- row.names(coefficients_table)
      ci <- exp(ci)
      return(ci)
    }
  )
  colnames(ci) <- c("95% CI (low)","95% CI (high)")
  coefficients_table <- cbind(coefficients_table, ci)
  coefficients_table <- coefficients_table[,c(1,6,7,2,3,4,5)]
  
  # type III statistics table
  type3_table <- as.matrix(drop1(res, scope = ~., test = "LRT"))
  # if there are interactions, then set the results
  # of the main effects to "NA" because these type III
  # stats cannot be accurately estimated
  ints <- grep(":", row.names(type3_table), value = T, fixed = T)
  intsIds <- unique(unlist(strsplit(ints, ":")))
  type3_table[intsIds,] <- NA
  # round values
  type3_table[,c("Deviance","AIC")] <- round(type3_table[,c("Deviance","AIC")], 1)
  type3_table[,"LRT"] <- round(type3_table[,"LRT"], 3)
  type3_table[,"Pr(>Chi)"] <- signif(type3_table[,"Pr(>Chi)"], 4)
  
  # total SNP effect table
  # if a snplocus snp has an interaction, then compute
  # the total effect of the snp on the model
  # by determining the combined effect of removing the
  # snp and all of its interactions from the model
  totalSnpEffect_table <- NULL
  if (formula$id != "" && length(ints) > 0 && any(grepl(formula$id, ints, fixed = T))) {
    snp_vars <- grep(formula$id, row.names(type3_table), value = T, fixed = T)
    formula_reduce <- update(formula$formula, paste0("~.",paste0("-", snp_vars, collapse = "")))
    res_reduce <- glm(formula_reduce, family = binomial(link='logit'), data = dat)
    totalSnpEffect_table <- as.matrix(lrtest(res, res_reduce))[2, 3:5, drop = F]
    row.names(totalSnpEffect_table) <- "Total"
    totalSnpEffect_table[,"Df"] <- totalSnpEffect_table[,"Df"] * -1
    totalSnpEffect_table[,"Chisq"] <- round(totalSnpEffect_table[,"Chisq"], 3)
    totalSnpEffect_table[,"Pr(>Chisq)"] <- signif(totalSnpEffect_table[,"Pr(>Chisq)"], 4)
    totalSnpEffect_table <- cbind("Variable" = row.names(totalSnpEffect_table), totalSnpEffect_table, "VariableIDs" = paste(snp_vars, collapse = ";"))
    totalSnpEffect_table <- list("header" = colnames(totalSnpEffect_table), "rows" = totalSnpEffect_table)
  }
  
  # other summary stats table
  other_table <- list(
    "header" = c("Dispersion parameter", "Null deviance", "Null deviance degrees of freedom", "Residual deviance", "Residual deviance degrees of freedom", "AIC"),
    "rows" = round(c(res_summ$dispersion, res_summ$null.deviance, res_summ$df.null, res_summ$deviance, res_summ$df.residual, res_summ$aic), 1)
  )
  
  # export the results tables
  out <- list("res" = res, "sampleSize" = unbox(sampleSize), "residuals" = residuals_table, "coefficients" = coefficients_table, "type3" = type3_table, "other" = other_table)
  if (!is.null(totalSnpEffect_table)) out[["totalSnpEffect"]] <- totalSnpEffect_table
  return(out)
}

# cox regression
coxRegression <- function(formula, dat) {  
  res <- coxph(formula$formula, data = dat, model = T)
  
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
  # do not use drop1() to compute type III stats for cox regression
  # because it will use the drop1.default() method and this will
  # error out if samples are filtered from the data table
  # TODO: may replace with car::Anova() when car package becomes available on servers
  vlst <- attr(res$terms, "term.labels", exact = T)
  type3_table <- matrix(data = NA, nrow = length(vlst), ncol = 5)
  row.names(type3_table) <- vlst
  for (i in 1:length(vlst)) {
    v <- vlst[i]
    formula_reduce <- update(formula$formula, paste0("~.-", v))
    res_reduce <- coxph(formula_reduce, data = dat, model = T)
    lt <- as.matrix(lrtest(res, res_reduce))
    type3_table[i,] <- lt[2,]
  }
  colnames(type3_table) <- colnames(lt)
  type3_table <- type3_table[,3:5,drop = F]
  type3_table[,"Df"] <- type3_table[,"Df"] * -1 #convert Df diff to Df
  # if there are interactions, then set the results
  # of the main effects to "NA" because these type III
  # stats cannot be accurately estimated
  ints <- grep(":", row.names(type3_table), value = T, fixed = T)
  intsIds <- unique(unlist(strsplit(ints, ":")))
  type3_table[intsIds,] <- NA
  # round values
  type3_table[,"Chisq"] <- round(type3_table[,"Chisq"], 3)
  type3_table[,"Pr(>Chisq)"] <- signif(type3_table[,"Pr(>Chisq)"], 4)
  
  # total SNP effect table
  # if a snplocus snp has an interaction, then compute
  # the total effect of the snp on the model
  # by determining the combined effect of removing the
  # snp and all of its interactions from the model
  totalSnpEffect_table <- NULL
  if (formula$id != "" && length(ints) > 0 && any(grepl(formula$id, ints, fixed = T))) {
    snp_vars <- grep(formula$id, row.names(type3_table), value = T, fixed = T)
    formula_reduce <- update(formula$formula, paste0("~.",paste0("-", snp_vars, collapse = "")))
    res_reduce <- coxph(formula_reduce, data = dat, model = T)
    totalSnpEffect_table <- as.matrix(lrtest(res, res_reduce))[2, 3:5, drop = F]
    row.names(totalSnpEffect_table) <- "Total"
    totalSnpEffect_table[,"Df"] <- totalSnpEffect_table[,"Df"] * -1
    totalSnpEffect_table[,"Chisq"] <- round(totalSnpEffect_table[,"Chisq"], 3)
    totalSnpEffect_table[,"Pr(>Chisq)"] <- signif(totalSnpEffect_table[,"Pr(>Chisq)"], 4)
    totalSnpEffect_table <- cbind("Variable" = row.names(totalSnpEffect_table), totalSnpEffect_table, "VariableIDs" = paste(snp_vars, collapse = ";"))
    totalSnpEffect_table <- list("header" = colnames(totalSnpEffect_table), "rows" = totalSnpEffect_table)
  }
  
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
  if (!is.null(totalSnpEffect_table)) out[["totalSnpEffect"]] <- totalSnpEffect_table
  return(out)
}

# run regression analysis
runRegression <- function(formula, regtype, dat, outcome) {
  # remove samples with NA values in any variable in the formula
  # NOTE: even though regression functions (e.g. lm, glm, etc.)
  # perform this filtration by default, this filtration
  # should be done before any regression analysis because
  # multiple regression models might need to be compared to one
  # another (e.g. computation of total snp effect) and there might
  # be samples that are NA for variables in one model but
  # not in another model.
  fdat <- dat[complete.cases(dat[,all.vars(formula$formula)]),]
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
  results$coefficients <- formatCoefficients(results$coefficients, results$res, input$regressionType, fdat)
  results$type3 <- formatType3(results$type3)
  out <- list("id" = unbox(formula$id), "data" = results[names(results) != "res"])
  if (!is.null(formula$type)) out$type <- unbox(formula$type)
  return(out)
}

# generate cubic spline plot spline
plot_spline <- function(splineVariable, dat, outcome, res, regtype) {
  # prepare test data table for predicting model outcome values
  # columns are all independent variables
  # for the spline variable, use regularly spaced data; for continuous variables, use data median; for categorical variables, use reference category
  if (regtype == "cox") {
    outcomeIds <- c(outcome$timeToEvent$timeId, outcome$timeToEvent$eventId)
  } else {
    outcomeIds <- outcome$id
  }
  independentIds <- colnames(dat)[!colnames(dat) %in% outcomeIds]
  sampleSize <- ifelse(nrow(dat) > 1000, 1000, nrow(dat))
  newdat <- dat[1:sampleSize, independentIds, drop = F]
  
  # prepare test data table for adjusting model outcome values
  # columns are the proportions and effect sizes of non-reference categorical coefficients 
  newdat2 <- matrix(data = NA, nrow = 0, ncol = 2, dimnames = list(c(),c("prop", "effectSize")))
  
  # populate the test data tables
  for (term in colnames(newdat)) {
    if (term == splineVariable$id) {
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
  
  # test model
  # predict outcome values of the model using the test data
  preddat <- predict(res, newdata = newdat, se.fit = T)
  # compute 95% confidence intervals
  ci_upr <- preddat$fit + (1.96 * preddat$se.fit)
  ci_lwr <- preddat$fit - (1.96 * preddat$se.fit)
  preddat_ci <- cbind("fit" = preddat$fit, "lwr" = ci_lwr, "upr" = ci_upr)
  # adjust the predicted values 
  # adjusted predicted values = predicted values + ((prop category A * coef category A) + (prop category B * coef category B) + etc.)
  preddat_ci_adj <- preddat_ci + sum(apply(newdat2, 1, prod), na.rm = T)
  
  # plot data
  plotfile <- splineVariable$spline$plotfile
  png(filename = plotfile, width = 950, height = 550, res = 200)
  par(mar = c(3, 2.5, 1, 5), mgp = c(1, 0.5, 0), xpd = T)
  if (regtype == "linear" | regtype == "logistic") {
    if (regtype == "linear") {
      # for linear, plot predicted values
      pointtype <- 16
      pointsize <- 0.3
      ylab <- outcome$name
    } else {
      # for logistic, plot predicted probabilities
      preddat_ci_adj <- 1/(1+exp(-preddat_ci_adj))
      pointtype <- 124
      pointsize <- 0.7
      ylab <- paste0("Pr(", outcome$name, " ", outcome$categories$nonref, ")")
    }
    # use only finite predicted data
    toKeep <- rowSums(!is.finite(preddat_ci_adj)) == 0
    preddat_ci_adj <- preddat_ci_adj[toKeep,]
    newdat <- newdat[toKeep,,drop = F]
    # first plot actual (not predicted) data
    # predicted data will be overlayed later
    plot(dat[,splineVariable$id],
         dat[,outcome$id],
         cex.axis = 0.5,
         ann = F,
         type = "n"
    )
    points(dat[,splineVariable$id],
           dat[,outcome$id],
           pch = pointtype,
           cex = pointsize
    )
  } else if (regtype == "cox") {
    # for cox, plot hazard ratios
    preddat_ci_adj <- exp(preddat_ci_adj)
    # use only finite predicted data
    toKeep <- rowSums(!is.finite(preddat_ci_adj)) == 0
    preddat_ci_adj <- preddat_ci_adj[toKeep,]
    newdat <- newdat[toKeep,,drop = F]
    pointtype <- 16
    pointsize <- 0.3
    ylab <- "Hazard Ratio"
    # plot only predicted data
    # do not also plot actual data (like for linear/logistic) because cox outcome data is time-to-event and will not be comparable to the predicted hazard ratios
    plot(newdat[,splineVariable$id],
         preddat_ci_adj[,"fit"],
         ylim = c(min(preddat_ci_adj[,"lwr"]), max(preddat_ci_adj[,"upr"])),
         cex.axis = 0.5,
         ann = F,
         type = "n"
    )
  } else {
    stop("unrecognized regression type")
  }
  
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
formatCoefficients <- function(coefficients_table, res, regtype, dat) {
  # round columns to 2 decimal places
  # round p-value column to 3 significant digits
  coefficients_table[,-ncol(coefficients_table)] <- round(coefficients_table[,-ncol(coefficients_table)], 2)
  coefficients_table[,ncol(coefficients_table)] <- signif(coefficients_table[,ncol(coefficients_table)], 3)
  
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
      for (c2 in clst2) {
        for (c1 in clst1) {
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
  
  # extract columns of interest
  if (regtype == "linear") {
    coefficients_table <- coefficients_table[, c("Variable", "Category", "Beta", "95% CI (low)", "95% CI (high)", "Pr(>|t|)"), drop = F]
  } else if (regtype == "logistic") {
    coefficients_table <- coefficients_table[, c("Variable", "Category", "Odds ratio", "95% CI (low)", "95% CI (high)", "Pr(>|z|)"), drop = F]
  } else if (regtype == "cox") {
    # cox regression
    # report sample size and event counts of coefficients
    sCol <- vector(mode = "character")
    eCol <- vector(mode = "character")
    for (i in 1:length(vCol)) {
      v <- vCol[i]
      c <- cCol[i]
      if (v %in% names(res$xlevels)) {
        # categorical variable
        # determine sample size and event count of both ref and non-ref categories
        # values will be stored in separate columns in the format "ref/nonref"
        ref <- res$xlevels[[v]][1]
        m <- table(dat[,"outcome_event"], dat[,v])
        samplesize_ref <- sum(m[,ref])
        samplesize_c <- sum(m[,c])
        sCol <- c(sCol, paste(samplesize_ref, samplesize_c, sep = "/"))
        eventcnt_ref <- m["1",ref]
        eventcnt_c <- m["1",c]
        eCol <- c(eCol, paste(eventcnt_ref, eventcnt_c, sep = "/"))
      } else {
        # continuous variable
        # set sample size and event count to NA
        sCol <- c(sCol, NA)
        eCol <- c(eCol, NA)
      }
    }
    coefficients_table <- cbind(coefficients_table, "Sample Size (ref/non-ref)" = sCol, "Events (ref/non-ref)" = eCol)
    coefficients_table <- coefficients_table[, c("Variable", "Category", "Sample Size (ref/non-ref)", "Events (ref/non-ref)", "HR", "95% CI (low)", "95% CI (high)", "Pr(>|z|)"), drop = F]
  } else {
    stop("regression type is not recognized")
  }
  
  colnames(coefficients_table)[ncol(coefficients_table)] <- "P" # p-value column
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

# parse results from univariate and multivariate analyses
parseUniMultiResults <- function(reg_results, regtype) {
  # get coefficients from the univariate and multivariate analyses
  multiCoefficients <- NULL
  uniCoefficients <- NULL
  for (res in reg_results) {
    coefs <- res$data$coefficients$rows
    # remove intercept row because cannot merge together intercepts
    # from different univariate analyses
    coefs <- coefs[row.names(coefs) != "(Intercept)", ,drop = F]
    if (res$type == "multivariate") {
      multiCoefficients <- coefs
    } else if (res$type == "univariate") {
      if (is.null(uniCoefficients)) {
        uniCoefficients <- coefs
      } else {
        uniCoefficients <- rbind(uniCoefficients, coefs)
      }
    } else {
      stop ("results type not recognized")
    }
  }
  # prepare separate univariate and multivariate coefficients tables
  uniCoefficients_table <- list("header" = colnames(uniCoefficients), "rows" = uniCoefficients)
  multiCoefficients_table <- list("header" = colnames(multiCoefficients), "rows" = multiCoefficients)
  # return parsed results containing the separate coefficients tables 
  reg_results_parsed <- list()
  reg_results_parsed[[1]] <- list("id" = res$id, "data" = list("sampleSize" = res$data$sampleSize, "coefficients_uni" = uniCoefficients_table, "coefficients_multi" = multiCoefficients_table))
  if (regtype == "cox") reg_results_parsed[[1]]$data$eventCnt = res$data$eventCnt
  return(reg_results_parsed)
}