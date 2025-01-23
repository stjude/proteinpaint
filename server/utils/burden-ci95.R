options(warn=-1)
library(jsonlite)

# pr=5   ### change for each DX
# handle input arguments
args <- commandArgs(trailingOnly = T)
if (length(args) != 1) stop("Usage: echo <in_json> | Rscript burden-ci95.R bootstrapResults > <out_json>")
pr <- args[1]

#outall=NULL
#for(bootnum in 1:20){
#	bootnum=1 ##### loop this from 1 to 20. 
#print(bootnum) 
#setwd(paste("R:/Biostatistics/Biostatistics2/Qi/QiCommon/St Jude/Nickhill/Daisuke/2023/boot/boot",bootnum,sep=""))
#out1=read.csv(file=paste("./bootprimary",pr,".csv",sep=""))
#out1$boot=bootnum
#outall=rbind(outall,out1)
#}
con <- file("stdin", "r")
json <- readLines(con)
close(con)
input <- fromJSON(json)
outall <- input$boots

save.image("~/burden-ci95.RData") # load as workspace in RStudio session 
### For each cell (each chc and age combination), there are 20 values. get the SD from the 20 bootstrapped burdens.
SDall=NULL
for(chc_num in c(1:32)[-c(2,5,14,20,23,26)]){ 
#	chc_num=1
data=outall[outall$chc==chc_num,]  ## data for this chc_num from the 20 bootstraps on each age point
data=data[,!colnames(data) %in% c("chc","boot")]
# for each column (each age point), get the SD
sd1=apply(data,2,sd) 
sd1$chc=chc_num
SDall=rbind(SDall,sd1)
}

# #### burden for total of the 26 CHCs is the sum of the 26 burdens. So for each boot, take all the 26 and then sum up, to result in a column with 20 rows.

btotal=NULL
for(bootnum in 1:20){
#	bootnum=1
data=outall[outall$boot==bootnum,]
data=data[,!colnames(data) %in% c("chc","boot")]
total=apply(data,2,sum) 
btotal=rbind(btotal,total)
}
### get SD for the total burdern from the 20 rows
sdtotal=apply(btotal,2,sd)
sdtotal=data.frame(t(sdtotal), check.names=F)
sdtotal$chc=0 ### indicating the total CHCs

sd=rbind(SDall,sdtotal)
sd=apply(sd,c(1,2),as.numeric)

##### read the burden from the original data. Use that and SD to get lower and upper bound.
# oburden=read.csv(paste("R:/Biostatistics/Biostatistics2/Qi/QiCommon/St Jude/Nature Review/CHCs/App/Rdata/primary",pr,".csv",sep=""))
oburden=input$burden
# oburden$boot=0
### total burden for the original data
total=apply(oburden[,!colnames(oburden) %in% c("chc","boot")],2,sum) 
burdentotal=data.frame(t(total), check.names=F)
burdentotal$chc=0 ### indicating the total CHCs
oburden=rbind(oburden,burdentotal)  #### burden for each chc with age in the columns. The last row is for the total burden.
oburden=data.frame(oburden, check.names=F)


#### lower bound, the lowest is 0 burden.
low=oburden[,!colnames(oburden) %in% "chc"]-1.96*sd[,!colnames(oburden) %in% "chc"]
low[low<0]=0
low$chc=oburden$chc
#### The upper bound
up=oburden[,!colnames(oburden) %in% "chc"]+1.96*sd[,!colnames(oburden) %in% "chc"]
up$chc=oburden$chc

### Take primary=5 CNS as an example (with hight TXs in step 3). At age 50, the burden is 9.04 with 95% CI (7.92 to 10.16)
# oburden$X.50.51[oburden$chc==0]
# low$X.50.51[low$chc==0]
# up$X.50.51[up$chc==0]

# plot(c(20,95),c(0,15),type="n",xlab="Age",ylab="Burden",font=2)
# lines(seq(20,94,1),oburden[oburden$chc==0,!colnames(oburden) %in% "chc"],lty=1)
# lines(seq(20,94,1),low[low$chc==0,!colnames(low) %in% "chc"],lty=2)
# lines(seq(20,94,1),up[up$chc==0,!colnames(up) %in% "chc"],lty=2)

# toJSON(low, digits = NA, na = "string")
ci <- list(low = low, up = up, overall=burdentotal)
toJSON(ci)
