#!/bin/bash

set -e

###############
# ARGUMENTS
###############

if (($# == 0)); then
	REV="HEAD"
else
	REV=$1
fi

#############################
# EXTRACT FROM COMMIT
#############################

./build/tmp.sh $REV
cd tmppack/server
npm install
npx webpack --config=webpack.config.js

##########
# PACK
##########

npm pack 
