#!/bin/bash

#
# Run from the command line like e.g.: sh run.sh "/Users/user/data/tp/genomes"
# The genomes directory should contain the 2bit files (hg19.2bit and hg38.2bit)  for the genomes to be served.
#

# To be able to connect the pp blat client to the blat server add the following to serverconfig.json:
#   "genomes": [
#        {
#         "name": "hg19",
#         "species": "human",
#         "file": "./genome/hg19.js",
#         "blat": {
#            "host": "blat-hg19",
#            "port": "1234",
#            "seqDir": "/home/root/pp/tp/genomes/"
#         },
#         ...
#        {
#         "name": "hg38",
#         "species": "human",
#         "file": "./genome/hg38.js",
#         "blat": {
#            "host": "blat-hg38",
#            "port": "1235",
#            "seqDir": "/home/root/pp/tp/genomes/"
#         },

if [ $# -eq 0 ]; then
  echo "Error: No host GENOME_DIR argument supplied." >&2
  exit 1
fi

GENOME_DIR=$1
CONTAINER_NAME_HG19="blat-hg19"
PORT_HG19=1234
CONTAINER_NAME_HG38="blat-hg38"
PORT_HG38=1235
IMAGE_NAME="ghcr.io/stjude/blat"

# temporarily ignore bash error
set +e
echo "finding any matching blat containers to stop and remove ..."
  docker ps -aq --filter "name=$CONTAINER_NAME_HG19" | xargs -r docker rm -f
  docker ps -aq --filter "name=$CONTAINER_NAME_HG38" | xargs -r docker rm -f
# re-enable exit on errors
set -e

# common network is needed to communicate with the blat server
sh ../createPPNetwork.sh

docker run -d \
	--name $CONTAINER_NAME_HG19 \
	--network pp_network \
	--mount type=bind,source=$GENOME_DIR,target=/home/root/blat/genomes,readonly \
	-e PORT=$PORT_HG19 \
	-e STEPSIZE=5 \
  -e HGNUM="hg19" \
	--publish $PORT_HG19:$PORT_HG19 \
	$IMAGE_NAME

docker run -d \
	--name $CONTAINER_NAME_HG38 \
	--network pp_network \
	--mount type=bind,source=$GENOME_DIR,target=/home/root/blat/genomes,readonly \
	-e PORT=$PORT_HG38 \
	-e STEPSIZE=5 \
  -e HGNUM="hg38" \
	--publish $PORT_HG38:$PORT_HG38 \
	$IMAGE_NAME