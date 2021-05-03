#!/usr/bin/python3

import sys
import os

#####
#function

#check if multiple alternative allele exists
def MUTIALLECK(alt):
	if ',' in alt:
		return True
	else:
		return False
#replace CSQ with civic_csq in INFO field
def GENINFO(c):
	cl = c.split(';')
	return ';'.join(cl[0:2]+['civic_csq'+cl[2][3:]])

	
if len(sys.argv) != 4:
	print('Usage: python3 '+sys.argv[0]+' <CIViC input vcf file> <output vcf file> <reference genome fai file>')
	sys.exit(1)

#generate new vcf file
vcfinfile = open(sys.argv[1])
vcfout = open(sys.argv[2],'w')

for line in vcfinfile:
	if line.startswith('##INFO=<ID=CSQ'):
		newline = line.replace('<ID=CSQ','<ID=civic_csq')
		vcfout.write(newline)
		#out.write('##INFO=<ID=ST,Number=.,Type=String,Description="CIViC Entity Status, accepted or submitted">\n')
	elif line.startswith('#'):
		vcfout.write(line)
	else:
		L = line.strip().split('\t')
		mutck = MUTIALLECK(L[4])
		if mutck:
			print('Multiple alternative allele: '+'@'.join(L[0:2]+L[3:5]),file=sys.stderr)
			continue
		info = GENINFO(L[-1])
		vcfout.write('\t'.join(L[0:-1]+[info])+'\n')
vcfout.close()
vcfinfile.close()

#generate bash sh file to add contig info to vcf file
#sort vcf file
#vep annotate, bgzip and index vcf file
vcfoutfile = sys.argv[2]
shout = open('civic.sh','w')
shout.write('bcftools reheader -f '+sys.argv[3]+' -o x.vcf '+vcfoutfile+'\n')
shout.write('bcftools sort -o x.sort.vcf -T ./ x.vcf\n')
shout.write('mv x.sort.vcf '+vcfoutfile+'\nrm -f x.vcf\n')
shout.write('bsub -q gpu_rhel7 -P PCGP -o vep.log -e vep.elog -R "rusage[mem=20000]" -J CIViCvep "module load perl/5.10.1; vep --cache \
--cache_version 96 --refseq --assembly GRCh37 --dir /research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/VEP/.vep \
--offline --hgvs --fasta /research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/VEP/Homo_sapiens.GRCh37.75.dna.toplevel.fa.gz \
-i '+vcfoutfile+' --vcf --no_stats -o vep.'+vcfoutfile+'"\n')
shout.write('bsub -q gpu_rhel7 -P PCGP -w \'done(CIViCvep)\' -o vcfbgzipidx.log -e vcfbgzipidx.elog "mv vep.'+vcfoutfile+' '+vcfoutfile+'; bgzip '+vcfoutfile+\
		';tabix -p vcf '+vcfoutfile+'.gz"')
shout.close()
os.system('sh civic.sh')
