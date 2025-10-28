#!/bin/bash

#
# !!! call from the proetinpaint/container/deps dir !!!
# ./build.sh
# 

set -euxo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build.sh [-m] [-r] [-b] [-c]

	-m MODE: string to loosely indicate the build environment.
			 - defaults to an empty string
			 - 'pkg' is reserved to indicate a package build, outside of the repo or dev environment
			 - will be used as a prefix for the image name
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that are used prior to npm install
"
BUILDARGS=""
CROSSENV=""
MODE=""
while getopts "m:r:b:c:h:x:" opt; do
	case "${opt}" in
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

if [[ "$MODE" == "pkg" && -d "../client" ]]; then
	echo "post-install pkg build skipped within repo"
	exit 0
fi

######################
# COMPUTED VARIABLES
######################

PLATFORM=""
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then 
	ARCH="x86_64";
  PLATFORM="--platform=linux/amd64"
# Enable this if you want to build for arm64
#	ARCH="aarch64";
#	PLATFORM="--platform=linux/arm64"
fi


#########################
# Docker build
#########################

IMGVER="$(node -p "require('./package.json').version")"
# assumes that the branch head is currently checked out
IMGREV="head"
set +e
HASH=$(git rev-parse --short HEAD 2>/dev/null)
set -e
if [[ "$HASH" != "" ]]; then
	IMGREV="$HASH"
fi
SERVERPKGVER="$(node -p "require('./package.json').containerDeps.server")"
FRONTPKGVER="$(node -p "require('./package.json').containerDeps.front")"

cp -r ../public ./
cp ../full/app-full.mjs .
cp ../server/app-server.mjs .

# copy over R utilities for installing R dependencies
mkdir -p R
cp -r ../../R/utils R/

mkdir -p python
cp -r ../../python/requirements.txt python/

cp ../../server/package.json ./

# Create the tmppack folder to store pp tarballs during CI,
# if there are changes in the pp repo
mkdir -p ./tmppack

# build ppbase, ppserver, and ppfull images
# NOTE: important to supply the same ARCH, IMGVER, and IMGREV arguments
# for all 3 build jobs to ensure that the ppbase stage of the build
# is cached for the ppserver and ppfull stages
echo "building ${MODE}ppbase image"
docker buildx build . --file ./Dockerfile --target ppbase --tag "${MODE}ppbase:latest" $PLATFORM --build-arg ARCH="$ARCH" --build-arg IMGVER=$IMGVER --build-arg IMGREV=$IMGREV $BUILDARGS --output type=docker

echo "building ${MODE}ppserver image"
docker buildx build . --file ./Dockerfile --target ppserver --tag "${MODE}ppserver:latest" $PLATFORM --build-arg ARCH="$ARCH" --build-arg IMGVER=$IMGVER --build-arg IMGREV=$IMGREV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS --output type=docker

echo "building ${MODE}ppfull image"
docker buildx build . --file ./Dockerfile --target ppfull --tag "${MODE}ppfull:latest" $PLATFORM --build-arg ARCH="$ARCH" --build-arg IMGVER=$IMGVER --build-arg IMGREV=$IMGREV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg FRONTPKGVER=$FRONTPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS --output type=docker

# in non-dev/repo environment, may automatically add extra tags
if [[ "$MODE" != "" ]]; then
	for target in server full; do
		docker tag "${MODE}pp${target}:latest" "${MODE}pp${target}:$IMGVER"
	done

	if [[ "$HASH" != "" ]]; then
		for target in base server full; do
			docker tag "${MODE}pp${target}:latest" "${MODE}pp${target}:$IMGVER-$HASH"
		done
	fi
fi

rm -rf public
rm ./app-*.mjs
