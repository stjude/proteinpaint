# ./scripts/deploy.scmc.sh [$DEVHOST]
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
cp public/index.html tmpbuild/public/
cp genome/* tmpbuild/genome/
cp dataset/* tmpbuild/dataset/
cp src/common.js src/vcf.js src/bulk* src/tree.js tmpbuild/src/
cp public/bin/* tmpbuild/public/bin/
cp public/dev.html tmpbuild/public/

sed "s%$DEVHOST/bin/%http://124.74.133.38:8088/bin/%" < public/bin/proteinpaint.js > tmpbuild/public/bin/proteinpaint.js

tar zcvf sourcecode.tgz tmpbuild/

scp sourcecode.tgz -p 3322 user@124.74.133.38:
