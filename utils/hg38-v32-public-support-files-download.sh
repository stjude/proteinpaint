#!/usr/bin/env sh

# NOTE:
# This script downloads multiple large reference files for ProteinPaint setup.
# In some environments (e.g., AWS or systems with execution limits),
# the script execution can time out due to long-running downloads.
# Please verify your environment's execution time limits and consider using persistent storage
# (e.g., Amazon EBS, Amazon EFS, or S3) to avoid re-downloading files on subsequent runs.

set -e
TP_FOLDER="${1:-$PWD}"
mkdir -pv "$TP_FOLDER"
cd "$TP_FOLDER"

curl --parallel \
    --remote-name-all --continue-at - --create-dirs --output-dir genomes/ \
    \
    https://proteinpaint.stjude.org/ppGenomes/hg38.gz \
    https://proteinpaint.stjude.org/ppGenomes/hg38.gz.fai \
    https://proteinpaint.stjude.org/ppGenomes/hg38.gz.gzi \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir anno/ \
    https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz \
    https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/gencode.v32.hg38.gz \
    https://proteinpaint.stjude.org/ppSupport/gencode.v32.hg38.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/genes.hg38.mmrf.db \
    `# Please note that following dbSNP slice file is only for testing your ProteinPaint server;` \
    `# if you need genome-wide SNP information, download the full file from UCSC instead.` \
    https://proteinpaint.stjude.org/ppSupport/dbsnp-slice/dbsnp.hg38.bb \
    https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz \
    https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/hicfiles.tgz \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir anno/db/ \
    https://proteinpaint.stjude.org/ppSupport/db/proteindomain.db \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir anno/msigdb/ \
    https://proteinpaint.stjude.org/ppSupport/msigdb/db_2023.2.Hs \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir hg38/ \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir utils/meme/motif_databases/HUMAN/ \
    https://proteinpaint.stjude.org/ppSupport/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme \
    https://proteinpaint.stjude.org/ppSupport/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv

# Ensures index files are newer than data files so tabix won't break
touch genomes/*.fai genomes/*.gzi
touch anno/*.tbi
touch hg38/*.csi

# Releases the "hicFragment/" and "hicTAD/" folders under anno/
cd anno
tar zxf hicfiles.tgz
