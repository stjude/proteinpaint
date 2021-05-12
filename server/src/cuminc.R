#library(survival) #for survfit function
library(cmprsk) #for cuminc function
args <- commandArgs(TRUE)

year_to_events <- as.numeric(unlist(strsplit(args[1], split = "_")))
events <- as.integer(unlist(strsplit(args[2], split = "_")))
groups <- as.integer(unlist(strsplit(args[3], split = "_")))
#print (year_to_events)
#print (events)
#print (groups)

ci_output <- cuminc(ftime=year_to_events, fstatus=events, group=groups, cencode = 0)

if (length(ci_output[["Tests"]]) == 6) { # Competing risks present
  print (paste("p_value:",ci_output[["Tests"]][3],ci_output[["Tests"]][4]))
}
if (length(ci_output[["Tests"]]) == 3) { # No competing risks present
  print (paste("p_value:",ci_output[["Tests"]][2]))
}



print (paste("control_time:",toString(ci_output[[1]]$time)))
print (paste("control_est:", toString(ci_output[[1]]$est)))

#print ("ci_output[[1]]$var")
#print (ci_output[[1]]$var)

print (paste("case_time:",toString(ci_output[[2]]$time)))
print (paste("case_est:", toString(ci_output[[2]]$est)))

#print ("ci_output[[2]]$var")
#print (ci_output[[2]]$var)

### 95% CI
low_control <- ci_output[[1]]$est-1.96*sqrt(ci_output[[1]]$var)
print (paste("low_control:", toString(low_control)))
up_control  <- ci_output[[1]]$est+1.96*sqrt(ci_output[[1]]$var)
print (paste("up_control:", toString(up_control)))

low_case <- ci_output[[2]]$est-1.96*sqrt(ci_output[[2]]$var)
print (paste("low_case:", toString(low_case)))
up_case  <- ci_output[[2]]$est+1.96*sqrt(ci_output[[2]]$var)
print (paste("up_case:", toString(up_case)))
