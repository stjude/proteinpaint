#!/bin/bash

set -euxo pipefail

. ../args.sh "$@"

cp -r ../public .

#########################
# Docker build
#########################

echo "building ${MODE}ppfull image"
if [[ "$SERVERTGZ" != "" ]]; then
	npm pkg set dependencies.@sjcrh/proteinpaint-server=$SERVERTGZ
	npm pkg set dependencies.@sjcrh/proteinpaint-front=$FRONTTGZ
fi

docker buildx build . \
	--file ./Dockerfile \
	--tag "${MODE}ppfull:latest" $PLATFORM \
	--build-arg IMGVER=$IMGVER \
	--build-arg IMGREV=$IMGREV \
	--build-arg CROSSENV="$CROSSENV" $BUILDARGS \
	--output type=docker

############
# Clean up
############

git restore package.json
rm -rf public
