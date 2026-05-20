#!/bin/bash

#
# Run from the command line like e.g.: sh run.sh "/path/to/aihisto/"
# I think it should be more clear about how to change your serverconfig and that symlinks wont work for this
#


if [ $# -eq 0 ]; then
	echo "Error: No host data root argument supplied." >&2
  exit 1
fi

TP=$1
CONTAINER_NAME="tile-server"
PORT=5000
IMAGE_NAME="ghcr.io/stjude/tile-server"
CONTAINER_MOUNT="/home/root/tileserver/tp"

# temporarily ignore bash error
set +e
echo "finding any matching tileserver containers to stop and remove ..."
  docker ps -aq --filter "name=$CONTAINER_NAME" | xargs -r docker rm -f
# re-enable exit on errors
set -e

sh ../createPPNetwork.sh
# theeres a problem that the container and the machine makes inquiries about aihisto data, but the container is looking in this "/home/root/tileserver/tp" path 
# (side note I dont think you want tp bu actually aihisto data path) and the machine wants to look in the "/Users/jsimps98/data/aihisto" path, but both seem to be  using the mount path from serverconfig.
#Theres also a problem that data and model are put up by symlnks so when the links are mounted they point to data thats not actually there, so the overlays dont show up
# I think there are 3 solutions
# 1. have two variables in serverconfig for host and container paths 
# 2. mount the data path with the same path as the host files including real ppaihal data (probably the simplest)
# 3. use this translate path function in app.py from copilot (seems fragile)
docker run -d \
	--name $CONTAINER_NAME \
	--network pp_network \
	--mount type=bind,source=$TP,target=$TP,readonly \
	--mount type=bind,source=/Users/jsimps98/dev/sjpp/ppaihal/data,target=/Users/jsimps98/dev/sjpp/ppaihal/data,readonly \
	--mount type=bind,source=/Users/jsimps98/dev/sjpp/ppaihal/model,target=/Users/jsimps98/dev/sjpp/ppaihal/model,readonly \
	-e PORT=$PORT \
	-e TILESERVER_HOST_MOUNT=$TP \
	-e TILESERVER_CONTAINER_MOUNT=$CONTAINER_MOUNT \
	--memory="4g" \
	 --cpus="1" \
	--publish $PORT:$PORT \
	$IMAGE_NAME