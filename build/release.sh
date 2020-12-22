#!/bin/bash

set -e

# get the current tag
TAG=$(node -p "require('./package.json').version")
# we will look for the tarball of the current package version
PKGVER="stjude-proteinpaint-$TAG.tgz"

if [[ ! -d tmppack || ! -f tmppack/$PKGVER ]]; then
	# create the tarball as needed
	. ./build/publish.sh tgz
else 
	echo "Reusing a previously built and matching package"
fi

cd ./tmppack
rm -rf package
tar -xzf $PKGVER

STATICDIR=Pk983gP.Rl2410y45

# also distribute a tarball in our pecan server
echo "Distributing the tarball ..."
scp $PKGVER prp1:/opt/data/pecan/$STATICDIR/

# create gdc dataset
rm -rf gds
mkdir gds
mkdir gds/genome
mkdir gds/dataset
cp ../../dataset/gdc.hg38.js gds/dataset/
# the additional portal files are dev copies for demonstration only,
# they are neither committed nor included in the package.json:files
mkdir gds/public
cp -r ../wrappers/portal/public gds/public
mv gds/public/public gds/public/portal
tar -czf gds.tgz gds 


# 
# requires these tunnel settings in ~/.ssh/config:
# 
# Host prp1
# User          genomeuser
# HostName      pp-prp1.stjude.org
# ProxyCommand  ssh gnomeuser@svldtemp01.stjude.org nc %h %p 2> /dev/null
#
scp gds.tgz prp1:/opt/data/pecan/$STATICDIR/sB4R7FC4Su  # gdc's CUSTOMERKEY

# standard release
# publish at the end of this script in order not 
# to get a re-publish error in case any 
# preceding step has an error that exits
cd package
npm publish # publish to registry
cd ..
