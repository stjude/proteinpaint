#!/bin/bash

# This script is called by generate.sh from the container/coverage dir

set -exo pipefail

##############################
# ARGUMENTS
##############################

USAGE="Usage:
  ./build.sh [-x] [-z]

  -x XVFB: use xvfb-run when running browser tests
  -z USETGZ: use local tarballs for the server package
"

USETGZ=""
XVFB=""

# may skip if there are no updates to augen, shared, and rust workspaces,
# or if those have already been packed and built into latest ppserver:image
while getopts "zxh" opt; do
  case "${opt}" in
  x) 
    XVFB="xvfb-run --auto-servernum"
    ;;
  z)
    # install proteinpaint-* builds from tarballs, not published packages
    USETGZ=true
    ;;
  h)
    echo "$USAGE"
    exit 1
    ;;
  *)
    echo "Unrecognized parameter"
    echo -e "\n\n$USAGE\n\n"
    exit 1
    ;;
  esac
done

# run from container/coverage dir
COVDIR=$PWD

##################################
# CREATE UP-TO-DATE ppserver image
##################################

if [[ "$USETGZ" == "true" ]]; then
  cd ..
  ./pack.sh
  ./build2.sh -z server
  cd $COVDIR
fi


##############################
# BUILD IMAGE
##############################

PLATFORM=""
ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then 
  # in Apple Silicon machines, need to emulate x86 platform of the base image, 
  # otherwise this error comes up: `no match for platform in manifest: not found`
  PLATFORM="--platform=linux/amd64"
fi

IMGNAME="ppcov:latest"

docker buildx build . \
  --file ./Dockerfile \
  --tag $IMGNAME $PLATFORM \
  --output type=docker
