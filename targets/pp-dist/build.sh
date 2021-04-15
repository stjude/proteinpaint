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
cd tmppack
npm run reset
cd server
echo -e "\nCreating the server bundle\n"
npx webpack --config=webpack.config.js

cd ../client
echo -e "\nBundling the client browser bin ...\n"
npx webpack --config=webpack.config.js --env.url="__PP_URL__"
echo -e "\nPacking the client module main ...\n"
npx rollup -c ./rollup.config.js
sed -i.bak 's%proteinpaint-client%proteinpaint%' package.json

##########
# PACK
##########

cd ..
rm package.json
./targets/pp-dist/editpkgjson.js > package.json
npm pack 
