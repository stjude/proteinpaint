
##### This code takes about 30 seconds to run. When user input the parameters (sexval to hdmtxval), run this for the original data and 20 for the bootstraped data at the same time, so we can have the burdern and 95% CI in about 30 seconds.

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

chc_nums <- c(1:32)[-c(2,5,14,20,23,26)] # CHCs. 6 out of 32 CHCs not used.
availCores <- detectCores()
if (is.na(availCores)) stop("cannot detect number of available cores")
cores <- ifelse(length(chc_nums) < availCores, length(chc_nums), availCores)

#####################
# Functions for our method
# Ref: https://stats.stackexchange.com/questions/46532/cox-baseline-hazard
#####################
# setwd("R:/Biostatistics/Biostatistics2/Qi/QiCommon/St Jude/Nature Review/CHCs/App/Rdata")

load(fitsData)
load(survData)
# survs[[1]]

############################ These are the input values in APP that users can change. Edgar, these should be the same as the APP before, variable names and units. #############
### Input the primary DX. 
# pr=5
# agecut=40   ##### Edgar, This is not an user input paramter, but we input this. This depends on the DX. For example, here for CNS we use 40. For HL DX, it is 55. I will give this value for each DX.

# # # Input person's values, 18 input X's , plus the input primary DX
# 	sexval=1  #sex, take value 1 for male and 0 for female
# 	whiteval=1	# Race white or not, 1 for white, 0 for non-white
# 	agedxval=6  # age at primary cancer DX

# #### Chemotherapy 	
# 	steroidval=0  #Steroids 1 for yes 0 for no
# 	bleoval=0; ##Bleomycin
# 	vcrval=12; 	#Vincristine 
# 	etopval=2500; #Etoposide 
# 	itmtval=0; 		#Intrathecal Methotrexate 
# 	cedval=1.6		# Cyclophosphamide, 0.7692 mean 7692. 
# 	cispval=300		#Cisplatin
# 	doxval=0		#Anthracycline, 3 mean 300 ml/m2
# 	carboval=0  ## Carboplatin
# 	hdmtxval=0	## High-Dose Methotrexate
	
# # Radiation
# 	brainval=5.4 #Brain, 5.4 means 54Gy, 5400 cGy. #####Same for all RT doses.#####
# 	chestval=2.4 # chest/neck RT, 2.4 for 24 Gy
# 	heartval=0	# Heart RT
# 	pelvisval=0	#pelvis RT
# 	abdval=2.4  # Abdominal RT

####################################################################################

##### if no TX, use these.
#	steroidval=0; bleoval=0; 	vcrval=0; 	etopval=0;	itmtval=0; 	cedval=0; cispval=0; brainval=0; 
#	doxval=0; chestval=0; abdval=0;

# survs[[1]]

############### no TX
#	steroidval=0;  bleoval=0; vcrval=0; etopval=0; itmtval=0; cedval=0; cispval=0; brainval=0;  doxval=0; chestval=0; abdval=0; heartval=0; pelvisval=0; carboval=0; hdmtxval=0

# Qi made many newdata_chc_sampled so we have 1000 times more donors -- but in different files.
load(sampleData)

newdata_chc_sampled=do.call("rbind", replicate(6,newdata_chc_sampled, simplify = FALSE))
newdata_chc_sampled$t.startage=seq(5,70,1)
newdata_chc_sampled$t.endage=seq(6,71,1)
### originally data fit to 60 only. using cphfits can get est up to 60 only. ==> later I further cut at 50 or so to fit lines, becuase original data had 95th percentile around age 50 or so.
newdata_chc_sampled=newdata_chc_sampled[newdata_chc_sampled$t.endage<=60,]

# paste(names(input), input, sep = ":", collapse = ",")
pr=input$diaggrp
# agecut was previously hardcoded to 40 above
agecut=c('1'=50, '2'=45, '3'=55, '4'=50, '5'=40, '6'=60, '7'=50, '8'=45, '9'=45, '10'=45, '11'=50 )[pr]
sexval=input$sex
newdata_chc_sampled$sex=input$sex # sexval
newdata_chc_sampled$white=input$white # whiteval
newdata_chc_sampled$agedx2=input$agedx # agedxval
newdata_chc_sampled$steroid=input$steroid # steroidval
newdata_chc_sampled$bleodose=input$bleo # bleoval
newdata_chc_sampled$vcrdose=input$vcr # vcrval
newdata_chc_sampled$etopdose=input$etop # etopval
newdata_chc_sampled$itmtxdose=input$itmt # itmtval
newdata_chc_sampled$ced_sum2=input$ced # cedval
newdata_chc_sampled$cisplatdose=input$cisp # cispval
newdata_chc_sampled$brainrad2=input$brain # brainval
newdata_chc_sampled$doxed_sum2=input$dox # doxval
newdata_chc_sampled$chestrad2=input$chest # chestval
newdata_chc_sampled$abdrad2=input$abd # abdval
newdata_chc_sampled$heartradboth2=input$heart # heartval
newdata_chc_sampled$pelvisrad2=input$pelvis # pelvisval
newdata_chc_sampled$carboplatdose=input$carbo # carboval
newdata_chc_sampled$hdmtxdose=input$hdmtx # hdmtxval

# newdata_chc_sampled$sex=sexval
# newdata_chc_sampled$white=whiteval
# newdata_chc_sampled$agedx2=agedxval
# newdata_chc_sampled$steroid=steroidval
# newdata_chc_sampled$bleodose=bleoval
# newdata_chc_sampled$vcrdose=vcrval
# newdata_chc_sampled$etopdose=etopval
# newdata_chc_sampled$itmtxdose=itmtval
# newdata_chc_sampled$ced_sum2=cedval
# newdata_chc_sampled$cisplatdose=cispval
# newdata_chc_sampled$brainrad2=brainval
# newdata_chc_sampled$doxed_sum2=doxval
# newdata_chc_sampled$chestrad2=chestval
# newdata_chc_sampled$abdrad2=abdval
# newdata_chc_sampled$heartradboth2=heartval
# newdata_chc_sampled$pelvisrad2=pelvisval
# newdata_chc_sampled$carboplatdose=carboval
# newdata_chc_sampled$hdmtxdose=hdmtxval

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

results <- mclapply(X = chc_nums, FUN = function(chc_num) predict(cphfits2[[chc_num]], newdata = data.frame(newdata_chc_sampled,primary=pr),type='expected'), mc.cores = cores)
for(n in 1:length(results)){
	newdata_chc_sampled = data.frame(newdata_chc_sampled,results[[n]])
}
names(newdata_chc_sampled)[25:50]=paste0("est_chc",chc_nums)
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

#	plot(c(0,90),c(0,1),type="n")
survspline=smooth.spline(newdata_chc_sampled$t.endage[newdata_chc_sampled$t.endage<=agecut],newdata_chc_sampled$survprob[newdata_chc_sampled$t.endage<=agecut],spar=0.5)
predsurv=predict(survspline,seq(0,95,1))

#	lines(predsurv$x,predsurv$y,col=3,lty=2)

##### ##### ##### ##### ##### ##### ##### ##### ##### ##### ##### ##### ##### 

###### get rid of the est_chcXX and "sumN"columns which were used to calculate the survival probability only.
# invisible(dim(newdata_chc_sampled))
newdata_chc_sampled=newdata_chc_sampled[,-grep("est_chc", colnames(newdata_chc_sampled))]
newdata_chc_sampled=newdata_chc_sampled[,-grep("sumN", colnames(newdata_chc_sampled))]
# invisible(dim(newdata_chc_sampled))

### Add rows  t.startage from 60 to 94, and t.endage from 65 to 95; so we can get burden 60-90.
add=newdata_chc_sampled[newdata_chc_sampled$t.startage<=39,]
# table(add$t.startage)
# table(add$t.endage)
add$t.startage=add$t.startage+55
add$t.endage=add$t.endage+55
# table(add$t.startage)
# table(add$t.endage)
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

get_estimate <- function(chc_num) {  #### Edgar, you may make this in separate runs to save time.
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
	#### fitted values had <0 values in age 0-8 or so. change to 0 cumulative hazard.
	base$hazard[base$hazard<0]=0
	base2 = base %>% 
		mutate(hazard2 = hazard - c(0,hazard[-length(hazard)])) %>%
		ungroup() %>% as.data.frame()

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
	if(chc_num %in% c(6) & sexval==1){
		for_web_BCCT2=matrix(0,nrow=1,ncol=ncoltmp)
	for_web_BCCT=as.data.frame(for_web_BCCT2)
	colnames(for_web_BCCT)=colnames(person_burden[1:75])
	}
	##### if male condition 7, then it is 0 for females.d
	if(chc_num %in% c(7) & sexval==0){
		for_web_BCCT2=matrix(0,nrow=1,ncol=ncoltmp)
	for_web_BCCT=as.data.frame(for_web_BCCT2)
	colnames(for_web_BCCT)=colnames(person_burden[1:ncoltmp])
	}

	for_web_BCCT$chc=chc_num

	return(for_web_BCCT)
}

# this serial loop works
# for(chc_num in chc_nums) {
# 	person_burden=rbind(person_burden, get_estimate(chc_num))
# }

# get estimates
# parallelize across chc_nums
results <- mclapply(X = chc_nums, FUN = get_estimate, mc.cores = cores)

# combine rows into person_burden data frame
for (n in 1:length(results)) {
  row <- results[[n]]
  if (!identical(names(row), names(results[[1]]))) {
    # some rows may have empty column names because they
    # used the columns names from the person_burden table, which
    # is NULL when get_estimate() is run in parallel (see the
    # if() statements in get_estimate())
    # in this situation, use the column names from the first row
    names(row) <- names(results[[1]])
  }
  person_burden <- rbind(person_burden, row)
}

# person_burden[,30:31]
# sum(person_burden[,31])  ## total burden at 50 years old. 8.971574 for this example.

#### The predicated burden for 26 grouped CHCs from age 20 to 95.
# write.csv(person_burden,file=paste("primary",pr,".csv"),row.names=F)
toJSON(person_burden, digits = NA, na = "string")
