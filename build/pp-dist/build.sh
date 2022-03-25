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

################################
# BUILD THE FULL TESTABLE IMAGE
################################

./build/full/build.sh -r $REV
tar -C tmppack/ -xvf archive.tar build/pp-dist

#########################
# Pack with Docker build
#########################

# get the current tag
TAG="$(node -p "require('./package.json').version")"
echo "building ppdist:$REV image, package version=$TAG"
docker build --file ./tmppack/build/pp-dist/Dockerfile --tag ppdist:$REV --build-arg IMGVER=$REV --build-arg PKGVER=$TAG .
