###############################################
#
# Retrieve positions of variants based on rsIDs
#
###############################################

# Retrieve the genomic positions of PGS variants using their rsIDs. Query the rsIDs of variants against a dbSNP table to retrieve their genomic positions.

import sys
import pandas as pd

if len(sys.argv) != 4:
    print("Usage: python3 get_rsID_positions.py <PGS.txt> <dbsnp.hg38.bed> <PGS.data.hg38.txt>")
    sys.exit()

pgs = pd.read_table(sys.argv[1], dtype="string", comment="#")
dbsnp = pd.read_table(sys.argv[2], dtype="string", names=["chr","start","end","rsID"])

pgs_dbsnp = pgs.merge(dbsnp, on="rsID")
pgs_out = pgs_dbsnp.loc[:,["chr","end","effect_allele","reference_allele","effect_weight"]]
pgs_out.rename(columns={"chr": "chr_name", "end": "chr_position"}, inplace="True")
pgs_out.loc[:,"chr_name"] = pgs_out.loc[:,"chr_name"].str.replace("chr","")

pgs_out.to_csv(sys.argv[3], sep="\t", index=False)
