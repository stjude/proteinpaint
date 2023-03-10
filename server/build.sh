#!/bin/bash

set -e

###############
# ARGUMENTS
###############

if (($# == 0)); then
	REV="latest"
else
	REV=$1
fi

#############################
# EXTRACT FROM COMMIT
#############################

./build/extract.sh $REV
cd tmppack/server
npm install
npx webpack --config=webpack.config.js

##########
# PACK
##########

npm pack 
