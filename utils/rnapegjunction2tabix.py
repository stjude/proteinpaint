#!/usr/bin/python3

import sys
import re
import os

if len(sys.argv) == 1:
	print('<input RNApeg output file (1. 1-based junction, 2. count 3. type)> <output file /path/to/basename>')
	sys.exit(1)


infile = sys.argv[1]
outfile = sys.argv[2]


fh = open(infile)
out = open(outfile,'w')
for line in fh:
	if line.startswith('junction'):
		continue
	l = line.strip().split('\t')
	readcount = l[1]
	type = l[2]
	t = re.split('[:,]',l[0])
	chrom = t[0]
	strand = t[2]
	try:
		start = int(t[1])
		stop = int(t[4])
	except:
		print('invalid junction: '+line,file=sys.stderr)
		continue
	out.write('\t'.join([chrom,str(start-1),str(stop-1),strand,type,readcount])+'\n')
fh.close()
out.close()

os.system('sort -k1,1 -k2,2n '+outfile+' > '+outfile+'.sort')
os.system('mv '+outfile+'.sort '+outfile)
os.system('bgzip '+outfile)
os.system('tabix -p bed '+outfile+'.gz')
