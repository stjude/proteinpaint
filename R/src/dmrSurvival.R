###############################################
# Cox screen of region methylation vs survival #
###############################################

# Usage: echo <in_json> | Rscript dmrSurvival.R > <out_json>

# Input JSON:
# {
#   time: [], status: [] (0 = censored, 1 = event), group: [] (the two volcano groups),
#   covariates: { <name>: [] }   numeric, or strings treated as categorical
#   features: [{ id, values: [] }]   one value per sample, null where missing
# }
# All per-sample arrays share one sample order.
#
# Output JSON: [{ id, n, events, hr, lower, upper, p, q, pInteraction, hrByGroup: { <group>: hr }, kmP: { <group>: p } }]
#
# Per feature, on the samples that have it:
#   primary      Surv ~ z + covariates + strata(group)
#                z is the feature's rank-based inverse normal score, so hr is per SD of that score,
#                comparable across regions and not driven by a few extreme values. strata(group) gives each group its own baseline hazard: the
#                grouping's own prognostic effect is absorbed, not attributed to methylation.
#   interaction  Surv ~ z * group + covariates; Wald p of the z:group term.
#   by group     Surv ~ z + covariates within each group, for reading which group carries it,
#                and kmP: log-rank p of a split at the group's own median, the Kaplan-Meier view.
# q is Benjamini-Hochberg over the features' primary p.

library(jsonlite)
library(survival)

con <- file("stdin", "r")
json <- readLines(con)
close(con)
input <- fromJSON(json, simplifyVector = TRUE)

base <- data.frame(time = as.numeric(input$time), status = as.integer(input$status), group = factor(input$group))
covNames <- character(0)
if (length(input$covariates)) {
  for (name in names(input$covariates)) {
    v <- input$covariates[[name]]
    col <- make.names(name)
    base[[col]] <- if (is.numeric(v)) v else factor(v)
    covNames <- c(covNames, col)
  }
}

# a covariate that is constant on the samples in hand cannot be estimated and makes coxph fail
usableCovs <- function(d) covNames[vapply(covNames, function(c) length(unique(na.omit(d[[c]]))) > 1, logical(1))]

fitCoef <- function(formula, d, term) {
  fit <- tryCatch(suppressWarnings(coxph(formula, data = d)), error = function(e) NULL)
  if (is.null(fit)) return(NULL)
  s <- summary(fit)$coefficients
  if (!(term %in% rownames(s))) return(NULL)
  s[term, ]
}

rhs <- function(core, covs) paste(c(core, covs), collapse = " + ")

out <- lapply(seq_len(nrow(input$features)), function(i) {
  id <- input$features$id[i]
  x <- as.numeric(unlist(input$features$values[i]))
  d <- base
  d$z <- x
  d <- d[complete.cases(d), ]
  res <- list(id = id, n = nrow(d), events = sum(d$status))
  if (nrow(d) < 10 || sd(d$z) == 0) return(res)
  # rank-based inverse normal: expression TPM runs 100-fold between median and 99th percentile on
  # lowly expressed genes, and a plain z-score let a handful of outliers set the hazard ratio
  d$z <- qnorm((rank(d$z) - 0.5) / nrow(d))
  covs <- usableCovs(d)

  c1 <- fitCoef(as.formula(paste("Surv(time, status) ~", rhs(c("z", "strata(group)"), covs))), d, "z")
  if (!is.null(c1)) {
    res$hr <- unname(exp(c1["coef"]))
    res$lower <- unname(exp(c1["coef"] - 1.96 * c1["se(coef)"]))
    res$upper <- unname(exp(c1["coef"] + 1.96 * c1["se(coef)"]))
    res$p <- unname(c1["Pr(>|z|)"])
  }
  if (nlevels(droplevels(d$group)) == 2) {
    lv <- levels(droplevels(d$group))
    c2 <- fitCoef(as.formula(paste("Surv(time, status) ~", rhs("z * group", covs))), d, paste0("z:group", lv[2]))
    if (!is.null(c2)) res$pInteraction <- unname(c2["Pr(>|z|)"])
  }
  res$hrByGroup <- list()
  res$kmP <- list()
  for (g in levels(droplevels(d$group))) {
    dg <- d[d$group == g, ]
    cg <- fitCoef(as.formula(paste("Surv(time, status) ~", rhs("z", usableCovs(dg)))), dg, "z")
    if (!is.null(cg)) res$hrByGroup[[g]] <- unname(exp(cg["coef"]))
    # the Kaplan-Meier reading of the same patients: split at the group's own median, log-rank
    hi <- dg$z > median(dg$z)
    if (sum(hi) >= 5 && sum(!hi) >= 5 && sum(dg$status) > 0) {
      lr <- tryCatch(survdiff(Surv(time, status) ~ hi, data = dg), error = function(e) NULL)
      if (!is.null(lr)) res$kmP[[g]] <- 1 - pchisq(lr$chisq, df = 1)
    }
  }
  res
})

p <- sapply(out, function(r) if (is.null(r$p)) NA else r$p)
q <- p.adjust(p, method = "BH")
for (i in seq_along(out)) if (!is.na(q[i])) out[[i]]$q <- q[i]

cat(toJSON(out, auto_unbox = TRUE, digits = NA, null = "null"))
