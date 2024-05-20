if [[ $1 == "" ]]; then
    echo "No data folder specified, using current directory as data folder"
    TP_FOLDER=$PWD
else
    TP_FOLDER=$1
fi 

if [[ ! -d $TP_FOLDER ]]
then
    echo "$TP_FOLDER does not exists on your filesystem, creating one."
    mkdir -p $TP_FOLDER
fi

cd $TP_FOLDER
mkdir -p genomes/ anno/db/ anno/msigdb/ hg19/ hg38/ utils/meme/motif_databases/HUMAN/


cd genomes/
curl https://proteinpaint.stjude.org/ppGenomes/hg19.gz -O
curl https://proteinpaint.stjude.org/ppGenomes/hg19.gz.fai -O
curl https://proteinpaint.stjude.org/ppGenomes/hg19.gz.gzi -O
curl https://proteinpaint.stjude.org/ppGenomes/hg38.gz -O
curl https://proteinpaint.stjude.org/ppGenomes/hg38.gz.fai -O
curl https://proteinpaint.stjude.org/ppGenomes/hg38.gz.gzi -O

cd ../anno/
curl https://proteinpaint.stjude.org/ppSupport/refGene.hg19.gz -O
curl https://proteinpaint.stjude.org/ppSupport/refGene.hg19.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz -O
curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/gencode.v40.hg19.gz -O
curl https://proteinpaint.stjude.org/ppSupport/gencode.v40.hg19.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/gencode.v43.hg38.gz -O
curl https://proteinpaint.stjude.org/ppSupport/gencode.v43.hg38.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/genes.hg19.db -O
curl https://proteinpaint.stjude.org/ppSupport/genes.hg38.db -O

# Please note that following two steps only download dbSNP slice files for testing your ProteinPaint server;
# if you need genome-wide SNP information, you need to re-download files from 
# https://hgdownload.soe.ucsc.edu/gbdb/hg38/snp/dbSnp153.bb
# https://hgdownload.soe.ucsc.edu/gbdb/hg19/snp/dbSnp153.bb
curl https://proteinpaint.stjude.org/ppSupport/dbsnp-slice/dbsnp.hg38.bb -O
curl https://proteinpaint.stjude.org/ppSupport/dbsnp-slice/dbsnp.hg19.bb -O

curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg19.gz -O
curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg19.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz -O
curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz.tbi -O

curl https://proteinpaint.stjude.org/ppSupport/hicfiles.tgz -O
tar zxvf hicfiles.tgz # Releases the "hicFragment/" and "hicTAD/" folders under anno/

cd db/
curl https://proteinpaint.stjude.org/ppSupport/db/proteindomain.db -O

cd ../msigdb/
curl https://proteinpaint.stjude.org/ppSupport/msigdb/db_2023.2.Hs  -O

cd ../../hg19/
curl https://proteinpaint.stjude.org/ppSupport/clinvar.hg19.bcf.gz -O
curl https://proteinpaint.stjude.org/ppSupport/clinvar.hg19.bcf.gz.csi -O


cd ../hg38/
curl https://proteinpaint.stjude.org/ppSupport/clinvar.hg38.bcf.gz -O
curl https://proteinpaint.stjude.org/ppSupport/clinvar.hg38.bcf.gz.csi -O


cd ../utils/meme/motif_databases/HUMAN/
curl https://proteinpaint.stjude.org/ppSupport/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme -O
curl https://proteinpaint.stjude.org/ppSupport/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv -O

cd $TP_FOLDER
curl https://proteinpaint.stjude.org/ppSupport/ppdemo_bam.tar.gz -O # This tarball only contains the BAM slices which are shown in http://proteinpaint.stjude.org/bam 
#curl https://proteinpaint.stjude.org/ppSupport/pp.demo.tgz -O
tar zxvf ppdemo_bam.tar.gz # Releases the "proteinpaint_demo/" folder under $TP_FOLDER
