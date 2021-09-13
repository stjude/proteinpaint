#!/bin/bash

#################################
# PRS pipeline
#################################


########## Overview #############

# Pipeline to compute PRS scores for SJLIFE and CCSS samples using a given set of variants and their effect weights.


########### Input ###############

# The input for this PRS pipeline is a variant scoring file that reports the variants that will be used for PRS computation and their effect weights. This pipeline is designed to handle variant scoring files from the PGS catalog (https://www.pgscatalog.org/). Scoring files can be downloaded from the catalog and inputted directly into this pipeline. Alternatively, a custom variant scoring file can also be provided. For a custom scoring file, the file should follow the formatting guidelines described in the PGS catalog (see: https://www.pgscatalog.org/downloads/#dl_ftp).


######## Pipeline steps #########

# Pre-process the variants dataset
    # Determine the hg38 coordinates of the variants
    # Abort the analysis, if dataset contains duplicated variants
    # Discard non-SNP variants (e.g. indels)
    # Discard non-autosomal SNPs
    # Discard strand-ambiguous SNPs
    # Match variants to SJLIFE+CCSS variants

# Compute PRS scores of SJLIFE and CCSS samples
    # Split SJLIFE and CCSS samples by ancestry. Only consider samples of European, African, or Asian ancestry
    # Compute PRS scores of samples for each ancestry separately using the processed variant dataset.
    # QC steps during PRS computation:
        # Missing call rate < 10%
        # HWE p-value > 1e-6
        # Effect allele frequency > 1% (optional)
            # Compute PRS scores with and without this cutoff


############ Notes ##############

# Create a new working directory before running this pipeline. Store the input variant scoring file in this directory and run the pipeline from this directory. All output files of the pipeline will be stored in this working directory.


############# Code ##############

if [[ $# -ne 2 ]]
then
    printf "Usage: bash path/to/prs_pipeline.sh <variant scoring file> <genome build>\n"
    printf "\t<variant scoring file>: file containing the input variants and their effect weights. This file should be stored in the working directory of the PRS analysis.\n"
    printf "\t<genome build>: genome build of variants (hg19 or hg38). If genome build is hg19, then variant coordinates will be lifted over to hg38 coordinates.\n"
    exit 2
fi

variants=$1
genome=$2

module load dos2unix/7.4.0 ucsc/041619 R/4.0.2

# Remove carriage returns
dos2unix --allow-chown $variants

# Count the total number of input variants
totalCnt=$(grep -v "^#" $variants | sed '1d' | wc -l)

# Verify that effect allele, reference allele, and effect weight information is provided
header=$(grep -v "^#" $variants | head -n 1)
if [[ ! $header =~ "effect_allele" ]] || [[ ! $header =~ "reference_allele" ]] || [[ ! $header =~ "effect_weight" ]]
then
    echo "Error: variants file does not contain allele and/or weight information"
    exit 2
fi

# Determine the hg38 genomic positions of the variants. If the genomic positions of variants are provided and the genome build is hg38, then use these positions. If the genome build is hg19, then liftover to hg38. If genomic positions are not provided, then determine genomic positions using the rsIDs.
unliftedCnt=0
if [[ $header =~ "chr_name" ]] && [[ $header =~ "chr_position" ]]
then
    if [[ $header =~ "rsID" ]]
    then
        grep -v "^#" $variants | cut -f 2-6 > variants.data.txt
    else
        grep -v "^#" $variants | cut -f 1-5 > variants.data.txt
    fi
    # Verify that the columns of the data file are: chr, pos, effect allele, ref allele, effect weight.
    header_data=$(head -n 1 variants.data.txt | sed 's/\t/,/g')
    if [[ $header_data != "chr_name,chr_position,effect_allele,reference_allele,effect_weight" ]]
    then
        echo "Error: variant data file is not in the correct format"
        exit 2
    fi
    # Liftover to hg38 coordinates (if applicable)
    if [[ $genome == "hg38" ]]
    then
        mv variants.data.txt variants.data.hg38.txt
    elif [[ $genome == "hg19" ]]
    then
        sed '1d' variants.data.txt | awk 'BEGIN{FS=OFS="\t"} {print "chr"$1,$2-1,$2,$1";"$2";"$3";"$4";"$5}' > variants.data.bed
        liftOver variants.data.bed ~/tp/utils/mds.liftover/hg19ToHg38.over.chain.gz variants.data.hg38.bed variants.data.unlifted.bed
        # Discard SNPs from minor chromosomes and convert the hg38 BED file to a PGS text file.
        awk 'BEGIN{FS=OFS="\t"} $1 !~ /_/' variants.data.hg38.bed | awk 'BEGIN{FS="[\t;]"; OFS="\t"; print "chr_name\tchr_position\teffect_allele\treference_allele\teffect_weight"} {sub("chr","",$1); print $1,$3,$6,$7,$8}' > variants.data.hg38.txt
        unliftedCnt=$(($(grep -c "" variants.data.txt) - $(grep -c "" variants.data.hg38.txt)))
    #If genome build is neither hg19 nor hg38, then abort
    else
        echo "Error: genome build of PGS dataset must be hg19 for liftover"
        exit 2
    fi
# If genomic position columns are not available, then determine the genomic positions of variants using their rsIDs
elif [[ $header =~ "rsID" ]]
then
    grep -v "^#" $variants | sed '1d' | cut -f 1 > variants.rsIDs.txt
    # Query the rsIDs against the dbSNP database (which has been mapped to hg38). Discard dbSNP hits from minor chromosomes.
    bigBedNamedItems -nameFile ~/tp/gmatt/prs/dbSnp153.bb variants.rsIDs.txt stdout | cut -f 1-4 | awk 'BEGIN{FS=OFS="\t"} $1 !~ /_/' > variants.dbSNP.bed
    # Verify a 1:1 correspondence between rsID queries and dbSNP hits
    if ! cmp -s <(sort variants.rsIDs.txt) <(cut -f 4 variants.dbSNP.bed | sort)
    then
        echo "Error: no 1:1 correspondence between rsID queries and dbSNP hits"
        exit 2
    fi
    # Incorporate the genomic positions of the rsIDs into the variant table
    python3 ~/tp/gmatt/prs/get_rsID_positions.py $variants variants.dbSNP.bed variants.data.hg38.txt
else
    echo "Error: the variants file is not in the correct format"
    exit 2
fi

# Verify the columns of the hg38 data file
header_data_hg38=$(head -n 1 variants.data.hg38.txt | sed 's/\t/,/g')
if [[ $header_data_hg38 != "chr_name,chr_position,effect_allele,reference_allele,effect_weight" ]]
then
    echo "Error: the variants hg38 data file is not in the correct format"
    exit 2
fi


##############################
# Initial QC of variant data
##############################

# Check if PGS dataset contains any duplicated SNPs
dupCnt=$(awk 'BEGIN{FS=OFS="\t"} FNR > 1 {print $1,$2,$3,$4}' variants.data.hg38.txt | sort | uniq -d | wc -l)
if [[ $dupCnt -gt 0 ]]
then
    echo "Error: duplicated SNPs present"
    exit 2
fi

# Discard variants that are either: [1] non-SNPs (e.g. indels), [2] non-autosomal SNPs, or [3] strand-ambiguous SNPs
nonSnpCnt=$(sed '1d' variants.data.hg38.txt | awk 'BEGIN{FS=OFS="\t"} (length($3) > 1) || (length($4) > 1)' | wc -l)
nonAutoCnt=$(sed '1d' variants.data.hg38.txt | cut -f 1 | grep -c "[^0-9]")
ambigCnt=$(sed '1d' variants.data.hg38.txt | awk 'BEGIN{FS=OFS="\t"} ($3 == "A" && $4 == "T") || ($3 == "T" && $4 == "A") || ($3 == "C" && $4 == "G") || ($3 == "G" && $4 == "C")' | wc -l)
awk 'BEGIN{FS=OFS="\t"} FNR == 1; ((length($3) == 1) && (length($4) == 1)) && ($1 !~ /[^0-9]/) && (($3 == "A" && $4 != "T") || ($3 == "T" && $4 != "A") || ($3 == "C" && $4 != "G") || ($3 == "G" && $4 != "C"))' variants.data.hg38.txt > variants.data.hg38.filt.txt


#############################
# Variant matching
#############################

# First, extract SJLIFE+CCSS variants that have the same positions as the input variants (this step will reduce the memory load of the variant matching step)
sed '1d' variants.data.hg38.filt.txt | awk 'BEGIN{FS=OFS="\t"} {print $1,$2,$2}' | sort -k1,1n -k2,2n -u > variants.hg38.regions
zcat ~/tp/files/hg38/sjlife/bcf/SJLIFE.CCSS.variants.txt.gz | head -n 1 > sjlife.ccss.variants.posMatch.txt
tabix -R variants.hg38.regions ~/tp/files/hg38/sjlife/bcf/SJLIFE.CCSS.variants.txt.gz >> sjlife.ccss.variants.posMatch.txt

# Filter the input variants for variants that match SJLIFE+CCSS variants. Matching variants share the same position and alleles. Alleles may match in either order (e.g. ref=ref/effect=alt OR ref=alt/effect=ref) on either strand.
python3 ~/tp/gmatt/prs/variant_matching.py variants.data.hg38.filt.txt sjlife.ccss.variants.posMatch.txt variants.data.hg38.matched.txt > variant.matching.stats
noPosMatchCnt=$(grep "^No position match" variant.matching.stats | awk 'BEGIN{FS=": "} {print $2}')
posMatchNoAlleleMatchCnt=$(grep "^Position match, no allele match" variant.matching.stats | awk 'BEGIN{FS=": "} {print $2}')
matchedCnt=$(cat variants.data.hg38.matched.txt | wc -l)


#############################
# PRS computation
#############################

# Compute PRS scores for SJLIFE+CCSS samples using the set of matched input variants. Split samples into ancestry groups (e.g. European, Afican, and Asian) and compute PRS separately for each group. Compute PRS with and without a minor allele frequency (MAF) cutoff of >1% for all groups.
for ancestry in european african asian
do
    awk -v ancestry="${ancestry^} Ancestry" 'BEGIN{FS=OFS="\t"} $2 == "genetic_race" && $3 == ancestry {print $1}' ~/tp/files/hg38/sjlife/clinical/annotation.matrix > ${ancestry}.samples
    node ~/tp/gmatt/prs/compute_prs.bundle.js variants.data.hg38.matched.txt ${ancestry}.samples maf ${ancestry}.prs.mafFilt.profile > ${ancestry}.prs.mafFilt.stats
    node ~/tp/gmatt/prs/compute_prs.bundle.js variants.data.hg38.matched.txt ${ancestry}.samples noMaf ${ancestry}.prs.profile > ${ancestry}.prs.stats
done


#############################
# Print statistics
#############################
printf "Number of input variants: ${totalCnt}\n\
Numbers of dropped variants:\n\
\tVariants not lifted over: ${unliftedCnt}\n\
\tNon-SNP variants: ${nonSnpCnt}\n\
\tNon-autosomal SNPs: ${nonAutoCnt}\n\
\tAmbiguous SNPs: ${ambigCnt}\n\
\tSNPs with no position match in SJLIFE+CCSS: ${noPosMatchCnt}\n\
\tSNPs with position match, but no allele match, in SJLIFE+CCSS: ${posMatchNoAlleleMatchCnt}\n\
Number of SNPs used for PRS computation: ${matchedCnt}\n\n\n" > prs.pipeline.stats

printf "PRS computation stats:\n" >> prs.pipeline.stats
for ancestry in european african asian
do
    printf "\n${ancestry^} PRS (no MAF filter):\n" >> prs.pipeline.stats
    cat ${ancestry}.prs.stats >> prs.pipeline.stats
    printf "\n${ancestry^} PRS (1%% MAF filter):\n" >> prs.pipeline.stats
    cat ${ancestry}.prs.mafFilt.stats >> prs.pipeline.stats
done
