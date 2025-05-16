#!/bin/bash

# Run from the command line like e.g.: sh run.sh "/path/to/binaries/"

if [ $# -eq 0 ]; then
  echo "Error: No binaries folder argument supplied." >&2
  exit 1
fi

BINARIES_FOLDER=$1
CONTAINER_NAME="rust-local-build"
IMAGE_NAME="rust-local-build:latest"

# Temporarily ignore bash error
set +e
echo "Finding any matching rust-local-build containers to stop and remove ..."
docker ps -aq --filter "name=$CONTAINER_NAME" | xargs -r docker rm -f
set -e

# Start container
docker run -d \
  --name $CONTAINER_NAME \
  $IMAGE_NAME

# Delete and recreate ../rust-binaries
echo "Cleaning up ../rust-binaries ..."
rm -rf ../rust-binaries
mkdir -p ../rust-binaries

# Wait a bit to make sure the container is fully running (optional)
sleep 2

# Copy binaries from the container to ../rust-binaries
echo "Copying binaries from container..."
docker cp "$CONTAINER_NAME:/home/root/rust/target/release/." ../rust-binaries

echo "Done. Binaries copied to ../rust-binaries"
