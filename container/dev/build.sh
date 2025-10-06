#!/bin/bash

DEFAULT_TAG="latest"
TAG="${1:-$DEFAULT_TAG}"

PLATFORM=""
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then
	ARCH="x86_64";
  PLATFORM="--platform=linux/amd64"
# Enable this if you want to build for arm64
#	ARCH="aarch64";
#	PLATFORM="--platform=linux/arm64"
fi

# The podman buildx build command
docker buildx build . \
  --file ./Dockerfile \
  --tag "ghcr.io/stjude/devcontainer:$TAG" \
  $PLATFORM