#!/bin/bash

# !!! TODO !!!
# use as prepublish script in this workspace' package.json to trigger this,
# once an npm-compatible registry is available instead of tarball URLs

# the canonical host domain is set in your ~/.ssh/config
REMOTEHOST=$1
TGZ=$2
REMOTEDIR=/opt/data/pp/packages

echo "packing the rust package ..."
npm pack
echo "deploying $TGZ to $REMOTEHOST ..."
# the default user for the canonical domain is set in your ~/.ssh/config
scp $TGZ $REMOTEHOST:$REMOTEDIR

ssh -t $REMOTEHOST "
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
