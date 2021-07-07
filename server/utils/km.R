library(survival)

con <- file("stdin","r")
dat <- read.table(con,sep="\t",header=T,quote="")
test <- survdiff(Surv(futime, fustat) ~ rx,data=dat)
testOut <- capture.output(test)
testOut <- gsub(" ","",testOut)
pvalue <- strsplit(testOut[length(testOut)], split = ",")[[1]][2]
if (!grepl("^p=",pvalue)){
    stop("Unexpected p-value format.")
}
cat(sub("p=","",pvalue),"\n",sep="")
close(con)
