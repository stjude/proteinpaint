################################
#
# Convert the hg19 coordinates within the pediatric FPKM file to hg38 coordinates
#
################################

#Objective: convert the hg19 coordinates within the pediatric FPKM file to hg38 coordinates. Discard hg38 coordinates that are not on fully assembled chromosomes.

#Usage: python3 liftover_hg19_pediatric_fpkm_to_hg38.py


#Map hg19 pediatric FPKM coordinates to hg38 coordinates
hg19_vs_hg38 = {}
with open("pediatric.fpkm.hg38.bed","r") as pediatric_fpkm_hg38_bed:
    for line in pediatric_fpkm_hg38_bed:
        line = line.strip()
        lineFields = line.split("\t")
        #Discard hg38 coordinates (and their corresponding hg19 coordinates) that are not on fully assembled chromosomes
        if "_" not in lineFields[0]:
            hg19coordinate = lineFields[3]
            hg38coordinate = lineFields[0] + "-" + lineFields[1] + "-" + lineFields[2]
            hg19_vs_hg38[hg19coordinate] = hg38coordinate

#Convert hg19 coordinates within the pediatric FPKM file to hg38 coordinates
with open("pediatric.fpkm.hg19","r") as pediatric_fpkm_hg19, open("pediatric.fpkm.hg38","w") as pediatric_fpkm_hg38:
    for line in pediatric_fpkm_hg19:
        line = line.strip()
        if line.startswith("#"):
            pediatric_fpkm_hg38.write(line + "\n")
        else:
            lineFields = line.split("\t")
            hg19coordinate = lineFields[0] + "-" + lineFields[1] + "-" + lineFields[2]
            #Some hg19 coordinates will not have corresponding hg38 coordinates
            if hg19coordinate in hg19_vs_hg38.keys():
                hg38coordinate = hg19_vs_hg38[hg19coordinate]
                hg38chr = hg38coordinate.split("-")[0]
                hg38start = hg38coordinate.split("-")[1]
                hg38stop = hg38coordinate.split("-")[2]
                pediatric_fpkm_hg38.write(hg38chr + "\t" + hg38start + "\t" + hg38stop + "\t" + lineFields[3] + "\n")


