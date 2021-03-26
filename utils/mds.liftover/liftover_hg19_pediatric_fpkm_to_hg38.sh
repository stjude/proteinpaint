#!/bin/bash
#BSUB -P PCGP
#BSUB -J liftover_hg19_pediatric_fpkm_to_hg38
#BSUB -oo liftover_hg19_pediatric_fpkm_to_hg38.out
#BSUB -eo liftover_hg19_pediatric_fpkm_to_hg38.err

##########################################
#
# Liftover hg19 pediatric FPKM to hg38
#
##########################################

#Objective: liftover the hg19 coordinates of the pediatric FPKM file to hg38 coordinates. Discard hg38 coordinates that are not on fully assembled chromosomes.

module load python/3.7.0 htslib/1.10.2 liftover/111417

#Decompress the hg19 pediatric FPKM file
zcat ~/tp/hg19/Pediatric/pediatric.fpkm.hg19.gz > pediatric.fpkm.hg19

#Create a BED file of unique hg19 coordinates. Store a copy of each coordinate in the 4th column.
sed '1d' pediatric.fpkm.hg19 | awk 'BEGIN{FS=OFS="\t"} {print $1,$2,$3,$1"-"$2"-"$3}' | uniq > pediatric.fpkm.hg19.bed

#Liftover hg19 coordinates to hg38 coordinates
liftOver pediatric.fpkm.hg19.bed hg19ToHg38.over.chain.gz pediatric.fpkm.hg38.bed unlifted.pediatric.fpkm.hg19.bed

#Convert the hg19 coordinates within the pediatric FPKM file to hg38 coordinates
python3 liftover_hg19_pediatric_fpkm_to_hg38.py

#Sort, compress and index the pediatric hg38 FPKM file
head -n 1 pediatric.fpkm.hg38 > pediatric_fpkm_hg38_header.txt
sed '1d' pediatric.fpkm.hg38 | sort -k1,1 -k2,2n > pediatric.fpkm.hg38.noHeader.sorted
cat pediatric_fpkm_hg38_header.txt pediatric.fpkm.hg38.noHeader.sorted > pediatric.fpkm.hg38.sorted
rm pediatric.fpkm.hg38
mv pediatric.fpkm.hg38.sorted pediatric.fpkm.hg38
bgzip -f pediatric.fpkm.hg38
tabix -f -p bed pediatric.fpkm.hg38.gz

#Validate the pediatric hg38 FPKM file
python3 ~/tp/utils/mds.validate.fpkm.py --fpkm pediatric.fpkm.hg38.gz

#Remove temporary files
rm pediatric.fpkm.hg19 *.fpkm.*.bed pediatric.fpkm.hg38.noHeader.sorted pediatric_fpkm_hg38_header.txt


