# Rscript cuminc.R 0.3_0.4_0.1_0.2 1_1_0_0

#library(survival) #for survfit function
library(cmprsk) #for cuminc function
args <- commandArgs(TRUE)

year_to_events <- as.numeric(unlist(strsplit(args[1], split = "_")))
events <- as.integer(unlist(strsplit(args[2], split = "_")))
#groups <- as.integer(unlist(strsplit(args[3], split = "_")))

#print (year_to_events)
#print (events)
#print (groups)

#ci_output <- cuminc(ftime=year_to_events, fstatus=events, group=groups, cencode = 0)
ci_output <- cuminc(ftime=year_to_events, fstatus=events, cencode = 0)

#if (length(ci_output[["Tests"]]) == 6) { # Competing risks present
#  print (paste("p_value:",format(round(ci_output[["Tests"]][3], 6), nsmall = 6)))
#}
#if (length(ci_output[["Tests"]]) == 3) { # No competing risks present
#  print (paste("p_value:",format(round(ci_output[["Tests"]][2], 6), nsmall = 6)))
#}

#print (paste("control_time:",toString(ci_output[[1]]$time)))
#print (paste("control_est:", toString(ci_output[[1]]$est)))

#print ("ci_output[[1]]$var")
#print (ci_output[[1]]$var)

## IMPORTANT !!!! - REMEMBER TO CHANGE the index number of case to 2 from 1 when you implement groups (case vs control)

print (paste("case_time:",toString(ci_output[[1]]$time)))
print (paste("case_est:", toString(ci_output[[1]]$est)))

#print ("ci_output[[2]]$var")
#print (ci_output[[2]]$var)

### 95% CI, all negative CI values are set to zero
#low_control <- ci_output[[1]]$est-1.96*sqrt(ci_output[[1]]$var)
#low_control [low_control < 0]  <- 0
#print (paste("low_control:", toString(low_control)))
#up_control  <- ci_output[[1]]$est+1.96*sqrt(ci_output[[1]]$var)
#up_control [up_control < 0]  <- 0
#print (paste("up_control:", toString(up_control)))


## IMPORTANT !!!! - REMEMBER TO CHANGE the index number of case to 2 from 1 when you implement groups (case vs control)

low_case <- ci_output[[1]]$est-1.96*sqrt(ci_output[[1]]$var)
low_case [low_case < 0]  <- 0
print (paste("low_case:", toString(low_case)))
up_case  <- ci_output[[1]]$est+1.96*sqrt(ci_output[[1]]$var)
up_case [up_case < 0]  <- 0
print (paste("up_case:", toString(up_case)))
