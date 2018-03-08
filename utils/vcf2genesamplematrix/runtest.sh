#../../node_modules/.bin/webpack --entry=./source.js --output-filename=bin.js --target=node
#node bin.js --genome=hg19 --excludeclass=intron,e output.html /home/xzhou/y2


../../node_modules/.bin/webpack --entry=./source.smat.js --output-filename=bin.smat.js --target=node
node bin.smat.js --genome=hg19 --excludeclass=intron,e /home/xzhou/y2.vcf.gz /home/xzhou/y2.vcf.gz.tbi
