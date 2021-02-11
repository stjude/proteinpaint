#!/bin/bash
#BSUB -P PCGP
#BSUB -J liftover_hg19_pediatric_svcnv_to_hg38
#BSUB -oo liftover_hg19_pediatric_svcnv_to_hg38.out
#BSUB -eo liftover_hg19_pediatric_svcnv_to_hg38.err

##########################################
#
# Liftover hg19 pediatric SVCNV to hg38
#
##########################################

#Objective: liftover the hg19 coordinates of the pediatric SVCNV file to hg38 coordinates. Discard hg38 coordinates that are not on fully assembled chromosomes.

module load python/3.7.0 htslib/1.10.2 liftover/111417

#Decompress the hg19 pediatric SVCNV file
zcat ~/tp/hg19/Pediatric/pediatric.svcnv.hg19.gz > pediatric.svcnv.hg19

#Liftover the hg19 coordinates within the pediatric SVCNV file to hg38 coordinates
python3 liftover_hg19_pediatric_svcnv_to_hg38.py

#Sort, compress and index the pediatric hg38 SVCNV file
head -n 1 pediatric.svcnv.hg38 > pediatric_svcnv_hg38_header.txt
sed '1d' pediatric.svcnv.hg38 | sort -k1,1 -k2,2n > pediatric.svcnv.hg38.noHeader.sorted
cat pediatric_svcnv_hg38_header.txt pediatric.svcnv.hg38.noHeader.sorted > pediatric.svcnv.hg38.sorted
rm pediatric.svcnv.hg38
mv pediatric.svcnv.hg38.sorted pediatric.svcnv.hg38
bgzip -f pediatric.svcnv.hg38
tabix -f -p bed pediatric.svcnv.hg38.gz

#Validate the pediatric hg38 SVCNV file
node ~/tp/utils/mds.validate.svcnv.js pediatric.svcnv.hg38.gz

#Remove temporary files
rm pediatric.svcnv.hg19 *.svcnv.*.bed pediatric.svcnv.hg38.noHeader.sorted pediatric_svcnv_hg38_header.txt


