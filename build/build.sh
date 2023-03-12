#!/bin/bash

set -euxo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build/build.sh [-r] [-b] [-c]

	-r REV: git revision to checkout, if empty will use the current code state
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that are used prior to npm install
"
REV=latest
BUILDARGS=""
CROSSENV=""
while getopts "r:b:c:h:x:" opt; do
	case "${opt}" in
	r)
		REV=${OPTARG}
		;;
	b)
		BUILDARGS=${OPTARG}
		;;
	c)
		CROSSENV=${OPTARG}
		;;
	h)
		echo "$USAGE"
		exit 1
		;;
  *)
  	echo "Unrecognized parameter. Use -h to display usage."
  	exit 1
  	;;
	esac
done

#########################
# EXTRACT REQUIRED FILES
#########################

./build/extract.sh -r "$REV"
REV=$(cat tmppack/rev.txt)
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then ARCH="aarch64"; fi

#########################
# Docker build
#########################

cd tmppack/build/full
# !!! FOR TESTING ONLY --- REMOVE .npmrc BEFORE PUSHING !!!
# !!! once PP is open-sourced, the .npmrc should only have the registry URL for the @stjude namespace !!!
cp ~/.npmrc .
cd ../server
cp ~/.npmrc .
cd ../..

# get the current tag
TAG="$(node -p "require('./package.json').version")"
SERVERPKGVER="$(node -p "require('./server/package.json').version")"
FRONTPKGVER="$(node -p "require('./front/package.json').version")"

echo "building ppbase:$REV image, package version=$TAG"
docker build . --file ./build/Dockerfile --target ppbase --tag ppbase:$REV --build-arg ARCH="$ARCH" $BUILDARGS

echo "building pprust:$REV image, package version=$TAG"
docker build . --file ./build/Dockerfile --target pprust --tag pprust:$REV --build-arg ARCH="$ARCH" $BUILDARGS

echo "building ppserver:$REV image, package version=$TAG"
docker build . --file ./build/Dockerfile --target ppserver --tag ppserver:$REV --build-arg IMGVER=$REV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS

echo "building ppfull:$REV image, package version=$TAG"
docker build . --file ./build/Dockerfile --target ppapp --tag ppfull:$REV --build-arg IMGVER=$REV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg FRONTPKGVER=$FRONTPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS
