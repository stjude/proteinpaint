#!/usr/bin/python3
"""
vcf file validation:
1. if number of columns consistant with the number in header line
2. check if chromsome is consistant with header contigs
3. check if VEP annotated
4. check if sample contain all values for each element of FORMAT field and Cases
5. check if position of insertion or deletion starts with the one nucleotide before the insertion or deletion site
6. and more... including total number of variants from each chromosome and total cases.
"""
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
def PARSEMETAINFO(metaInfoL):
# retrieve few informations from meta info lines
# 1. total number of columns in header line
# 2. formats in meta info lines
# 3. all chromosomes in meta info lines
	colnum = 0
	format = []
	allchrom = []
	info = []
	for m in metaInfoL:
		if m.startswith('#CHROM'):
			colnum = len(m.strip().split('\t'))
		if m.startswith('##FORMAT'):
			format.append(re.search("ID=(.*?),",m).group(1))
		if m.startswith('##contig'):
			allchrom.append(re.search("ID=(.*?),",m).group(1))
	return colnum,format,allchrom		
def CHECKVAR(varL,colN,chrs):
	# 1. if number of columns consistant with the number in header line
	if len(varL) < colN:
		ColNumCK = 'less'
	elif len(varL) > colN:
		ColNumCK = 'more'
	else:
		ColNumCK = []
	# 2. check if chromsome is consistant with header contigs
	if varL[0] in chrs:
		DiffChr = 'Same'
	else:
		DiffChr = 'Diff'
	# 3. check if VEP annotated
	if 'CSQ' in varL[7]:
		vep = True
	else:
		vep = False
	# 4. check if sample contain all values for each element of FORMAT field and Cases
	if len(varL) > 10:
		SAMVALLENSET = varL[9:]
		CONVS = {ev for ev in SAMVALLENSET if len(ev.split(':')) != len(varL[8].split(':'))}
		if CONVS:
			AllValIn = False
		else:
			AllValIn = True
		EMTCASE = ':'.join(['.']*len(varL[8].split(':')))
		CASES = len([1 for x in SAMVALLENSET if x != EMTCASE])
	else:
		AllValIn = 'NA'
		CASES = 'NA'
	# 5. check if position of insertion or deletion starts with the one nucleotide before the insertion or deletion site
	CORSYS = True
	if len(varL[3]) != len(varL[4]):
		if not varL[3].replace('-','').strip() or not varL[4].replace('-','').strip():
			CORSYS = False
	return ColNumCK,DiffChr,vep,AllValIn,CORSYS,CASES
		
	




#vcf file
vcf = args.vcf
if vcf.endswith('.gz'):
	vcffh = gzip.open(vcf)
else:
	vcffh = open(vcf)

#ColNum = 0 #Header line coloumn number
#FORMAT = [] #Formats in VCF meta info lines
#CHROMOSOMES = [] # All chromosomes in VCF meta info lines
metainfo = [] # Meta-information lines

#CK PART
MissCHR = [] # 2
NCOR = [] # 5
SAMFORMTVAL = [] # 4
VEPANNO = True # 3
VarMissCol = {'less':[],'more':[]} # 1
TOTALCASE = 0
VARNumPerC = {}
for vcf in vcffh:
	if isinstance(vcf,bytes):
		vcf = vcf.decode('utf-8')
	if vcf.startswith('#'):
		metainfo.append(vcf)
		continue
	ColNum,FORMAT,CHROMOSOMES = PARSEMETAINFO(metainfo)
	L = vcf.strip().split('\t')
	ID = '\t'.join(L[0:2]+L[3:5])
	ColNumCK,DiffCHR,VEP,ALLVALIN,CORSYS,CASES = CHECKVAR(L,ColNum,CHROMOSOMES)
	# 1 
	if ColNumCK:
		VarMissCol[ColNumCK].append(ID)
	# 2
	if DiffCHR == 'Diff' and L[0] not in MissCHR:
		MissCHR.append(L[0])

	# 3
	if VEPANNO and not VEP:
		VEPANNO = False

	# 4
	if ALLVALIN != 'NA':
		if not ALLVALIN:
			SAMFORMTVAL.append(ID)
	if CASES != 'NA':
		TOTALCASE += CASES
	
	# 5
	if not CORSYS:
		NCOR.append(ID)

	if L[0] not in VARNumPerC: #Total number of variants on each chr
		VARNumPerC[L[0]] = 1
	else:
		VARNumPerC[L[0]] += 1
vcffh.close()

print('VCF file stats:')

# 1
print('1. Check if number of columns for each variant consistant with the number in header line:')
if VarMissCol['less'] or VarMissCol['more']:
	print('\tVariants with more columns:')
	for i in VarMissCol['more']:
		print('\t\t'+i)
	print('\tVariants with less columns:')
	for i in VarMissCol['less']:
		print('\t\t'+i)
else:
	print('\tYes')

# 2
print('2. check if chromsome is consistant with header contigs:')
if MissCHR:
	print('\tThe following chromosomes from variants can not be found from VCF meta info lines:')
	for c in MissCHR:
		print('\t\t'+c)

# 3
print('3. check if VEP annotated:')
if not VEPANNO:
	print('\tNo VEP annotation for some or all Variants.')
else:
	print('\tVEP annotated')

# 4
print('4. check if sample contain all values for each element of FORMAT field and Cases')
if SAMFORMTVAL:
	print('\tSome of values from FORMAT field are missed from samples in the following variants:')
	for v in SAMFORMTVAL:
		print('\t'+v)
else:
	print('\tVerified!')
print('\tTotal number of cases: '+str(TOTALCASE))

# 5
print('5. check if position of insertion or deletion starts with the one nucleotide before the insertion or deletion site')
if NCOR:
	print('\tThe coordinate system was not correct for total str(len(NCOR)) indels!')
else:
	print('\tVerified!\n')

# more
print('more...\n')
TotalVar = 0

print('Total variants on each chromosome:')
for c in VARNumPerC:
	print('\tchr'+c+'\t'+str(VARNumPerC[c]))
	TotalVar += VARNumPerC[c]

print('\nTotal variants: '+str(TotalVar))
