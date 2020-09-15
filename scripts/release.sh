#!/bin/bash

set -e

# ....
# 
# 

if (($# == 0 || $# > 2)); then
	echo "Usage:

	./scripts/release.sh [ UPDATETYPE ] [ CUSTOMER ]

	- UPDATETYPE [ patch | minor ]
		'patch' for bug fixes
		'minor' feature updates 
		'major' is not allowed, since that update type should not be customer specific

	- CUSTOMER 
		optional name of the customer that will receive the package
		defaults to 'all'
	"
	exit 1

elif (($# == 1)); then
	UPDATETYPE=$1
	CUSTOMER=all

elif (($# == 2)); then
	UPDATETYPE=$1
	CUSTOMER=$2
fi

if [[ "$CUSTOMER" != "all" && "$CUSTOMER" != "gdc"  ]]; then
	echo "Unsupported customer '$CUSTOMER'"
	exit 1
fi

if [[ "$UPDATETYPE" != "patch" && "$UPDATETYPE" != "minor" ]]; then
	echo "Invalid update type='$UPDATETYPE'"
	exit 1
fi

./scripts/tag-version.sh $UPDATETYPE

# get the current tag
TAG=$(node -p "require('./package.json').version")
PKGVER="stjude-proteinpaint-$TAG.tgz"

if [[ ! -d tmppack || ! -f tmppack/$PKGVER ]]; then
	. ./scripts/publish.sh tgz
fi

cd ./tmppack
rm -rf package
tar -xzf $PKGVER
rm $PKGVER

if [[ "$CUSTOMER" == "gdc" || "$CUSTOMER" == "all" ]]; then
	echo "Filtering the dataset js files for gdc ..."
	# will selectively filter later, 
	# rm package/dataset/..???.js
	tar -czf $PKGVER package
	echo "transferring the package ..."
	scp $PKGVER genomeuser@pp-prt:/opt/app/pecan/portal/www/static/Pk983gP.Rl2410y45/
	# switch destination to jump-prp1 server later
fi

rm -rf package
