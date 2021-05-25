out <- NULL
con <- file("stdin","r")
dat <- read.table(con,sep="\t",header=F,quote="")

for (i in 1:nrow(dat)) {
	x <- fisher.test( matrix( c( dat[i,2], dat[i,3], dat[i,4], dat[i,5], dat[i,6], dat[i,7] ), nrow=2 ) )
	out <- rbind(out,x$p.value)
}
out <- cbind(dat,out)

write.table(out,file="",sep="\t",quote=F,row.names=F,col.names=F)
close(con)
