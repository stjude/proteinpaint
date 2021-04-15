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
cd tmppack/client
npm install
echo -e "\nPacking the client module main ...\n"
npx rollup -c ./rollup.config.js

##########
# PACK
##########

npm pack 
