#!/bin/bash

set -e


if (($# != 3 && $# != 4)); then
	echo "Usage: $ ./restart.sh SRCDIR SRCPORT IMAGE_NAME [ CONTAINER_ID \"pp\" ]

	- SRCDIR: the serverconfig.tpmasterdir as specified in your serverconfig.json
	- SRCPORT: the host port
	- IMAGE_NAME: the name of the docker image that you want to run
	- CONTAINER_ID: the container ID to assign to the running image instance
	"
	exit 1

elif (($# == 3)); then
	SRCDIR=$1
	SRCPORT=$2
	IMAGE_NAME=$3
	CONTAINER_ID=pp

else 
	SRCDIR=$1
	SRCPORT=$2
	IMAGE_NAME=$3
	CONTAINER_ID=$4
fi

# docker build --file Dockerfile --tag ppbase:latest .

set +e
docker stop pp && docker rm pp
set -e

docker run -d \
	--name $CONTAINER_ID \
	--mount type=bind,source=$SRCDIR,target=/home/root/pp/tp,readonly \
	--publish $SRCPORT:3456 \
	$IMAGE_NAME

# docker attach $CONTAINER_ID
