#!/usr/bin/python3

"""
Downloading *.protein.gpff.gz files from NCBI for CDD extraction.
"""


import subprocess as sp
import os,sys
import nameConvert

usage="python3 "+sys.argv[0]+" <species>"

if len(sys.argv) <= 1:
	print(usage)
	print("Species supported:")
	print(', '.join(nameConvert.SUPSPE()))
	sys.exit(1)

species = sys.argv[1]

## species info
speDir = nameConvert.DOWNAME(species)
if not speDir:
	print(species + ' is not supported yet!')
	print('Species supported: '+', '.join(nameConvert.SUPSPE()))
	sys.exit(1)

downloadPath = 'ftp://ftp.ncbi.nih.gov/refseq/' + \
		speDir + \
		'/mRNA_Prot/*.protein.gpff.gz'

#generate a directory named 'CDD_NCBI' to store all protein.gpff.gz files
sp.run('mkdir -p CDD_NCBI_'+species,shell=True)
os.chdir('CDD_NCBI_'+species)

#Downloading NCBI protein annotation files (protein.gpff.gz)
sp.run('wget '+downloadPath,shell=True)
#sp.run('wget ftp://ftp.ncbi.nih.gov/refseq/release/vertebrate_mammalian/*.protein.gpff.gz',shell=True)
print('protein annotation file downloading done!')

