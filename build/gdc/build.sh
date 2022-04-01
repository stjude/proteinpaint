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

./build/full/build.sh -r $REV
REV=$(cat tmppack/rev.txt)
tar -C tmppack/ -xvf archive.tar build/gdc

#####################
# Build the image
#####################

# get the current tag
# GIT_TAG is set when the script is kicked off by GDC Jenkins
TAG="$(grep version package.json | sed 's/.*"version": "\(.*\)".*/\1/')"

# get the current tag
#TAG="$(node -p "require('./package.json').version")"
echo "building ppgdc:$REV image, package version=$TAG"
docker build --file ./tmppack/build/gdc/Dockerfile --tag $DOCKER_TAG --build-arg IMGVER=$REV --build-arg PKGVER=$TAG .
