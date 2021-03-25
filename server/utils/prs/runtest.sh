#!/bin/bash
# 
# Usage: ./utils/prs/runtest.sh 
# run from proteinpaint project root in order for webpack to 
# properly exclude the node_modules in "externals" array
# 
npx webpack --config=./utils/prs/webpack.config.prs.js
node ./utils/prs/bin.js ~/gb/tp/files/hg38/sjlife/vcf/vcf.gz ~/gb/tp/files/hg38/sjlife/tmp/snps 10
