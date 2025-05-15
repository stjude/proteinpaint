#!/usr/bin/env sh

set -e
TP_FOLDER="${1:-$PWD}"
mkdir -pv "$TP_FOLDER"
cd "$TP_FOLDER"

curl --parallel \
    --remote-name-all --continue-at - --create-dirs --output-dir genomes/ \
    \
    https://proteinpaint.stjude.org/ppGenomes/hg19.gz \
    https://proteinpaint.stjude.org/ppGenomes/hg19.gz.fai \
    https://proteinpaint.stjude.org/ppGenomes/hg19.gz.gzi \
    https://proteinpaint.stjude.org/ppGenomes/hg38.gz \
    https://proteinpaint.stjude.org/ppGenomes/hg38.gz.fai \
    https://proteinpaint.stjude.org/ppGenomes/hg38.gz.gzi \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir anno/ \
    https://proteinpaint.stjude.org/ppSupport/refGene.hg19.gz \
    https://proteinpaint.stjude.org/ppSupport/refGene.hg19.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz \
    https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/gencode.v40.hg19.gz \
    https://proteinpaint.stjude.org/ppSupport/gencode.v40.hg19.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/gencode.v47.hg38.gz \
    https://proteinpaint.stjude.org/ppSupport/gencode.v47.hg38.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/genes.hg19.db \
    https://proteinpaint.stjude.org/ppSupport/genes.hg38.db \
    `# Please note that following two steps only download dbSNP slice files for testing your ProteinPaint server;` \
    `# if you need genome-wide SNP information, you need to re-download files from ` \
    `# https://hgdownload.soe.ucsc.edu/gbdb/hg38/snp/dbSnp153.bb` \
    `# https://hgdownload.soe.ucsc.edu/gbdb/hg19/snp/dbSnp153.bb` \
    https://proteinpaint.stjude.org/ppSupport/dbsnp-slice/dbsnp.hg38.bb \
    https://proteinpaint.stjude.org/ppSupport/dbsnp-slice/dbsnp.hg19.bb \
    https://proteinpaint.stjude.org/ppSupport/rmsk.hg19.gz \
    https://proteinpaint.stjude.org/ppSupport/rmsk.hg19.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz \
    https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz.tbi \
    https://proteinpaint.stjude.org/ppSupport/hicfiles.tgz \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir anno/db/ \
    https://proteinpaint.stjude.org/ppSupport/db/proteindomain.db \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir anno/msigdb/ \
    https://proteinpaint.stjude.org/ppSupport/msigdb/db_2023.2.Hs  \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir hg19/ \
    https://proteinpaint.stjude.org/ppSupport/clinvar.hg19.bcf.gz \
    https://proteinpaint.stjude.org/ppSupport/clinvar.hg19.bcf.gz.csi \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir hg38/ \
    https://proteinpaint.stjude.org/ppSupport/clinvar.hg38.bcf.gz \
    https://proteinpaint.stjude.org/ppSupport/clinvar.hg38.bcf.gz.csi \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir utils/meme/motif_databases/HUMAN/ \
    https://proteinpaint.stjude.org/ppSupport/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme \
    https://proteinpaint.stjude.org/ppSupport/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv \
    \
    --next --remote-name-all --continue-at - --create-dirs --output-dir . \
    https://proteinpaint.stjude.org/ppSupport/ppdemo_bam.tar.gz `# This tarball only contains the BAM slices which are shown in http://proteinpaint.stjude.org/bam`

#curl https://proteinpaint.stjude.org/ppSupport/pp.demo.tgz -O

# Releases the "hicFragment/" and "hicTAD/" folders under anno/
cd anno
tar zxf hicfiles.tgz
cd ..
tar zxf ppdemo_bam.tar.gz # Releases the "proteinpaint_demo/" folder under $TP_FOLDER
