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
		optional name of the customer that will receive a filtered package
		defaults to 'all'
		the default package will still be published in the registry
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
# we will look for the tarball of the current package version
PKGVER="stjude-proteinpaint-$TAG.tgz"

if [[ ! -d tmppack || ! -f tmppack/$PKGVER ]]; then
	# create the tarball as needed
	. ./scripts/publish.sh tgz
fi

cd ./tmppack
rm -rf package
tar -xzf $PKGVER
rm $PKGVER

# standard release
cd package
npm publish # publish to registry
cd ..
# also distribute a tarball in our pecan server
cp -r package package-std
tar -czf $PKGVER package-std
echo "Distributing the tarball ..."
scp $PKGVER genomeuser@pp-prt:/opt/app/pecan/portal/www/static/Pk983gP.Rl2410y45/

if [[ "$CUSTOMER" == "gdc" || "$CUSTOMER" == "all" ]]; then
	echo "Creating a tarball for gdc ..."
	KEY="random-str"
<<<EOF
	ssh -t genomeuser@pp-prt "
		cd /opt/app/pecan/portal/www/static/Pk983gP.Rl2410y45/
		tar -xzf $PKGVER
		echo 'Filtering the dataset js files for gdc ...'
		# rm package/dataset/*...
		tar -czf $PKGVER-$KEY package
		mkdir $KEY
		mv $PKGVER-$KEY $KEY/$PKGVER
	"
EOF
fi

rm -rf package
