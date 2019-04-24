argv <- commandArgs(TRUE)

infile <- argv[1]
outfile <- argv[2]

out <- NULL
dat <- read.table(infile,sep="\t",header=F,quote="")

for (i in 1:nrow(dat)) {
	x <- chisq.test( matrix( c( dat[i,2], dat[i,3], dat[i,4], dat[i,5] ), ncol=2 ) )
	out <- rbind(out,x$p.value)
}
out <- cbind(dat,out)

write.table(out,file=outfile,sep="\t",quote=F,row.names=F,col.names=F)
