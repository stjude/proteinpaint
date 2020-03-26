../../node_modules/.bin/webpack source.js -o bin.js --target=node
scp bin.js xzhou1@hpc:~/tp/utils/countbamallele.phased.js
../../node_modules/.bin/webpack simple.js -o bin2.js --target=node
scp bin2.js xzhou1@hpc:~/tp/utils/countbamallele.simple.js
