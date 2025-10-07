#!/bin/bash

set -exo pipefail

#################################
# serverconfig-derived variables
#################################

if [[ ! -f serverconfig.json ]]; then
	echo "There must be a serverconfig.json in the current working directory."
	exit 1
fi

# may fill-in serverconfig defaults
node validateConfig.cjs
TPDIR=$(node -p "require('./serverconfig.json').tpmasterdir")
HOSTPORT=$(node -p "require('./serverconfig.json').URL?.split(':')[2]")
EXPOSED_PORT=3000 # forced to 3000 by server/src/serverconfig.js, previously $(node -p "require('./serverconfig.json').port || 3000")

############
# Arguments
############

# defaults
CONTAINER_NAME=pp

# overrides
if [[ "$1" != "" ]]; then IMAGE_NAME=$1; fi
if [[ "$2" != "" ]]; then CONTAINER_NAME=$2; fi

if (($# < 1)); then
	echo "Usage: $ ./dockrun.sh IMAGE_NAME [ CONTAINER_NAME \"pp\" ]

	- IMAGE_NAME: the name of the docker image that you want to run, default=$IMAGE_NAME

	- CONTAINER_NAME: the container ID to assign to the running image instance, default=$CONTAINER_NAME
	"
	exit 1
fi

echo "[$TPDIR] [$HOSTPORT:$EXPOSED_PORT] [$IMAGE_NAME] [$CONTAINER_NAME]"

#################
# Docker process
#################

# temporarily ignore bash error
set +e
# find any docker process (docker ps), either running or stopped (-a)
# with a matching name (-q, name only instead of verbose);
# if any is found (xargs -r), remove it (docker rm) even if running (-f)
echo "finding any matching container process to stop and remove ..."
docker ps -aq --filter "name=$CONTAINER_NAME" | xargs -r docker rm -f
# re-enable exit on errors
set -e

# may need to create an empty dataset/ dir for mounting
if [[ ! -d ./dataset ]]; then
	mkdir dataset
fi

# common network is needed to communicate with the blat server
sh createPPNetwork.sh

echo "Starting container process='$CONTAINER_NAME' ..."
APPDIR=$(pwd)
CONTAPP=/home/root/pp/app/active
docker run -d \
	--name $CONTAINER_NAME \
	--network pp_network \
	--mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
	--mount type=bind,source=$APPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
	--mount type=bind,source=$APPDIR/dataset,target=$CONTAPP/dataset \
	--publish $HOSTPORT:$EXPOSED_PORT \
	-e PP_MODE=container-prod \
	-e PP_PORT=$EXPOSED_PORT \
	$IMAGE_NAME

echo "^ assigned container ID ^"

./verify.sh $CONTAINER_NAME $HOSTPORT $EXPOSED_PORT
