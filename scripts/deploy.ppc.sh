#npm run ppdev

cp server.js deploys/ppc/
cp public/index.html deploys/ppc/
cp src/common.js src/vcf.js src/bulk* src/tree.js src/mds.termdb.termvaluesetting.js deploys/ppc/src/
cp genome/* deploys/ppc/genome/
cp dataset/* deploys/ppc/dataset/
cp public/bin/* deploys/ppc/public/bin/
cp package.json deploys/ppc/


# port 3001 is hardcoded for xin's computer
sed 's%http://localhost:3001/bin/%https://ppc.stjude.org/bin/%' < public/bin/proteinpaint.js > deploys/ppc/public/bin/proteinpaint.js

cd deploys/
tar zcvf sourcecode.tgz ppc/
scp sourcecode.tgz genomeuser@ppc.stjude.org:/opt/app/pp


#ssh -t genomeuser@ppc.stjude.org "
#	cd /opt/app/pp
#	tar zxvf sourcecode.tgz
#	mv proteinpaint/server.js .
#	mv proteinpaint/dataset/*js dataset/
#	mv proteinpaint/genome/*js genome/
#	mv proteinpaint/public/index.html public/
#	mv proteinpaint/public/bin/* public/bin/
#	mv proteinpaint/src/* src/
#	rm -rf proteinpaint/ sourcecode.tgz
#	./node_modules/forever/bin/forever stop server.js;./node_modules/forever/bin/forever -o forever.out -e forever.err start server.js --max-old-space-size=81920
#"
