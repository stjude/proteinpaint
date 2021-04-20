#!/bin/bash

set -e

###############
# ARGUMENTS
###############

usage() {
	echo "Usage:

	./targets/pp-dist/build.sh [-t] [-r]

	-t tpmasterdir: your local serverconfig.json's tpmasterdir
	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
TPDIR=''
while getopts "t:r:h:" opt; do
	case "${opt}" in
	t) 
		TPMASTERDIR=$OPTARG
		;;
	r)
		REV=$OPTARG
		;;
	h)
		usage
		exit 1
		;;
	esac
done

if [[ "$TPMASTERDIR" == "" ]]; then
	echo "Missing the -t argument"
	usage
	exit 1
fi

#########################
# EXTRACT REQUIRED FILES
#########################

./build/extract.sh
REV=$(cat tmppack/rev.txt)

#####################
# Build the image
#####################

cd tmppack
# get the current tag
TAG="$(node -p "require('./package.json').version")"
echo "building image:$REV, version=$TAG"
docker build --file ./build/Dockerfile --tag ppbase:$REV .

# build an image for GDC-related tests
# 
# TODO: 
# will do this test as QC for building the server image once 
# minimal test-only data files are available
#
docker build \
	--file ./targets/gdc/Dockerfile \
	--target ppgdctest \
	--tag ppgdctest:$REV \
	--build-arg IMGVER=$REV \
	--build-arg PKGVER=$TAG \
	.

# delete this test step once the gdc wrapper tests are 
# triggered as part of the image building process
./targets/gdc/dockrun.sh $TPMASTERDIR 3456 ppgdctest:$REV
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
