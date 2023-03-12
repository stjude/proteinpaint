#!/bin/bash

set -e

IMAGE_NAME=ppfull:latest
CONTAINER_ID=pp

# overrides
if [[ "$1" != "" ]]; then IMAGE_NAME=$2; fi
if [[ "$2" != "" ]]; then CONTAINER_ID=$2; fi

../run.sh $IMAGE_NAME $CONTAINER_ID
