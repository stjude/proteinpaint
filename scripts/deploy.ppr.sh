# ./scripts/deploy.ppr.sh [$DEVHOST]

if (($# == 0)); then
	DEVHOST="http://localhost:3000"
else
	DEVHOST=$1
fi	

rm -rf tmpbuild
mkdir tmpbuild
mkdir tmpbuild/public
mkdir tmpbuild/public/bin
mkdir tmpbuild/genome
mkdir tmpbuild/dataset
mkdir tmpbuild/src

cp server.js tmpbuild/
cp genome/* tmpbuild/genome/
cp dataset/* tmpbuild/dataset/
cp src/common.js src/vcf.js src/bulk* src/tree.js tmpbuild/src/
cp public/bin/* tmpbuild/public/bin/
cp public/dev.html tmpbuild/public/

sed "s%$DEVHOST/bin/%https://ppr.stjude.org/bin/%" < public/bin/proteinpaint.js > tmpbuild/public/bin/proteinpaint.js

tar zcvf sourcecode.tgz tmpbuild/

scp sourcecode.tgz genomeuser@ppr.stjude.org:/opt/app/pp

ssh -tt genomeuser@ppr.stjude.org "
	cd /opt/app/pp
	tar zxvf sourcecode.tgz
	
	mv tmpbuild/server.js es6_proteinpaint/
	mv tmpbuild/dataset/*js es6_proteinpaint/dataset/
	mv tmpbuild/genome/*js es6_proteinpaint/genome/
	mv tmpbuild/public/index.html es6_proteinpaint/public/
	mv tmpbuild/public/bin/* es6_proteinpaint/public/bin/
	mv tmpbuild/src/* es6_proteinpaint/src/
	
	rm -rf tmpbuild/ sourcecode.tgz
	
	cd es6_proteinpaint
	../proteinpaint_run_node.sh
"
rm -rf tmpbuild
rm sourcecode.tgz
