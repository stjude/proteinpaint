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
cd tmppack/client
npm install
echo -e "\nPacking the client module main ...\n"
npx rollup -c ./rollup.config.js
sed -i.bak 's%proteinpaint-client%proteinpaint%' package.json

##########
# PACK
##########

npm pack 
