argv <- commandArgs(TRUE)

infile <- argv[1]
outfile <- argv[2]

out <- NULL
dat <- read.table(infile,sep="\t",header=F,quote="")

for (i in 1:nrow(dat)) {
	x <- binom.test(dat[i,10],dat[i,10]+dat[i,9],0.5)
	y <- abs(dat[i,10]/(dat[i,10]+dat[i,9]) - 0.5)
	out <- rbind(out,c(x$p.value,y))
}
#colnames(out) <- c("pvalue","delta.abs")
out <- cbind(dat,out)

write.table(out,file=outfile,sep="\t",quote=F,row.names=F,col.names=F)
