####################################################
#
# Filter for matching PGS and SJLIFE/CCSS variants #
#
####################################################

# Filter the PGS variants for variants that match SJLIFE/CCSS variants. A matching variant must meet the following criteria:
    # The chromosomal position of the variant is the same across datasets.
    # The alleles of the variant match across datasets in one of the following ways (+ and - refer to strand orientation):
        # [PGS ref(+) = SJ/CC ref] and [PGS effect(+) = SJ/CC alt]
        # [PGS ref(+) = SJ/CC alt] and [PGS effect(+) = SJ/CC ref]
        # [PGS ref(-) = SJ/CC ref] and [PGS effect(-) = SJ/CC alt]
        # [PGS ref(-) = SJ/CC alt] and [PGS effect(-) = SJ/CC ref]

# PGS variants that match SJLIFE/CCSS variants are printed to the specified output file ("PGS.data.hg38.matched.txt"). Output columns are as follows: chromosome, position, effect allele, reference allele, effect weight
    # The effect and reference alleles in the output are on the same strand as that of the matching alleles in the SJLIFE/CCSS dataset.

# Usage: python3 variant_matching.py <PGS.data.hg38.txt> <SJLIFE.CCSS.variants.txt> <PGS.data.hg38.matched.txt>

import sys
import pandas as pd
import numpy as np
from Bio.Seq import Seq

if len(sys.argv) != 4:
    print("Usage: python3 variant_matching.py <PGS.data.hg38.txt> <SJLIFE.CCSS.variants.txt> <PGS.data.hg38.matched.txt>")
    sys.exit()

#Read in the PGS and SJLIFE/CCSS variant datasets
pgs = pd.read_table(sys.argv[1], dtype="string")
sjlife_ccss = pd.read_table(sys.argv[2], dtype="string")
totalVariants = len(pgs.index)

#Determine the number of PGS variants that do not have a position match to an SJLIFE/CCSS variant
pgs_posMatch = pgs.merge(sjlife_ccss, how="left", left_on=["chr_name","chr_position"], right_on=["chr","pos"])
noPosMatch = pgs_posMatch.loc[:,"chr"].isna().sum()

#Extract PGS variants with a position and allele match to an SJLIFE/CCSS variant
pgs_sjlife_ccss_merged = pgs.merge(sjlife_ccss, left_on=["chr_name","chr_position","effect_allele","reference_allele"], right_on=["chr","pos","ref_allele","alt_allele"])
pgs_matched = pgs_sjlife_ccss_merged.loc[:,["chr_name","chr_position","effect_allele","reference_allele","effect_weight"]].to_numpy()
effectRef_refAlt = len(pgs_sjlife_ccss_merged.index)

#Check for opposite allele match
pgs_sjlife_ccss_merged = pgs.merge(sjlife_ccss, left_on=["chr_name","chr_position","reference_allele","effect_allele"], right_on=["chr","pos","ref_allele","alt_allele"])
pgs_matched = np.concatenate((pgs_matched, pgs_sjlife_ccss_merged.loc[:,["chr_name","chr_position","effect_allele","reference_allele","effect_weight"]].to_numpy()))
refRef_effectAlt = len(pgs_sjlife_ccss_merged.index)

#Check for allele match on reverse strand
pgs_rev = pgs.copy()
pgs_effect_alleles = list(map(Seq, pgs.loc[:,"effect_allele"].tolist()))
pgs_ref_alleles = list(map(Seq, pgs.loc[:,"reference_allele"].tolist()))
pgs_effect_alleles_rev = list(map(Seq.reverse_complement, pgs_effect_alleles))
pgs_ref_alleles_rev = list(map(Seq.reverse_complement, pgs_ref_alleles))
pgs_rev.loc[:,"effect_allele"] = list(map(str, pgs_effect_alleles_rev))
pgs_rev.loc[:,"reference_allele"] = list(map(str, pgs_ref_alleles_rev))
pgs_rev = pgs_rev.astype("string")

pgs_sjlife_ccss_merged = pgs_rev.merge(sjlife_ccss, left_on=["chr_name","chr_position","effect_allele","reference_allele"], right_on=["chr","pos","ref_allele","alt_allele"])
pgs_matched = np.concatenate((pgs_matched, pgs_sjlife_ccss_merged.loc[:,["chr_name","chr_position","effect_allele","reference_allele","effect_weight"]].to_numpy()))
effectRef_refAlt_rev = len(pgs_sjlife_ccss_merged.index)

pgs_sjlife_ccss_merged = pgs_rev.merge(sjlife_ccss, left_on=["chr_name","chr_position","reference_allele","effect_allele"], right_on=["chr","pos","ref_allele","alt_allele"])
pgs_matched = np.concatenate((pgs_matched, pgs_sjlife_ccss_merged.loc[:,["chr_name","chr_position","effect_allele","reference_allele","effect_weight"]].to_numpy()))
refRef_effectAlt_rev = len(pgs_sjlife_ccss_merged.index)

#Export the filtered PGS variants
np.savetxt(sys.argv[3], pgs_matched, fmt="%s", delimiter="\t")

#Determine the number of variants with a position match, but no allele match
posMatchNoAlleleMatch = totalVariants - noPosMatch - pgs_matched.shape[0]

#Export the matching statistics to stdout
print("Total PGS variants:", totalVariants)
print("No position match:", noPosMatch)
print("Position match, no allele match:", posMatchNoAlleleMatch)
print("Allele match (ref = ref; effect = alt):", refRef_effectAlt)
print("Allele match (effect = ref; ref = alt):", effectRef_refAlt)
print("Allele match (ref(-) = ref; effect(-) = alt):", refRef_effectAlt_rev)
print("Allele match (effect(-) = ref; ref(-) = alt):", effectRef_refAlt_rev)
