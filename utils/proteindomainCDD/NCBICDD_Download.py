#!/usr/bin/python3

"""
Downloading *.protein.gpff.gz files from NCBI for CDD extraction.
"""


import subprocess as sp
import os,sys

usage="python3 "+sys.argv[0]+" <species>"
spe = """human
	mouse
	zebrafish
"""

if len(sys.argv) <= 1:
	print(usage)
	print("Species supported:")
	print(spe)
	sys.exit(1)

species = sys.argv[1]

## species info
ORG2refDir = {"human":"H_sapiens",
                "mouse":"M_musculus",
                "zebrafish":"D_rerio"}


#generate a directory named 'CDD_NCBI' to store all protein.gpff.gz files
sp.run('mkdir -p CDD_NCBI_'+species,shell=True)
os.chdir('CDD_NCBI_'+species)

#Downloading NCBI protein annotation files (protein.gpff.gz)
sp.run('wget ftp://ftp.ncbi.nih.gov/refseq/'+ORG2refDir[species]+'/mRNA_Prot/*.protein.gpff.gz',shell=True)
#sp.run('wget ftp://ftp.ncbi.nih.gov/refseq/release/vertebrate_mammalian/*.protein.gpff.gz',shell=True)
print('protein annotation file downloading done!')

