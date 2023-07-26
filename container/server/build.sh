#!/bin/bash

set -euxo pipefail

. ../args.sh "$@"

###############
# Docker build
###############

echo "building ${MODE}ppserver image"
if [[ "$SERVERTGZ" != "" ]]; then
	npm pkg set dependencies.@sjcrh/proteinpaint-server=$SERVERTGZ
fi

docker buildx build . \
	--file ./Dockerfile \
	--tag "${MODE}ppserver:latest" $PLATFORM \
	--build-arg IMGVER=$IMGVER \
	--build-arg IMGREV=$IMGREV \
	--build-arg CROSSENV="$CROSSENV" $BUILDARGS \
	--output type=docker

#############
# Clean up
#############

git restore package.json
