#!/bin/bash

set -e

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

# standard release
cd package
npm publish # publish to registry
cd ..

STATICDIR=Pk983gP.Rl2410y45

# also distribute a tarball in our pecan server
echo "Distributing the tarball ..."
scp $PKGVER prp1:/opt/data/pecan/$STATICDIR/

# create gdc dataset
rm -rf gds
mkdir gds
mkdir gds/genome
mkdir gds/dataset
cp dataset/gdc.hg38.2.js gds/dataset/
tar -czf gds.tgz gds 
scp gds.tgz prp1:/opt/data/pecan/$STATICDIR/sB4R7FC4Su  # gdc's CUSTOMERKEY
