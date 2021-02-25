library('hwde')
argv <- commandArgs(TRUE)

# TODO get input from stdin, also node.js needs to be able to stream data into the Rscript process
infile <- argv[1]

out <- NULL
dat <- read.table(infile,sep="\t",header=F,quote="")

for (i in 1:nrow(dat)) {
	x <- hwexact( dat[i,1], dat[i,2], dat[i,3] )
	cat(x, "\n")
}
