#!/bin/bash

set -e

###############
# ARGUMENTS
###############

USAGE="Usage:
./build/full/build.sh [-r] [-b] [-c] [-a]

	-r REV: git revision to checkout, if empty will use the current code state
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that used prior to npm install
	-a: architecture that should be used to compile native packages
"
REV=latest
BUILDARGS=""
CROSSENV=""
ARCH="x86_64"
while getopts "r:b:c:h:a:" opt; do
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
	a)
		ARCH=${OPTARG}	
		;;
	h)
		echo $USAGE
		exit 1
		;;
	\?)
		echo $USAGE
		exit 1
		;;
	esac
done
echo "ARCH IS $ARCH"
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
docker build  --file ./build/Dockerfile $BUILDARGS --target ppbase --tag ppbase:$REV --build-arg ARCH="$ARCH" .
echo "building pprust:$REV image, package version=$TAG"
docker build  --file ./build/Dockerfile $BUILDARGS --target pprust --tag pprust:$REV --build-arg ARCH="$ARCH" .
echo "generating a build with minimal package jsons"
docker build  --file ./build/Dockerfile $BUILDARGS --target ppminpkg --tag ppminpkg:$REV --build-arg ARCH="$ARCH" .

echo "building pppkg:$REV image, package version=$TAG, can copy /home/root/pp/tmppack/stjude-proteinpaint.tgz as a publishable package"
docker build  --file ./build/full/Dockerfile $BUILDARGS --target pppkg --tag pppkg:$REV --build-arg IMGVER=$REV --build-arg PKGVER=$TAG --build-arg CROSSENV="$CROSSENV" .

echo "building ppfull:$REV image, package version=$TAG"
docker build  --file ./build/full/Dockerfile $BUILDARGS --target ppapp --tag ppfull:$REV --build-arg IMGVER=$REV --build-arg PKGVER=$TAG --build-arg CROSSENV="$CROSSENV" .