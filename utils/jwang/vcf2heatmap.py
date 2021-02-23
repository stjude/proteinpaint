#!/usr/bin/python3

"""This script would convert VEP annotated vcf files to snvindel file for heatmap building.
"""

__author__    =  "Jian  Wang"
__copyrith__ = "Copyright 2021.02.19, St.Jude"


import argparse
import sys,re,os
import subprocess as sp
import gzip

parser = argparse.ArgumentParser(description='build heatmap snvindel file from VEP annotated vcf files')
parser.add_argument('-v','--vcfList',help='vcf file list')
parser.add_argument('-o','--OUTPUT',help='output file')
parser.add_argument('--filter',action='store_true',help='filter out intronic and intergenic annotation",metavar="class fileter')

args = parser.parse_args()

#filter out intronic and intergenic annotation
Filter = args.filter

#If no options were given by the user, print help and exit
if len(sys.argv) == 1:
        parser.print_help()
        exit(0)

FILES = [x.strip() for x in open(args.vcfList)]
OUT_FILE = open(args.OUTPUT,'w')
OUT_FILE.write('\t'.join(['gene','refseq','chromosome','start','aachange','class','sample','REF','ALT'])+'\n')


#########################################
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
#splice_region_variant                   -> P(SPLICE_REGION);           transcript_ablation                     -> mclassdel(DEL) #
#5_prime_utr_variant                     -> Utr5;       3_prime_utr_variant                     -> Utr3                           #
#upstream_gene_variant                   -> noncoding;  downstream_gene_variant                 -> noncoding                      #
#tfbs_ablation                           -> noncoding;  tfbs_amplification                      -> noncoding                      #
#tf_binding_site_variant                 -> noncoding;  regulatory_region_ablation              -> noncoding                      #
#regulatory_region_amplification         -> noncoding;  feature_elongation                      -> noncoding                      #
#regulatory_region_variant               -> noncoding;  feature_truncation                      -> noncoding                      #
#intergenic_variant                      -> noncoding;                                                                            #
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
        ANNOLIST = []
        for iso in isoAnno:
                #include canonical transcripts only
                if iso not in canonTrans:
                        continue
                # ['C', 'intron_variant', 'MODIFIER', '', 'ENSESTG00000013524', 'Transcript', 'ENSESTT00000033865', 'protein_coding', '', '2/2', 'ENSESTT00000033865.1:c.-39-78G>C', '', '', '', '', '', '', '', '', '1', '', '', '', '']
                vepAnnoL = isoAnno[iso][0].strip().split('|')
                conseTem = vepAnnoL[refFieIdx['Consequence']]
                if '&' in conseTem:
                        conse = VEPANNOPRIO(conseTem.strip().split('&'))
                else:
                        conse = conseTem
                annovar_class = VEPCON2ANNOC(conse).lower() #Annovar class
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
                        ANNOLIST.append([gene,iso_acc,chrom,str(pos),aachange,annovar_class,sample,ref,alt])
        return ANNOLIST

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
#Prioritize vep annotation
def VEPANNOPRIO(annoList):
        VEPANNO = ['transcript_ablation','splice_acceptor_variant','splice_donor_variant','stop_gained',
                   'frameshift_variant','stop_lost','start_lost','transcript_amplification','inframe_insertion',
                   'conservative_inframe_insertion','disruptive_inframe_insertion','inframe_deletion','conservative_inframe_deletion',
                   'disruptive_inframe_deletion','missense_variant','protein_altering_variant','splice_region_variant','incomplete_terminal_codon_variant',
                   'stop_retained_variant','synonymous_variant','coding_sequence_variant','mature_mirna_variant','5_prime_utr_variant','3_prime_utr_variant',
                   'non_coding_transcript_exon_variant','intron_variant','nmd_transcript_variant','non_coding_transcript_variant','upstream_gene_variant',
                   'downstream_gene_variant','tfbs_ablation','tfbs_amplification','tf_binding_site_variant','regulatory_region_ablation','regulatory_region_amplification',
                   'feature_elongation','regulatory_region_variant','feature_truncation','intergenic_variant']
        annoidx = [VEPANNO.index(x.lower()) for x in annoList]
        annoidx = sorted(annoidx)
        return VEPANNO[annoidx[0]]



#check if knownCanonical.txt and knownToRefSeq.txt exists
#Canonical ensembl and refseq ID for transcript ID filtering
if os.path.isfile('knownCanonical.txt') and os.path.isfile('knownToRefSeq.txt'):
	#cononTrans (known canonical transcripts)
	canonTrans = [x.split('\t')[4].strip().split('.')[0] for x in open('knownCanonical.txt')]
	#refseq
	ensembl2refseq = {}
	knownToRefSeqFile = open('knownToRefSeq.txt')
	for line in knownToRefSeqFile:
		L = line.strip().split('\t')
		ensembl2refseq[L[0].split('.')[0]] = L[1]
	knownToRefSeqFile.close()
	canonTrans.extend([ensembl2refseq[e] for e in canonTrans if e in ensembl2refseq])
	
else:
	print('Please Download and Extract the following files:')
	print('http://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/knownCanonical.txt.gz')
	print('http://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/knownToRefSeq.txt.gz')
	sys.exit(1)

### screen all vcf file
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
                outList = GETCLASS(CHROM,POS,REF,ALT,sample,VAR_iso_ANNO,ReqFieldIdx)
                if not outList:
                        continue
                #class filtering
                if Filter:
                        outList = [e for e in outList if not e[5] in ['noncoding','intron']]
                for e in outList:
                           OUT_FILE.write('\t'.join(e)+'\n')     
        fh.close()
OUT_FILE.close()
