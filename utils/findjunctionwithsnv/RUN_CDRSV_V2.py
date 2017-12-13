#!/usr/bin/python

from optparse import OptionParser
import sys,re,os

if __name__ == '__main__':
	parser = OptionParser()
	parser.add_option("-b","--bam_path",dest="BAM_P",help="the path to all you bam files",metavar="BAM_PATH")
	parser.add_option("-s","--SV", dest = "SV", help="The SV file", metavar = "SV_FILE")

	(options,args) = parser.parse_args()


	#if no options were given by the user, print help and exit
	if len(sys.argv) == 1:
		parser.print_help()
		exit(0)

	#Read SV file and count from bam file

	SV_fh = open(options.SV)
	O_name = options.SV+"_annotated"
	OUT = open(O_name,'w')
	hd = SV_fh.readline().strip().split('\t')
	OUT.write('\t'.join(hd[0:20]) + "\t" + "Germline_Count" + "\t" + '\t'.join(hd[20:])+"\n")
	for sv in SV_fh:
		sv_arr = sv.strip().split('\t')
		chrA = sv_arr[2]
		posA = sv_arr[3]
		chrB = sv_arr[6]
		posB = sv_arr[7]
		CALCU = ""
		for dir in os.listdir(options.BAM_P):
			np = os.path.join(options.BAM_P,dir)
			if os.path.isdir(np) and dir.startswith("SJ"):
				for bf in os.listdir(np):
					nnp = os.path.join(np,bf)
					if os.path.isfile(nnp) and nnp.endswith(".bam") and re.search("SJ.*?_G",nnp):
						R_V = os.popen("python3 Count_discordant_reads_SV.py -B "+ nnp + " -a "+chrA+" -b " + chrB + " -1 "+posA+" -2 "+posB+" -s 1000 -o count").read().strip()
						if re.search("^\d+", R_V):
							N_R_S = int(R_V)
						else:
							N_R_S = 0
						if N_R_S >1:
							if CALCU:
								CALCU += ","+re.search("(SJ\w+_G\w)", os.path.split(nnp)[1]).groups()[0]+","+str(N_R_S)
							else:
								CALCU = re.search("(SJ\w+_G\w)", os.path.split(nnp)[1]).groups()[0]+","+str(N_R_S)
						elif N_R_S <=1:
							continue
					else:
						continue
			else:
				continue
		if CALCU:
			OUT.write('\t'.join(sv_arr[0:20]) + "\t" + CALCU + "\t" + '\t'.join(sv_arr[20:]) + "\n")
		else:
			OUT.write('\t'.join(sv_arr[0:20]) + "\t" + "-" + "\t" + '\t'.join(sv_arr[20:]) + "\n")	
	OUT.close()
	SV_fh.close()
