#!/usr/bin/python3

import argparse
import os
import sys
import subprocess as sp
import re

def SQLITEEXPORT(df,tl):
	expCode = '.mode tabs\n'
	for t in tl:
		expCode += '.out '+t+'\n'
		expCode += 'select * from '+t+';\n'
	expCodeOUT = open('export.sql','w')
	expCodeOUT.write(expCode)
	expCodeOUT.close()
	SQLRT = sp.run('sqlite3 '+DBFILE+' <export.sql',shell=True,stdout=sp.PIPE).stdout.decode('utf-8')
	if SQLRT:
		print('db table export failed ...')
		sys.exit(1)
	else:
		print(','.join(tl)+' tables generated.')
		os.system('rm -f export.sql')
def SQLITELOAD(tl,tblcode,indexcode):
	loadCode = 'drop table if exists ideogram;\n'
	for t in tl:
		loadCode += 'drop table if exists '+t+';\n'
	for tc in tblcode:
		loadCode += tc+'\n'
	loadCode += 'CREATE TABLE ideogram (\n'
	loadCode += 'chromosome character varying,\n'
	loadCode += 'chromosome_start integer,\n'
	loadCode += 'chromosome_end integer,\n'
	loadCode += 'name character varying(20),\n'
	loadCode += 'giestain character varying(20)\n'
	loadCode += ');\n'
	loadCode += '.mode tabs\n'
	for t in tl:
		loadCode += '.import '+t+' '+t+'\n'
	loadCode += '.import cytoBand.txt ideogram\n'
	for i in indexcode:
		loadCode += i+'\n'
	loadCode += 'CREATE INDEX chromosome on ideogram (chromosome collate nocase);\n'
	loadCodeOUT = open('load.sql','w')
	loadCodeOUT.write(loadCode)
	loadCodeOUT.close()


parser = argparse.ArgumentParser()
parser.add_argument('-g','--genome',help='genome version (e.g. hg38, hg19)')
parser.add_argument('--db',help='gene db file. ideogram table will be added to the gene db if db file is provided')
parser.add_argument('-o','--output',help='output db file')
args=parser.parse_args()

if not args.genome:
	parser.print_help()
	sys.exit(1)

os.system('wget http://hgdownload.cse.ucsc.edu/goldenPath/'+args.genome+'/database/cytoBand.txt.gz')
if not os.path.isfile('cytoBand.txt.gz'):
	print('cytoBand.txt.gz downloading failed...')
	sys.exit(1)
os.system('bgzip -d cytoBand.txt.gz')
print('cytoBand.txt is downloaded from UCSC...')
if args.db:
	DBFILE = args.db
	tableList = re.split('\s+',sp.run('sqlite3 '+DBFILE+' ".table"',shell=True,stdout=sp.PIPE).stdout.decode('utf-8').strip())
	SQLITEEXPORT(DBFILE,tableList)
	schema = sp.run('sqlite3 '+DBFILE+' ".schema"',shell=True,stdout=sp.PIPE).stdout.decode('utf-8')
	tblCreCode = []
	dbindexCode = []
	for x in schema.strip().split('\n'):
		if x.startswith('CREATE INDEX'):
			dbindexCode.append(x)
		else:
			tblCreCode.append(x)

	SQLITELOAD(tableList,tblCreCode,dbindexCode)
	#generate db file
	os.system('sqlite3 '+args.output+' <load.sql')
	os.system('rm -f load.sql')
	for tl in tableList:
		os.system('rm -f '+tl)
