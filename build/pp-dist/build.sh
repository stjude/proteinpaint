#!/bin/bash

set -e

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build/pp-dist/build.sh [-r]

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

./build/extract.sh -r $REV -t pp-dist
REV=$(cat tmppack/rev.txt)

#########################
# Pack with Docker build
#########################

# get the current tag
TAG="$(node -p "require('./package.json').version")"
echo "building ppbase:$REV image, package version=$TAG"
docker build --file ./build/Dockerfile --target ppbase --tag ppbase:$REV .
echo "building pprust:$REV image, package version=$TAG"
docker build --file ./build/Dockerfile --target pprust --tag pprust:$REV .
echo "building ppdist:$REV image, package version=$TAG"
docker build --file ./build/pp-dist/Dockerfile --tag ppdist:$REV --build-arg IMGVER=$REV --build-arg PKGVER=$TAG .
