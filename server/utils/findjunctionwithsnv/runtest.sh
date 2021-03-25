bgzip -c test/rawjunc > test/junc.gz
tabix -f -p bed test/junc.gz

bgzip -c test/rawvcf > test/vcf.gz
tabix -f -p vcf test/vcf.gz

../../node_modules/.bin/webpack --entry=./source.js --output-filename=bin.js --target=node

node ~/node/es6/utils/findjunctionwithsnv/bin.js --max-old-space-size=2048 --genome=/home/xzhou/data/hg19/hg19.fa.gz --gene=/home/xzhou/data/tp/anno/gencode.v24.hg19.gz --junction=test/junc.gz --dnavcf=test/vcf.gz,WGS --dnavcf=/home/xzhou/data/tp/hg19/PCGP/DNA/vcf/SJHGG027_D.wgs.vcf.gz,WES
