#!/bin/bash

#################################
# USE ONLY IN DOCKER CONTAINER
################################

set -e

##################################
# *** TEST ***
# Create a serverconfig.json file 
# and public/ dir for testing only
##################################

echo -e $(./targets/gdc/createServerConfig.js) > serverconfig.json

SCRIPT=server/src/test/gdc-cached-data.server.js

# kill any matching unterminated server process 
# from an incomplete packing process
set e
if pgrep "$SCRIPT"; then pkill -f "$SCRIPT"; fi
set -e

# the server must be running during the test INSIDE A CONTAINER
echo "Starting the server for testing ..."
nohup sh -c "PP_CUSTOMER=gdc PP=container-test node $SCRIPT" > output.log &

# the GDC serverconfig is backend-only by default,
# need to wait to make sure that the server startup
# will not delete a newly created "public/" directory 
sleep 3
mkdir -p public/bin

cd client
# test before bundling the client code
echo "Running GDC-PP React Wrapper tests ..."
Xvfb -ac -screen scrn 1280x2000x24 :9.0 -nolisten unix & export DISPLAY=:9.0
npm run gdc -- --no-sandbox
pkill -f "$SCRIPT" &> /dev/null

