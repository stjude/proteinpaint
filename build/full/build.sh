#!/bin/bash

set -e

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build/full/build.sh [-r]

	-r REV: git revision to checkout, if empty will use the current code state
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that used prior to npm install
"

REV=latest
BUILDARGS=""
CROSSENV=""
while getopts "r:b:c:h:" opt; do
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
		echo $USAGE
		exit 1
		;;
	esac
done

#########################
# EXTRACT REQUIRED FILES
#########################

./build/extract.sh -r $REV -t full
REV=$(cat tmppack/rev.txt)

#########################
# Pack with Docker build
#########################

cd tmppack

# get the current tag
#TAG="$(node -p "require('./package.json').version")"
TAG="$(grep version package.json | sed 's/.*"version": "\(.*\)".*/\1/')"
echo "building ppbase:$REV image, package version=$TAG"
docker build --file ./build/Dockerfile $BUILDARGS --target ppbase --tag ppbase:$REV .
echo "building pprust:$REV image, package version=$TAG"
docker build --file ./build/Dockerfile $BUILDARGS --target pprust --tag pprust:$REV .
echo "generating a build with minimal package jsons"
docker build --file ./build/Dockerfile $BUILDARGS --target ppminpkg --tag ppminpkg:$REV .

echo "building ppfull:$REV image, package version=$TAG"
docker build --file ./build/full/Dockerfile $BUILDARGS --tag ppfull:$REV --build-arg IMGVER=$REV --build-arg PKGVER=$TAG --build-arg CROSSENV="$CROSSENV" .
