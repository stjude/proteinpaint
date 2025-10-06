#!/bin/bash

DEFAULT_TAG="latest"
TAG="${1:-$DEFAULT_TAG}"

PLATFORM=""
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then
	ARCH="aarch64";
	PLATFORM="--platform=linux/arm64"
fi

# The podman buildx build command
docker buildx build . \
  --file ./Dockerfile \
  --tag "ghcr.io/stjude/devcontainer:$TAG" \
  $PLATFORM