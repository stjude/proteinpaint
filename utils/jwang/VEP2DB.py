#!/usr/bin/python3

"""sample.vep.out.vcf - This script will transfer VEP annotated vcf file to the sqlite database file similar to pediatric_hg19.db.
			This script take VEP annotated file (vep.out.vcf) as input and output the table file with name you specify.
""" 

__author__    =  "Jian  Wang"
__copyrith__ = "Copyright 2017.11.29, St.Jude"



from optparse import OptionParser 
import sys,re,os

parser = OptionParser()
parser.add_option("-v","--vepAnnoVcf",dest="VEP_ANNO_VCF",help="VEP annotated vcf file",metavar = "VEP annotated VCF file")
parser.add_option("-o","--OUTPUT",dest="OUTPUT",help="Prefix of OUTPUT db file",metavar = "Prefix of OUTPUT DB file")

(options,args) = parser.parse_args()

#If no options were given by the user, print help and exit
if len(sys.argv) == 1:
	parser.print_help()
	exit(0)


FILE = open(options.VEP_ANNO_VCF)
OUT_FILE = open(options.VEP_ANNO_VCF+"_tabPP",'w')



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
		return "Utr5"
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
		return "Utr3"
	else:
		return False
	
#screen samples:
def SCR_SAM(sample,alt,annorowl):
	RELI = []
	for n in range(-len(sample),0):
		GT = re.search("(.*?):",annorowl[n]).groups()[0]
		CT = re.search("(.*?):(.*?):",annorowl[n]).groups()[1]
		if GT == "./." or GT == "0/0":
			continue
		elif '0' in GT:
			gt = GT.strip().split('/')
			ct = CT.strip().split(',')
			RELI.append([sample[n+len(sample)],alt[int(gt[1])-1],gt[1],int(ct[1]),int(ct[0])+int(ct[1])])
		else:
			gt = GT.strip().split('/')
			ct = CT.strip().split(',')
			if gt[0] == gt[1]:
				RELI.append([sample[n+len(sample)],alt[int(gt[1])-1],gt[1],int(ct[0])+int(ct[1]),int(ct[0])+int(ct[1])])
			else:
				for x,m in enumerate(gt):
					RELI.append([sample[n+len(sample)],alt[int(m)-1],m,int(ct[x]),int(ct[0])+int(ct[1])])
	return RELI

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



SAMPLE = []

for row in FILE:
	if row.startswith("#") and re.search("^#CHROM\s",row):
		SAMPLE = re.search("FORMAT\s+(.*)",row).groups()[0].split('\t')
	elif row.startswith("#"):
		continue
	else:
		rowl = row.strip().split('\t')
		CHROM = rowl[0]
		POS = rowl[1]
		REF = rowl[3]
		ALT = rowl[4].strip().split(',')
		INFO = rowl[7]
		VEPANNO = re.search("CSQ=(.*)",INFO).groups()[0]
		VEPANNOL = VEPANNO.strip().split(',')
		VAR_iso_ANNO = VARISOANNO_EXT(VEPANNOL)
		SAMPLE_ALT_CO = SCR_SAM(SAMPLE,ALT,rowl)
		if SAMPLE_ALT_CO and VAR_iso_ANNO:
			tem = [(m[0],m[1],VAR_iso_ANNO[n][int(m[2])-1],m[3],m[4]) for m in SAMPLE_ALT_CO for n in VAR_iso_ANNO]
			for t in tem:
				tl = list(t)
				geiso = tl[2]	
				geisol = geiso.strip().split('|')
				if '&' in geisol[1]:
					conse = re.search("(.*?)&",geisol[1]).groups()[0]
				else:
					conse = geisol[1]
				annovar_class = VEPCON2ANNOC(conse)
				hgvsp = geisol[11]
				if '.' in geisol[6]:
					iso_acc = re.search("(.*?)\.",geisol[6]).groups()[0]
				else:
					iso_acc = geisol[6]
				if annovar_class:
					if geisol[11]:
						aachange = re.search(".*\.(.*)",geisol[11]).groups()[0]
						OUT_FILE.write('\t'.join([tl[0],'',tl[0]]+('\t'*20).split('\t')+[annovar_class,'',aachange,'',str(CHROM),str(POS),geisol[3],iso_acc]+('\t'*11).split('\t')+[REF,tl[1],'t','f',str(tl[3]),str(tl[4])]+('\t'*15).split('\t'))+'\n')
					else:
						 OUT_FILE.write('\t'.join([tl[0],'',tl[0]]+('\t'*20).split('\t')+[annovar_class,'',REF+'>'+tl[1],'',str(CHROM),str(POS),geisol[3],iso_acc]+('\t'*11).split('\t')+[REF,tl[1],'t','f',str(tl[3]),str(tl[4])]+('\t'*15).split('\t'))+'\n')
				else:
					print("Please check class transfer reslut. Can not find annovar class for this vep annotation:"+'\t'.join(tl)+'\n')
		else:
			print("SAMPLE_ALT_CO and VAR_iso_ANNO: problem for one of them")

FILE.close()
OUT_FILE.close()

############################
#sqlite database
content = "drop table if exists snvindel_hg19;\tCREATE TABLE snvindel_hg19 (\tdonor_name character varying(20),\tdonor_id integer,\tsample_name character varying(50),\tcell_sample_id integer,\tsample_disease_phase character varying(25),\tanalyte_sample_id integer,\tanalyte character varying(3),\tvariant_origin character varying(50),\tvariant_origin_pp character varying(50),\tvalidation_status character varying(50),\tquality character varying(50),\tanalysis_run_id integer,\tanalysis_run_name character varying(100),\tresult_id_case integer,\tsample_id_case integer,\tsample_id_control integer,\tgenotype_id integer,\tgenotype_assay_id_case integer,\tallele_1_id_case integer,\talelle_2_id_case integer,\tallele_1_signal_case numeric(5,0),\tallele_2_signal_case numeric(5,0),\tgv_id integer,\tvariant_name character varying(500),\tvariant_class character varying(255),\tvariant_type character varying(20),\tamino_acid_change text,\tlocus_id integer,\tchromosome character varying,\tchr_position integer,\tgene_symbol character varying(50),\tisoform_accession character varying(50),\tprotein_gi numeric(11,0),\tgv2gene_id integer,\tanalysis_type_name character varying(100),\tanalysis_type_type character varying(100),\tvariant_analysis text,\tseq_src character varying[],\tresult_id_ctrl integer,\tgenotype_assay_id_ctrl integer,\tallele_1_id_ctrl integer,\tallele_2_id_ctrl integer,\tallele_1_signal_ctrl numeric(5,0),\tallele_2_signal_crtl numeric(5,0),\tallele_1 text,\tallele_2 text,\tallele_1_is_reference boolean,\tallele_2_is_reference boolean,\tmutant_reads_in_case numeric(5,0),\ttotal_reads_in_case numeric,\tmutant_reads_in_control numeric,\ttotal_reads_in_control numeric,\tsrc text,\tdonor_name_orig text,\tsample_name_orig text,\tis_public boolean,\tcdna_coordinate text,\tpubmed_id_list text,\tdataset_label character varying(65),\tallele_1_signal_rna numeric,\tallele_2_signal_rna numeric,\trnaseq_maf numeric(4,3),\tsample_has_loh_results boolean DEFAULT false NOT NULL,\tloh_seg_mean numeric(4,3),\tloh character varying(100),\tcommittee_classification character varying(25)\t);\t\t\t\t\t.mode tabs\t.import sample.vep.out.vcf_tabPP  snvindel_hg19\t\t\tCREATE INDEX snvindel_hg19_isoform on snvindel_hg19 (isoform_accession collate nocase);"

load_fh = open("load.sql",'w')

for c in content.split('\t'):
	load_fh.write(c+'\n')
load_fh.close()

os.system("sqlite3 "+ options.OUTPUT + ".db <load.sql")

#os.remove("load.sql")
#os.remove(options.VEP_ANNO_VCF+"_tabPP")
