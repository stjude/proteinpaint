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
binSize=$(awk -v minScore=$minScore -v maxScore=$maxScore 'BEGIN { print (maxScore - minScore) / 6 }')
firstBinStop=$(awk -v minScore=$minScore -v binSize=$binSize 'BEGIN { print minScore + binSize }')
printf "prs_${pgsID}\tprs_${pgsID}\tPolygenic Risk Scores\t{\"name\":\"${pgsID}\",\"id\":\"prs_${pgsID}\",\"isleaf\":true,\"type\":\"float\",\"bins\":{\"default\":{\"type\":\"regular\",\"bin_size\":${binSize},\"startinclusive\":true,\"first_bin\":{\"startunbounded\":true,\"stop\":${firstBinStop}}},\"label_offset\":1}}\t0\n" >> $termdbFile
printf "prs_${pgsID}_maf\tprs_${pgsID}_maf\tPolygenic Risk Scores\t{\"name\":\"${pgsID} (MAF>1%%)\",\"id\":\"prs_${pgsID}_maf\",\"isleaf\":true,\"type\":\"float\",\"bins\":{\"default\":{\"type\":\"regular\",\"bin_size\":${binSize},\"startinclusive\":true,\"first_bin\":{\"startunbounded\":true,\"stop\":${firstBinStop}}},\"label_offset\":1}}\t0\n" >> $termdbFile
