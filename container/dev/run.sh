#!/bin/bash

#
# Run from the command line like e.g.: sh run.sh "/path/to/project/folder/"
#


if [ $# -eq 0 ]; then
  echo "Error: No host project folder argument supplied." >&2
  exit 1
fi

PROJECT_FOLDER=$1

CONTAINER_NAME="ppdev"
PORT=3000
IMAGE_NAME="ghcr.io/stjude/devcontainer:latest"


./build.sh

# temporarily ignore bash error
set +e
echo "finding any matching dev containers to stop and remove ..."
  docker ps -aq --filter "name=$CONTAINER_NAME" | xargs -r docker rm -f
# re-enable exit on errors
set -e

# common network is needed to communicate with the blat server
sh ../createPPNetwork.sh

# Check if serverconfig.json exists in the root folder, if not, copy it
if [ ! -f "$PROJECT_FOLDER"./serverconfig.json ]; then
  cp serverconfig.json "$PROJECT_FOLDER"/
fi

docker run -d \
	--name $CONTAINER_NAME \
	--network pp_network \
  --mount type=bind,source="$PROJECT_FOLDER",target=/home/root/proteinpaint/ \
	-e PORT=$PORT \
	--publish $PORT:$PORT \
	$IMAGE_NAME