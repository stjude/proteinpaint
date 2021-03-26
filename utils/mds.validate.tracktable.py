#!/usr/bin/python3

import argparse,json,sys,os
import subprocess as sp

parser = argparse.ArgumentParser(description='mds.validate.tracktable.py: This script is used to validate track table.')
parser.add_argument('-t','--trackTable',help='The relative path to the track table file starting from <TP> directory')
args = parser.parse_args()

if not args.trackTable:
	parser.print_help()
	sys.exit(1)
if not os.path.isfile('./bigWigInfo'):
	print("To validate bw file, bigWigInfo(UCSC) has to be put under the same folder with this script!!!",file=sys.stderr)
	sys.exit(1)

#function
def CKBIGWIG(bwfh):
	if not os.path.isfile(bwfh):
		return False,bwfh+": BigWig file does not exist!"
	try:
		INFO = sp.run("./bigWigInfo "+bwfh,shell=True,check=True,stdout=sp.PIPE,stderr=sp.PIPE)
	except:
		return False,bwfh+": This is not a valid bigwig file!"
	return True,'bigwig file validation passed'

def CKSTRBIGWIG(bwfh1,bwfh2):
	for bf in [bwfh1,bwfh2]:
		ckr,cki = CKBIGWIG(bf)
		if not ckr:
			return ckr,cki
	return True,'bigwig stranded files validated!'

def CKAICHECK(aifh):
	if not os.path.isfile(aifh):
		return False,aifh+": aicheck file does not exist!"
	if not os.path.isfile(aifh+'.tbi'):
		return False,aifh+".tbi: index file does not exist!"
	chr = sp.getoutput("tabix -l "+aifh).split('\n')
	if len(chr) < 24:
		return False,aifh+": Total chromosome number less than 24!"	
	return True,'aicheck file validated'


TPPATH = os.path.split(os.getcwd())[0]
TableFile = os.path.join(TPPATH,args.trackTable)
if not os.path.isfile(TableFile):
	print("Error: Track table file does not exist!!!",file=sys.stderr)
	sys.exit(1)

fh = open(TableFile)
start = 0
for line in fh:
	line = line.strip()
	if not line:
		continue
	start += 1
	L = line.split('\t')
	print(str(start)+' finished\t'+L[0])
	SampleNam = L[0]
	AssayNam = L[1]
	JS = json.loads(L[2])
	Type = JS['type']
	if Type == 'bigwig':
		bwfile = os.path.join(TPPATH,JS['file'])
		CKResult,CKInfo = CKBIGWIG(bwfile)
	elif Type == 'bigwigstranded':
		bwfile1 = os.path.join(TPPATH,JS['strand1']['file'])
		bwfile2 = os.path.join(TPPATH,JS['strand2']['file'])
		CKResult,CKInfo = CKSTRBIGWIG(bwfile1,bwfile2)
	elif Type == 'aicheck':
		aifile = os.path.join(TPPATH,JS['file'])
		CKResult,CKInfo = CKAICHECK(aifile)
	else:
		continue
	if not CKResult:
		print(CKInfo,file=sys.stderr)
		sys.exit(1)
fh.close()

print('All track table file are validated!!!')

