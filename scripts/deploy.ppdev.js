/*
do follow to deploy to proteinpaint-dev

$ npm run ppdev

this currently only works on xin's computer, but later show work on pp-irp with modifications

the middle part with parsing serverconfig is crucial

*/

const exec = require('child_process').execSync
const path = require('path')


exec(`
cp server.js deploys/ppdev/proteinpaint/
cp utils/* deploys/ppdev/proteinpaint/utils/
cp public/index.html deploys/ppdev/proteinpaint/public/
cp genome/* deploys/ppdev/proteinpaint/genome/
cp dataset/* deploys/ppdev/proteinpaint/dataset/
cp src/common.js src/vcf.js src/bulk* src/tree.js deploys/ppdev/proteinpaint/src/
cp public/bin/* deploys/ppdev/proteinpaint/public/bin/
`)


// get host
const config = require('../serverconfig.json')
const host = config.host || 'http://localhost:3000/bin/'
exec("sed 's%"+host+"%http://proteinpaint-dev:3001/bin/%' < public/bin/proteinpaint.js > deploys/ppdev/proteinpaint/public/bin/proteinpaint.js")




exec(`
cd deploys/ppdev
tar zcvf sourcecode.tgz proteinpaint/
scp sourcecode.tgz xzhou1@hpc:/research/rgs01/resgen/legacy/gb_customTracks/pp/
ssh -t xzhou1@hpc "
	cd /research/rgs01/resgen/legacy/gb_customTracks/pp/
	tar zxvf sourcecode.tgz
	mv proteinpaint/server.js .
	mv proteinpaint/dataset/*js dataset/
	mv proteinpaint/genome/*js genome/
	mv proteinpaint/public/index.html public/
	mv proteinpaint/public/bin/* public/bin/
	mv proteinpaint/src/* src/
	rm -rf proteinpaint/ sourcecode.tgz
"
ssh -t xzhou1@proteinpaint-dev "
	cd pp
	./node_modules/forever/bin/forever stop server.js; ./node_modules/forever/bin/forever -o ~/forever.out -e ~/forever.err start server.js --max-old-space-size=8192
"
`)
