#!/bin/bash
set -e
set -u
set -o pipefail

##########################################
#
# Split SNP table into chunks
#
##########################################

#Objective: split a SNP table into chunks of 10,000 SNPs. Shuffle the SNPs prior to chunking so that each chunk has a balanced distribution of chromosomes.

#Usage: bash split_snps.sh <snp_table>

if [[ "$#" -ne 1 ]]
then
    echo "Usage: bash split_snps.sh <snp_table>"
    exit 2
fi

snpTable=$1

#Create a new directory to store the SNP chunks
rm -r -f SNPchunks
mkdir SNPchunks

#Shuffle the SNP table and then split it into chunks of 10,000 SNPs
chunkSize=10000
snpCount=$(cat $snpTable | wc -l)
chunkSuffixLength=$(echo "$snpCount $chunkSize" | awk '{printf int($1/$2)}' | wc -m)
shuf $snpTable | split -a $chunkSuffixLength -d -l $chunkSize - SNPchunks/SNPchunk.
