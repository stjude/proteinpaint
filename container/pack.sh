#!/bin/bash

set -euxo pipefail

# this script:
# - will pack workspaces 
# - replace each workspace package.json's dependency versions
#   with the tarball location as copied into the Docker build
#
# call from the proteinpaint/container dir

# defaults
PKGPATH=/home/root/pp/tmppack
TMPDIR=/home/root/pp/tmppack/

if (( $# == 1 )); then
	PKGPATH="$1"
fi

if (( $# == 2 )); then
	PKGPATH="$1"
	TMPDIR="$2"
fi

rm -rf tmppack
mkdir tmppack

FRONTTDEPNAME="@sjcrh/proteinpaint-front"
SERVERTDEPNAME="@sjcrh/proteinpaint-server"

# no -w argument to bump.js, just get the changed workspace since the last publish
cd ..
CHANGEDWS=$(./build/bump.js prerelease)
cd container

if [[ "$CHANGEDWS" == *"client"* ]]; then
	cd ../client
	echo "packing client ..."
	npm pack
	CLIENTPKGVER=$(node -p "require('./package.json').version")
	CLIENTTGZ=sjcrh-proteinpaint-client-$CLIENTPKGVER.tgz
	mv $CLIENTTGZ ../container/tmppack/
	cd ../front
	CLIENTDEPNAME="@sjcrh/proteinpaint-client"
	# may reset the dep new version temporarily, for package testing 
	npm pkg set "devDependencies.$CLIENTDEPNAME"=$PKGPATH/$CLIENTTGZ
	cd ../container
fi

if [[ "$CHANGEDWS" == *"client"* || "$CHANGEDWS" == *"front"* ]]; then
	cd ../front
	echo "packing front ..."
	npm pack
	FRONTPKGVER=$(node -p "require('./package.json').version")
	FRONTTGZ=sjcrh-proteinpaint-front-$FRONTPKGVER.tgz
	mv $FRONTTGZ ../container/tmppack/
	git restore package.json

	cd ../container/full
	echo "update the dependency in container/full/package.json to point to the front tarball inside of tmppack dir ..."
	npm pkg set "dependencies.$FRONTTDEPNAME"=$PKGPATH/$FRONTTGZ
	cd ..
fi

if [[ "$CHANGEDWS" == *"rust"* ]]; then
	cd ../rust
	echo "packing rust ..."
	npm pack
	RUSTPKGVER=$(node -p "require('./package.json').version")
	RUSTTGZ=sjcrh-proteinpaint-rust-$RUSTPKGVER.tgz
	mv $RUSTTGZ ../container/tmppack/

	cd ../server
	RUSTDEPNAME="@sjcrh/proteinpaint-rust"
	# may reset the dep new version temporarily, for package testing 
	npm pkg set "dependencies.$RUSTDEPNAME"=$PKGPATH/$RUSTTGZ
	cd ../container
fi

if [[ "$CHANGEDWS" == *"rust"* || "$CHANGEDWS" == *"server"* ]]; then
	cd ../server
	echo "packing server ..."
	npm pack
	SERVERTPKGVER=$(node -p "require('./package.json').version")
	SERVERTGZ=sjcrh-proteinpaint-server-$SERVERTPKGVER.tgz
	mv $SERVERTGZ ../container/tmppack/
	git restore package.json

	cd ../container/full
	echo "update the dependency in container/full/package.json to point to the server tarball inside of tmppack dir ..."
	FRONTTDEPNAME="@sjcrh/proteinpaint-front"
	npm pkg set "dependencies.$FRONTTDEPNAME"=$PKGPATH/$SERVERTGZ

	cd ../server
	echo "update dependencies in container/server/package.json to point to server tarball inside of tmppack dir ..."
	npm pkg set "dependencies.$SERVERTDEPNAME"=$PKGPATH/$SERVERTGZ

	cd ..
fi
