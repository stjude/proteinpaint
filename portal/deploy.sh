#!/bin/bash

REMOTEHOST=pp-prt
TGZ=$1
VERSION=$2
TGZDIR=/opt/data/pp/packages
REMOTEDIR=/opt/app/pp

echo "packing the portal package ..."
npm pack
echo "deploying $TGZ to $REMOTEHOST ..."
# the default user for the canonical domain is set in your ~/.ssh/config
scp $TGZ $REMOTEHOST:$REMOTEDIR

ssh -t $REMOTEHOST "
	tar --warning=no-unknown-keyword -xzf $TGZDIR/$TGZ -C $REMOTEDIR/available/

	cd $REMOTEDIR
	mv -f available/package available/$TGZ
	cp -r active/node_modules available/$TGZ
	cp active/serverconfig.json available/$TGZ/
	cp -Rn active/public/ available/$TGZ/
	cp -Rn active/dataset/ available/$TGZ/

	chmod -R 755 available/$TGZ
	
	cd available/$TGZ
	# copy previous builds to allow reuse if validated by sccache and cargo
	[[ -d $PPRUSTACTIVEDIR ]] && mkdir -p $PPRUSTMODDIR && cp -rf $PPRUSTACTIVEDIR ./$PPRUSTMODDIR/
	npm install @stjude/proteinpaint-rust

	cd $REMOTEDIR
	ln -sfn /opt/app/pecan/portal/www/sjcharts/public available/$TGZ/public/sjcharts
	ln -sfn ./bin available/$TGZ/public/no-babel-polyfill
	ln -sfn available/$TGZ active
	
	./helpers/record.sh deployed
	./proteinpaint_run_node.sh
	./helpers/purge.sh \"pp-*\" 

	cd $REMOTEDIR
	mkdir tmpbuild
	tar --warning=no-unknown-keyword -xzf $TGZ -C tmpbuild/
	cd tmpbuild/package
	# compile the rust source in the host environment
	npm run build
	cd ../..
	rm ~/$TGZ
	tar -czf $TGZ tmpbuild/package
	rn -rf tmpbuild
"
