#!/usr/bin/python3

import json,sys,re,gzip
import argparse

parser = argparse.ArgumentParser(description="validation of vcf file for MDS")
parser.add_argument('-v','--vcf',help='vcf file')
args=parser.parse_args()

if not args.vcf:
	parser.print_help()
	sys.exit(1)

#_______________________________
#functions

#extract header info
def GETINFO(l):
	if l.startswith('##FORMAT'):
		FORMAT.append(re.search("ID=(.*?),",l).group(1))
	elif l.startswith('##contig'):
		CHROMSOME.append(re.search("ID=(.*?),",l).group(1))
	elif l.startswith('#CHROM'):
		SAMPLES.extend(l.strip().split('\t')[9:])
#required fileds check

#check chromsome
def CKCHROM(c):
	if c not in CHROMSOME:
		print("Erro: Chromsome: "+c+" is not a valid chromsome value!",file=sys.stderr)
		sys.exit(1) 
#check insertion or deletion coordinate system
def CKINSPOS(r,a):
	if not r.replace('-','').strip() or not a.replace('-','').strip():
		print("Erro: Please use the correct coordinate system(use the base BEFORE the insertion or deletion)",file=sys.stderr)
		sys.exit(1)

#check if sample value length is eaqual to format length
def CKSAMVALLEN(f,v):
	SAMVALLENSET = set(v)
	CONVS = {ev for ev in SAMVALLENSET if len(ev.split(':')) != len(f.split(':'))}
	if CONVS:
		print("Erro: the length of info is not equal to FORMAT length "+f,file=sys.stderr)
		sys.exit(1)

#Get samples missing pubmed ID
def GETSAMNOPMID(f,v):
	if 'pmid' in f:
		FORMATL = f.split(':')
		fidx = FORMATL.index('pmid')
		SAM = {SAMPLES[x] for x,ev in enumerate(v) if ev.split(':')[fidx] == '.' and ',' in ev}
		if SAM:
			return SAM
		else:
			return False

#vcf file
vcf = args.vcf
if vcf.endswith('.gz'):
	vcffh = gzip.open(vcf)
else:
	vcffh = open(vcf)


FORMAT = []
CHROMSOME = []
SAMPLES = []
CASES = 0
SAMNOPMID = set()
for vcf in vcffh:
	if isinstance(vcf,bytes):
		vcf = vcf.decode('utf-8')
	if vcf.startswith('#'):
		GETINFO(vcf)
		continue
	line = vcf.replace('\n','')
	L = line.split('\t')
	CKCHROM(L[0]) #check if chromsome is consistant with header contigs 
	if len(L[3]) != len(L[4]): #check insertion or deletion coordinate system
		CKINSPOS(L[3],L[4])
	if L[7] == '.': #Check if VEP annotated
		print("Erro: Please annotate VCF file using VEP",file=sys.stderr)
		sys.exit(1)
	CKSAMVALLEN(L[8],L[9:]) #check if sample value length is eaqual to format length
	SAMSMISSPID = GETSAMNOPMID(L[8],L[9:])
	if SAMSMISSPID:
		SAMNOPMID = SAMNOPMID.union(SAMSMISSPID)
	CASE = [1 for x in L[9:] if ',' in x]
	CASES += len(CASE)
vcffh.close()


#OUTPUT statinfo
print('Chromsomes are consistant with header contigs!')
print('Coordinate system for INDELS is correct!')
print('No info was missed for elements in FORMAT field!')
print('VCF file is successfully validated\n\n')

print("SAMPLES missing pmid:")
for sam in SAMNOPMID:
	print(sam)

print('\nTotal cases:')
print(CASES)
