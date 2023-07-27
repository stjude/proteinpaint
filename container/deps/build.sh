#!/bin/bash

#
# !!! call from the proetinpaint/container dir !!!
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
	# ARCH="aarch64";
	# Hardcoded until build is fixed for arm64
	ARCH="x86_64"
	# will emulate x86 arch in arm64 machines
	PLATFORM="--platform=linux/amd64"
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

echo "building ${MODE}ppbase image"
docker buildx build . --file ./Dockerfile --target ppbase --tag "${MODE}ppbase:latest" $PLATFORM --build-arg ARCH="$ARCH" $BUILDARGS --output type=docker

echo "building ${MODE}pprust image"
docker buildx build . --file ./Dockerfile --target pprust --tag "${MODE}pprust:latest" $PLATFORM --build-arg ARCH="$ARCH" $BUILDARGS --output type=docker

echo "building ${MODE}ppserver image"
docker buildx build . --file ./Dockerfile --target ppserver --tag "${MODE}ppserver:latest" $PLATFORM --build-arg IMGVER=$IMGVER --build-arg IMGREV=$IMGREV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS --output type=docker

echo "building ${MODE}ppfull image"
docker buildx build . --file ./Dockerfile --target ppfull --tag "${MODE}ppfull:latest" $PLATFORM --build-arg IMGVER=$IMGVER --build-arg IMGREV=$IMGREV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg FRONTPKGVER=$FRONTPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS --output type=docker

# in non-dev/repo environment, may automatically add extra tags
if [[ "$MODE" != "" ]]; then
	for target in server full; do
		docker tag "${MODE}pp${target}:latest" "${MODE}pp${target}:$IMGVER"
	done

	if [[ "$HASH" != "" ]]; then
		for target in base rust server full; do
			docker tag "${MODE}pp${target}:latest" "${MODE}pp${target}:$HASH"
		done
	fi
fi
