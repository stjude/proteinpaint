#!/usr/bin/python

from optparse import OptionParser
import sys,re,os

if __name__ == '__main__':
	parser = OptionParser()
	parser.add_option("-B","--BAM", dest="BAM", help="The bam file", metavar = "BAM")
	parser.add_option("-a", "--chrA", dest = "CHRA", help="The first chromosome where SV occur", metavar = "ChrA")
	parser.add_option("-b", "--chrB", dest = "CHRB", help="The second chromosome where SV occur", metavar = "ChrB")
	parser.add_option("-1", "--POSA", type = "int", dest = "POSA", help = "The coordinate of SV on the first chromosome",metavar = "CoordinateA_Number")
	parser.add_option("-2", "--POSB", type = "int", dest = "POSB", help = "The coordinate of SV on the second chromosome", metavar = "CoordinateB_Number")
	parser.add_option("-o", "--OUT", dest = "OUT", help = "Only two values allowed for the output type: count or fasta", metavar = "count/fasta")
	parser.add_option("-s", "--SIZE", type = "int", dest = "SIZE", help = "The size cutoff between two breakpoints on same chromosome", metavar = "SIZE_Number")	

	(options,args) = parser.parse_args()


	#if no options were given by the user, print help and exit
	if len(sys.argv) == 1:
		parser.print_help()
		exit(0)

	if options.CHRA == options.CHRB and abs(options.POSA - options.POSB) < options.SIZE:
		print("Breakpoints2close")
		exit(-1)
	
	R_P = {}
	Reads = {}
	

	#for chrA:posA
	left = options.POSA - 2000
	right = options.POSA + 2000
	for read in os.popen("samtools view " + options.BAM + " " + options.CHRA + ":" + str(left) + "-" + str(right)):
		(qname, flag, rname, pos, mapq, cigar, mrnm,  mpos, tlen, seq, qual) = read.strip().split('\t')[0:11]
		if options.CHRA == options.CHRB:
			if mrnm == "=" and abs(int(tlen)) > options.SIZE:
				if qname in R_P:
					if ("chr"+rname+"."+pos) not in R_P[qname]:
						R_P[qname].append("chr"+rname+"."+pos)
						Reads["chr"+rname+"."+pos] = seq
					else:
						continue
				else:
					R_P[qname] = ["chr"+rname+"."+pos]
					Reads["chr"+rname+"."+pos] = seq
		else:
			if mrnm == str(options.CHRB):
				if qname in R_P:
					if ("chr"+rname+"."+pos) not in R_P[qname]:
						R_P[qname].append("chr"+rname+"."+pos)
						Reads["chr"+rname+"."+pos] = seq
					else:
						continue
				else:
					R_P[qname] = ["chr"+rname+"."+pos]
					Reads["chr"+rname+"."+pos] = seq
	#print(R_P)
	#print(Reads)

	#for chrB:posB
	left = options.POSB - 2000
	right = options.POSB + 2000
	for read in os.popen("samtools view " + options.BAM + " " + options.CHRB + ":" + str(left) + "-" + str(right)):
		(qname, flag, rname, pos, mapq, cigar, mrnm,  mpos, tlen, seq, qual) = read.strip().split('\t')[0:11]
		if options.CHRA == options.CHRB:
			if mrnm == "=" and abs(int(tlen)) > options.SIZE:
				if qname in R_P:
					if ("chr"+rname+"."+pos) not in R_P[qname]:
						R_P[qname].append("chr"+rname+"."+pos)
						Reads["chr"+rname+"."+pos] = seq
					else:
						continue
				else:
					R_P[qname] = ["chr"+rname+"."+pos]
					Reads["chr"+rname+"."+pos] = seq
		else:
			if mrnm == str(options.CHRA):
				if qname in R_P:
					if ("chr"+rname+"."+pos) not in R_P[qname]:
						R_P[qname].append("chr"+rname+"."+pos)
						Reads["chr"+rname+"."+pos] = seq
					else:
						continue
				else:
					R_P[qname] = ["chr"+rname+"."+pos]
					Reads["chr"+rname+"."+pos] = seq
	#print(R_P)
	#print(Reads)
	#output results
	if options.OUT == "count":
		F_A = []
		for rk in sorted(R_P.keys()):
			if isinstance(R_P[rk],list) and len(R_P[rk]) >1:
				F_A.append(R_P[rk][0]+"\t"+R_P[rk][1])
		
		print(str(len(set(F_A)))+"\n")
	elif options.OUT == "fasta":
		F_A = []
		for rk in sorted(R_P.keys()):
			if isinstance(R_P[rk],list) and len(R_P[rk]) >1:
				header = rk
				seq = ""
				if (R_P[rk][0]+"\t"+R_P[rk][1]) not in F_A:
					for locus in sorted(R_P[rk]):
						seq += "\n" + Reads[locus]
						header += "\t"+locus
					print(">"+header+seq+"\n")
					F_A.append(R_P[rk][0]+"\t"+R_P[rk][1])
				else:
					pass
	else:
		pass
