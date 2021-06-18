#!/usr/bin/python3


script_description="""
Python script used to reheader bcf or vcf file
The following file is required
	1. /research/rgs01/resgen/legacy/gb_customTracks/tp/files/hg38/sjlife/clinical/samples.idmap
		new samples.idmap
	These two file will be used to generate a new file called intIDmap which will contain two columns. 
	The first column is call old_name(current integer ID) and new_name(new integer ID)
Newly generated reheadered bcf/vcf files and logfiles will be put under working directory. Here it is /research/rgs01/resgen/legacy/gb_customTracks/tp/files/hg38/sjlife/bcf/reheader. 
reheadered bcf/vcf files will be indexed here and moved to the final directory.
The inputs:
	1. the folder where bcf/vcf files could be found. The reheadered bcf/vcf files will be put here and the old files will be overwrited. 
	2. bcf or vcf  you are working on 
	3. header with SJID
	4. working directory(/research/rgs01/resgen/legacy/gb_customTracks/tp/files/hg38/sjlife/bcf/reheader)
"""

import argparse
from argparse import RawTextHelpFormatter
import sys,os
import subprocess as sp

##function

#reheadering
def REHEADER(working_dir,vfile_dir,vfile,idmap,vtype,overwrite):
	vname = os.path.join(working_dir,vfile)
	recomVname = os.path.join(working_dir,'recom.'+vfile)
	curVarFile = os.path.join(vfile_dir,vfile)
	OUT = open(vname+'.sh','w')
	OUT.write("#!/bin/bash\n")
	OUT.write("#BSUB -J "+vfile+".reheader\n")
	OUT.write("#BSUB -q standard\n#BSUB -n 5\n")
	OUT.write('#BSUB -R "rusage[mem=5000]"\n#BSUB -o '+vname+'_reh_log\n')
	OUT.write('#BSUB -e '+vname+'_reh_elog\n')
	OUT.write('bcftools reheader --samples '+idmap+' --threads 5 -o '+vname+' '+curVarFile+'\n')
	if vtype == 'vcf':
		OUT.write('tabix -p vcf '+vname+'\n')
	elif vtype == 'bcf':
		OUT.write('bcftools view -l 1 --threads 5 -O b -o '+recomVname+' '+vname+'\n')
		OUT.write('mv '+recomVname+' '+vname+'\n')
		OUT.write('bcftools index --threads 5 '+vname+'\n')
	if overwrite:
		OUT.write('mv '+vname+'* '+vfile_dir+'\n')
	OUT.close()
	os.system('bsub <'+vname+'.sh')
#generate idmatch file with old integer id and new integer id
def GENIDMATCH(vfile,idmapfile,vtype,intIDmapFile,sam):
	SJID2Int = GETSJID2INT(idmapfile) #SJID to new integer ID match
	if vtype == 'vcf':
		curIntID = sp.run('tabix -H '+vfile+'|grep "#CHROM"',shell=True,stdout=sp.PIPE).stdout.decode('utf-8').strip().split('\t')[9:]
	elif vtype == 'bcf':
		curIntID = sp.run('bcftools view -h '+vfile+'|grep "#CHROM"',shell=True,stdout=sp.PIPE).stdout.decode('utf-8').strip().split('\t')[9:]
	SJID2OldInt = dict(zip(sam,curIntID))
	#generate intIDmap used for reheader
	intIDmapout = open(intIDmapFile,'w')
	intIDmapout.write(' '.join(['old_name','new_name'])+'\n')
	for s in sam:
		intIDmapout.write(' '.join([SJID2OldInt[s],SJID2Int[s]])+'\n')
	intIDmapout.close()


#get SJID to new integer ID match
def GETSJID2INT(idmapfile):
	idmatch = {}
	fh = open(idmapfile)
	for i in fh:
		l = i.strip().split('\t')
		idmatch[l[1]] = l[0]
	fh.close()
	return idmatch	


parser = argparse.ArgumentParser(description=script_description,formatter_class=RawTextHelpFormatter)
parser.add_argument('-f','--folder',help='absolute path to the folder where bcf/vcf file can be found')
parser.add_argument('-t','--filetype',help='bcf or vcf')
parser.add_argument('--header',help='vcf header file with SJID')
parser.add_argument('-d','--workdir',help='working directory')
parser.add_argument('--overwrite',action='store_true',help='put reheadered file to final directory where current bcf/vcf file will be overwrited. Otherwise, reheadered files will be put under /research/rgs01/resgen/legacy/gb_customTracks/tp/files/hg38/sjlife/bcf/reheader/')
args = parser.parse_args()

if len(sys.argv) == 1:
	parser.print_help()
	sys.exit(1)


#working directory
workingDir = args.workdir

#file type: bcf or vcf
fileType = args.filetype

#current ID map
if not os.path.isfile(args.header):
	print('header file '+args.header+' does not exists...')
	sys.exit(1)
SAMPLES = sp.run('grep "#CHROM" '+args.header,shell=True,stdout=sp.PIPE).stdout.decode('utf-8').strip().split('\t')[9:]

#New ID map
newIDmapFile = '/research/rgs01/resgen/legacy/gb_customTracks/tp/files/hg38/sjlife/clinical/samples.idmap'


#bcf/vcf files...
varFiles = [x for x in os.listdir(args.folder) if x.endswith(fileType+'.gz')]
#generate idmatch file
#os.path.join(args.folder,varFiles[0]) : any vcf or bcf file need to be reheadered
#newIDmapFile : New ID map 
#fileType : vcf or bcf
#workingDir : workingDir
#SAMPLES : sample list from vcf header with SJID 
#intIDmapFile : int ID map file with old integer ID in the #1 column and new integer ID in the #2 column 
intIDmapFile = os.path.join(workingDir,'intIDmap')
if os.path.isfile(intIDmapFile):
	sp.run('rm -f '+intIDmapFile,shell=True)
GENIDMATCH(os.path.join(args.folder,varFiles[0]),newIDmapFile,fileType,intIDmapFile,SAMPLES)



#reheadering...
for v in varFiles:
	REHEADER(workingDir,args.folder,v,intIDmapFile,fileType,args.overwrite)
print('reheader jobs have been submitted!')




