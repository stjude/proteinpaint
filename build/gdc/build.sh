#!/bin/bash

set -e

###############
# ARGUMENTS
###############


usage() {
	echo "Usage:

	./build/gdc/build.sh [-t] [-r]

	-t tpmasterdir: your local serverconfig.json's tpmasterdir
	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
TPDIR=''
DOCKER_TAG=$REV
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

################################
# BUILD THE FULL TESTABLE IMAGE
################################

./build/full/build.sh -r $REV \
	-b "--build-arg http_proxy=http://cloud-proxy:3128 --build-arg https_proxy=http://cloud-proxy:3128" \
	-c "npx cross-env ELECTRON_GET_USE_PROXY=true GLOBAL_AGENT_HTTPS_PROXY=http://cloud-proxy:3128"

tar -C tmppack/ -xvf archive.tar build/gdc

#####################
# Build the image
#####################

# get the current tag
# GIT_TAG is set when the script is kicked off by GDC Jenkins
TAG="$(grep version package.json | sed 's/.*"version": "\(.*\)".*/\1/')"

# get the current tag
#TAG="$(node -p "require('./package.json').version")"
REV=$(cat tmppack/rev.txt)
echo "building ppgdc:$REV image, package version=$TAG, docker tag=$DOCKER_TAG"
docker build --file ./tmppack/build/gdc/Dockerfile --tag $DOCKER_TAG --build-arg IMGVER=$REV --build-arg PKGVER=$TAG .
