../../node_modules/.bin/webpack --entry=./source.js --output-filename=bin.js --target=node

node bin.js --genome=hg19 --excludeclass=Intron,exon output.html /home/xzhou/y2
