#!/bin/bash

#################################
#
# PRS pipeline
#
#################################


########## Objective ############

# Pipeline to compute PRS scores for SJLIFE+CCSS samples based on a specified PGS dataset from the PGS catalog.


######## Pipeline steps #########

# Download the PGS scoring file from the PGS catalog

# Pre-process the PGS data
    # Determine the hg38 coordinates of the variants
    # Discard dataset if it contains non-SNP variants (e.g. indels)
    # Discard dataset if it contains duplicated SNPs
    # Remove non-autosomal SNPs
    # Remove strand-ambiguous SNPs
    # Match variants to SJLIFE+CCSS variants

# Compute PRSs of SJLIFE+CCSS samples
    # Split SJLIFE+CCSS samples by ancestry. Only consider samples of European, African, or Asian ancestry
    # Compute the PRSs of samples from each ancestry group separately based on the processed PGS data.
    # QC steps during PRS computation:
        # Missing call rate < 10%
        # HWE p-value > 1e-6
        # Effect allele frequency > 1% (optional)
            # Compute PRSs with and without this cutoff


############ Notes ##############

# Before running the pipeline, create a new directory for storing all output files of the pipeline.


if [[ $# -ne 2 ]]
then
    printf "Usage: bash prs_pipeline.sh <pgsID> <outDir>\n"
    printf "\t<pgsID>: PGS identifier (e.g. PGS000332)\n"
    printf "\t<outDir>: directory to store output files\n"
    exit 2
fi
pgsID=$1
outDir=$2

module load ucsc/041619 R/4.0.2


##############################
# Download PGS scoring file
##############################

# Download the PGS scoring file from the PGS catalog
cd $outDir
wget http://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/${pgsID}/ScoringFiles/${pgsID}.txt.gz
gunzip ${pgsID}.txt.gz
rawSnpCnt=$(grep -v "^#" ${pgsID}.txt | sed '1d' | wc -l)

# Verify that effect allele, reference allele, and effect weight information is provided
pgsFileCols=$(grep -v "^#" ${pgsID}.txt | head -n 1)
if [[ ! $pgsFileCols =~ "effect_allele" ]] || [[ ! $pgsFileCols =~ "reference_allele" ]] || [[ ! $pgsFileCols =~ "effect_weight" ]]
then
    echo "Error: PGS scoring file does not contain allele and/or weight information"
    exit 2
fi

# Determine the hg38 genomic positions of PGS variants. If the genomic positions of variants are provided and the genome build is hg38, then use these positions. If the genome build is hg19, then liftover to hg38. If genomic positions are not provided, then determine genomic positions using the rsIDs.
notLiftedSnpCnt=0
if [[ $pgsFileCols =~ "chr_name" ]] && [[ $pgsFileCols =~ "chr_position" ]]
then
    if [[ $pgsFileCols =~ "rsID" ]]
    then
        grep -v "^#" ${pgsID}.txt | cut -f 2-6 > ${pgsID}.data.txt
    else
        grep -v "^#" ${pgsID}.txt | cut -f 1-5 > ${pgsID}.data.txt
    fi
    # Verify that the columns of the PGS data file are: chr, pos, effect allele, ref allele, effect weight.
    pgsDataFileCols=$(head -n 1 ${pgsID}.data.txt | sed 's/\t/,/g')
    if [[ $pgsDataFileCols != "chr_name,chr_position,effect_allele,reference_allele,effect_weight" ]]
    then
        echo "Error: PGS data file is not in the correct format"
        exit 2
    fi
    # Liftover to hg38 coordinates (if applicable)
    pgsGenome=$(grep "^# Original Genome Build" ${pgsID}.txt | cut -d " " -f 6)
    if [[ $pgsGenome == "hg38" ]] || [[ $pgsGenome == "GRCh38" ]]
    then
        mv ${pgsID}.data.txt ${pgsID}.data.hg38.txt
    elif [[ $pgsGenome == "hg19" ]] || [[ $pgsGenome == "GRCh37" ]]
    then
        # Convert PGS text file to BED file
        sed '1d' ${pgsID}.data.txt | awk 'BEGIN{FS=OFS="\t"} {print "chr"$1,$2-1,$2,$1";"$2";"$3";"$4";"$5}' > ${pgsID}.data.bed
        # Liftover from hg19 to hg38
        liftOver ${pgsID}.data.bed ~/tp/utils/mds.liftover/hg19ToHg38.over.chain.gz ${pgsID}.data.hg38.bed ${pgsID}.data.notLifted.bed
        # Discard SNPs from minor chromosomes and convert the hg38 BED file to a PGS text file.
        awk 'BEGIN{FS=OFS="\t"} $1 !~ /_/' ${pgsID}.data.hg38.bed | awk 'BEGIN{FS="[\t;]"; OFS="\t"; print "chr_name\tchr_position\teffect_allele\treference_allele\teffect_weight"} {sub("chr","",$1); print $1,$3,$6,$7,$8}' > ${pgsID}.data.hg38.txt
        notLiftedSnpCnt=$(($(grep -c "" ${pgsID}.data.txt) - $(grep -c "" ${pgsID}.data.hg38.txt)))
    #If genome build is neither hg19 nor hg38, then abort
    else
        echo "Error: genome build of PGS dataset must be hg19 for liftover"
        exit 2
    fi
# If genomic position columns are not available, then determine the genomic positions of variants using their rsIDs
elif [[ $pgsFileCols =~ "rsID" ]]
then
    grep -v "^#" ${pgsID}.txt | sed '1d' | cut -f 1 > ${pgsID}.rsIDs.txt
    # Query the rsIDs against the dbSNP database (which has been mapped to hg38). Discard dbSNP hits from minor chromosomes.
    bigBedNamedItems -nameFile ~/tp/gmatt/prs/dbSnp153.bb ${pgsID}.rsIDs.txt stdout | cut -f 1-4 | awk 'BEGIN{FS=OFS="\t"} $1 !~ /_/' > ${pgsID}.dbSNP.bed
    # Verify a 1:1 correspondence between rsID queries and dbSNP hits
    if ! cmp -s <(sort ${pgsID}.rsIDs.txt) <(cut -f 4 ${pgsID}.dbSNP.bed | sort)
    then
        echo "Error: no 1:1 correspondence between rsID queries and dbSNP hits"
        exit 2
    fi
    # Incorporate the genomic positions of the rsIDs into the PGS variant table
    python3 ~/tp/gmatt/prs/get_rsID_positions.py ${pgsID}.txt ${pgsID}.dbSNP.bed ${pgsID}.data.hg38.txt
else
    echo "Error: the PGS file is not in the correct format"
    exit 2
fi

# Verify the columns of the PGS hg38 data file
pgshg38DataFileCols=$(head -n 1 ${pgsID}.data.hg38.txt | sed 's/\t/,/g')
if [[ $pgshg38DataFileCols != "chr_name,chr_position,effect_allele,reference_allele,effect_weight" ]]
then
    echo "Error: PGS hg38 data file is not in the correct format"
    exit 2
fi


##############################
# Initial QC of PGS data
##############################

# Discard the PGS dataset if it contains any non-SNP variants (e.g. indels)
nonSnpCnt=$(sed '1d' ${pgsID}.data.hg38.txt | awk 'BEGIN{FS=OFS="\t"} (length($3) > 1) || (length($4) > 1)' | wc -l)
if [[ $nonSnpCnt -gt 0 ]]
then
    echo "Error: non-SNP variants found in PGS dataset"
    exit 2
fi

# Check if PGS dataset contains any duplicated SNPs
dupSnpCnt=$(awk 'BEGIN{FS=OFS="\t"} FNR > 1 {print $1,$2,$3,$4}' ${pgsID}.data.hg38.txt | sort | uniq -d | wc -l)
if [[ $dupSnpCnt -gt 0 ]]
then
    echo "Error: duplicated SNPs found in PGS dataset"
    exit 2
fi

# Remove any non-autosomal or strand-ambiguous SNPs from the PGS dataset
nonAutoSnpCnt=$(sed '1d' ${pgsID}.data.hg38.txt | cut -f 1 | grep -c "[^0-9]")
ambigSnpCnt=$(sed '1d' ${pgsID}.data.hg38.txt | awk 'BEGIN{FS=OFS="\t"} ($3 == "A" && $4 == "T") || ($3 == "T" && $4 == "A") || ($3 == "C" && $4 == "G") || ($3 == "G" && $4 == "C")' | wc -l)
awk 'BEGIN{FS=OFS="\t"} FNR == 1;$1 !~ /[^0-9]/' ${pgsID}.data.hg38.txt | awk 'BEGIN{FS=OFS="\t"} FNR == 1;($3 == "A" && $4 != "T") || ($3 == "T" && $4 != "A") || ($3 == "C" && $4 != "G") || ($3 == "G" && $4 != "C")' > ${pgsID}.data.hg38.filt.txt


#############################
# Variant matching
#############################

# First, extract SJLIFE+CCSS variants that have the same positions as PGS variants (this step will reduce the memory load of the variant matching step)
sed '1d' ${pgsID}.data.hg38.filt.txt | awk 'BEGIN{FS=OFS="\t"} {print $1,$2,$2}' | sort -k1,1n -k2,2n -u > ${pgsID}.hg38.regions
zcat ~/tp/files/hg38/sjlife/bcf/SJLIFE.CCSS.variants.txt.gz | head -n 1 > SJLIFE.CCSS.${pgsID}.posMatch.txt
tabix -R ${pgsID}.hg38.regions ~/tp/files/hg38/sjlife/bcf/SJLIFE.CCSS.variants.txt.gz >> SJLIFE.CCSS.${pgsID}.posMatch.txt

# Filter PGS variants for variants that match SJLIFE+CCSS variants. Matching variants share the same position and alleles. Alleles may match in either order (e.g. ref=ref/effect=alt OR ref=alt/effect=ref) on either strand.
python3 ~/tp/gmatt/prs/variant_matching.py ${pgsID}.data.hg38.filt.txt SJLIFE.CCSS.${pgsID}.posMatch.txt ${pgsID}.data.hg38.matched.txt > ${pgsID}.matching.stats
noPosMatchSnpCnt=$(grep "^No position match" ${pgsID}.matching.stats | awk 'BEGIN{FS=": "} {print $2}')
posMatchNoAlleleMatchSnpCnt=$(grep "^Position match, no allele match" ${pgsID}.matching.stats | awk 'BEGIN{FS=": "} {print $2}')
matchedSnpCnt=$(cat ${pgsID}.data.hg38.matched.txt | wc -l)


#############################
# PRS computation
#############################

# Compute PRS scores for SJLIFE+CCSS samples using the set of matched PGS variants. Split samples into ancestry groups (e.g. European, Afican, and Asian) and compute PRS separately for each group. Compute PRS with and without a minor allele frequency (MAF) cutoff of >1% for all groups.
for ancestry in European African Asian
do
    awk -v ancestry="$ancestry Ancestry" 'BEGIN{FS=OFS="\t"} $2 == "genetic_race" && $3 == ancestry {print $1}' ~/tp/files/hg38/sjlife/clinical/annotation.matrix > ${ancestry}.samples
    node ~/tp/gmatt/prs/compute_prs.js ${pgsID}.data.hg38.matched.txt ${ancestry}.samples > ${pgsID}.${ancestry}.prs.mafFilt.profile 2> ${pgsID}.${ancestry}.prs.mafFilt.stats
    node ~/tp/gmatt/prs/compute_prs.js --no-maf-cutoff ${pgsID}.data.hg38.matched.txt ${ancestry}.samples > ${pgsID}.${ancestry}.prs.profile 2> ${pgsID}.${ancestry}.prs.stats
done


#############################
# Print statistics
#############################
printf "\n==== PRS pipeline statistics ====\n\n"
printf "Number of SNPs in PGS dataset: ${rawSnpCnt}\n"
printf "Numbers of dropped PGS SNPs:\n"
printf "\tSNPs not lifted over: ${notLiftedSnpCnt}\n"
printf "\tNon-autosomal SNPs: ${nonAutoSnpCnt}\n"
printf "\tAmbiguous SNPs: ${ambigSnpCnt}\n"
printf "\tSNPs with no position match in SJLIFE+CCSS: ${noPosMatchSnpCnt}\n"
printf "\tSNPs with position match, but no allele match, in SJLIFE+CCSS: ${posMatchNoAlleleMatchSnpCnt}\n"
printf "Number of PGS SNPs used for PRS computation: ${matchedSnpCnt}\n"
