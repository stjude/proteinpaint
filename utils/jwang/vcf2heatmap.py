#!/usr/bin/python3

"""This script would convert VEP annotated vcf files to snvindel file for heatmap building.
""" 

__author__    =  "Jian  Wang"
__copyrith__ = "Copyright 2021.02.19, St.Jude"



from optparse import OptionParser 
import sys,re,os
import subprocess as sp

parser = OptionParser()
parser.add_option("-v","--vepAnnoVcf",dest="VEP_ANNO_VCF",help="vcf file list",metavar = "VEP annotated VCF file")
parser.add_option("-o","--OUTPUT",dest="OUTPUT",help="OUTPUT file",metavar = "OutPut File")
parser.add_option("--filter",action="store_true",dest="filter",help="filter out intronic and intergenic annotation",metavar="class fileter")

(options,args) = parser.parse_args()


#If no options were given by the user, print help and exit
if len(sys.argv) == 1:
	parser.print_help()
	exit(0)

FILES = [x.strip() for x in open(options.VEP_ANNO_VCF)]
OUT_FILE = open(options.OUTPUT,'w')
OUT_FILE.write('\t'.join(['gene','refseq','chromosome','start','aachange','class','sample','REF','ALT'])+'\n')


#########################################
#Functions

#VEP Consequence to annovar class
###################################################################################################################################
#splice_acceptor_variant 	       	 -> L(SPLICE);			start_lost   		 		-> N(NONSENSE)    #
#splice_donor_variant     		 -> L(SPLICE);			transcript_amplification 		-> X              #
#mature_mirna_variant		 	 -> E(EXON); 			coding_sequence_variant			-> X              #
#non_coding_transcript_exon_variant	 -> E(EXON);			intron_variant				-> Intron(INTRON) #
#non_coding_transcript_variant		 -> E(EXON);										  #
#stop_gained          	   	 	 -> N(NONSENSE);		inframe_insertion	 		-> I(PROTEININS)  #
#frameshift_variant     	 	 -> F(FRAMESHIFT);		conservative_inframe_insertion  	-> I(PROTEININS)  #
#stop_lost               	 	 -> N(NONSENSE);		disruptive_inframe_insertion		-> I(PROTEININS)  #
#protein_altering_variant	 	 -> N(NONSENSE);		incomplete_terminal_codon_variant	-> N(NONSENSE)    #
#inframe_deletion		 	 -> D(PROTEINDEL);		missense_variant			-> M(MISSENSE)    #
#conservative_inframe_deletion	 	 -> D(PROTEINDEL);		stop_retained_variant			-> S(SILENT)      #
#disruptive_inframe_deletion	 	 -> D(PROTEINDEL);		synonymous_variant			-> S(SILENT)      #
#nmd_transcript_variant			 -> S(SILENT);										  #
#splice_region_variant		 	 -> P(SPLICE_REGION);		transcript_ablation			-> mclassdel(DEL) #
#5_prime_utr_variant		 	 -> Utr5;	3_prime_utr_variant			-> Utr3                           #
#upstream_gene_variant			 -> noncoding;	downstream_gene_variant			-> noncoding			  #
#tfbs_ablation				 -> noncoding;	tfbs_amplification			-> noncoding  			  #
#tf_binding_site_variant		 -> noncoding;	regulatory_region_ablation		-> noncoding  			  #
#regulatory_region_amplification	 -> noncoding;	feature_elongation			-> noncoding			  #
#regulatory_region_variant		 -> noncoding;	feature_truncation			-> noncoding			  #
#intergenic_variant			 -> noncoding;										  #
###################################################################################################################################
def VEPCON2ANNOC(conseqen):
	conseq = conseqen.lower()
	if conseq in ['splice_acceptor_variant','splice_donor_variant']:
		return "SPLICE"
	elif conseq in ['mature_mirna_variant','non_coding_transcript_exon_variant','non_coding_transcript_variant']:
		return "EXON"
	elif conseq in ['stop_gained','stop_lost','protein_altering_variant','start_lost','incomplete_terminal_codon_variant']:
		return "NONSENSE"
	elif conseq in ['frameshift_variant']:
		return "FRAMESHIFT"
	elif conseq in ['inframe_deletion','conservative_inframe_deletion','disruptive_inframe_deletion']:
		return "PROTEINDEL"
	elif conseq in ['nmd_transcript_variant','stop_retained_variant','synonymous_variant']:
		return "SILENT"
	elif conseq in ['splice_region_variant']:
		return "SPLICE_REGION"
	elif conseq in ['5_prime_utr_variant']:
		return "Utr_5"
	elif conseq in ['upstream_gene_variant','tfbs_ablation','tf_binding_site_variant','regulatory_region_amplification','regulatory_region_variant','intergenic_variant','downstream_gene_variant','tfbs_amplification','regulatory_region_ablation','feature_elongation','feature_truncation']:
		return "NONCODING"
	elif conseq in ['transcript_amplification','coding_sequence_variant']:
		return "X"
	elif conseq in ['intron_variant']:
		return "INTRON"
	elif conseq in ['inframe_insertion','conservative_inframe_insertion','disruptive_inframe_insertion']:
		return "PROTEININS"
	elif conseq in ['missense_variant']:
		return "MISSENSE"
	elif conseq in ['transcript_ablation']:
		return "DEL"
	elif conseq in ['3_prime_utr_variant']:
		return "Utr_3"
	else:
		return False
	
#VEP->annovar class:
def GETCLASS(chrom,pos,ref,alt,sample,isoAnno,refFieIdx):
	for iso in isoAnno:
		# ['C', 'intron_variant', 'MODIFIER', '', 'ENSESTG00000013524', 'Transcript', 'ENSESTT00000033865', 'protein_coding', '', '2/2', 'ENSESTT00000033865.1:c.-39-78G>C', '', '', '', '', '', '', '', '', '1', '', '', '', '']
		vepAnnoL = isoAnno[iso][0].strip().split('|')
		conseTem = vepAnnoL[refFieIdx['Consequence']]
		if '&' in conseTem:
			conse = re.search("(.*?)&",conseTem).groups()[0]
		else:
			conse = conseTem
		annovar_class = VEPCON2ANNOC(conse).lower() #Annovar class
		#class filtering
		if options.filter and annovar_class in ['noncoding','intron']:
			return None 
		#aachange
		hgvsp = vepAnnoL[refFieIdx['HGVSp']]
		if hgvsp:
			aachange = re.search(".*\.(.*)",hgvsp).groups()[0]
		else:
			aachange = '>'.join([ref,alt])
		#iso_acc
		if '.' in iso:
			iso_acc = re.search("(.*?)\.",iso).groups()[0]
		else:
			iso_acc = iso
		gene = vepAnnoL[refFieIdx['SYMBOL']]
		if gene:
			OUT_FILE.write('\t'.join([gene,iso_acc,chrom,str(pos),aachange,annovar_class,sample,ref,alt])+'\n')

#Extraction of annotation of each isoform(multiple annotation for multiple ALT)
def VARISOANNO_EXT(infoL):
	varisoanno_D = {}
	for i in infoL:
		l = i.strip().split('|')
		if l[6] in varisoanno_D:
			varisoanno_D[l[6]].append(i)
		else:
			varisoanno_D[l[6]] = [i]
	return varisoanno_D




for f in FILES:
	#sample name
	sample = sp.run('grep -m 1 "#CHROM" '+f,shell=True,stdout=sp.PIPE).stdout.decode('utf-8').strip().split('\t')[-1]
	#VEP annotation CSQ line
	CSQinfo = sp.run('grep -m 1 "##INFO=<ID=CSQ" '+f,shell=True,stdout=sp.PIPE).stdout.decode('utf-8')
	CSQL = re.search('Format:\s*(.*?)"',CSQinfo).group(1).split('|')
	#required field
	ReqField = ['Feature','Consequence','SYMBOL','Gene','HGVSp']
	ReqFieldIdx = {x:CSQL.index(x) for x in ReqField}
	fh = open(f)
	for row in fh:
		if row.startswith('#'):
			continue
		rowl = row.strip().split('\t')
		CHROM,POS,REF,ALT = rowl[0],rowl[1],rowl[3],rowl[4]
		INFO = rowl[7]
		VEPANNO = re.search("CSQ=(.*)",INFO).groups()[0]
		VEPANNOL = VEPANNO.strip().split(',')
		VAR_iso_ANNO = VARISOANNO_EXT(VEPANNOL)
		GETCLASS(CHROM,POS,REF,ALT,sample,VAR_iso_ANNO,ReqFieldIdx)
	fh.close()

