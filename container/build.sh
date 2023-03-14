#!/bin/bash

set -euxo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build.sh [-r] [-b] [-c]

	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that are used prior to npm install
"
BUILDARGS=""
CROSSENV=""
while getopts "r:b:c:h:x:" opt; do
	case "${opt}" in
	r)
		REV=${OPTARG}
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

ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then ARCH="aarch64"; fi

# assumes that the branch head is currently checked out
REV=latest # $(git rev-parse --short HEAD)
TAG="$(node -p "require('./package.json').version")"
SERVERPKGVER="$(node -p "require('./package.json').containerDeps.server")"
FRONTPKGVER="$(node -p "require('./package.json').containerDeps.front")"

echo "building ppbase:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target ppbase --tag ppbase:$REV --build-arg ARCH="$ARCH" $BUILDARGS

echo "building pprust:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target pprust --tag pprust:$REV --build-arg ARCH="$ARCH" $BUILDARGS

echo "building ppserver:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target ppserver --tag ppserver:$REV --build-arg IMGVER=$REV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS

echo "building ppfull:$REV image, package version=$TAG"
docker build . --file ./Dockerfile --target ppapp --tag ppfull:$REV --build-arg IMGVER=$REV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg FRONTPKGVER=$FRONTPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS
