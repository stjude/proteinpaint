# Rscript cuminc.R 0.3_0.4_0.1_0.2 1_1_0_0

#library(survival) #for survfit function
suppressPackageStartupMessages(library(cmprsk)) #for cuminc function
args <- commandArgs(TRUE)

year_to_events <- as.numeric(unlist(strsplit(args[1], split = "_")))
events <- as.integer(unlist(strsplit(args[2], split = "_")))

ci_output <- cuminc(ftime=year_to_events, fstatus=events, cencode = 0)

print (paste("case_time:",toString(ci_output[[1]]$time)))
print (paste("case_est:", toString(ci_output[[1]]$est)))

low_case <- ci_output[[1]]$est-1.96*sqrt(ci_output[[1]]$var)
low_case [low_case < 0]  <- 0
print (paste("low_case:", toString(low_case)))
up_case  <- ci_output[[1]]$est+1.96*sqrt(ci_output[[1]]$var)
up_case [up_case < 0]  <- 0
print (paste("up_case:", toString(up_case)))
