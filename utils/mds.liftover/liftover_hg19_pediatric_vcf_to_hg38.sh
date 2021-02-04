#!/bin/bash
#BSUB -P PCGP
#BSUB -J liftover_hg19_pediatric_vcf_to_hg38
#BSUB -oo liftover_hg19_pediatric_vcf_to_hg38.out
#BSUB -eo liftover_hg19_pediatric_vcf_to_hg38.err

##########################################
#
# Liftover hg19 pediatric VCF to hg38
#
##########################################

#Objective: liftover the hg19 coordinates of the pediatric VCF file to hg38 coordinates. Discard hg38 coordinates that are not on fully assembled chromosomes.

module load python/3.7.0 htslib/1.10.2 bcftools/1.10.2 liftover/111417

#Convert the hg19 pediatric VCF file to an SQlite file
python3 ~/tp/utils/VCF2SQLite.py --vcf ~/tp/hg19/Pediatric/pediatric.hg19.vcf.gz --output pediatric.hg19.vcf.sqlite --anno --rsid

#Liftover the hg19 coordinates within the SQlite file to hg38 coordinates. Only consider coordinates from fully assembled chromosomes.
python3 liftover_hg19_pediatric_vcf_sqlite_to_hg38.py

#Convert the hg38 pediatric SQLite file to a VCF file
python3 ~/tp/utils/SQLite2VCF.py --JFfile pediatric.hg38.vcf.sqlite --header pediatric_hg38_vcfHeader.txt --output pediatric.hg38.vcf --anno --rsid

#Sort, compress, and index the hg38 pediatric VCF file
bcftools sort -T ./ -o pediatric.hg38.vcf.temp pediatric.hg38.vcf
rm pediatric.hg38.vcf
mv pediatric.hg38.vcf.temp pediatric.hg38.vcf
bgzip -f pediatric.hg38.vcf
tabix -f -p vcf pediatric.hg38.vcf.gz

#Validate the VCF file
python3 ~/tp/utils/mds.validate.vcf.py --vcf pediatric.hg38.vcf.gz

#Remove temporary files
rm *vcf.sqlite*


