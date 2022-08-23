#!/bin/bash

set -euxo pipefail

###############
# ARGUMENTS
###############


usage() {
	echo "Usage:

	./build/gdc/build.sh [-r] [-x] [-b] [-d] [-p]

	-r REV: git revision to checkout, if empty will use the current code state
	-b build arguments, like proxy-servers for downloading whitelisted packages, dependencies
	   default \"--build-arg http_proxy=http://cloud-proxy:3128 --build-arg https_proxy=http://cloud-proxy:3128 --build-arg ELECTRON_GET_USE_PROXY=true --build-arg GLOBAL_AGENT_HTTPS_PROXY=http://cloud-proxy:3128\"
	-p Use the GDC proxy
	-d Optional docker tag
	-x Set bash debug output
	"
}

REV=latest
DOCKER_TAG=ppgdc:${REV}
BUILDARGS="--label org.opencontainers.image.revision=$(git rev-parse --short HEAD)
  --label org.opencontainers.image.created=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

while getopts 'r:b:h:d:p:x:' opt; do
	echo "[DEBUG] opt is ${opt}"
	case ${opt} in
	r )
		REV=${OPTARG}
		;;
	d )
		DOCKER_TAG=${OPTARG}
		;;
	b )
		BUILDARGS="${BUILDARGS} ${OPTARG}"
		;;
	p )
		BUILDARGS="${BUILDARGS} --build-arg http_proxy=http://cloud-proxy:3128 --build-arg https_proxy=http://cloud-proxy:3128 --build-arg ELECTRON_GET_USE_PROXY=true --build-arg GLOBAL_AGENT_HTTPS_PROXY=http://cloud-proxy:3128"
		;;
	x )
		set -x
		;;
	h )
		usage
		exit 1
		;;
	:)
		echo "$0: Must supply an argument to -$OPTARG." >&2
		exit 1
		;;
	?)
		echo "Invalid option: -${OPTARG}."
		exit 2
		;;
	esac
done

################################
# BUILD THE FULL TESTABLE IMAGE
################################

./build/full/build.sh -r "$REV" -b "$BUILDARGS"
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
BUILDARGS="${BUILDARGS} --label org.opencontainers.ref.name=proteinpaint:${REV} --label org.opencontainers.image.version=${REV}"

echo "building $DOCKER_TAG image, package version=$TAG, REV=$REV"
docker build . --file ./tmppack/build/gdc/Dockerfile --tag $DOCKER_TAG --build-arg IMGVER=$REV --build-arg PKGVER=$TAG $BUILDARGS
