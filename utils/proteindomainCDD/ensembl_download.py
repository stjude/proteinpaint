#!/usr/bin/python3

import argparse,sys
from pybiomart import *
import nameConvert

parser = argparse.ArgumentParser(description='Download domain info for ensembl gene')
parser.add_argument('-s','--species',help="Species name. Current supported species: human,mouse,zebrafish")

args = parser.parse_args()

if len(sys.argv) <= 1:
	parser.print_help()
	sys.exit(1)

dataset_name = nameConvert.GETDAT(args.species)
if not dataset_name:
	print(args.species + ' is not supported yet!')
	print('Species supported: '+', '.join(nameConvert.SUPSPE()))
	sys.exit(1)

dataset = Dataset(name=dataset_name,host='http://www.ensembl.org')

#CDD
M = dataset.query(attributes=['ensembl_transcript_id','external_gene_name','cdd','cdd_start','cdd_end'])
M.to_csv('ensembl_CDD_'+args.species+'.gz',index=False,compression='gzip',sep='\t')

#pfam
M = dataset.query(attributes=['ensembl_transcript_id','external_gene_name','pfam','pfam_start','pfam_end'])
M.to_csv('ensembl_Pfam_'+args.species+'.gz',index=False,compression='gzip',sep='\t')

#smart
M = dataset.query(attributes=['ensembl_transcript_id','external_gene_name','smart','smart_start','smart_end'])
M.to_csv('ensembl_smart_'+args.species+'.gz',index=False,compression='gzip',sep='\t')

#tigrfam
M = dataset.query(attributes=['ensembl_transcript_id','external_gene_name','tigrfam','tigrfam_start','tigrfam_end'])
M.to_csv('ensembl_tigrfam_'+args.species+'.gz',index=False,compression='gzip',sep='\t')


