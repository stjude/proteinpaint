#!/bin/bash

#
# Run from the command line like e.g.: sh run.sh "/path/to/tp/"
#


if [ $# -eq 0 ]; then
  echo "Error: No host tp argument supplied." >&2
  exit 1
fi

TP=$1
CONTAINER_NAME="tile-server"
PORT=5000
IMAGE_NAME="ghcr.io/stjude/tile-server"

# temporarily ignore bash error
set +e
echo "finding any matching blat containers to stop and remove ..."
  docker ps -aq --filter "name=$CONTAINER_NAME" | xargs -r docker rm -f
# re-enable exit on errors
set -e

# common network is needed to communicate with the blat server
sh ../createPPNetwork.sh

docker run -d \
	--name $CONTAINER_NAME \
	--network pp_network \
	--mount type=bind,source=$TP,target=/home/root/tileserver/tp,readonly \
	-e PORT=$PORT \
	--memory="4g" \
	 --cpus="1" \
	--publish $PORT:$PORT \
	$IMAGE_NAME