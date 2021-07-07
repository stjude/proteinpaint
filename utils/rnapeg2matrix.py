#!/usr/bin/python3

script_descript="""
python script to make matrix file from rnapeg output files
Parameters:
--rnapegTable: tab-delimited file with two columns (sample_name in 1st column followed by path to rnapeg output file)
or
--directory: absolute path to the folder where all rnapeg output files were put
             in this case, rnapeg output file name should be same as sample name
--OUTPUT:    output matrix file
"""

import os,sys
import argparse
from argparse import RawTextHelpFormatter

parser = argparse.ArgumentParser(description=script_descript,formatter_class=RawTextHelpFormatter)
group = parser.add_mutually_exclusive_group()
group.add_argument('--rnapegTable',help='tab-delimited file with two columns (sample_name in 1st column followed by path to rnapeg output file)')
group.add_argument('--directory',help='absolute path to the folder where all rnapeg output files were put. rnapeg output file name should be same as sample name')
parser.add_argument('-o','--OUTPUT',help='output matrix file')
args=parser.parse_args()


########
#function
#chromosme, position, type and readcount info
def RNAPEG2JUNC(sample,pegfile):
	pegfh = open(pegfile)
	for pegline in pegfh:
		if pegline.startswith('junction'):
			continue
		l = pegline.strip().split('\t')
		gcor = l[0].replace(',',':').split(':')
		chra,posa,stda,chrb,posb,stdb = gcor
		if not chra.startswith('chr') and not chrb.startswith('chr'):
			continue
		if chra != chrb or stda != stdb:
			continue
		posa = int(posa)
		posb = int(posb)
		if posa > posb:
			continue
		posa,posb = list(map(str,[posa-1,posb-1]))
		jid = '.'.join([chra,posa,posb,'+',l[2]])
		if not jid in JUNCTION:
			JUNCTION[jid] = {sample:l[1]}
		else:
			JUNCTION[jid].update({sample:l[1]})
	pegfh.close()
	return True

######
#sample
SAMPLES = []
#junction
JUNCTION = {}
#rnapegFile
rnapegFile = {} #{sample:rnapegFile}
if args.rnapegTable:
	fh = open(args.rnapegTable)
	for line in fh:
		l = line.strip().split('\t')
		rnapegFile[l[0]] = l[1] 
	fh.close()
elif args.directory:
	rnapegFile = {x:os.path.join(args.directory,x) for x in os.listdir(args.directory)}
else:
	parser.print_help(sys.stderr)
	sys.exit(1)

#convert rnapeg output to matrix
for s in rnapegFile:
	SAMPLES.append(s)
	RT = RNAPEG2JUNC(s,rnapegFile[s])
	if not RT:
		print('There could be a problem with '+rnapegFile[s])
		print('Processing broken!')
		sys.exit(1)
#output
out = open(args.OUTPUT,'w')
out.write('\t'.join(['#chr','start','stop','strand','type']+SAMPLES)+'\n')
for id in JUNCTION:
	valL = ['']*len(SAMPLES)
	for s in JUNCTION[id]:
		idx = SAMPLES.index(s)
		valL[idx] = JUNCTION[id][s]
	out.write('\t'.join(id.split('.')+valL)+'\n')
out.close()

