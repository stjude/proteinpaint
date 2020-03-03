# ict: internal clingen test
# https://pp-ict.stjude.org/
# https://clingen-test.stjude.org/
# it uses the same folder at ./deploys/ppc/ and overwrites files there

cp server.js deploys/ppc/
cp public/index.html deploys/ppc/
cp src/common.js src/vcf.js src/bulk* src/tree.js src/mds.termdb.termvaluesetting.js deploys/ppc/src/
cp utils/*.R deploys/ppc/utils/
cp genome/*  deploys/ppc/genome/
cp dataset/* deploys/ppc/dataset/
cp public/bin/* deploys/ppc/public/bin/
cp package.json deploys/ppc/


# port 3001 is hardcoded for xin's computer
sed 's%http://localhost:3001/bin/%https://pp-ict.stjude.org/bin/%' < public/bin/proteinpaint.js > deploys/ppc/public/bin/proteinpaint.js

cd deploys/
tar zcvf sourcecode.tgz ppc/
scp sourcecode.tgz genomeuser@pp-ict.stjude.org:/opt/app/pp


ssh -t genomeuser@pp-ict.stjude.org "
	cd /opt/app/pp
	tar zxvf sourcecode.tgz
	mv ppc/server.js .
	mv ppc/dataset/*js dataset/
	mv ppc/genome/*js genome/
	mv ppc/utils/*js utils/
	mv ppc/public/index.html public/
	mv ppc/public/bin/* public/bin/
	mv ppc/src/* src/
	rm -rf ppc/ sourcecode.tgz
	sh proteinpaint_run_node.sh
	#./node_modules/forever/bin/forever stop server.js;./node_modules/forever/bin/forever -o forever.out -e forever.err start server.js --max-old-space-size=81920
"
