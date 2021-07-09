#!/bin/bash

set -e

###############
# ARGUMENTS
###############


usage() {
	echo "Usage:

	./build/gdc/build.sh [-r]

	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
TPDIR=''
while getopts "t:r:h:d:" opt; do
	case "${opt}" in
	r)
		REV=$OPTARG
		;;
	d)
		DOCKER_TAG=$OPTARG
		;;
	h)
		usage
		exit 1
		;;
	esac
done

#if [[ "$TPMASTERDIR" == "" ]]; then
#	echo "Missing the -t argument"
#	usage
#	exit 1
#fi

#########################
# EXTRACT REQUIRED FILES
#########################

./build/extract.sh -r $REV -t gdc
REV=$(cat tmppack/rev.txt)

#####################
# Build the image
#####################

cd tmppack
# get the current tag
# GIT_TAG is set when the script is kicked off by GDC Jenkins
TAG="$(grep version package.json | sed 's/.*"version": "\(.*\)".*/\1/')"
echo "building ppbase:$REV image, package version=$TAG"
docker build --file ./build/Dockerfile --tag ppbase:$REV .

# build an image for GDC-related tests
#
docker build \
	--file ./build/gdc/prepush/Dockerfile \
	--target ppgdctest \
	--tag ppgdctest:$REV \
	--build-arg IMGVER=$REV \
	--build-arg PKGVER=$TAG \
	.

# this image may publish the @stjude-proteinpaint client package
docker build \
	--file ./build/gdc/prepush/Dockerfile \
	--target ppserver \
	--tag ppgdcserver:$REV \
	--build-arg IMGVER=$REV \
	--build-arg PKGVER=$TAG \
	.
