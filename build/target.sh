#!/bin/bash

set -e

if (($# != 1)); then
	echo "Usage: $ ./target.sh [ dev | test | prod ]
	"
	exit 1
fi

TARGET=$1

echo "building the docker image target='$TARGET' ...."

if [[ "$TARGET" == "dev" ]]; then
	docker build --file ./build/Dockerfile --target $TARGET --tag ppdeps:$TARGET .
	if [[ -d node_modules ]]; then
		mv node_modules node_modules-0
	fi

elif [[ "$TARGET" == "test" ]]; then
	echo "TODO: write a test target in Dockerfile"
	exit 1

elif [[ "$TARGET" == "prod" ]]; then
	if [[ -d node_modules-0 ]]; then
		mv node_modules-0 node_modules
	fi

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
	cp ../serverconfig.json ../build/set-container-config.js package/
	cd package
	docker build --file ../../build/Dockerfile --target $TARGET --tag ppdeps:$TARGET .
	cd ../..

else 
	echo "Unknown target='$TARGET'"

fi

