#!/bin/bash

set -euxo pipefail

MODE=""
if (( $# == 0 )); then
	echo "Missing subdir argument"
	echo "Usage: call from within the container dir
	
	./version.sh [subdir=deps|server|full] [-w]
  
  subdir  required, any of the container subdirectory that has a dockerfile
  -w       option to commit changes
	"
	exit 1
fi

SUBDIR=$1
MODE=""
if (( $# == 2 )); then
	MODE="$2"
fi

cd ..
# container image builds will use published packages, so exclude the corresponding workspaces here
# TODO: delete the following lines since it doesn't seem like the $UPDATED variable 
#       is used/captured by this script's consumer, anywhere???
UPDATED=$(./build/bump.cjs $MODE -x=shared/types -x=shared/utils -x=rust -x=augen -x=server -x=client -x=front)
echo "UPDATED=[$UPDATED]"
cd container/$SUBDIR

DEPS="dependencies.@sjcrh/proteinpaint-"
if [[ "$(grep containerDeps ./package.json)" != "" ]]; then
	DEPS=containerDeps.
fi

ROOTPKGVER=$(node -p "require('../../package.json').version")
echo "setting $SUBDIR package.version='$ROOTPKGVER'"
npm pkg set version=$ROOTPKGVER

SERVERPKGVER=$(node -p "require('../../server/package.json').version")
echo "setting $SUBDIR package.${DEPS}server='$SERVERPKGVER'"
npm pkg set "${DEPS}server"=$SERVERPKGVER

if [[ "$SUBDIR" == "full" ]]; then
	FRONTPKGVER=$(node -p "require('../../front/package.json').version")
	echo "setting $SUBDIR package.${DEPS}full='$SERVERPKGVER'"
	npm pkg set "${DEPS}front"=$FRONTPKGVER
fi

cd ..
