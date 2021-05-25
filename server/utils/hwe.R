library('hwde')

con <- file("stdin","r")
dat <- read.table(con,sep="\t",header=F,quote="")

for (i in 1:nrow(dat)) {
	pvalue <- hwexact( dat[i,1], dat[i,2], dat[i,3] )
	cat(pvalue,"\n",sep="")
}

close(con)
