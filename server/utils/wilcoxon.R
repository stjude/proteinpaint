out <- NULL
con <- file("stdin","r")
dat <- read.table(con,sep="\t",header=F,quote="")

save.image("test.Rdata")
stop("stop here")

for (i in 1:nrow(dat)) {

	# line: snpid \t vector1 \t vector2
	# dat[i,2] is "v1,v2,v3,..."
	# dat[i,3] is "v1,v2,v3,..."

	x <- wilcox.test( strsplit(",",dat[i,2])[[1]], strsplit(",",dat[i,3])[[1]] )

	out <- rbind(out,x$p.value)
}
out <- cbind(dat,out)

write.table(out,file="",sep="\t",quote=F,row.names=F,col.names=F)
close(con)
