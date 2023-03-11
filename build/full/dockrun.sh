#!/bin/bash

set -e


if (($# < 3)); then
	echo "Usage: $ ./dockrun.sh SRCDIR HOSTPORT IMAGE_NAME APPDIR [ CONTAINER_ID \"pp\" ]

	- SRCDIR: the serverconfig.tpmasterdir as specified in your serverconfig.json
	- HOSTPORT: the host port
	- IMAGE_NAME: the name of the docker image that you want to run
	- APPDIR: the app directory with optional serverconfig.json, public, server/genome, and server/client directories
	- CONTAINER_ID: the container ID to assign to the running image instance
	"
	exit 1

elif (($# == 3)); then
	SRCDIR=$1
	HOSTPORT=$2
	IMAGE_NAME=$3
	APPDIR=$(pwd)
	CONTAINER_ID=pp

elif (($# == 4)); then
	SRCDIR=$1
	HOSTPORT=$2
	IMAGE_NAME=$3
	APPDIR=$4
	CONTAINER_ID=pp

else 
	SRCDIR=$1
	HOSTPORT=$2
	IMAGE_NAME=$3
	APPDIR=$4
	CONTAINER_ID=$5
fi

# docker build --file Dockerfile --tag ppbase:latest .

set +e
docker stop $CONTAINER_ID && docker rm $CONTAINER_ID
set -e

CONTAPP=/home/root/pp/app/active
EXPOSED_PORT=3000
echo "[$SRCDIR] [$HOSTPORT] [$IMAGE_NAME] [$APPDIR] [$CONTAINER_ID]"
docker run -d \
	--name $CONTAINER_ID \
	--mount type=bind,source=$SRCDIR,target=/home/root/pp/tp,readonly \
	--mount type=bind,source=$APPDIR/public,target=$CONTAPP/public \
	--mount type=bind,source=$APPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
	--publish $HOSTPORT:$EXPOSED_PORT \
	-e PP_MODE=container-prod \
	-e PP_PORT=$EXPOSED_PORT \
	$IMAGE_NAME
