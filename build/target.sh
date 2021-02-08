#!/bin/bash

set -e

if (($# != 1)); then
	echo "Usage: $ ./target.sh [ dev | test | prod ]
	"
	exit 1
fi

TARGET=$1
# get the current tag
TAG=$(node -p "require('./package.json').version")
# we will look for the tarball of the current package version
PKGVER=stjude-proteinpaint-$TAG.tgz


echo "building the docker image target='$TARGET' ...."

if [[ "$TARGET" == "dev" ]]; then
	rm -rf tmppack
	mkdir tmppack
	npm pack
	tar -xzf $PKGVER -C tmppack/
	cd tmppack
	cp ../serverconfig.json package/
	cp -r ../dataset package
	cp -r ../genome package
	if [[ -d ../.ssl ]]; then
		cp -r ../.ssl package
	fi
	cd package
	docker build --file ../../build/Dockerfile --target $TARGET --tag ppdeps:$TARGET .
	cd ../..
	TPDIR=$(node -p "require('./serverconfig.json').tpmasterdir")
	./build/dockrun.sh $TPDIR 3456 ppdeps:dev
	node ./build/syncpack.js

elif [[ "$TARGET" == "test" ]]; then
	echo "TODO: write a test target in Dockerfile"
	exit 1

elif [[ "$TARGET" == "prod" || "$TARGET" == "prod-bare" ]]; then
	if [[ ! -d tmppack || ! -f tmppack/$PKGVER ]]; then
		# create the tarball as needed
		. ./build/publish.sh tgz
	else 
		echo "Reusing a previously built and matching package"
	fi

	cd ./tmppack
	rm -rf package
	tar -xzf $PKGVER
	
	if [[ "$TARGET" != "prod-bare" ]]; then
		cp ../serverconfig.json package/
	fi 

	cd package
	docker build --file ../../build/Dockerfile --target $TARGET --tag ppdeps:$TARGET .
	cd ../..

else 
	echo "Unknown target='$TARGET'"

fi

