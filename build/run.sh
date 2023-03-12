#!/bin/bash

set -e

#################################
# serverconfig-derived variables
#################################

if [[ ! -f serverconfig.json ]]; then
	echo "There must be a serverconfig.json in the current working directory."
	exit 1
fi

TPDIR=$(node -p "require('./serverconfig.json').tpmasterdir")
if [[ "$TPDIR" == "" ]]; then
	echo "There must be a serverconfig.tpmasterdir entry."
	exit 1
fi

HOSTPORT=$(node -p "require('./serverconfig.json').url?.split(':')[2]")
if [[ "$HOSTPORT" == "" || "$HOSTPORT" == "undefined" ]]; then
	echo "There must be a serverconfig.url entry with a :port number."
	exit 1
fi

EXPOSED_PORT=$(node -p "require('./serverconfig.json').port || 3000")
if [[ "$EXPOSED_PORT" == "" ]]; then EXPOSED_PORT=3000; fi

############
# Arguments
############

# defaults
CONTAINER_ID=pp

# overrides
if [[ "$1" != "" ]]; then IMAGE_NAME=$1; fi
if [[ "$2" != "" ]]; then CONTAINER_ID=$2; fi

if (($# < 1)); then
	echo "Usage: $ ./dockrun.sh IMAGE_NAME [ CONTAINER_ID \"pp\" ]

	- IMAGE_NAME: the name of the docker image that you want to run, default=$IMAGE_NAME

	- CONTAINER_ID: the container ID to assign to the running image instance, default=$CONTAINER_ID
	"
	exit 1
fi

echo "[$TPDIR] [$HOSTPORT] [$IMAGE_NAME] [$CONTAINER_ID]"

#################
# Docker process
#################

set +e
docker stop $CONTAINER_ID && docker rm $CONTAINER_ID
set -e

APPDIR=$(pwd)
CONTAPP=/home/root/pp/app/active

if [[ "$IMAGE_NAME" == ppserver* ]]; then
	docker run -d \
		--name $CONTAINER_ID \
		--mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
		--mount type=bind,source=$APPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
		--publish $HOSTPORT:$EXPOSED_PORT \
		-e PP_MODE=container-prod \
		-e PP_PORT=$EXPOSED_PORT \
		$IMAGE_NAME

else 
	docker run -d \
		--name $CONTAINER_ID \
		--mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
		--mount type=bind,source=$APPDIR/public,target=$CONTAPP/public \
		--mount type=bind,source=$APPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
		--publish $HOSTPORT:$EXPOSED_PORT \
		-e PP_MODE=container-prod \
		-e PP_PORT=$EXPOSED_PORT \
		$IMAGE_NAME

fi
