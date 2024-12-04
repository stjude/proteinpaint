
## Code is exactly the same as "Step3Qrev-CNS1yr-Clean_for_Edgar.R", but only changed the input by taking those from the bootstrapped data folders and output to the bootstrapped data folders.

rm(list=ls())

suppressPackageStartupMessages(library(dplyr))  ### Qi changed to load plyr first, due to R message: If you need functions from both plyr and dplyr, please load plyr first, then dplyr:
suppressPackageStartupMessages(library(survival))
library(jsonlite)
library(parallel)

options(warn=-1)

# stream in json input data
con <- file("stdin", "r")
json <- readLines(con)
close(con)
input <- fromJSON(json)
# handle input arguments
args <- commandArgs(trailingOnly = T)
if (length(args) != 3) stop("Usage: echo <in_json> | Rscript burden.R fitsData survData sampleData > <out_json>")
fitsData <- args[1]
survData <- args[2]
sampleData <- args[3]

# save.image("~/test123.RData")
chc_nums <- c(1:32)[-c(2,5,14,20,23,26)] # CHCs. 6 out of 32 CHCs not used.
availCores <- detectCores()
if (is.na(availCores)) stop("cannot detect number of available cores")
cores <- ifelse(length(chc_nums) < availCores, length(chc_nums), availCores)

##############
# !!! commented out to do parallelization or loop in Nodejs, where input$bootnum is supplied
for(bootnum in 1:20){ 
#	bootnum=1 ##### loop this from 1 to 20. 
# print(input$bootnum) 

setwd(paste("/Users/esioson/gb/tp/files/hg38/sjlife/burden/boot/boot",bootnum,sep=""))

load('cphfits2.RData')
load('surv.RData')


############################ These are the input values in APP that users can change. Edgar, these should be the same as the APP before, variable names and units. #############

#	1="Acute lymphoblastic leukemia"
#	2="AML"
#	3="Hodgkin lymphoma"
#	4="Non-Hodgkin lymphoma"
#	5="Central nervous system"
#	6="Bone tumor"
#	7="STS"
#	8="Wilms tumor"
#	9="Neuroblastoma"
#	10="Retinoblastoma"
#	11="Germ cell tumor";

### Input the primary DX. 
# pr=5
# agecut=40   ##### Edgar, This is not an user input parameter, but we input this. This depends on the DX. For example, here for CNS we use 40. For HL DX, it is 55. I will give this value for each DX.


# #### if working on STS;
# pr=7; agecut=50

# # Input person's values, 18 input X's , plus the input primary DX
# 	sexval=1  #sex, take value 1 for male and 0 for female
# 	whiteval=1	# Race white or not, 1 for white, 0 for non-white
# 	agedxval=6  # age at primary cancer DX

# #### Chemotherapy 	
# 	steroid=0  #Steroids 1 for yes 0 for no
# 	bleo=0; ##Bleomycin
# 	vcr=12; 	#Vincristine 
# 	etop=2500; #Etoposide 
# 	itmt=0; 		#Intrathecal Methotrexate 
# 	ced=1.6		# Cyclophosphamide, 0.7692 mean 7692. 
# 	cisp=300		#Cisplatin
# 	dox=0		#Anthracycline, 3 mean 300 ml/m2
# 	carbo=0  ## Carboplatin
# 	hdmtx=0	## High-Dose Methotrexate
	
# # Radiation
# 	brain=5.4 #Brain, 5.4 means 54Gy, 5400 cGy. #####Same for all RT doses.#####
# 	chest=2.4 # chest/neck RT, 2.4 for 24 Gy
# 	heart=0	# Heart RT
# 	pelvis=0	#pelvis RT
# 	abd=2.4  # Abdominal RT
# ####################################################################################

# ##### if no TX, use these.
# 	steroid=0; bleo=0; 	vcr=0; 	etop=0;	itmt=0; 	ced=0; cisp=0; brain=0; 	dox=0; chest=0; abd=0;


# survs[[1]]

############### no TX
#	steroid=0;  bleo=0; vcr=0; etop=0; itmt=0; ced=0; cisp=0; brain=0;  dox=0; chest=0; abd=0; heart=0; pelvis=0; carbo=0; hdmtx=0

# Qi made many newdata_chc_sampled so we have 1000 times more donors -- but in different files.
load("/Users/esioson/gb/tp/files/hg38/sjlife/burden/nchcsampledsex0age0steroid0bleo0vcr0etop0itmt0.RData") ##This does not matter by bootstrap. It is just to provide a dataframe with all the X's needed, and X's were updated by the user input values.


newdata_chc_sampled=do.call("rbind", replicate(6,newdata_chc_sampled, simplify = FALSE))
newdata_chc_sampled$t.startage=seq(5,70,1)
newdata_chc_sampled$t.endage=seq(6,71,1)
### originally data fit to 60 only. using cphfits can get est up to 60 only. ==> later I further cut at 50 or so to fit lines, becuase original data had 95th percentile around age 50 or so.
newdata_chc_sampled=newdata_chc_sampled[newdata_chc_sampled$t.endage<=60,]

# paste(names(input), input, sep = ":", collapse = ",")
pr=input$diaggrp
# agecut was previously hardcoded to 40 above
agecut=c('1'=50, '2'=45, '3'=55, '4'=50, '5'=40, '6'=60, '7'=50, '8'=45, '9'=45, '10'=45, '11'=50 )[pr]
newdata_chc_sampled$sex=input$sex
newdata_chc_sampled$white=input$white
newdata_chc_sampled$agedx2=input$agedx
newdata_chc_sampled$steroid=input$steroid
newdata_chc_sampled$bleodose=input$bleo
newdata_chc_sampled$vcrdose=input$vcr
newdata_chc_sampled$etopdose=input$etop
newdata_chc_sampled$itmtxdose=input$itmt
newdata_chc_sampled$ced_sum2=input$ced
newdata_chc_sampled$cisplatdose=input$cisp
newdata_chc_sampled$brainrad2=input$brain
newdata_chc_sampled$doxed_sum2=input$dox
newdata_chc_sampled$chestrad2=input$chest
newdata_chc_sampled$abdrad2=input$abd
newdata_chc_sampled$heartradboth2=input$heart
newdata_chc_sampled$pelvisrad2=input$pelvis
newdata_chc_sampled$carboplatdose=input$carbo
newdata_chc_sampled$hdmtxdose=input$hdmtx


results <- mclapply(X = chc_nums, FUN = function(chc_num) predict(cphfits2[[chc_num]], newdata = data.frame(newdata_chc_sampled,primary=pr),type='expected'), mc.cores = cores)
for(n in 1:length(results)){
	newdata_chc_sampled = data.frame(newdata_chc_sampled,results[[n]])
}

for(j in c(1:32)[-c(2,5,14,20,23,26)]){ ## CHCs. 6 out of 32 CHCs not used.
	tmp_Nj = predict(cphfits2[[j]], newdata = data.frame(newdata_chc_sampled,primary=pr),type='expected')
	newdata_chc_sampled = data.frame(newdata_chc_sampled,tmp_Nj)
}
names(newdata_chc_sampled)[25:50]=paste0("est_chc",c(1:32)[-c(2,5,14,20,23,26)])
newdata_chc_sampled = newdata_chc_sampled %>%
	mutate(sumN_tmp = rowSums(dplyr::select(.,starts_with("est_chc"))))%>%
	group_by(mrn) %>%
	mutate(sumN_obs = cumsum(sumN_tmp)) %>%
	as.data.frame()
	
##Qi: the sumN here depends on all the 26 grouped conditions. So the input X's all matter. That is, if sex is not in a CHC of interest, it would make a difference here on sumN (becuase sex was on some CHCs), and hence make a difference on burden of that CHC even that it is not in the cphfits of that CHC.
newdata_chc_sampled = newdata_chc_sampled %>%
	group_by(mrn) %>%
	mutate(chc20 = sumN_obs[t.endage == 20]) %>%
	ungroup() %>%
	as.data.frame()
newdata_chc_sampled$death =1
newdata_chc_sampled$obsCHCat20 = newdata_chc_sampled$current.chc

# survival probability
# https://stats.stackexchange.com/questions/288393/calculating-survival-probability-per-person-at-time-t-from-cox-ph


newdata_chc_sampled$survprob = exp(-predict(survs[[1]],newdata=data.frame(newdata_chc_sampled,primary=pr),type='expected'))

#----------------------------------------------------------------------------------------------------------------#
##### Qi added the below "cumprod" for survival by time t. But need to figure out: What is the "survprob" in BCCT formulat? Should it be survival of the segment, or survival by time t? == need to figure out with YY. Discussed, YY confirmed my way: survival prob in the formula is cumulative, not for that segment.
#----------------------------------------------------------------------------------------------------------------#

#----------------------------------------------------------------------------------------------------------------#
## If assume "survprob" is over time (not for each segment):
#### why does the survprob does not decrease over time? I think this is not the real survival probability over time. Do I have to do multiplication over time thinking survprob is the survival over that segment? Try the multiplication over time.===== I think this make sense. In the "predict" above, survial=exp(-expected) was for each row (thinking each row is a separate person). While in newdata_chc_sampled, the rows are for the same person, and the survival depends on the previoys line, so need to multiply the survival from the previous line.
newdata_chc_sampled$survprob4=cumprod(newdata_chc_sampled$survprob)
newdata_chc_sampled$survprob=newdata_chc_sampled$survprob4

#### too high survival, need to handle the ages with the same survival #### 
#	survspline=smooth.spline(newdata_chc_sampled$t.endage[newdata_chc_sampled$t.endage<=39],newdata_chc_sampled$survprob[newdata_chc_sampled$t.endage<=39],spar=0.5)
# predsurv=predict(survspline,seq(0,95,1))
# lines(predsurv$x,predsurv$y,col=1,lty=2)
# survspline=smooth.spline(newdata_chc_sampled$t.endage[newdata_chc_sampled$t.endage<=40],newdata_chc_sampled$survprob[newdata_chc_sampled$t.endage<=40],spar=0.5)
# predsurv=predict(survspline,seq(0,95,1))
# lines(predsurv$x,predsurv$y,col=1,lty=2)

####for some DXs, such as STS,  need to handle the data, when the survival is the same as the previous year, *0.99 or *0.985 or 0.97 depending on age. Refer to more details on comments I made in "Step3Qrev-STS1yr.R". === Qi self note and Edgar can ignore.
#### Edgar, compared to the version I sent before, I added these lines.
tpdata=newdata_chc_sampled[,c("t.endage","survprob")]
tpdata$prev=lag(tpdata$survprob)
tpdata$ind=0;tpdata$ind[tpdata$prev==tpdata$survprob]=1
tpdata$ind[tpdata$t.endage<=25]=0 ## if before age 25 the survival is the same as previous year, ok
tpdata$cumsum=cumsum(tpdata$ind)
tpdata$survnew[tpdata$t.endage<40]=tpdata$survprob[tpdata$t.endage<40]*(0.99^tpdata$cumsum[tpdata$t.endage<40])
tpdata$survnew[tpdata$t.endage>=40]=tpdata$survprob[tpdata$t.endage>=40]*(0.98^tpdata$cumsum[tpdata$t.endage>=40])
newdata_chc_sampled$survprob=tpdata$survnew


#	plot(c(0,90),c(0,1),type="n")
survspline=smooth.spline(newdata_chc_sampled$t.endage[newdata_chc_sampled$t.endage<=agecut],newdata_chc_sampled$survprob[newdata_chc_sampled$t.endage<=agecut],spar=0.5)
predsurv=predict(survspline,seq(0,95,1))
#	lines(predsurv$x,predsurv$y,col=3,lty=2)

##### ##### ##### ##### ##### ##### ##### ##### ##### ##### ##### ##### ##### 

###### get rid of the est_chcXX and "sumN"columns which were used to calculate the survival probability only.
#dim(newdata_chc_sampled)
newdata_chc_sampled=newdata_chc_sampled[,-grep("est_chc", colnames(newdata_chc_sampled))]
newdata_chc_sampled=newdata_chc_sampled[,-grep("sumN", colnames(newdata_chc_sampled))]
#dim(newdata_chc_sampled)


### Add rows  t.startage from 60 to 94, and t.endage from 65 to 95; so we can get burden 60-90.
add=newdata_chc_sampled[newdata_chc_sampled$t.startage<=39,]
#table(add$t.startage)
#table(add$t.endage)
add$t.startage=add$t.startage+55
add$t.endage=add$t.endage+55
#table(add$t.startage)
#table(add$t.endage)
newdata_chc_sampled=rbind(newdata_chc_sampled,add)
newdata_chc_sampled=newdata_chc_sampled[order(newdata_chc_sampled$mrn,newdata_chc_sampled$t.startage),]
### replace the survival prob with the calculated/extrapolated survival probability
smooth_surv=data.frame(age=predsurv$x,surv=predsurv$y)
smooth_surv$surv[smooth_surv$age<=20]=1
#### survival probability cannot be <0. Hanle the years with survival prob<0
#https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1310013501 This page had the conditional survival based on age
## take the last year with a positive survival prob, and its survival prob
positive=smooth_surv[smooth_surv$surv>0,]
alast=tail(positive,1)[1,1]
slast=tail(positive,1)[1,2]
#smooth_surv$alast=alast
#smooth_surv$alast=slast
smooth_surv$interval=smooth_surv$age-alast
### use the last positive survival prob*0.5^(years from the last age with positive survival probability), assuming the conditions survival prob after that age 50% each year.
cave <- function(x) slast*0.5^(max(x["interval"],0))
smooth_surv$surv1=apply(smooth_surv,1,cave)
smooth_surv$surv[smooth_surv$surv<0]=smooth_surv$surv1[smooth_surv$surv<0]

newdata_chc_sampled=merge(newdata_chc_sampled,smooth_surv,by.x="t.endage",by.y="age")
newdata_chc_sampled$survprob=newdata_chc_sampled$surv

# when there is an interaction in the model, it gave warning. So I would make a new data with all 0's to make it work.
newdata0=matrix(0,nrow=1,ncol=18)
newdata0=as.data.frame(newdata0)
colnames(newdata0)=c("sex","white","agedx2","steroids","bleodose","vcrdose","etopdose","itmtxdose","ced_sum2",
"cisplatdose","brainrad2","doxed_sum2","chestrad2","abdrad2","heartradboth2","pelvisrad2","carboplatdose","hdmtxdose")


newdata_chc_sampled1=newdata_chc_sampled ## do this so each run on chc_num loops below starts with the original newdata_chc_sampled1


##########################################################################
person_burden=NULL

for(chc_num in c(1:32)[-c(2,5,14,20,23,26)]){  #### Edgar, you may make this in separate runs to save time.
# print(chc_num)
newdata_chc_sampled=newdata_chc_sampled1

# linear predictor
newdata_chc_sampled$exp_lp = predict(cphfits2[[chc_num]], newdata = data.frame(newdata_chc_sampled,primary=pr),type='risk',reference="zero")

# Baseline nelson-aalan est
# https://stats.stackexchange.com/questions/46532/cox-baseline-hazard
j=chc_num
base = basehaz(cphfits2[[chc_num]],centered = F) # this is a cumulative hazard, so need to convert it into non-cumulative version
#centered,	if TRUE return data from a predicted survival curve at the mean values of the covariates fit$mean, if FALSE return a prediction for all covariates equal to zero.
#request the hazard for that covariate combination from the survfit() function that is called by basehaz(). https://stats.stackexchange.com/questions/565210/about-getting-baseline-survival-probability-for-a-piecewise-cox-model-with-inter


### Max time in the data is 70.42. We need to estimate up to 90. 
#Yutaka: I think we should smooth the cumulative hazard and then take the derivative to get the hazard.
#One thread I found on Web is: "As an approximation you can smooth the fitted baseline cumulative hazard (e.g. by package pspline) and ask for its derivative."  Can you try using smooth.spline and smooth the cumulative hazard and then get the derivative?  https://cran.r-project.org/web/packages/pspline/pspline.pdf


#### Qi added: base is for different DX. Now we run within each pr, so neeed cumulaive hazrd for that pr only
base=base[base$strata==paste("primary=",pr,sep=""),] #cumulative hazard
base=base[base$time<=agecut,]  ### shouldn't we use the same age cutoff as the survival function splines? Yes, do so.

##### study the smooth parameter. I think spar=1 is the best one to use (most smoothest)
cumHspline=smooth.spline(base$time,base$hazard,spar=1)
predcumhz=predict(cumHspline,seq(0,95,1))  ### predicted cumulative hazard


##### In order to use the above way to get dN0, do Daisuke's original way using cumhz difference. But the  difference is that: we fit cumhz with smooth.spline and can extend it to 90 years old.
base=data.frame(time=predcumhz$x,hazard=predcumhz$y)  ##Daisuke used the cumHz, here we smoothed it and then use it.
### Edgar, I made some changes here, comapred to the version I sent earlier. i.e., I got rid of the line "base$hazard[base$hazard<0]=0", and added "base2$hazard2[base2$hazard2<0]=0" below.
base2 = base %>% 
	mutate(hazard2 = hazard - c(0,hazard[-length(hazard)])) %>%
	ungroup() %>% as.data.frame()

#### fitted values had <0 values in age 0-8 or so. change to hazard=0 if the hazard<0. This implies no increase in cumulative hazard at that time point, so should be no increase in burden.
base2$hazard2[base2$hazard2<0]=0

base2 = base2 %>%
	mutate(time_cat = cut(time,breaks=seq(0,95,1),right = FALSE, include.lowest = TRUE)) %>% 
	ungroup()

base3 = base2 %>%
	group_by(time_cat) %>%
	dplyr::summarize(dN0 = sum(hazard2)) %>%
	filter(!is.na(time_cat))	

###############
# BCCT
###############
newdata_chc_sampled$time_cat = cut(newdata_chc_sampled$t.startage,breaks=seq(0,95,1),right = FALSE, include.lowest = TRUE)

#newdata_chc_sampled$time_cat = cut(newdata_chc_sampled$t.startage,breaks=seq(0,90,5),right = FALSE, include.lowest = TRUE) this won't work, because the input donors file had "t.startage" up to 55 only

newdata_chc_sampled = newdata_chc_sampled %>% 
	left_join(base3,by="time_cat")
newdata_chc_sampled$dN0 = ifelse(is.na(newdata_chc_sampled$dN0),0,newdata_chc_sampled$dN0)

BCCT = newdata_chc_sampled %>% 
	group_by(mrn) %>%
	mutate(BCCT_tmp = exp_lp*survprob*dN0) %>%
	mutate(BCCT = cumsum(BCCT_tmp)) %>%
	filter(t.startage>=20) %>%
	ungroup() %>%
	as.data.frame()

for_web_BCCT = as.data.frame(tidyr::pivot_wider(BCCT,id_cols = mrn, names_from=time_cat,values_from=BCCT))
for_web_BCCT =for_web_BCCT[,-1]

#### for non-recurrent ones, maximum burden is 1 if the grouped conditions had only 1 condition. (11, 19,29) had only 1 conditons non-recurrent. (15,17,25) had 2 conditons. Take 25 as an example, it had obesity/underweight where underweight was so rare. So max 1 is still good. 
#### non-recurrent CHCs are 11, 15, 17, 19, 25, 29. ==I think making it maximum 1 is not good always, becuase these are grouped conditions. For example, chc=10 contains 3 non-recurrent events, so one person could have each of these once, making it maximum 3 in this person for chc=10. 
ncoltmp=75  ## from 20 to 94
if(chc_num %in% c(11, 15, 17, 19, 25, 29)){
for_web_BCCT2=apply(for_web_BCCT,c(1,2),function(x) min(x,1))
for_web_BCCT=as.data.frame(for_web_BCCT2)
colnames(for_web_BCCT)=colnames(person_burden[1:ncoltmp])
}
#For example, chc=10 contains 3 non-recurrent events, so one person could have each of these once, making it maximum 3 in this person for chc=10. 
if(chc_num %in% c(10)){
for_web_BCCT2=apply(for_web_BCCT,c(1,2),function(x) min(x,3))
for_web_BCCT=as.data.frame(for_web_BCCT2)
colnames(for_web_BCCT)=colnames(person_burden[1:ncoltmp])
}
##### if female condition 6, then it is 0 for males.
if(chc_num %in% c(6) & input$sex==1){
	for_web_BCCT2=matrix(0,nrow=1,ncol=ncoltmp)
for_web_BCCT=as.data.frame(for_web_BCCT2)
colnames(for_web_BCCT)=colnames(person_burden[1:75])
}
##### if male condition 7, then it is 0 for females.d
if(chc_num %in% c(7) & input$sex==0){
	for_web_BCCT2=matrix(0,nrow=1,ncol=ncoltmp)
  for_web_BCCT=as.data.frame(for_web_BCCT2)
  colnames(for_web_BCCT)=colnames(person_burden[1:ncoltmp])
}

for_web_BCCT$chc=chc_num

person_burden=rbind(person_burden,for_web_BCCT)

} #end of chc_num loop

# person_burden[,30:31]
# sum(person_burden[,31])  ## total burden at 50 years old. 8.971574 for this example.

#write.csv(person_burden,file=paste("./bootprimary",pr,".csv",sep=""),row.names=F)
toJSON(person_burden, digits = NA, na = "string")
}  ## end of bootnum
