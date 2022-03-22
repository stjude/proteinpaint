#!/bin/bash

set -e

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build/full/build.sh [-r]

	-r REV: git revision to checkout, if empty will use the current code state
"

REV=latest
while getopts "r:h:" opt; do
	case "${opt}" in
	r)
		REV=${OPTARG}
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
TAG="$(node -p "require('./package.json').version")"
echo "building ppbase:$REV image, package version=$TAG"
docker build --file ./build/Dockerfile --target ppbase --tag ppbase:$REV .
echo "building pprust:$REV image, package version=$TAG"
docker build --file ./build/Dockerfile --target pprust --tag pprust:$REV .
echo "building ppfull:$REV image, package version=$TAG"
docker build --file ./build/full/Dockerfile --tag ppfull:$REV --build-arg IMGVER=$REV --build-arg PKGVER=$TAG .
