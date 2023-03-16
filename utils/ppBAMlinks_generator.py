# This python script generates ppBAM links for each variant in a given single-sample VCF file

# Installation: python3 -m venv vcf_parse && source vcf_parse/bin/activate && pip3 install PyVCF3
# Syntax: source vcf_parse/bin/activate && python3 ppBAMlinks_generator.py --VCF test3.vcf --BAM test.bam

import vcf
import gzip
import argparse

parser = argparse.ArgumentParser(
                    prog = 'ppBAMlinks_generator',
                    description = 'Generates weblinks in a csv file for each variant from the given VCF file',
                    epilog = 'Text at the bottom of help')
parser.add_argument('--VCF', type=str, required=True, help='path to input single-sample vcf file is required')
parser.add_argument('--BAM', type=str, required=True, help='path to input BAM file is required')
parser.add_argument('--IP', type=str, required=False, default="localhost:3000", help='IP address of proteinpaint server')
parser.add_argument('--out', type=str, required=False, default="output.csv", help='Output csv file')
parser.add_argument('--reference_genome', type=str, required=False, default="hg19", help='Reference genome (e.g hg19,hg38)')
parser.add_argument('--view_range', type=int, required=False, default=300, help='View range from the variant position')
parser.add_argument('--sample_name', type=str, required=False, help='Name of sample')

args = parser.parse_args()

vcf_file = args.VCF
bam_file = args.BAM
ip_address = args.IP
output_file = args.out
genome_build = args.reference_genome
view_range = args.view_range
sample_name = args.sample_name # Name of sample

#print ("VCF:",vcf_file)
#print ("BAM:",bam_file)
#print ("ip_address:",ip_address)
#print ("sample_name:",sample_name)

if vcf_file.endswith(".gz")==True:
  vcf_reader = vcf.Reader(gzip.open(vcf_file, 'r'))
else:
  vcf_reader = vcf.Reader(open(vcf_file, 'r'))  

if sample_name == None:
   sample_name = bam_file.replace(".bam","")

old_record = None
old_weblink = None
multi_weblink = None
json_string=""
with open(output_file,'w') as xyz:
  for record in vcf_reader:
     if len(record.ALT) == 1: # Single-allele variant but may contain multi-allele variant in the following rows
        view_start = record.POS - view_range
        view_stop = record.POS + view_range
        if view_start < 0:
          view_start = 0

        # Check to see if there is any overlap with the previous variant
        if record.ALT[0] != None and record.REF != None:
           if old_record != None and old_record.ALT[0] != None and old_record.CHROM == record.CHROM:
             old_variant_length = max(len(old_record.REF),len(old_record.ALT[0]))
             variant_length = max(len(record.REF),len(record.ALT[0]))
             if (old_record.POS < record.POS and record.POS < old_record.POS + old_variant_length): # Check to see if the curent variant overlaps with previous variant
                if json_string == "": # First entry of multi-allele variant. JSON string is created when there is no previous JSON string
                   json_string = '{"chr:"' + old_record.CHROM + '", "variants":[{"pos":' + str(old_record.POS) +', "ref":"' + str(old_record.REF) + '","alt":"' + str(old_record.ALT[0]) + '"},{"pos":' + str(record.POS) +', "ref":"' + str(record.REF) + '","alt":"' + str(record.ALT[0]) + '"}]'
                   multi_weblink = ip_address + "/?genome=" + genome_build + "&block=1&position=" + record.CHROM + ":" + str(view_start) + "-" + str(view_stop) + "&bamfile=" + sample_name + "," + bam_file +"&variant=" + json_string
                   #print ("json_string:",json_string)
                else: # If JSON string already exists, new JSON entry is added to existing JSON string
                   json_string=json_string[:-1]
                   json_string += ',{"pos":' + str(record.POS) +', "ref":"' + str(record.REF) + '","alt":"' + str(record.ALT[0]) + '"}]'
                   multi_weblink = ip_address + "/?genome=" + genome_build + "&block=1&position=" + record.CHROM + ":" + str(view_start) + "-" + str(view_stop) + "&bamfile=" + sample_name + "," + bam_file +"&variant=" + json_string
             else: # When current variant does not overlap with previous variant, it is considered "single-allele" variant
                if multi_weblink != None:
                  xyz.write(multi_weblink+"\n")
                  multi_weblink = None
                  old_weblink = None
                weblink = ip_address + "/?genome=" + genome_build + "&block=1&position=" + record.CHROM + ":" + str(view_start) + "-" + str(view_stop) + "&bamfile=" + sample_name + "," + bam_file +"&variant=" + str(record.CHROM) + "." + str(record.POS) + "." + str(record.REF) + "." + str(record.ALT[0])
                json_string=""
                if old_weblink != None:
                   xyz.write(old_weblink+"\n")
                   old_weblink = weblink  
           else:  # Single-allele variant
              if multi_weblink != None:
                xyz.write(multi_weblink+"\n")
                multi_weblink = None
                old_weblink = None       
              weblink = ip_address + "/?genome=" + genome_build + "&block=1&position=" + record.CHROM + ":" + str(view_start) + "-" + str(view_stop) + "&bamfile=" + sample_name + "," + bam_file +"&variant=" + str(record.CHROM) + "." + str(record.POS) + "." + str(record.REF) + "." + str(record.ALT[0])
              json_string=""
              if old_weblink != None:
                 xyz.write(old_weblink+"\n")
                 old_weblink = weblink
     else: # Multi-allele variant
         if multi_weblink != None:
           xyz.write(multi_weblink+"\n")
           multi_weblink = None
           old_weblink = None
         json_string='{"chr:"' + record.CHROM + '", "variants":['
         for alt_allele in record.ALT:
            json_string+='{"pos":' + str(record.POS) +', "ref":"' + str(record.REF) + '","alt":"' + str(alt_allele) + '"},'
         json_string=json_string[:-1]
         json_string += ']'
         weblink = ip_address + "/?genome=" + genome_build + "&block=1&position=" + record.CHROM + ":" + str(view_start) + "-" + str(view_stop) + "&bamfile=" + sample_name + "," + bam_file +"&variant=" + json_string
         if old_weblink != None:
           xyz.write(old_weblink+"\n")
           old_weblink = weblink 
     old_record = record
     if old_weblink == None:
        old_weblink = weblink
  if multi_weblink != None:
    xyz.write(multi_weblink+"\n")
  else:  
    xyz.write(weblink+"\n")
xyz.close()
