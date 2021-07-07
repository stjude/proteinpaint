#!/bin/bash

set -e

###############
# ARGUMENTS
###############


usage() {
	echo "Usage:

	./targets/gdc/build.sh [-t] [-r]

	-t tpmasterdir: your local serverconfig.json's tpmasterdir
	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
TPDIR=''
while getopts "t:r:h:d:" opt; do
	case "${opt}" in
	t) 
		TPMASTERDIR=$OPTARG
		;;
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
docker build --file ./build/Dockerfile --tag ppbase:$REV --build-arg http_proxy=http://cloud-proxy:3128 --build-arg https_proxy=http://cloud-proxy:3128 .

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
        --build-arg http_proxy=http://cloud-proxy:3128 \
        --build-arg https_proxy=http://cloud-proxy:3128 \
	--build-arg electron_get_use_proxy=true \
	--build-arg global_agent_https_proxy=http://cloud-proxy:3128 \
	.

# delete this test step once the gdc wrapper tests are 
# triggered as part of the image building process
#./targets/gdc/dockrun.sh $TPMASTERDIR 3456 ppgdctest:$REV
#if [[ "$?" != "0" ]]; then
#	echo "Error when running the GDC test image (exit code=$?)"
#	exit 1
#fi

# this image may publish the @stjude-proteinpaint client package
docker build \
	--file ./targets/gdc/Dockerfile \
	--target ppserver \
	--tag $DOCKER_TAG \
	--build-arg IMGVER=$REV \
	--build-arg PKGVER=$TAG \
        --build-arg http_proxy=http://cloud-proxy:3128 \
        --build-arg https_proxy=http://cloud-proxy:3128 \
	.