#!/bin/bash

set -e


if (($# != 3 && $# != 4)); then
	echo "Usage: $ ./dockrun.sh SRCDIR HOSTPORT IMAGE_NAME [ CONTAINER_ID \"pp\" ]

	- SRCDIR: the serverconfig.tpmasterdir as specified in your serverconfig.json
	- HOSTPORT: the host port
	- IMAGE_NAME: the name of the docker image that you want to run
	- CONTAINER_ID: the container ID to assign to the running image instance
	"
	exit 1

elif (($# == 3)); then
	SRCDIR=$1
	HOSTPORT=$2
	IMAGE_NAME=$3
	CONTAINER_ID=${4:-pp} #defaults to 'pp' if not provided

else 
	SRCDIR=$1
	HOSTPORT=$2
	IMAGE_NAME=$3
	CONTAINER_ID=$4
fi

# docker build --file Dockerfile --tag ppbase:latest .

set +e
docker stop $CONTAINER_ID && docker rm $CONTAINER_ID
set -e

EXPOSED_PORT=3000

if [[ "$IMAGE_NAME" == *dev ]]; then 
	echo "running the dev container ..."
	cd tmppack/package/
	docker run -d \
		--name $CONTAINER_ID \
		--mount type=bind,source=$SRCDIR,target=/home/root/pp/tp,readonly \
		--mount type=bind,source=${PWD},target=/home/root/pp/app,readonly \
		--publish $HOSTPORT:$EXPOSED_PORT \
		-e PP_PORT=$EXPOSED_PORT \
		-e PP_CUSTOMER=gdc \
		-e PP_BACKEND_ONLY=false \
		$IMAGE_NAME
	cd ../..

else 
	docker run -d \
		--name $CONTAINER_ID \
		--mount type=bind,source=$SRCDIR,target=/home/root/pp/tp,readonly \
		--publish $HOSTPORT:$EXPOSED_PORT \
		-e PP_PORT=$EXPOSED_PORT \
		-e PP_CUSTOMER=gdc \
		-e PP_BACKEND_ONLY=false \
		$IMAGE_NAME

fi
