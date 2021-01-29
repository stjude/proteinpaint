../../node_modules/.bin/webpack --entry=./source.js --output-filename=bin.js --target=node --mode=development
node dist/bin.js ~/data/tp/files/hg38/sjlife/vcf/vcf.gz ~/data/tp/files/hg38/sjlife/tmp/snps 10
