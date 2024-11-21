#!/bin/bash

set -e

if (( $# < 3 )); then
  echo "Missing arguments"
  echo "Usage: ./verify.sh CONTAINER_NAME HOSTPORT EXPOSED_PORT"
  exit 1
fi

CONTAINER_NAME=$1
HOSTPORT=$2
EXPOSED_PORT=$3

##########################
# Monitor server startup
##########################

end_time=$((SECONDS+480))

ENDSTR="Validation succeeded"
echo "Waiting for server validation ..."
while true; do
  if docker logs $CONTAINER_NAME 2>&1 | grep -q "$ENDSTR"; then
  	echo "$ENDSTR"
    break
  fi
  if docker logs $CONTAINER_NAME 2>&1 | grep -q "Error"; then
  	docker logs pp
    exit 1
  fi
  sleep 1
  if (( SECONDS >= end_time )); then
    echo "Validation timed out"
    exit 1
  fi
done

ENDSTR="STANDBY AT PORT 3000" # the port is forced to 3000 inside the container by server/src/serverconfig.js
echo "Waiting for server startup ..."
while true; do
  if docker logs $CONTAINER_NAME 2>&1 | grep -q "$ENDSTR"; then
  	echo "Server started"
      break
  fi
  if docker logs $CONTAINER_NAME 2>&1 | grep -q "Error"; then
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
