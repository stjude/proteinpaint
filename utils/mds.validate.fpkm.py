#!/usr/bin/python3

"""mds.validate.fpkm.py: fpkm file(pediatric.fpkm.hg19.gz) validator used for mds.
"""
import argparse
import gzip,json,sys

parser = argparse.ArgumentParser(description="mds.validate.fpkm.py: fpkm file(pediatric.fpkm.hg19.gz) validator used for mds.")
parser.add_argument('-f','--fpkm',help='fpkm file')
args = parser.parse_args()

if not args.fpkm:
	parser.print_help()
	sys.exit(1)

#functions
def CKSAMVALGENE(j):
	for k in ['sample','value','gene']:
		if k not in j:
			return False
	return True


#FPKMFILE = '/research/rgs01/resgen/legacy/gb_customTracks/tp/hg19/Pediatric/pediatric.fpkm.hg19.gz'
fpkmfh = gzip.open(args.fpkm,'rb')

HeaderSample = set(fpkmfh.readline().decode('utf-8').strip().split(' ')[1:])
DATASAM = set()
for line in fpkmfh:
	line = line.decode('utf-8')
	L = line.strip().split('\t')
	JS = json.loads(L[3])
	RCK = CKSAMVALGENE(JS)
	if not RCK:
		print("one of required keys(sample,value,gene) not exists.\t" + line,file=sys.stderr)
		sys.exit(1)
	VAL = JS['value']
	if not type(VAL) == float and not type(VAL) == int:
		print("expression value is not numerical!\t" + line,file=sys.stderr)
		sys.exit(1)
	SamNam = JS['sample']
	DATASAM.add(SamNam)
fpkmfh.close()

if HeaderSample != DATASAM:
	print("The samples in header are not exactly same as in data", file=sys.stderr)
	sys.exit(1)
print('fpkm file is good to use for MDS')

