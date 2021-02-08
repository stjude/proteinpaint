#!/usr/bin/python3

"""SampleSplitter.py: Take snvindel vcf files and svcnv file (PCGP-TARGET project) and output one js file containing all variations for each sample
"""

"""This version removed the function of adding signature color from version 2 and add signature val for SNVs from target samples.
pantargetsignature:2
"""
__author__ = 'Jian Wang'
__copyright__ = 'Copyright 2018, St. Jude'
___version__ = 'v3'

import argparse,json,re,gzip,sys,os

parser = argparse.ArgumentParser()
parser.add_argument('--vcf',nargs='+',help='All vcf files',default=False)
#parser.add_argument("--vepTerm",help = "Vep SO term in ordered as on VEP page")
parser.add_argument('--svcnv',help='svcnv file')
parser.add_argument('--outdir',help='output directory')

args = parser.parse_args()

if not args.svcnv.endswith('.gz'):
	sys.stderr.write('Error: This script only process bgzip compressed file\n')
	sys.exit(1)



SamAllVar = {}

#____________________________________________________________________
#snvindel

#Functions
#VEP Consequence to annovar class
###################################################################################################################################
#splice_acceptor_variant                 -> L(SPLICE);                  start_lost                              -> N(NONSENSE)    #
#splice_donor_variant                    -> L(SPLICE);                  transcript_amplification                -> X              #
#mature_mirna_variant                    -> E(EXON);                    coding_sequence_variant                 -> X              #
#non_coding_transcript_exon_variant      -> E(EXON);                    intron_variant                          -> Intron(INTRON) #
#non_coding_transcript_variant           -> E(EXON);                                                                              #
#stop_gained                             -> N(NONSENSE);                inframe_insertion                       -> I(PROTEININS)  #
#frameshift_variant                      -> F(FRAMESHIFT);              conservative_inframe_insertion          -> I(PROTEININS)  #
#stop_lost                               -> N(NONSENSE);                disruptive_inframe_insertion            -> I(PROTEININS)  #
#protein_altering_variant                -> N(NONSENSE);                incomplete_terminal_codon_variant       -> N(NONSENSE)    #
#inframe_deletion                        -> D(PROTEINDEL);              missense_variant                        -> M(MISSENSE)    #
#conservative_inframe_deletion           -> D(PROTEINDEL);              stop_retained_variant                   -> S(SILENT)      #
#disruptive_inframe_deletion             -> D(PROTEINDEL);              synonymous_variant                      -> S(SILENT)      #
#nmd_transcript_variant                  -> S(SILENT);                                                                            #
#splice_region_variant                   -> P(SPLICE_REGION);           transcript_ablation                     -> mclassdel->DEL #
#5_prime_utr_variant                     -> Utr5;       3_prime_utr_variant                     -> Utr3                           #
#upstream_gene_variant                   -> noncoding;  downstream_gene_variant                 -> noncoding                      #
#tfbs_ablation                           -> noncoding;  tfbs_amplification                      -> noncoding                      #
#tf_binding_site_variant                 -> noncoding;  regulatory_region_ablation              -> noncoding                      #
#regulatory_region_amplification         -> noncoding;  feature_elongation                      -> noncoding                      #
#regulatory_region_variant               -> noncoding;  feature_truncation                      -> noncoding                      #
#intergenic_variant                      -> noncoding(X) -> X;                                                                    #
###################################################################################################################################
#newly added
#start_retained_variant                  -> S(SILENT)
#
#
#
#
#
###################################################################################################################################
def VEPCON2ANNOC(conseqen):
	conseq = conseqen.lower()
	if conseq in ['splice_acceptor_variant','splice_donor_variant']:
		return "L"
	elif conseq in ['mature_mirna_variant','non_coding_transcript_exon_variant','non_coding_transcript_variant']:
		return "E"
	elif conseq in ['stop_gained','stop_lost','protein_altering_variant','start_lost','incomplete_terminal_codon_variant']:
		return "N"
	elif conseq in ['frameshift_variant']:
		return "F"
	elif conseq in ['inframe_deletion','conservative_inframe_deletion','disruptive_inframe_deletion']:
		return "D"
	elif conseq in ['nmd_transcript_variant','start_retained_variant','stop_retained_variant','synonymous_variant']:
		return "S"
	elif conseq in ['splice_region_variant']:
		return "P"
	elif conseq in ['5_prime_utr_variant']:
		return "Utr5"
	elif conseq in ['upstream_gene_variant','tfbs_ablation','tf_binding_site_variant','regulatory_region_amplification','regulatory_region_variant','downstream_gene_variant','tfbs_amplification','regulatory_region_ablation','feature_elongation','feature_truncation']:
		return "noncoding"
	elif conseq in ['transcript_amplification','coding_sequence_variant','intergenic_variant']:
		return "X"
	elif conseq in ['intron_variant']:
		return "Intron"
	elif conseq in ['inframe_insertion','conservative_inframe_insertion','disruptive_inframe_insertion']:
		return "I"
	elif conseq in ['missense_variant']:
		return "M"
	elif conseq in ['transcript_ablation']:
		return "DEL"
	elif conseq in ['3_prime_utr_variant']:
		return "Utr3"
	else:
		return False
#Extract samples with readcount
def SAM_EX(allSamReadL,SAMLIST,format):
	sam = []
	EmptyVal = ':'.join(['.'] * len(format.split(':')))
	for x,read in enumerate(allSamReadL):
		if read == EmptyVal:
			continue
		sam.append(SAMLIST[x])
	return sam

#Decide which vep so term has higher level
def HIGH_LEVEL_COM(TermL):
	TERM = ''
	TermIDX = 0
	TERMIDX = 0
	for x,t in enumerate(TermL):
		if not t:
			continue
		if not TERM:
			TERM = t
			TermIDX = VEPTerm.index(TERM)
			TERMIDX = x
		else:
			if VEPTerm.index(t) < TermIDX:
				TERM = t
				TermIDX = VEPTerm.index(t)
				TERMIDX = x
			else:
				continue
	return TERM,TERMIDX
#output js info for samples with readcount for a specific SNVindel
def SNVINDELJS(sams,lineInfoList):
	JS = {'dt':1,\
		'chr':'chr' + lineInfoList[0],\
		'position':int(lineInfoList[1]),\
		'ref':lineInfoList[3],\
		'alt':lineInfoList[4]}
	#print(lineInfoList)
	VEPANNOL = re.search("CSQ=(.*)",lineInfoList[7]).group(1).split(',')
	lineVEPL = []
	for vepline in VEPANNOL:
		veplineL = vepline.split('|')
		if veplineL[1]:
			if '&' in veplineL[1]:
				temL = veplineL[1].split('&')
				CONSTem = HIGH_LEVEL_COM(temL)[0]
			else:
				CONSTem = veplineL[1]
		else:
			CONSTem = veplineL[1]
			#continue
		lineVEPL.append(CONSTem)
	CONSFinal = HIGH_LEVEL_COM(lineVEPL)
	CONSEQUENCE_L = VEPANNOL[CONSFinal[1]].split('|')
	if len(set(lineVEPL)) == 1 and lineVEPL[0] == '':
		JS['class'] = 'X' 
	else:
		JS['class'] = VEPCON2ANNOC(CONSFinal[0]) #VEPCON2ANNOC(CONSEQUENCE_L[1])
	if CONSEQUENCE_L[3]:
		JS['gene'] = CONSEQUENCE_L[3]
	if CONSEQUENCE_L[6]:
		JS['isoform'] = CONSEQUENCE_L[6].split('.')[0]
	if CONSEQUENCE_L[11]:
		JS['mname'] = CONSEQUENCE_L[11].split(':')[1]
	else:
		JS['mname'] = lineL[3]+'>'+lineL[4]
	#JS['sample'] = sam
	for sam in sams:
		samJS = JS.copy()
		signature = EXTSIG(sam,lineInfoList[8],lineInfoList[9:])
		if signature:
			samJS['pantargetsignature'] = signature
		if not sam in SamAllVar:
			SamAllVar[sam] = [samJS]
		else:
			SamAllVar[sam].append(samJS)

#extract signature infomation for samples that have any
def EXTSIG(sam,format,valList):
	formatL = format.split(':')
	if 'pantargetsignature' in formatL:
		sigIDX = formatL.index('pantargetsignature')
		samIDX = SAMPLES.index(sam)
		samSigVal = valList[samIDX].split(':')[sigIDX]
		if samSigVal == '.':
			return False
		else:
			return samSigVal
	else:
		return False

#Load VEP SO terms
VEPTerm = ['transcript_ablation', 'splice_acceptor_variant', 'splice_donor_variant', 'stop_gained', \
	'frameshift_variant', 'stop_lost', 'start_lost', 'transcript_amplification', 'inframe_insertion', \
	'inframe_deletion', 'missense_variant', 'protein_altering_variant', 'splice_region_variant', \
	'incomplete_terminal_codon_variant', 'start_retained_variant','stop_retained_variant', 'synonymous_variant', 'coding_sequence_variant', \
	'mature_miRNA_variant', '5_prime_UTR_variant', '3_prime_UTR_variant', 'non_coding_transcript_exon_variant', \
	'intron_variant', 'NMD_transcript_variant', 'non_coding_transcript_variant', 'upstream_gene_variant', \
	'downstream_gene_variant', 'TFBS_ablation', 'TFBS_amplification', 'TF_binding_site_variant', \
	'regulatory_region_ablation', 'regulatory_region_amplification', 'feature_elongation', \
	'regulatory_region_variant', 'feature_truncation', 'intergenic_variant']


#Screening snvindel files
if args.vcf:
	for snvfh in args.vcf:
		if not snvfh.endswith('.gz'):
			sys.stderr.write('Error: This script only process bgzip compressed file\n')
			sys.exit(1)
		fh = gzip.open(snvfh,'rb')
		SAMPLES = []
		for i in fh:
			line = i.decode('utf-8')
			lineL = line.strip().split('\t')
			if line.startswith('#CHROM'):
				SAMPLES = lineL[9:]
				continue
			elif line.startswith('#'):
				continue
			SamReadCounL = lineL[9:]
			SAML = SAM_EX(SamReadCounL,SAMPLES,lineL[8])
			SNVINDELJS(SAML,lineL)
		fh.close()


#____________________________________________________________________
#svcnv
def PARSEVAR(rowlist):
	rowjs = json.loads(rowlist[3])
	if rowjs['dt'] in [5,2]:
		if 'chrA' in rowjs:
			rowjs['chrB'] = rowlist[0]
			rowjs['posB'] = GETPOS(rowlist[1])
		elif 'chrB' in rowjs:
			rowjs['chrA'] = rowlist[0]
			rowjs['posA'] = GETPOS(rowlist[1])
		ckid = '@'.join([rowjs['chrA'],str(rowjs['posA']),rowjs['strandA'],rowjs['chrB'],str(rowjs['posB']),rowjs['strandB'],rowjs['sample']])
		if ckid in SVFU:
			return False
		else:
			SVFU.append(ckid)
			return rowjs
	elif rowjs['dt'] in [4,6,10]:
		rowjs['chr'] = rowlist[0]
		rowjs['start'] = GETPOS(rowlist[1])
		rowjs['stop'] = GETPOS(rowlist[2])
		return rowjs
	
def GETPOS(num):
	try:
		NUM = int(num)
	except:
		NUM = int(round(float(num)))
	return NUM

#output js info for samples with readcount for a specific SVCNV
#Screening svcnv files
if args.svcnv:
	svcnvfh = gzip.open(args.svcnv,'rb')
	SVFU = []
	for svcnv in svcnvfh:
		line = svcnv.decode('utf-8')
		if line.startswith('#'):
			continue
			#lineL = line.strip().split(' ')
			#SAMPLES = lineL[1:]
		lineL = line.strip().split('\t')
		svcnvRetu = PARSEVAR(lineL)
		if svcnvRetu:
			samNam = svcnvRetu.pop('sample')             #svcnvRetu['sample']
			if not samNam in SamAllVar:
				SamAllVar[samNam] = [svcnvRetu]
			else:
				SamAllVar[samNam].append(svcnvRetu)
		else:
			continue
	svcnvfh.close()

#outdir = '/home/jwang7/tp/jwang/SampleSplitter'
#outdir = args.outdir
outdir = os.path.realpath(os.path.expanduser(args.outdir))
outable = open(os.path.join(outdir,'table'),'w')
relat_samplepath = re.search('tp\/(.*)',outdir).group(1)

#output var files:
for e in SamAllVar:
	outable.write('\t'.join([e,os.path.join(relat_samplepath,e)])+'\n')
	out = open(os.path.join(outdir,e),'w')
	print(json.dumps(SamAllVar[e],indent=True,sort_keys=True),file=out)
	out.close()
outable.close()
