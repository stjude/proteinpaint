#!/bin/bash

set -e

###############
# ARGUMENTS
###############

usage() {
	echo "Usage:

	./targets/gdc/build.sh [-r]

	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
TPDIR=''
while getopts "r:h:" opt; do
	case "${opt}" in
	r)
		REV=$OPTARG
		;;
	h)
		usage
		exit 1
		;;
	esac
done

#########################
# EXTRACT REQUIRED FILES
#########################

./build/extract.sh -r $REV
REV=$(cat tmppack/rev.txt)

#####################
# Build the image
#####################

cd tmppack
# get the current tag
TAG="$(node -p "require('./package.json').version")"
echo "building ppbase:$REV image, package version=$TAG"
docker build --file ./build/Dockerfile --tag ppbase:$REV .

# build an image for GDC-related tests
docker build \
	--file ./targets/gdc/Dockerfile \
	--target ppgdctest \
	--tag ppgdctest:$REV \
	--build-arg IMGVER=$REV \
	--build-arg PKGVER=$TAG \
	.

if [[ "$?" != "0" ]]; then
	echo "Error when running the GDC test image (exit code=$?)"
	exit 1
fi

# this image may publish the @stjude-proteinpaint client package
docker build \
	--file ./targets/gdc/Dockerfile \
	--target ppserver \
	--tag ppgdc:$REV \
	--build-arg IMGVER=$REV \
	--build-arg PKGVER=$TAG \
	.
