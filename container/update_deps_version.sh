#!/bin/bash

# call from the container dir
# ./update_deps_version.sh <new_version> <Dockerfile>
# - new_version: the new deps image version to set in the Dockerfile

# Check if both the version and path are passed as arguments
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <new_version> <path_to_dockerfile>"
  exit 1
fi

NEW_VERSION=$1
DOCKERFILE=$2

# Check if the Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
  echo "Dockerfile not found at $DOCKERFILE"
  exit 1
fi

# Use sed to find and replace the VERSION in the Dockerfile
sed -i.bak "s/^ARG VERSION=.*/ARG VERSION=$NEW_VERSION/" "$DOCKERFILE"

# Provide feedback to the user
if [ $? -eq 0 ]; then
  echo "Dockerfile updated successfully. VERSION is now set to $NEW_VERSION."
else
  echo "Failed to update Dockerfile."
fi