#!/bin/bash

set -e

###########################
# Create a clean workspace
###########################

rm -rf tmppack
mkdir tmppack
tar -xf archive.tar -C tmppack/

cd tmppack
npm run reset

###########################
# Bundle the server code
###########################

cd server
echo -e "\nCreating the server bundle\n"
npx webpack --config=webpack.config.js --env.devtool=cheap-source-map

##################################
# *** TEST ***
# Create a serverconfig.json file 
# and public/ dir for testing only
##################################

cd ..
echo -e $(./targets/gdc/createServerConfig.js) > serverconfig.json

# kill any matching unterminated server process 
# from an incomplete packing process
set e
if pgrep "server/bin.js"; then pkill -f "server/bin.js"; fi
set -e

# the server must be running during the test
echo "Starting the server for testing ..."
nohup sh -c "PP_CUSTOMER=gdc node server/bin.js" > output.log &

# the GDC serverconfig is backend-only by default,
# need to wait to make sure that the server startup
# will not delete a newly created "public/" directory 
sleep 3
mkdir -p public/bin

cd client
# test before budling the client code
echo "Running GDC-PP React Wrapper tests ..."
npm run gdc
pkill -f "server/bin.js"

#####################################
# Bundle the client code (ES modules)
#####################################

echo -e "\nPacking the client module main ...\n"
rm -rf dist
npx rollup -c ./rollup.config.js

cd ..
