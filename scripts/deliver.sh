#!/bin/bash

set -e

# ....
# 
# 

if (($# == 0)); then
	echo "Usage:

	./scripts/deliver.sh [ CUSTOMER ]
	"
	exit 1
else
	CUSTOMER=$1
fi

. ./scripts/publish.sh tgz
# inherit the $TAG value from the publish script
PKGVER="stjude-proteinpaint-$TAG.tgz"

cd ./tmppack
rm -rf package
tar -xzf $PKGVER
rm $PKGVER

if [[ "$CUSTOMER" == "gdc" ]]; then
	echo "Filtering the dataset js files ..."
	# will selectively filter later, remove all for now
	rm package/dataset/*.js
	tar -czf $PKGVER package
	echo "transferring the package ..."
	scp $PKGVER genomeuser@pp-prt:/opt/app/pecan/portal/www/static/Pk983gP.Rl2410y45/
	# switch destination to jump-prp1 server later

else 
	echo "Unrecognized customer='$CUSTOMER'"
	exit 1

fi

cd ..
# rm -r tmppack
