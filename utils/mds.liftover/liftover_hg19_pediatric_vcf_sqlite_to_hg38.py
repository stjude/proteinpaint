###################################
#
# Liftover hg19 vcf sqlite file to hg38 vcf sqlite file
#
###################################

#Objective: liftover the hg19 coordinates within an sqlite-formatted vcf file to hg38 coordinates. Discard hg38 coordinates that are not on fully assembled chromosomes.

#Usage: python3 liftover_hg19_pediatric_vcf_sqlite_to_hg38.py

import subprocess
import numpy as np
import argparse
import os
import glob

#Specify the input sqlite-formatted vcf file
filename1="pediatric.hg19.vcf.sqlite"

#Convert the variant coordinates to BED format. Store the original coordinates in the 4th column of the BED file.
with open(filename1+".bed",'w') as xyz:
	for line in open(filename1,'r'):
		line2=line.split("\t")
		chrom="chr"+line2[0]
		start=str(int(line2[1])-1)
		end=line2[1]
		xyz.write(chrom+"\t"+start+"\t"+end+"\t"+line2[0]+"-"+line2[1]+"\n")
xyz.close()

#Sort the BED file and extract unique coordinates
subprocess.call(["cat "+filename1+".bed | sort -k1,1V -k2,2n | uniq > "+ filename1 + ".temp && rm " + filename1+".bed && mv "+filename1+".temp "+filename1+".bed"],shell=True)

#Liftover the hg19 coordinates to hg38 coordinates
subprocess.call(["liftOver "+filename1+".bed"+" hg19ToHg38.over.chain.gz "+filename1.replace("hg19","hg38")+".bed unlifted."+filename1+".bed"], shell=True)

#Sort the hg38 BED file and extract unique coordinates
subprocess.call(["cat "+filename1.replace("hg19","hg38")+".bed | sort -k1,1V -k2,2n | uniq > "+ filename1.replace("hg19","hg38") + ".temp && rm " + filename1.replace("hg19","hg38")+".bed && mv "+filename1.replace("hg19","hg38")+".temp "+filename1.replace("hg19","hg38")+".bed"],shell=True)

#Store the corresponding hg19 and hg38 coordinates in numpy arrays
hg19positions=[]
hg38positions=[]
for line in open(filename1.replace("hg19","hg38")+".bed",'r'):
	line2=line.split("\t")
	#Discard hg38 coordinates (and their corresponding hg19 coordinates) that are not on fully assembled chromosomes
	if "_" not in line2[0]:
		hg19positions.append(line2[3].replace("\n",""))
		hg38positions.append(line2[0].replace("chr","")+"-"+line2[2])

hg19positions=np.array(hg19positions)
hg38positions=np.array(hg38positions)

#Convert hg19 coordinates in SQlite file to hg38 coordinates
with open(filename1.replace("hg19","hg38"),'w') as xyz:
	for line in open(filename1,'r'):
		line2=line.split("\t")
		ind=np.where(hg19positions==line2[0]+"-"+line2[1])
		try: # Some hg19 positions will not have a corresponding hg38 position
			hg38position=hg38positions[ind[0][0]]
			hg38position2=hg38position.split("-")
			xyz.write(hg38position2[0]+"\t"+hg38position2[1]+"\t"+"\t".join(line2[2:]))
		except IndexError:
			continue
xyz.close()

