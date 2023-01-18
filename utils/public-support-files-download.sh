mkdir -p ~/data/tp/
cd ~/data/tp
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
curl https://proteinpaint.stjude.org/ppSupport/gencode.v41.hg38.gz -O
curl https://proteinpaint.stjude.org/ppSupport/gencode.v41.hg38.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/genes.hg19.db -O
curl https://proteinpaint.stjude.org/ppSupport/genes.hg38.db -O

curl https://pecan.stjude.cloud/static/hg38/dbsnp-slice/dbsnp.hg38.bb -O
curl https://pecan.stjude.cloud/static/hg19/dbsnp-slice/dbsnp.hg19.bb -O

curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg19.gz -O
curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg19.gz.tbi -O
curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz -O
curl https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz.tbi -O

curl https://proteinpaint.stjude.org/ppSupport/hicfiles.tgz -O
tar zxvf hicfiles.tgz
# releases the “hicFragment/” and “hicTAD/” folders under anno/

cd db/
curl https://proteinpaint.stjude.org/ppSupport/db/proteindomain.db -O

cd ../msigdb/
curl https://proteinpaint.stjude.org/ppSupport/msigdb/db -O

cd ../../hg19/
curl https://pecan.stjude.cloud/static/hg19/clinvar.hg19.vcf.gz -O
curl https://pecan.stjude.cloud/static/hg19/clinvar.hg19.vcf.gz.tbi -O

curl https://pecan.stjude.cloud/static/hg19/clinvar.hg19.hgvs_short.vep.bcf.gz -O
curl https://pecan.stjude.cloud/static/hg19/clinvar.hg19.hgvs_short.vep.bcf.gz.csi -O


cd ../hg38/
curl https://pecan.stjude.cloud/static/hg38/clinvar.hg38.vcf.gz -O
curl https://pecan.stjude.cloud/static/hg38/clinvar.hg38.vcf.gz.tbi -O

curl https://pecan.stjude.cloud/static/hg19/clinvar.hg38.hgvs_short.vep.bcf.gz -O
curl https://pecan.stjude.cloud/static/hg19/clinvar.hg38.hgvs_short.vep.bcf.gz.csi -O


cd ../utils/meme/motif_databases/HUMAN/
curl https://pecan.stjude.cloud/static/hg19/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme -O
curl https://pecan.stjude.cloud/static/hg19/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv -O

cd ~/data/tp/
curl https://pecan.stjude.cloud/static/pp-support/pp.demo.tgz -O
tar zxvf pp.demo.tgz
# releases the “proteinpaint_demo/” folder under data/tp/

# if needed, download this 5.3G HiC file
# mkdir ~/data/tp/proteinpaint_demo/hg19/hic/
# cd ~/data/tp/proteinpaint_demo/hg19/hic/
# curl https://proteinpaint.stjude.org/ppdemo/hg19/hic/hic_demo.hic -O
