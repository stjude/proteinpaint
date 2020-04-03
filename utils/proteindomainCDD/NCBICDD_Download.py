#!/usr/bin/python3

"""
Downloading *.protein.gpff.gz files from NCBI ftp://ftp.ncbi.nih.gov/refseq/release/vertebrate_mammalian/.
"""

import subprocess as sp
import os


#generate a directory named 'CDD_NCBI' to store all protein.gpff.gz files
sp.run('mkdir -p CDD_NCBI',shell=True)
os.chdir('CDD_NCBI')

#Downloading NCBI protein annotation files (protein.gpff.gz)
sp.run('wget ftp://ftp.ncbi.nih.gov/refseq/H_sapiens/mRNA_Prot/*.protein.gpff.gz',shell=True)
#sp.run('wget ftp://ftp.ncbi.nih.gov/refseq/release/vertebrate_mammalian/*.protein.gpff.gz',shell=True)
print('protein annotation file downloading done!')

