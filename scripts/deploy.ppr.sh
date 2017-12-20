# ./scripts/deploy.ppr.sh [$DEVHOST]

if (($# == 0)); then
	DEVHOST="http://localhost:3000"
else
	DEVHOST=$1
fi	

rm -rf tmpbuild
mkdir tmpbuild
mkdir tmpbuild/public 
mkdir tmpbuild/genome
mkdir tmpbuild/dataset
mkdir tmpbuild/public/bin

cp server.js tmpbuild/
cp public/index.html tmpbuild/public/
cp genome/* tmpbuild/genome/
cp dataset/* tmpbuild/dataset/
cp src/common.js src/vcf.js src/bulk* src/tree.js tmpbuild/src/
cp public/bin/* tmpbuild/public/bin/
cp public/dev.html tmpbuild/public/

sed "s%$DEVHOST/bin/%https://ppr.stjude.org/bin/%" < public/bin/proteinpaint.js > tmpbuild/public/bin/proteinpaint.js

tar zcvf sourcecode.tgz tmpbuild/

scp sourcecode.tgz genomeuser@ppr.stjude.org:/opt/app/pp

ssh -t genomeuser@ppr.stjude.org "
	cd /opt/app/pp/es6_proteinpaint
	tar zxvf sourcecode.tgz
	mv tmpbuild/server.js .
	mv tmpbuild/dataset/*js dataset/
	mv tmpbuild/genome/*js genome/
	mv tmpbuild/public/index.html public/
	mv tmpbuild/public/bin/* public/bin/
	mv tmpbuild/src/* src/
	rm -rf tmpbuild/ sourcecode.tgz
	../proteinpaint_run_node.sh
"

rm -rf tmpbuild
rm sourcecode.tgz
