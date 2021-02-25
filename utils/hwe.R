library('hwde')
argv <- commandArgs(TRUE)

infile <- argv[1]
#outfile <- argv[2]

out <- NULL
dat <- read.table(infile,sep="\t",header=F,quote="")

for (i in 1:nrow(dat)) {
	x <- hwexact( dat[i,1], dat[i,2], dat[i,3] )
	cat(x, "\n")
	#out <- rbind(out,x)
}

#write.table(out,file=outfile,sep="\t",quote=F,row.names=F,col.names=F)
