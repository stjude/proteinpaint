#!/bin/bash

set -euo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build.sh [subdir] [-z] [-m] [-r] [-b] [-c]
	
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

set -x

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
if [[ "$1" != "" ]]; then
	SUBDIR=$1
fi

if [[ "$PKGPATH" != "" ]]; then
	PKGSCOPE=sjcrh-proteinpaint
	SERVERPKGVER="$(node -p "require('./$SUBDIR/package.json').dependencies['@sjcrh/proteinpaint-server']")"
	SERVERTGZFILE=$PKGSCOPE-server-$SERVERPKGVER.tgz
	SERVERTGZ="$PKGPATH/$SERVERTGZFILE"
	FRONTPKGVER="$(node -p "require('./$SUBDIR/package.json').dependencies['@sjcrh/proteinpaint-front']")"
	FRONTTGZ="$PKGPATH/$PKGSCOPE-front-$FRONTPKGVER.tgz"
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
	# ARCH="aarch64";
	# Hardcoded until build is fixed for arm64
	ARCH="x86_64"
	# will emulate x86 arch in arm64 machines
	PLATFORM="--platform=linux/amd64"
fi

#########################
# Handle -z option
#########################

if [[ ! -d ./tmppack ]]; then
	mkdir tmppack
fi

if [[ "$SERVERTGZ" == "" ]]; then
  rm -f tmppack/* 
elif [[ ! -f "./tmppack/$SERVERTGZFILE" ]]; then
	./pack.sh
fi

if [[ "$SERVERTGZ" != "" ]]; then
	cd $SUBDIR # so that the correct package.json is updated
	npm pkg set dependencies.@sjcrh/proteinpaint-server=$SERVERTGZ
	if [[ "$SUBDIR" == "full" ]]; then
		npm pkg set dependencies.@sjcrh/proteinpaint-front=$SERVERTGZ
	fi
	cd ..
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

git restore server/package.json
git restore full/package.json
