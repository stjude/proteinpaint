#!/bin/bash
#set -e
#set -u
#set -o pipefail

#############################################
#
# Update the PRS database with new PRS scores
#
#############################################

if [[ $# -ne 2 ]]
then
    printf "Usage: bash update_prs_db.sh <pgsID> <prsDir>\n"
    printf "\t<prsDir>: directory containing output files of PRS pipline\n"
    exit 2
fi

pgsID=$1
prsDir=$2
ancestryFile=~/tp/files/hg38/sjlife/clinical/PRS/ancestry.prs
annotationFile=~/tp/files/hg38/sjlife/clinical/PRS/annotation.scores
termdbFile=~/tp/files/hg38/sjlife/clinical/PRS/termdb.prs
cd $prsDir

# Update the ancestry.prs file
printf "prs_${pgsID}\tPolygenic Risk Scores\n" >> $ancestryFile
printf "prs_${pgsID}_maf\tPolygenic Risk Scores\n" >> $ancestryFile

# Update the annotation.scores file
for prsFile in *.prs.profile
do
    sed '1d' $prsFile | awk -v pgsID=$pgsID 'BEGIN{FS=OFS="\t"} {print $2,"prs_"pgsID,$4}' >> $annotationFile
done
for prsFile in *.prs.mafFilt.profile
do
    sed '1d' $prsFile | awk -v pgsID=$pgsID 'BEGIN{FS=OFS="\t"} {print $2,"prs_"pgsID"_maf",$4}' >> $annotationFile
done

# Update the termdb.prs file
minScore=$(awk -v pgsID=$pgsID 'BEGIN{FS=OFS="\t"} $2 == "prs_"pgsID' $annotationFile | cut -f 3 | sort -n | head -n 1)
maxScore=$(awk -v pgsID=$pgsID 'BEGIN{FS=OFS="\t"} $2 == "prs_"pgsID' $annotationFile | cut -f 3 | sort -n | tail -n 1)
binSize=$(awk -v minScore=$minScore -v maxScore=$maxScore 'BEGIN { binSize = (maxScore - minScore) / 6; if(binSize >= 1) {printf "%.f", binSize} else if(binSize >= 0.1) {printf "%.1f", binSize} else if(binSize >= 0.01) {printf "%.2f", binSize} else {printf "%.3f", binSize} }')
firstBinStop=$(awk -v minScore=$minScore -v binSize=$binSize 'BEGIN { print minScore + binSize }')
rounding=$(awk -v binSize=$binSize 'BEGIN{ if(binSize >= 1) {print ".0f"} else if(binSize >= 0.1) {print ".1f"} else if(binSize >= 0.01) {print ".2f"} else {print ".3f"} }')
printf "prs_${pgsID}\tprs_${pgsID}\tPolygenic Risk Scores\t{\"name\":\"${pgsID}\",\"id\":\"prs_${pgsID}\",\"isleaf\":true,\"type\":\"float\",\"bins\":{\"default\":{\"rounding\":\"${rounding}\",\"type\":\"regular\",\"bin_size\":${binSize},\"startinclusive\":true,\"first_bin\":{\"stop\":${firstBinStop}}}}}\t0\n" >> $termdbFile
printf "prs_${pgsID}_maf\tprs_${pgsID}_maf\tPolygenic Risk Scores\t{\"name\":\"${pgsID} (MAF>1%%)\",\"id\":\"prs_${pgsID}_maf\",\"isleaf\":true,\"type\":\"float\",\"bins\":{\"default\":{\"rounding\":\"${rounding}\",\"type\":\"regular\",\"bin_size\":${binSize},\"startinclusive\":true,\"first_bin\":{\"stop\":${firstBinStop}}}}}\t0\n" >> $termdbFile
