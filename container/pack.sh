#!/bin/bash

# this script:
# - will pack workspaces 
# - replace each workspace package.json's dependency versions
#   with the tarball location as copied into the Docker build

# from the proteinpaint/container dir

WORKSPACES="rust server client front"
if [[ "$1" != "" ]]; then
	WORKSPACES="$1"
fi

TMPDIR=/home/root/pp/tmppack/
if [[ "$2" != "" ]]; then
	TMPDIR="$2"
fi

rm -rf tmppack
mkdir tmppack

HASH=$(git rev-parse --short HEAD)

if [[ "$WORKSPACES" == *"client"* ]]; then
	cd ../client
	echo "packing client ..."
	npm pack
	CLIENTPKGVER=$(node -p "require('./package.json').version")
	CLIENTTGZ=sjcrh-proteinpaint-client-$CLIENTPKGVER.tgz
	mv $CLIENTTGZ ../container/tmppack/
	cd ../front
	CLIENTDEPNAME="@sjcrh/proteinpaint-client"
	# may reset the dep new version temporarily, for package testing 
	npm pkg set "devDependencies.$CLIENTDEPNAME"=$TMPDIR/$CLIENTTGZ
fi

if [[ "$WORKSPACES" == *"client"* || "$WORKSPACES" == *"front"* ]]; then
	cd ../front
	echo "packing front ..."
	npm pack
	FRONTTGZ=sjcrh-proteinpaint-front-*.tgz
	mv $FRONTTGZ ../container/tmppack/
	git restore package.json
fi

if [[ "$WORKSPACES" == *"rust"* ]]; then
	cd ../rust
	echo "packing rust ..."
	npm pack
	RUSTPKGVER=$(node -p "require('./package.json').version")
	RUSTTGZ=sjcrh-proteinpaint-rust-$RUSTPKGVER.tgz
	mv $RUSTTGZ ../container/tmppack/
	cd ../server
	RUSTDEPNAME="@sjcrh/proteinpaint-rust"
	npm pkg set "dependencies.$RUSTDEPNAME"=$TMPDIR/$RUSTTGZ
fi

if [[ "$WORKSPACES" == *"augen"* ]]; then
	cd ../augen
	echo "packing augen ..."
	npm pack
	AUGENPKGVER=$(node -p "require('./package.json').version")
	AUGENTGZ=sjcrh-augen-$AUGENPKGVER.tgz
	mv $AUGENTGZ ../container/tmppack/
	cd ../server
	AUGENDEPNAME="@sjcrh/augen"
	npm pkg set "dependencies.$AUGENDEPNAME"=$TMPDIR/$AUGENTGZ
fi

if [[ "$WORKSPACES" == *"rust"*  || "$WORKSPACES" == *"augen"* || "$WORKSPACES" == *"server"* ]]; then
	cd ../server
	echo "packing server ..."
	npm pack
	SERVERTGZ=sjcrh-proteinpaint-server-*.tgz
	mv $SERVERTGZ ../container/tmppack/
	git restore package.json
fi
