#!/bin/bash

# Proteinpaint Dev setup

REF=$1
if [[ "$REF" == ""; then
	echo "Please specify a genome reference"
	echo "Usage: ./init.sh [REF] # REF=hg19,hg38,mm9" 
	exit 1
fi

# TO-DO: Change these as needed!!! 
COMMONDIR="/opt/genomeportal/genomefile" # where sequence files will be held
TP="$COMMONDIR/tp" # optional for these to use COMMONDIR
CACHE="$COMMONDIR/cachedir"
BULKFILE="$COMMONDIR/bulkfile"

_mkdir_="sudo mkdir -p" # change to "mkdir -p" as needed



#####################################################
echo "Configuring server config directory names ..."
#####################################################

cp serverconfig.example.json ../serverconfig.json 
sed -i -e "s%_COMMONDIR_%$COMMONDIR%g" ../serverconfig.json
sed -i -e "s%_TP_%$TP%g" ../serverconfig.json
sed -i -e "s%_CACHE_%$CACHE%g" ../serverconfig.json
sed -i -e "s%_BULKFILE_%$BULKFILE%g" ../serverconfig.json



################################################
echo "Creating directories ..."
################################################
# see options to reset $_mkdir_ above

<<cc
$_mkdir_ $TP
$_mkdir_ $TP/hg19
$_mkdir_ $TP/anno
$_mkdir_ $TP/anno/db
$_mkdir_ $CACHE
$_mkdir_ $BULKFILE
cc



######################################################
echo "Downloading/setting up SNP files/db tables ..."
######################################################

# wget http://hgdownload.soe.ucsc.edu/goldenPath/hg19/database/snp146.txt.gz
gunzip snp146.txt.gz
cut -f1,2,3,4,5,10,12 snp146.txt > snp146.hg19
sqlite3 snp146.hg19.db < snp146.hg19.sql


<<cc
# wget http://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/snp146.txt.gz
gunzip snp146.txt.gz
cut -f1,2,3,4,5,10,12 snp146.txt > snp146.hg38
sqlite3 snp146.hg38.db < snp146.hg38.sql
cc



################################################
echo "Downloading supporting data files ..."
################################################

# Get direct dropbox file links from Xin
# for now, manually download files from 
# https://www.dropbox.com/sh/lknut3n7vayfna6/AACx4BEsNIq0fcwVTwybee72a?dl=0



################################################
echo "Processing supporting data files ..."
################################################

# touch all the .tbi files so they are newer than the .gz files
touch *.tbi

<<cc
sudo mv hg19.fa.gz.gzi $COMMONDIR
sudo mv hg38.fa.gz.gzi $COMMONDIR

sudo mv *refGene* $TP/anno
sudo mv *hg19* $TP/anno
sudo mv *hg38* $TP/anno
sudo mv *proteindomain* $TP/anno/db
sudo mv *pediatric $TP/anno/db
sudo mv *defaultIsoform* $TP/anno


# Make uncompressed version of gene annotation files 
# but do not remove the .gz files. This will speed up 
# the loading when starting the ProteinPaint service. 
# The text files should be in the same directory as the .gz files.
cd $TP/anno/
bgzip -d -c refGene.hg19.gz > refGene.hg19
bgzip -d -c refGene.hg38.gz > refGene.hg38
bgzip -d -c gencode.v24.hg19.gz > gencode.v24.hg19
bgzip -d -c gencode.v23.hg38.gz > gencode.v23.hg38
cc



