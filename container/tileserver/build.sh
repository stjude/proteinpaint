#!/bin/bash

DEFAULT_TAG="latest"
TAG="${1:-$DEFAULT_TAG}"

PLATFORM=""
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then
	ARCH="aarch64";
	PLATFORM="--platform=linux/arm64"
fi

# The docker buildx build command
docker buildx build . \
  --file ./Dockerfile \
  --tag "ghcr.io/stjude/tile-server:$TAG" \
  $PLATFORM \
  --build-arg ARCH="$ARCH"
