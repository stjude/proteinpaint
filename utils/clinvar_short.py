# This file will work with a .vcf extension. to run use the following command:
# $ python3 clinvar_short.py -v vcf -o output 

import sys
import argparse
import re
# import gzip

def AAcodeChange(vepanno):
# vepanno is basically a string. it should not be a list. make sure to check that.
    # print(vepanno)
# example vepanno : CSQ=T|missense_variant|MODERATE|HSPG2|3339|Transcript|NM_001291860.2|protein_coding|9/97||NM_001291860.2:c.1028G>A|NP_001278789.1:p.Arg343His|1121|1028|343|R/H|cGc/cAc|rs748189648||-1||EntrezGene||||C|C|||||,T|missense_variant|MODERATE|HSPG2|3339|Transcript|NM_005529.7|protein_coding|9/97||NM_005529.7:c.1028G>A|NP_005520.4:p.Arg343His|1121|1028|343|R/H|cGc/cAc|rs748189648||-1||EntrezGene||||C|C|||||
    
    # create empty list called newAnno
    newAnno = []

    if not vepanno:
        print('No VEP annotation given in the INFO field')
        sys.exit[1]
    
    # split vepanno after 'CSQ='
    vepanno2 = vepanno[4:].split(';')
    # print(vepanno2)
# example vepanno2 : T|missense_variant|MODERATE|HSPG2|3339|Transcript|NM_001291860.2|protein_coding|9/97||NM_001291860.2:c.1028G>A|NP_001278789.1:p.Arg343His|1121|1028|343|R/H|cGc/cAc|rs748189648||-1||EntrezGene||||C|C|||||,T|missense_variant|MODERATE|HSPG2|3339|Transcript|NM_005529.7|protein_coding|9/97||NM_005529.7:c.1028G>A|NP_005520.4:p.Arg343His|1121|1028|343|R/H|cGc/cAc|rs748189648||-1||EntrezGene||||C|C|||||

    # print([vepanno[0:4]])
    CSQ_term = vepanno[0:4]
    # print(CSQ_term)
    # this will split it at CSQ= and only take the string after that.
# example CSQ_term : 'CSQ+'
    
    # iterate over the list elements in vepanno2 and split at comma. so this will separate all the isoforms into their respective elements. 
    for elements in vepanno2:
        elements = elements.split(',')
        # print('elements',elements)
# example element: ['G|3_prime_UTR_variant|MODIFIER|LDLRAP1|26119|Transcript|NM_015627.3|protein_coding|9/9||NM_015627.3:c.*961A>G||1981|||||rs375492783||1||EntrezGene||||A|A|||uncertain_significance||1']

# now iterate over the items in the elements list and split at the tab. This will create a list will individual components.
# example item: ['A', 'missense_variant', 'MODERATE', 'ATP13A2', '23400', 'Transcript', 'NM_022089.4', 'protein_coding', '24/29', '', 'NM_022089.4:c.2681C>T', 'NP_071372.1:p.Ser894Leu', '2871', '2681', '894', 'S/L', 'tCg/tTg', 'rs376348581', '', '-1', '', 'EntrezGene', '', '', '', 'G', 'G', '', '', '', '', '']
    for items in elements:
        items = items.split('|')
        # print(items)
# take item 11 in each of those elements and assign it to hgvsp variable. so hgvsp will have all the items that look like: 'NP_071372.1:p.Ser894Leu'
        hgvsp = items[11]
        # print(hgvsp)

# some protein annotations have strange symbols in them such as '%3D'. this is something VEP autogenerates. so replace that with '='
        if '%3D' in hgvsp:
                hgvsp = hgvsp.replace('%3D', '=')
                # print('3d',hgvsp)

# now shorten the 3 letter aa to single letter aa. it takes three arguments, the hgvsp above, item[10] is the coding position 'NM_022089.4:c.2681C>T' and item[1] is the consequence for example 'missense_variant'
        try:
            hgvsp_short = get_hgvsp_short(hgvsp, items[10], items[1])
            # print('hgvsp_short',hgvsp_short)
        except:
            print('exception',elements)
            sys.exit(1)

        # print(type(hgvsp))

# After you have the hgvsp_short, then if that startswith 'p.' then store that in hgvsp_short
        lambda hgvsp_short: hgvsp_short.startswith('p.') if hgvsp_short else False
        # print(hgvsp_short)

# for non-coding regions, there will not be any hgvsp_short since they don't translate into a protein. so if hgvsp_short is a string value then append that to newAnno alongwith items 0-11 and items 12 onwards.
# but if the hgvsp_short is empty and there is nothing there then only append items 0-11 and 12 onwards.
        if type(hgvsp_short) == str:
            newAnno.append('|'.join(items[0:11]+[hgvsp_short[2:]]+items[12:]))
        # print(items[12:])
        else:
            newAnno.append('|'.join(items[0:11]+items[12:]))
        
    # print('newanno', newAnno)
    # print(type(newAnno))

# so now join the CSQ= to this newAnno.
    return CSQ_term+','.join(newAnno)

# this is the priority of VEP consequence using which the consequence in vepanno is split. 
VEPConseqPriority = {
	'transcript_ablation' : 1,
	'exon_loss_variant' : 1,
	'splice_donor_variant' : 2,
	'splice_donor_region_variant':2,
	'splice_donor_5th_base_variant': 2,
	'splice_polypyrimidine_tract_variant':2,
	'splice_acceptor_variant' : 2,
	'stop_gained' : 3,
	'frameshift_variant' : 3,
	'stop_lost': 3,
	'start_lost' : 4,
	'initiator_codon_variant' : 4,
	'disruptive_inframe_insertion' : 5,
	'disruptive_inframe_deletion' : 5,
	'conservative_inframe_insertion' : 5,
	'conservative_inframe_deletion' : 5,
	'inframe_insertion' : 5,
	'inframe_deletion' : 5,
	'protein_altering_variant' : 5,
	'missense_variant' : 6,
	'conservative_missense_variant' : 6,
	'rare_amino_acid_variant' : 6,
	'transcript_amplification' : 7,
	'splice_region_variant' : 8,
	'start_retained_variant' : 9,
	'stop_retained_variant' : 9,
	'synonymous_variant' : 9,
	'incomplete_terminal_codon_variant' : 10,
	'coding_sequence_variant' : 11,
	'mature_miRNA_variant' : 11,
	'exon_variant' : 11,
	'5_prime_UTR_variant' : 12,
	'5_prime_UTR_premature_start_codon_gain_variant' : 12,
	'3_prime_UTR_variant' : 12,
	'non_coding_exon_variant' : 13,
	'non_coding_transcript_exon_variant' : 13,
	'non_coding_transcript_variant' : 14,
	'nc_transcript_variant' : 14,
	'intron_variant' : 14,
	'intragenic_variant' : 14,
	'INTRAGENIC' : 14,
	'NMD_transcript_variant' : 15,
	'upstream_gene_variant' : 16,
	'downstream_gene_variant' : 16,
	'TFBS_ablation' : 17,
	'TFBS_amplification' : 17,
	'TF_binding_site_variant' : 17,
	'regulatory_region_ablation' : 17,
	'regulatory_region_amplification' : 17,
	'regulatory_region_variant' : 17,
	'regulatory_region' : 17,
	'feature_elongation' : 18,
	'feature_truncation' : 18,
	'intergenic_variant' : 19,
	'intergenic_region' : 19,
	'' : 20
}

# So this function takes the consequence which is item[1] and splits it at '&' and store it in conseql. this will create a list.
# example conseq: 'missense variant&nonsense variant'
def GetConseqPriority(conseq):
	conseql = conseq.strip().split('&')
	# print('conseql',conseql)
# example conseql: ['missense variant', 'nonsense variant']

# create empty dictionary conseqd. iterate over the terms in conseql and if that matches the VEP conseq priority dictionary above then store it as a key:value pair in the conseqd dictionary.
	conseqd ={}
	for term in conseql:
		if not term in conseqd:
			conseqd[term] = VEPConseqPriority[term]
	# print('conseqd',conseqd)

# sort the dictionary and get the key 
	conseq_sorted = sorted(conseqd, key=conseqd.get)
	# print('conseqSortl',conseq_sorted)

# return the value of that key in lower case.
	return conseq_sorted[0].lower()

# Here is the hgvsp_short function. This takes 3 arguments. the hgvsp_string which is the same as hgvsp_short, hgvsc_string is item[10] as mentioned above and csq_term is item[1] in elements.
def get_hgvsp_short(hgvsp_string, hgvsc_string, csq_term):
    
    aa_dict ={
    'Ala': 'A',
    'Asx': 'B',
    'Cys': 'C',
    'Asp': 'D',
    'Glu': 'E',
    'Phe': 'F',
    'Gly': 'G',
    'His': 'H',
    'Ile': 'I',
    'Lys': 'K',
    'Leu': 'L',
    'Met': 'M',
    'Asn': 'N',
    'Pro': 'P',
    'Gln': 'Q',
    'Arg': 'R',
    'Ser': 'S',
    'Thr': 'T',
    'Sec': 'U',
    'Val': 'V',
    'Trp': 'W',
    'Xaa': 'X-a',
    'Tyr': 'Y',
    'Glx': 'Z',
    'Ter': '*'
}

# create empty string hgvsp_short
    hgvsp_short = ''
   
# In the csq term if there is '&' then go through the GetConseqPriority function as described above. This should return one consequence term. 
    if '&' in csq_term:
        new_csq_term = GetConseqPriority(csq_term)
    else:
        new_csq_term = csq_term

    if new_csq_term == 'splice_donor_variant' \
        or new_csq_term == 'splice_acceptor_variant' \
            or new_csq_term == 'splice_donor_region_variant' \
                or new_csq_term == 'splice_donor_5th_base_variant'\
                    or new_csq_term == 'splice_region_variant' \
                        or new_csq_term == 'splice_polypyrimidine_tract_variant':

# If any of those consequence terms are splice variants as below then take the hgvsc_string(example:'NM_022089.4:c.2681C>T')
# split at ':' and take the [1] and store in hgvsc_coding(example: 'c.2681C>T') 

        if len(hgvsc_string.split(':')) > 1:
            hgvsc_string = hgvsc_string.split(':')[1]
            hgvsc_coding = re.findall('^c.(\d+)', hgvsc_string)
            if len(hgvsc_coding) > 0:
# input_pos will be the number 2681. This is basically the nucleotide number where this C>T conversion has taken place. 
                input_pos = float(hgvsc_coding[0])
                
                if input_pos < 1:
                    input_pos = 1
# so for a splice variant, the corrected position would be this computation below. the 3 stands for codon which is why divide it by 3.
                corrected_pos = (input_pos + (input_pos % 3))/3
# after you have the correct position, store that in hgvsp_short as p.Xcorrected_pos_splice
                hgvsp_short = 'p.X' + str(int(corrected_pos)) + '_splice'
         
            return hgvsp_short

# but if the consequence term is not a splice variant then just take [1] value from hgvsp and store in hgvsp_short.
    elif len(hgvsp_string) > 0:
        hgvsp_short = hgvsp_string.split(':')[1]
        # print(hgvsp_short)

# now for all the items in the aa dictionary above, in the keys, find the item and replace the 3 letter aa to the value of that key and store it in hgvsp_short.
        for item in aa_dict.keys():
            hgvsp_short = re.sub(item, aa_dict[item], hgvsp_short)
        # print(hgvsp_short)
        return hgvsp_short 
    else:
        # print(hgvsp_short) 
        return hgvsp_short

parser = argparse.ArgumentParser(description="hgvsp shortforms for VEP annotated Clinvar data")
parser.add_argument('-v', '--vcf', help='provide a compressed annotated VEP file (*.gz)')
parser.add_argument('-o', '--output', help='provide the filename for the output file')
args=parser.parse_args()


# vcf_fh = gzip.open(args.vcf)
vcf_fh = open(args.vcf)
output = open(args.output, 'w')

# counter = 0

# parse the line in the vcf file.
for line in vcf_fh:
    # line = line.decode('utf-8')

# take the vcf header and write it to the output file as it is. 
    if line.startswith('#'):
        output.write(line) 
        continue

    # counter += 1
    # print(counter,line) 

# take the rest of the lines and replace newline with empty string and split at tab. 
# example newline: ['1', '12073157', '874907', 'C', 'T', '.', '.', 'ALLELEID=862144;CLNDISDB=MONDO:MONDO:0018993,MedGen:C0270914,Orphanet:ORPHA64746|MONDO:MONDO:0019551,MedGen:C0393807,Orphanet:ORPHA90120,SNOMED_CT:128203003;CLNDN=Charcot-Marie-Tooth_disease_type_2|Hereditary_motor_and_sensory_neuropathy_with_optic_atrophy;CLNHGVS=NC_000001.10:g.12073157C>T;CLNREVSTAT=criteria_provided,_single_submitter;CLNSIG=Uncertain_significance;CLNVC=single_nucleotide_variant;CLNVCSO=SO:0001483;CLNVI=Illumina_Laboratory_Services,Illumina:842471;GENEINFO=MFN2:9927;MC=SO:0001624|3_prime_UTR_variant;ORIGIN=1;RS=778755558;CSQ=T|3_prime_UTR_variant|MODIFIER|MFN2|9927|Transcript|NM_001127660.2|protein_coding|18/18||NM_001127660.2:c.*1535C>T||3854|||||rs778755558||1||EntrezGene||||C|C|||uncertain_significance||1,T|3_prime_UTR_variant|MODIFIER|MFN2|9927|Transcript|NM_014874.4|protein_coding|19/19||NM_014874.4:c.*1535C>T||3999|||||rs778755558||1||EntrezGene||||C|C|||uncertain_significance||1']
    newline = line.replace('\n', '').split('\t')
    # print(newline)
    # counter += 1
    # print(counter, newline)

# take items from list index 7, replace newline with empty string and split at semi-colon ;
# example infofield: ['ALLELEID=1509854', 'CLNDISDB=MONDO:MONDO:0018993,MedGen:C0270914,Orphanet:ORPHA64746', 'CLNDN=Charcot-Marie-Tooth_disease_type_2', 'CLNHGVS=NC_000001.10:g.12064921A>G', 'CLNREVSTAT=criteria_provided,_single_submitter', 'CLNSIG=Uncertain_significance', 'CLNVC=single_nucleotide_variant', 'CLNVCSO=SO:0001483', 'GENEINFO=MFN2:9927', 'MC=SO:0001583|missense_variant', 'ORIGIN=1', 'CSQ=G|missense_variant|MODERATE|MFN2|9927|Transcript|NM_001127660.2|protein_coding|13/18||NM_001127660.2:c.1432A>G|NP_001121132.1:p.Met478Val|1477|1432|478|M/V|Atg/Gtg|rs953946892||1||EntrezGene||||A|A|||||,G|missense_variant|MODERATE|MFN2|9927|Transcript|NM_014874.4|protein_coding|14/19||NM_014874.4:c.1432A>G|NP_055689.1:p.Met478Val|1622|1432|478|M/V|Atg/Gtg|rs953946892||1||EntrezGene||||A|A|||||']

    infofield = newline[7].replace('\n','').split(';')
    # print(infofield)

    non_anno_infofield = []
    anno_infofield = []

    chrom = newline[0]
    pos = newline[1]
    id = newline[2]
    ref_allele = newline[3]
    alt_allelle = newline[4]
    quality = newline[5]
    filter = newline[6] 

    variant = '.'.join([chrom, pos, ref_allele, alt_allelle, quality,filter])
  
    for info in infofield:
        # counter +=1
        # print('info', info)
        if info.startswith('CSQ='):
            anno_infofield = info
        else:
            non_anno_infofield.append(info)
           
    # print('nonannofield',non_anno_infofield)

    # print('annoinfofield',anno_infofield)
   
    newAnno = AAcodeChange(anno_infofield)

    # print('newanno', type(newAnno) , newAnno)

    new_infofield = ';'.join(non_anno_infofield + [newAnno])
    # print(type(non_anno_infofield))

    # print('newinfofield',new_infofield)

    output.write('\t'.join(newline[0:7]+[new_infofield])+'\n')

output.close()
vcf_fh.close()
    # print(variant)

# print(anno_infofield)
# print(non_anno_Infofield)
