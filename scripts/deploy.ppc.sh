#npm run ppdev

cp server.js ../proteinpaint/
cp public/index.html ../proteinpaint/public/
cp genome/* ../proteinpaint/genome/
cp dataset/* ../proteinpaint/dataset/
cp src/common.js src/vcf.js src/bulk* src/tree.js ../proteinpaint/src/
cp public/bin/* ../proteinpaint/public/bin/
cp public/dev.html ../proteinpaint/public/

sed 's%http://localhost:3000/bin/%https://ppc.stjude.org/bin/%' < public/bin/proteinpaint.js > ../proteinpaint/public/bin/proteinpaint.js

cd ..
tar zcvf sourcecode.tgz proteinpaint/
scp sourcecode.tgz xzhou1@ppc.stjude.org:/opt/app/pp


ssh -t xzhou1@ppc.stjude.org "
	cd /opt/app/pp
	tar zxvf sourcecode.tgz
	mv proteinpaint/server.js .
	mv proteinpaint/dataset/*js dataset/
	mv proteinpaint/genome/*js genome/
	mv proteinpaint/public/index.html public/
	mv proteinpaint/public/bin/* public/bin/
	mv proteinpaint/src/* src/
	rm -rf proteinpaint/ sourcecode.tgz
	./node_modules/forever/bin/forever stop server.js;./node_modules/forever/bin/forever -o forever.out -e forever.err start server.js --max-old-space-size=81920
"
