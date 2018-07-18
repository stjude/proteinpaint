../../node_modules/.bin/webpack --entry=./source.js --output-filename=bin.js --target=node
scp bin.js xzhou1@hpc:~/tp/utils/countbamallele.phased.js
