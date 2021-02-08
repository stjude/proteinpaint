=============================================
Liftover hg19 pediatric datasets to hg38
=============================================

Liftover the hg19 coordinates of the pediatric SVCNV, VCF, and FPKM files to hg38 coordinates. Only hg38 coordinates from fully assembled chromosomes (e.g. chr1-chr22, chrX, chrY, and chrM) are retained.

There are 3 bash scripts in this directory, each for lifting over a specific pediatric file type (SVCNV, VCF, or FPKM). The input for each script is a compressed hg19 pediatric file from the following directory:
 
	~/tp/hg19/Pediatric/

The output of each script is a compressed hg38 pediatric file (.gz) and an indexed hg38 pediatric file (.gz.tbi).

Each script depends on an hg19-to-hg38 liftover chain file. This file can be downloaded from the UCSC Genome Browser: http://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver (file: "hg19ToHg38.over.chain.gz"). Store the chain file in the same directory as the liftover scripts.

The standard output and error of each script are stored in ".out" and ".err" files, respectively.


================
SVCNV liftover
================

Run the SVCNV liftover pipeline as a batch job:

	bsub < liftover_hg19_pediatric_svcnv_to_hg38.sh

The output files are stored in the current directory as follows:

	pediatric.svcnv.hg38.gz
	pediatric.svcnv.hg38.gz.tbi


================
VCF liftover
================

Run the VCF liftover pipeline as a batch job:

	bsub < liftover_hg19_pediatric_vcf_to_hg38.sh

The output files are stored in the current directory as follows:

	pediatric.hg38.vcf.gz
	pediatric.hg38.vcf.gz.tbi

Note: the chromosome information within the header of the hg38 VCF file (i.e. lines beginning with "##contig=") is associated with hg38 chromosomes.


================
FPKM liftover
================

Run the FPKM liftover pipeline as a batch job:

        bsub < liftover_hg19_pediatric_fpkm_to_hg38.sh

The output files are stored in the current directory as follows:

        pediatric.fpkm.hg38.gz
        pediatric.fpkm.hg38.gz.tbi


