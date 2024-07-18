#!/bin/bash

DEFAULT_TAG="latest"
TAG="${1:-$DEFAULT_TAG}"

PLATFORM=""
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then
	# ARCH="aarch64";
	# Hardcoded until build is fixed for arm64
	ARCH="x86_64"
	# will emulate x86 arch in arm64 machines
	PLATFORM="--platform=linux/amd64"
fi

# The docker buildx build command
docker buildx build . \
  --file ./Dockerfile \
  --tag "ghcr.io/stjude/tile-server:$TAG" \
  $PLATFORM