#!/bin/bash

set -e

# TODO We could remove the need for this custom build script if we tweaked
# a couple things either in this repo or in the GDC pipeline library:
#
# 1. We currently need to specify the prod-bare target since the prod target
# requires a preexisting serverconfig.json.
#
# 2. We need to specify a different location for the Dockerfile.

DOCKER_TAG="${REGISTRY}/ncigdc/${REPO}:${GIT_TAG}"

docker build \
	--build-arg http_proxy=http://cloud-proxy:3128 \
	--build-arg https_proxy=http://cloud-proxy:3128 \
	-f build/Dockerfile \
	--target prod-bare \
	-t "$DOCKER_TAG" \
	.

docker push "$DOCKER_TAG"

docker rmi "$DOCKER_TAG"

docker system prune -f --volumes
