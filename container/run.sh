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

echo "[$TPDIR] [$HOSTPORT] [$IMAGE_NAME] [$CONTAINER_NAME]"

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

echo "Starting container process='$CONTAINER_NAME' ..."
APPDIR=$(pwd)
CONTAPP=/home/root/pp/app/active
docker run -d \
	--name $CONTAINER_NAME \
	--mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
	--mount type=bind,source=$APPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
	--publish $HOSTPORT:$EXPOSED_PORT \
	-e PP_MODE=container-prod \
	-e PP_PORT=$EXPOSED_PORT \
	$IMAGE_NAME

echo "^ assigned container ID ^"

container_id=$(docker ps -q -f name=pp)
end_time=$((SECONDS+30))

echo "Waiting for 'STANDBY AT PORT $HOSTPORT' in container logs..."
while true; do
    if docker logs $container_id 2>&1 | grep -q "STANDBY AT PORT $HOSTPORT"; then
        echo "Server is listening on port $HOSTPORT"
        sleep 2 # wait for server cache and APIs  to warm up
        break
    fi
    sleep 1
    if (( SECONDS >= end_time )); then
        echo "Server failed to start."
        exit 0
    fi
done

docker logs pp > pp.log
echo "Container logs:"
cat pp.log
