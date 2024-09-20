#!/bin/bash

set -euo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build2.sh [-z] [-k] [-r] [-b] [-c] [subdir]
	
	subdir: 'server' | 'full', the subdirectory to build

	-z USETGZ: use local tarballs for the server and full packages
	-r PREFIX: prefix for the image name, defaults to an empty string ""
			 - 'pkg' is reserved to indicate a package build, outside of the repo or dev environment
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted in the built image
	-c CROSSENV: cross-env options that are used prior to npm install
"

SUBDIR=server
BUILDARGS=""
CROSSENV=""
PREFIX=""
SERVERTGZFILE=""
SERVERTGZ=""
FRONTTGZ=""
PKGPATH=""

#################
# PROCESSED ARGS
#################

while getopts "zr:b:c:h" opt; do
	case "${opt}" in
	z)
    # install proteinpaint-* builds from tarballs, not published packages
		PKGPATH=/home/root/pp/tmppack
		;;
	r)
		PREFIX=${OPTARG}
		;;
	b)
		BUILDARGS=${OPTARG}
		;;
	c)
		CROSSENV=${OPTARG}
		;;
	h)
		echo "$USAGE"
		exit 1
		;;
  *)
  	echo "Unrecognized parameter. Use -h to display usage."
  	exit 1
  	;;
	esac
done
IMGNAME="${PREFIX}pp$SUBDIR"

shift $(($OPTIND-1))

if (( $# == 1 )); then
	SUBDIR=$1
fi

################
# DETECTED ARGS
################

# print a trace of simple commands, after argument parsing above 
# which can be too noisy
set -x

IMGVER="$(node -p "require('./$SUBDIR/package.json').version")"
# assumes that the branch head is currently checked out
IMGREV="head"
set +e
HASH=$(git rev-parse --short HEAD 2>/dev/null)
set -e
if [[ "$HASH" != "" ]]; then
	IMGREV="$HASH"
fi

PLATFORM=""
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then 
	ARCH="aarch64";
	PLATFORM="--platform=linux/arm64"
fi

#########################
# Handle -z option
#########################

if [[ ! -d ./tmppack ]]; then
	# always has to have a tmppack dir because the Dockerfile may require it to COPY
	mkdir tmppack
fi

if [[ "$PKGPATH" != "" ]]; then
  if [[ "$(find ./tmppack -type f -iname "sjcrh*.tgz")" == "" ]] ; then
		echo "packing tarballs ..."
		./pack.sh $PKGPATH
	else
		# option to reuse tarballs in dev, if certain updated tarballs are not needed
		echo "reusing tmppack: to avoid reuse, run 'rm -rf tmppack'"
	fi
fi

###############
# Docker build
###############

IMGNAME="${PREFIX}pp$SUBDIR"

echo "building $IMGNAME image"

docker buildx build . \
	--file ./$SUBDIR/Dockerfile \
	--tag "$IMGNAME:$IMGVER-$HASH" \
	--tag "$IMGNAME:latest" $PLATFORM \
	--build-arg IMGVER=$IMGVER \
	--build-arg IMGREV=$IMGREV \
	--build-arg CROSSENV="$CROSSENV" $BUILDARGS \
	--output type=docker

#############
# Clean up
#############

# git restore server/package.json
# git restore full/package.json
