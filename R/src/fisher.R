con <- file("stdin","r")
dat <- read.table(con,sep="\t",header=F,quote="")

pvals <- apply(dat[,2:5], 1, function(row) fisher.test(matrix(row, ncol=2))$p.value)

out <- cbind(dat,pvals)

write.table(out,file="",sep="\t",quote=F,row.names=F,col.names=F)
close(con)
