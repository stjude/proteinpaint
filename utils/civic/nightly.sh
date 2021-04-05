#!/bin/bash
#BSUB -P PCGP
#BSUB -q standard
#BSUB -n 1
#BSUB -R "rusage[mem=3000]"
#BSUB -J civic_update
#BSUB -o civic_update_log
#BSUB -e civic_update_elog

source /etc/bashrc.modules # Necessary for loading modules in the job script
source /home/rpaul1/.bashrc # Necessary for loading variables and path to locally-installed software in the job script

cd ~/tp/rpaul1
if [ -f "nightly-civic_accepted_and_submitted.vcf" ]; then
  rm nightly-civic_accepted_and_submitted.vcf*
fi

if [ -f "CIViC.hg19.vcf.gz" ]; then
  rm CIViC.hg19.vcf.gz*
fi

cd ~/tp/rpaul1 && wget https://civicdb.org/downloads/nightly/nightly-civic_accepted_and_submitted.vcf && python CIViC_VCF.py nightly-civic_accepted_and_submitted.vcf CIViC.hg19.vcf /research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/mds/genome/hg19.fai > cronjob.CIViC.output.txt 2> cronjob.CIViC.error.txt && sleep 30m && cd ~/tp/rpaul1 && cp CIViC.hg19.vcf.gz* ../hg19 && rm CIViC.hg19.vcf.gz* nightly-civic_accepted_and_submitted.vcf && scp ../hg19/CIViC.hg19.vcf.gz* gnomeuser@svldtemp01.stjude.org:/home/gnomeuser && ssh -t gnomeuser@svldtemp01.stjude.org " 
   scp CIViC.hg19.vcf.gz* genomeuser@pp-prp1.stjude.org:/opt/data/pp/tp/hg19 && rm CIViC.hg19.vcf.gz* 
"

cd ~/tp/rpaul1
if [ -f "nightly-civic_accepted_and_submitted.vcf*" ]; then
  rm nightly-civic_accepted_and_submitted.vcf*
fi

if [ -f "CIViC.hg19.vcf.gz" ]; then
  rm CIViC.hg19.vcf.gz*
fi
