#!/bin/bash

set -euxo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build.sh [-r] [-b] [-c]

	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that are used prior to npm install
"
BUILDARGS=""
CROSSENV=""
MODE=""
while getopts "m:r:b:c:h:x:" opt; do
	case "${opt}" in
	m)
		MODE=${OPTARG}
		;;
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

if [[ "$MODE" == "notdev" ]]; then
	echo "post-install build skipped within repo"
	exit 0
fi


if [[ ! -d $PWD/tmppack ]]; then
    mkdir -p $PWD/tmppack
fi


ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then ARCH="aarch64"; fi

#########################
# Docker build
#########################
# !!! FOR TESTING ONLY --- REMOVE .npmrc BEFORE PUSHING !!!
# !!! once PP is open-sourced, the .npmrc should only have the registry URL for the @stjude namespace !!!
cp ~/.npmrc .

# assumes that the branch head is currently checked out
REV=latest # $(git rev-parse --short HEAD)
TAG="$(node -p "require('./package.json').version")"
SERVERPKGVER="$(node -p "require('./package.json').containerDeps.server")"
FRONTPKGVER="$(node -p "require('./package.json').containerDeps.front")"

echo "building ppbase:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target ppbase --tag ppbase:$REV --build-arg ARCH="$ARCH" $BUILDARGS

echo "building pprust:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target pprust --tag pprust:$REV --build-arg ARCH="$ARCH" $BUILDARGS

echo "building ppserverdeps:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target ppserverdeps --tag ppserverdeps:$REV --build-arg IMGVER=$REV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS

echo "building ppserver:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target ppserver --tag ppserver:$REV --build-arg IMGVER=$REV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS

echo "building ppfull:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target ppapp --tag ppfull:$REV --build-arg IMGVER=$REV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg FRONTPKGVER=$FRONTPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS

if [[ "$(ls -A $(pwd)/tmppack )" == "" ]]; then 
	rm -rf $PWD/tmppack   
fi
