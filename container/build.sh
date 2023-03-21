#!/bin/bash

set -euxo pipefail

###############
# ARGUMENTS
###############

USAGE="Usage:
	./build.sh [-m] [-r] [-b] [-c] [-t]

	-m MODE: string to loosely indicate the build environment.
			 - defaults to an empty string
			 - 'pkg' is reserved to indicate a package build, outside of the repo or dev environment
			 - will be used as a prefix for the image name
	-b BUILDARGS: build variables to pass to the Dockerfile that are not persisted to the built image
	-c CROSSENV: cross-env options that are used prior to npm install
	-t GIT_PAT: github personal access token to use in .npmrc
"
BUILDARGS=""
CROSSENV=""
MODE=""
GIT_PAT=""
while getopts "m:r:b:c:h:x:t:" opt; do
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
	t)
		GIT_PAT=${OPTARG}
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

if [[ ! -d $PWD/tmppack ]]; then
    mkdir -p $PWD/tmppack
fi


ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then ARCH="aarch64"; fi

#########################
# Docker build
#########################
# !!! FOR TESTING ONLY --- REMOVE .npmrc BEFORE PUSHING !!!
# !!! once PP uses a public npm registry that does not require a token, 
# then at most the .npmrc should only have the registry URL for the @stjude namespace !!!
if [[ "$GIT_PAT" != "" ]]; then
	echo "@stjude:registry=https://npm.pkg.github.com/" > .npmrc
	# pragma: allowlist nextline secret
	echo "//npm.pkg.github.com/:_authToken=$GIT_PAT" >> .npmrc
elif [[ ! -f .npmrc ]]; then
	if [[ ! -f ~/.npmrc ]]; then
		echo "either an .npmrc in the home or working directory, or a [-t Github personal access token] argument, is required"
		exit 1
	fi
	cp ~/.npmrc .
fi

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
docker build . --file ./Dockerfile --target ppbase --tag "${MODE}ppbase:latest" --build-arg ARCH="$ARCH" $BUILDARGS

echo "building ${MODE}pprust image"
docker build . --file ./Dockerfile --target pprust --tag "${MODE}pprust:latest" --build-arg ARCH="$ARCH" $BUILDARGS

echo "building ${MODE}ppserver image"
docker build . --file ./Dockerfile --target ppserver --tag "${MODE}ppserver:latest" --build-arg IMGVER=$IMGVER --build-arg IMGREV=$IMGREV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS

echo "building ${MODE}ppfull image"
docker build . --file ./Dockerfile --target ppfull --tag "${MODE}ppfull:latest" --build-arg IMGVER=$IMGVER --build-arg IMGREV=$IMGREV --build-arg SERVERPKGVER=$SERVERPKGVER --build-arg FRONTPKGVER=$FRONTPKGVER --build-arg CROSSENV="$CROSSENV" $BUILDARGS

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

if [[ "$(ls -Alq $PWD/tmppack | grep -q . )" ]]; then
	rm -r $PWD/tmppack
fi
