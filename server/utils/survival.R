library("survival") 

stream <- file("stdin", "r")
input <- read.table(stream, sep="\t", header=T, quote="")

input <- input[order(input$cohort),]
results <- survfit(Surv(time, status) ~ cohort, data = input)
table <- data.frame(cohort=(unique(input[order(input$cohort),1:2]))$cohort, time=results$time, surv=results$surv, lower = results$lower, upper = results$upper, nevent=results$n.event, ncensor=results$n.censor, nrisk=results$n.risk)
write.table(table, file="", sep="\t", row.names=F, quote=F)

close(stream)

#input <- data.frame(
#'cohort' = c(1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,   2,2,2,2,2,2,2,2),
#'time' = c(23,30,69,101,128,136,182,189,221,228,262,265,274,316,325,329,378,403,418,425,458,549,553,587,624,648,842,1070,1692,1914,3033,3827,4149,4203,4246,4309,4392,4434,4453,4474,4664,5072,   185,191,368,586,1559,1630,3208,6156),
#'status' = c(1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,0,0,0,0,0,1,0,1,0,0,  1,1,1,1,1,1,1,0)
#)
