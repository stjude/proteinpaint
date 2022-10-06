#!/bin/bash

# the canonical host domain is set in your ~/.ssh/config
REMOTEHOST=$1
TGZ=$2
REMOTEDIR=/opt/data/pp/packages

echo "packing the server package ..."
npm pack

# !!! TODO: will not need this when an npm-compatible registry becomes available !!!
echo "deploying $TGZ to $REMOTEHOST ..."
# the default user for the canonical domain is set in your ~/.ssh/config
scp $TGZ $REMOTEHOST:$REMOTEDIR
