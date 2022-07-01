#!/usr/bin/python3

script_description="""
change sample name of bcf file and fusion bedj file to intger id
This script will generate reheadered bcf file and fusion bedj file
inputfile: 
	   bcf file
	   fusion compressed bedj file
	   sample file with two columns seperated with space. The columns name is 'old_name new_name'
outputfile:
	   reheadered bcf file with compression level of 1
	   reheadered fusion bedj file
			
"""

import os
import sys
import gzip
import json
import argparse
from argparse import RawTextHelpFormatter


parser = argparse.ArgumentParser(description=script_description,formatter_class=RawTextHelpFormatter)
parser.add_argument('-b','--bcf',help='input bcf file')
parser.add_argument('-f','--fusion',help='input fusion file')
parser.add_argument('-s','--sample',help='sample file')
parser.add_argument('--out_bcf',help='output bcf file name (e.g. panall.hg38.bcf.gz)')
parser.add_argument('--out_fusion',help='output fusion file name (e.g. panall.svfusion.hg38.gz)')
args = parser.parse_args()

def PARMTST(param):
	for p in param:
		if not vars(args)[p]:
			return False
	return True


#test parameters
parmTest = PARMTST(['bcf','fusion','sample','out_bcf','out_fusion'])
if not parmTest:
	parser.print_help()
	sys.exit(1)



sampleidmap = args.sample
bcffile = args.bcf
fusionfile = args.fusion


#generate sample match dictionary NAMatch
samfh = open(sampleidmap)
NAMatch = {} #dictionary with sample name as key and intger ID as value
for line in samfh:
	l = line.strip().split(' ')
	NAMatch[l[0]] = l[1]
samfh.close()


#reheader bcf file
print('reheadering bcf file')
#generate x.bcf.gz
os.system('bcftools reheader -o x.bcf.gz -s '+sampleidmap+' '+bcffile)
#change the bcf file compression level to 1 
#generate x1.bcf.gz
os.system('bcftools view -l 1 --no-version -O b -o x1.bcf.gz x.bcf.gz')
#index bcf file
os.system('bcftools index x1.bcf.gz')
os.system('mv x1.bcf.gz '+args.out_bcf)
os.system('mv x1.bcf.gz.csi '+args.out_bcf+'.csi')
os.system('rm -f x.bcf.gz')

#reheader fusion file
fh = gzip.open(fusionfile)
out = open('fusion.rename','w')
#change the sample name in header line
namlinel = fh.readline().decode('utf-8').strip().split(' ')
newnamlinel = [NAMatch[x] if x in NAMatch else x for x in namlinel[1:]]
out.write(' '.join([namlinel[0]]+newnamlinel)+'\n')
for line in fh:
	l = line.decode('utf-8').strip().split('\t')
	JS = json.loads(l[3])
	if JS['sample'] in NAMatch: 
		JS['sample'] = int(NAMatch[JS['sample']])
	out.write('\t'.join(l[0:3]+[json.dumps(JS, sort_keys=True)])+'\n')
out.close()
fh.close()
os.system('bgzip fusion.rename')
os.system('tabix -p bed -c"#sample" fusion.rename.gz')
os.system('mv fusion.rename.gz '+args.out_fusion)
os.system('mv fusion.rename.gz.tbi '+args.out_fusion+'.tbi')
