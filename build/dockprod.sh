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
cd ..
docker build --file ./build/Dockerfile --tag ppdeps:latest .
