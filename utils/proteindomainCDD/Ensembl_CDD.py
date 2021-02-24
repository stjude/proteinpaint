#!/usr/bin/python3

import sys,gzip
import os,re
import json
import argparse

Description="""
domain tables including at least one of the following tables is required before running this script.
CDD, Pfam, SMART and TIGRFAM
domain table includes ensembl transcript ID, gene name, Domain ID, aa start, aa end
where to down CDD domain table:
http://useast.ensembl.org/biomart/martview/0b33cafdaebd19673cc93f70f64b6ccd
Output file will be hard coded as 'Ensembl_domain.json'
"""
if len(sys.argv) == 1:
	print('python3 '+sys.argv[0]+' -h for help')
	print(Description)
	sys.exit(1)


parser = argparse.ArgumentParser()
parser.add_argument('table',help='domain tables downloaded from ensembl biomart',nargs='+')
parser.add_argument('-s','--species',help='species name. support human,zebrafish and mouse')
args = parser.parse_args()


CDDTable = args.table

#########
#function
def CDDDIC(filename):
	DOMAIN = {}
	fh = open(filename)
	for line in fh:
		L = line.strip().split('\t')
		if '.' in L[3]:
			Describ = re.search('(.*?)[.,:]',L[3]).group(1)
		else:
			Describ = L[3]
		Describ = Describ.replace('\\','')
		Describ = Describ.replace('"','')
		if L[1] not in DOMAIN:
			DOMAIN[L[1]] = [L[0],L[2],Describ]
		else:
			print('Duplicated DOMAIN ID: '+L[1],file=sys.stderr)
			continue
			#sys.exit(1)
	fh.close()
	return DOMAIN
def GERJS(h,l):
	DJS = {'start':int(float(l[3])),'stop':int(float(l[4]))}
	k = l[2]
	if 'Pfam ID' in h:
		k = 'pfam'+l[2][2:]
		DJS['Pfam'] = k
	elif 'SMART ID' in h:
		k = 'smart'+l[2][2:]
		DJS['SMART'] = k
	elif 'TIGRFAM ID' in h:
		DJS['TIGRFAM'] = k
	if k not in CDD_ID_Detail:
		return False
	DJS['CDD'] = CDD_ID_Detail[k][0]
	DJS['name'] = CDD_ID_Detail[k][1]
	DJS['description'] = CDD_ID_Detail[k][2]
	return DJS
		

#########
#Download cdd id description from ftp://ftp.ncbi.nih.gov/pub/mmdb/cdd/cddid_all.tbl.gz --output cddid.tbl.gz
#generate Dictionary data structure with cdd id as key and description as value ([UID,short name, detail])
os.system('curl ftp://ftp.ncbi.nih.gov/pub/mmdb/cdd/cddid_all.tbl.gz --output cddid.tbl.gz')
os.system('gunzip cddid.tbl.gz')
CDD_ID_Detail = CDDDIC('cddid.tbl')


########
#generate CDD.json file for sqlite3 db
OUT = open('Ensembl_domain_'+args.species+'.json','w')
for table in CDDTable:
	if table.endswith('.gz'):
		fh = gzip.open(table)
	else:
		fh = open(table)
	head = fh.readline()
	if isinstance(head,bytes):
		head = head.decode('utf-8')
	head = head.strip().split('\t')
	for line in fh:
		if isinstance(line,bytes):
			line = line.decode('utf-8')	
		L = line.replace('\n','').split('\t')
		if not L[2]:
			continue
		JS = GERJS(head,L)
		if not JS:
			continue
		#JS = {'start':int(L[3]),'stop':int(L[4]),'CDD':CDD_ID_Detail[L[2]][0],'name':CDD_ID_Detail[L[2]][1],'description':CDD_ID_Detail[L[2]][2]}
		OUT.write('\t'.join([L[0],json.dumps(JS)])+'\n')
fh.close()
OUT.close()
