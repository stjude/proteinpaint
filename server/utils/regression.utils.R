########################
# REGRESSION UTILITIES #
########################

####################
# LIST OF UTILITIES 
####################


# function to prepare data table
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

# function to reformat the coefficients table
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

# function to reformat the type III statistics table
formatType3 <- function(type3_table) {
  # add a variable column
  type3_table <- cbind("Variable" = sub("cubic_spline\\(", "", sub(", c\\(.*", "", row.names(type3_table))), type3_table)
  type3_table <- list("header" = colnames(type3_table), "rows" = type3_table)
  return(type3_table)
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
plot_spline <- function(splineVariable, dat, outcome, res, regtype) {
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
  plot(dat[,splineVariable$id],
       dat[,outcome$id],
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
  points(dat[,splineVariable$id],
         dat[,outcome$id],
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

buildFormulas <- function(variables, regtype) {
  # collect outcome id(s), independent ids, cubic spline ids, and interactions
  # set aside snplocus snps to be handled separately
  if (regtype == "cox") {
    outcomeTimeId <- vector(mode = "character")
    outcomeEventId <- vector(mode = "character")
  } else {
    outcomeId <- vector(mode = "character")
  }
  independentIds <- vector(mode = "character")
  interactions <- vector(mode = "character")
  snpLocusSnps <- variables[0,]
  splineVariables <- variables[0,]
  for (r in 1:nrow(variables)) {
    variable <- variables[r,]
    if (variable$toSkip) {
      next
    }
    if (variable$type == "outcome") {
      # outcome variable
      if (regtype == "cox") {
        outcomeTimeId <- variable$timeToEvent$timeId
        outcomeEventId <- variable$timeToEvent$eventId
      } else {
        outcomeId <- variable$id
      }
      next
    } else if (variable$type == "spline") {
      # cubic spline variable
      # use call to cubic spline function in regression formula
      splineCmd <- paste0("cubic_spline(", variable$id, ", ", paste0("c(", paste(variable$spline$knots[[1]],collapse = ","), ")"), ")")
      independentIds <- c(independentIds, splineCmd)
      splineVariables <- rbind(splineVariables, variable)
    } else if (variable$type == "snplocus") {
      # snplocus snp
      # set aside so that separate formulas can be made for each snplocus snp
      snpLocusSnps <- rbind(snpLocusSnps, variable)
      next
    } else {
      # other independent variable
      independentIds <- c(independentIds, variable$id)
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
  
  # build formula(s)
  # prepare separate formula for each snplocus snp
  formulas <- list()
  if (nrow(snpLocusSnps) > 0) {
    # snplocus snps present
    # build separate formula for each snplocus snp
    tempIndependentIds <- vector(mode = "character")
    tempInteractions <- vector(mode = "character")
    for (r in 1:nrow(snpLocusSnps)) {
      snp <- snpLocusSnps[r,]
      tempIndependentIds <- c(independentIds, snp$id)
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
      if (regtype == "cox") {
        outcome <- paste0("Surv(",outcomeTimeId,", ",outcomeEventId,")")
      } else {
        outcome <- outcomeId
      }
      formula <- as.formula(paste(outcome, paste(c(tempIndependentIds, tempInteractions), collapse = "+"), sep = "~"))
      formulas[[length(formulas)+1]] <- list("id" = snp$id, "formula" = formula)
    }
  } else {
    # no snplocus snps
    # use single formula for all variables
    if (regtype == "cox") {
      outcome <- paste0("Surv(",outcomeTimeId,", ",outcomeEventId,")")
    } else {
      outcome <- outcomeId
    }
    formula <- as.formula(paste(outcome, paste(c(independentIds, interactions), collapse = "+"), sep = "~"))
    formulas[[length(formulas)+1]] <- list("id" = "", "formula" = formula)
  }
  return(list("formulas" = formulas, "splineVariables" = splineVariables))
}
