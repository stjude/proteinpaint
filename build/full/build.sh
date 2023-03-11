#!/bin/bash

set -euxo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build/full/build.sh [-r] [-b] [-c]

	-r REV: git revision to checkout, if empty will use the current code state
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that used prior to npm install
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

./build/extract.sh -r "$REV" -t full
REV=$(cat tmppack/rev.txt)
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then ARCH="aarch64"; fi
#########################
# Pack with Docker build
#########################

cd tmppack/build/full
npm pack
TAG="$(grep version package.json | sed 's/.*"version": "\(.*\)".*/\1/')"
# !!! FOR TESTING ONLY --- REMOVE !!!
cp ~/.npmrc .
cd ../..

# get the current tag
#TAG="$(node -p "require('./package.json').version")"

echo "building ppbase:$REV image, package version=$TAG"
docker build . --file ./build/Dockerfile --target ppbase --tag ppbase:$REV --build-arg ARCH="$ARCH" $BUILDARGS

echo "building pprust:$REV image, package version=$TAG"
docker build . --file ./build/Dockerfile --target pprust --tag pprust:$REV --build-arg ARCH="$ARCH" $BUILDARGS

echo "building ppfull:$REV image, package version=$TAG"
docker build . --file ./build/Dockerfile --target ppapp --tag ppfull:$REV --build-arg IMGVER=$REV --build-arg PKGVER=$TAG --build-arg CROSSENV="$CROSSENV" $BUILDARGS
