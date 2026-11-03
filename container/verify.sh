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
echo "[$CONTAINER_NAME][$HOSTPORT][$EXPOSED_PORT]"
##########################
# Monitor server startup
##########################

end_time=$((SECONDS+480))

ENDSTR="Validation succeeded"
echo "Waiting for server validation ..."
NUMLINES=0
while true; do
  # checked first, so that the wait also ends when there are no new log lines
  if (( SECONDS >= end_time )); then
    echo "Validation timed out"
    exit 1
  fi

  LOGS="$(docker logs $CONTAINER_NAME 2>&1)"
  # the log lines are printed and matched as is, not with echo -e, which would stop at a \c in a line,
  # such as in a test name, and hide the rest of the lines, including the ENDSTR line
  LINECOUNT=$(printf '%s' "$LOGS" | grep -c "^" || true)
  if [[ "$LOGS" == "" ]] || (( LINECOUNT == NUMLINES )); then
    sleep 1
    continue
  fi

  NEWLOGS=$(printf '%s\n' "$LOGS" | tail -n$(( LINECOUNT - NUMLINES )))
  printf '%s\n' "$NEWLOGS"
  NUMLINES=$LINECOUNT

  if grep -q "$ENDSTR" <<< "$NEWLOGS"; then
    break
  fi
  if grep -q "Error" <<< "$NEWLOGS"; then
  	# ppcov runs tests where Error messages may be displayed and should not stop the container
    if [[ "$CONTAINER_NAME" != "ppcov" ]]; then
      exit 1
    fi
  fi
  sleep 1
done

ENDSTR="STANDBY AT PORT ${EXPOSED_PORT}" # the port is forced to 3000 inside the container by server/src/serverconfig.js
echo "Waiting for server startup ..."
while true; do
  if docker logs $CONTAINER_NAME 2>&1 | grep -q "$ENDSTR"; then
  	echo "Server started"
      break
  fi
  if docker logs $CONTAINER_NAME 2>&1 | grep -q "Error"; then
  	docker logs $CONTAINER_NAME
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
