../../node_modules/.bin/webpack --entry=./source.js --output-filename=bin.js --target=node

node bin.js --genome=hg19 --vcf=/home/xzhou/y2.gz --excludeclass=Intron --excludeclass=snv
