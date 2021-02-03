################################
#
# Liftover the hg19 coordinates within the pediatric SVCNV file to hg38 coordinates
#
################################

#Objective: liftover the hg19 coordinates within the pediatric SVCNV file to hg38 coordinates. Discard hg38 coordinates that are not on fully assembled chromosomes.

#Usage: python3 liftover_hg19_pediatric_svcnv_to_hg38.py

import subprocess
import numpy as np
import argparse
import os
import glob

filename1="pediatric.svcnv.hg19"

with open(filename1+".bed",'w') as xyz:
  for line in open(filename1,'r'):
     if line.startswith("#")==True:
       pass
     else:
       line2=line.split("\t")
       if line2[1]==line2[2]: # Structural variant or fusion
          xyz.write(line2[0]+"\t"+line2[1]+"\t"+str(int(line2[2])+1)+"\t"+line2[0]+"-"+line2[1]+"-"+str(int(line2[2])+1)+"\n")
       else:  
          xyz.write(line2[0]+"\t"+line2[1]+"\t"+line2[2]+"\t"+line2[0]+"-"+line2[1]+"-"+line2[2]+"\n")
xyz.close()

subprocess.call(["cat "+filename1+".bed | sort -k1,1V -k2,2n | uniq > "+ filename1 + ".temp && rm " + filename1+".bed && mv "+filename1+".temp "+filename1+".bed"],shell=True)
subprocess.call(["module load liftover/111417 && liftOver "+filename1+".bed"+" hg19ToHg38.over.chain.gz "+filename1.replace("hg19","hg38")+".bed unlifted."+filename1+".bed"], shell=True)
subprocess.call(["cat "+filename1.replace("hg19","hg38")+".bed | sort -k1,1V -k2,2n | uniq > "+ filename1.replace("hg19","hg38") + ".temp && rm " + filename1.replace("hg19","hg38")+".bed && mv "+filename1.replace("hg19","hg38")+".temp "+filename1.replace("hg19","hg38")+".bed"],shell=True)

hg19positions=[]
hg38positions=[]
for line in open(filename1.replace("hg19","hg38")+".bed",'r'):
   line2=line.split("\t")
   #Discard hg38 coordinates (and their corresponding hg19 coordinates) that are not on fully assembled chromosomes
   if "_" not in line2[0]:
      hg19positions.append(line2[3].replace("\n",""))
      hg38positions.append(line2[0]+"-"+line2[1]+"-"+line2[2])   
hg19positions=np.array(hg19positions)
hg38positions=np.array(hg38positions)

with open(filename1.replace("hg19","hg38"),'w') as xyz:
  for line in open(filename1,'r'):
    if line.startswith("#")==True:
       xyz.write(line) #continue
    else: 
       line2=line.split("\t")
       if line2[1]==line2[2]: # Structural variants and fusions
           dict_object=eval(line2[3])
           chrom_pos=""
           try:
              chrom=dict_object['chrA']
              position=dict_object['posA']
              chrom_pos="A"
           except KeyError:
              chrom=dict_object['chrB']
              position=dict_object['posB']
              chrom_pos="B"
           ind=np.where(hg19positions==line2[0]+"-"+line2[1]+"-"+str(int(line2[1])+1))
           ind2=np.where(hg19positions==chrom+"-"+str(position)+"-"+ str(position+1))
           try: # Some hg19 positions will not have a corresponding hg38 position
              hg38position=hg38positions[ind[0][0]]
              hg38position2=hg38position.split("-")
           except IndexError:
              continue
           try: # Some hg19 positions will not have a corresponding hg38 position
              hg38position=hg38positions[ind2[0][0]]
              hg38position3=hg38position.split("-")
           except IndexError:
              continue
           if chrom_pos=="A":
             dict_object['chrA']=hg38position3[0]
             dict_object['posA']=int(hg38position3[1])
           elif chrom_pos=="B":
             dict_object['chrB']=hg38position3[0]
             dict_object['posB']=int(hg38position3[1])
           xyz.write(hg38position2[0]+"\t"+hg38position2[1]+"\t"+hg38position2[1]+"\t"+str(dict_object).replace("'",'"')+"\n")
       else:
         ind=np.where(hg19positions==line2[0]+"-"+line2[1]+"-"+line2[2])
         try: # Some hg19 positions will not have a corresponding hg38 position
            hg38position=hg38positions[ind[0][0]]
            hg38position2=hg38position.split("-")
            xyz.write(hg38position2[0]+"\t"+hg38position2[1]+"\t"+hg38position2[2]+"\t"+line2[3])
         except IndexError:
            continue 
xyz.close()


