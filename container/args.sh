#!/bin/bash

set -euxo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build.sh [-m] [-r] [-b] [-c]
	-z USETGZ: use local tarballs for the server and full packages
	-m MODE: string to loosely indicate the build environment.
			 - defaults to an empty string
			 - 'pkg' is reserved to indicate a package build, outside of the repo or dev environment
			 - will be used as a prefix for the image name
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted in the built image
	-c CROSSENV: cross-env options that are used prior to npm install
"

BUILDARGS=""
CROSSENV=""
MODE=""
SERVERTGZFILE=""
SERVERTGZ=""
FRONTTGZ=""

################
# DETECTED ARGS
################

IMGVER="$(node -p "require('./package.json').version")"
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

#################
# PROCESSED ARGS
#################
CURRDIR=$(basename "$PWD")

while getopts "zm:r:b:c:h:x:" opt; do
	case "${opt}" in
	z)
		PKGPATH=/home/root/pp/tmppack
		PKGSCOPE=sjcrh-proteinpaint
		SERVERPKGVER="$(node -p "require('./package.json').dependencies['@sjcrh/proteinpaint-server']")"
		SERVERTGZFILE=$PKGSCOPE-server-$SERVERPKGVER.tgz
		SERVERTGZ="$PKGPATH/$SERVERTGZFILE"
		FRONTPKGVER="$(node -p "require('./package.json').dependencies['@sjcrh/proteinpaint-front']")"
		FRONTTGZ="$PKGPATH/$PKGSCOPE-front-$FRONTPKGVER.tgz"
		;;
	m)
		MODE=${OPTARG}
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

#########################
# Handle -z option
#########################

if [[ ! -d ./tmppack ]]; then
	mkdir tmppack
fi 

if [[ "$SERVERTGZ" == "" ]]; then
  rm -f tmppack/* 
else
	if [[ ! -d ../tmppack || ! -f "../tmppack/$SERVERTGZFILE" ]]; then
		CURRDIR=$(basename "$PWD")
		cd ..
		./pack.sh
		cd $CURRDIR
	fi
	cp -f ../tmppack/* tmppack/
fi
