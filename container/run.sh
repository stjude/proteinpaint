#!/bin/bash

set -e

#################################
# serverconfig-derived variables
#################################

if [[ ! -f serverconfig.json ]]; then
	echo "There must be a serverconfig.json in the current working directory."
	exit 1
fi

# may fill-in serverconfig defaults
node validateConfig
TPDIR=$(node -p "require('./serverconfig.json').tpmasterdir")
HOSTPORT=$(node -p "require('./serverconfig.json').URL?.split(':')[2]")
EXPOSED_PORT=$(node -p "require('./serverconfig.json').port || 3000")

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

# may need to create an empty dataset/ dir for mounting
if [[ ! -d ./dataset ]]; then 
	mkdir dataset
fi

echo "Starting container process='$CONTAINER_NAME' ..."
APPDIR=$(pwd)
CONTAPP=/home/root/pp/app/active
docker run -d \
	--name $CONTAINER_NAME \
	--mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
	--mount type=bind,source=$APPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
	--mount type=bind,source=$APPDIR/dataset,target=$CONTAPP/dataset \
	--publish $HOSTPORT:$EXPOSED_PORT \
	-e PP_MODE=container-prod \
	-e PP_PORT=$EXPOSED_PORT \
	$IMAGE_NAME

echo "^ assigned container ID ^"

##########################
# Monitor server startup
##########################

end_time=$((SECONDS+30))

ENDSTR="Validation succeeded"
echo "Waiting for server validation ..."
while true; do
	logs="$(docker logs $CONTAINER_NAME 2>&1)"
    if echo "$logs" | grep -q "$ENDSTR"; then
    	echo "$ENDSTR"
        break
    fi
    if echo "$logs" | grep -q "Error"; then
    	docker logs pp
        exit 1
    fi
    sleep 1
    if (( SECONDS >= end_time )); then
        echo "Server failed to start."
        exit 1
    fi
done

ENDSTR="STANDBY AT PORT $EXPOSED_PORT"
echo "Waiting for server startup ..."
while true; do
    if echo "$logs" | grep -q "$ENDSTR"; then
    	echo "Server started"
        break
    fi
    if echo "$logs" | grep -q "Error"; then
    	docker logs pp
        exit 1
    fi
    sleep 1
    if (( SECONDS >= end_time )); then
        echo "Server failed to start."
        exit 1
    fi
done

#######
# Test
#######

healthcheck=$(curl -sS http://localhost:$HOSTPORT/healthcheck)
numlines=$(echo "$healthcheck" | grep -c '"status":"ok"')
if [[ "$numlines" == "1" ]]; then
	echo "healthcheck ok"
else 
	echo "healthcheck not ok: $healthcheck"
	exit 1
fi

genomes=$(curl -sS http://localhost:$HOSTPORT/genomes)
numlines=$(echo "$genomes" | grep -c '"genomes":')
if [[ "$numlines" == "1" ]]; then
	echo "genomes ok"
else 
	echo "genomes not ok: $genomes"
	exit 1
fi

########
# Hints
########

echo -e "\n************************************************************************"
echo "*"
echo "* Open the ProteinPaint app at http://localhost:$HOSTPORT in you web browser"
echo "*"
echo -e "*************************************************************************"

echo -e "\nHints:"
echo "- inspect logs with 'docker logs $CONTAINER_NAME'"
echo "- ssh into the container with 'docker exec -it $CONTAINER_NAME bash'"
echo "- stop the container with 'docker stop $CONTAINER_NAME'"
echo -e "\n"
