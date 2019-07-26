argv <- commandArgs(TRUE)

infile <- argv[1]
outfile <- argv[2]

dat <- read.table(infile,sep="\t",header=F,quote="")
out <- p.adjust( dat, method="BH")

write.table(out,file=outfile,sep="\t",quote=F,row.names=F,col.names=F)
