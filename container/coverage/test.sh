#!/bin/bash

# This script is called by generate.sh and CI-coverage.yml
# from the container/coverage dir

set -exo pipefail

# run from container/coverage dir
COVDIR=$PWD

# option to change the package script to run,
# from default combined:coverage to <COVTYPE>:coverage
COVTYPE="combined"
if (($# > 0)); then
  COVTYPE=$1 # "branch"
fi
echo "COVTYPE=[$COVTYPE]"
##############################
# RUN SERVER
##############################

# temporarily ignore bash error
set +e
# find any docker process (docker ps), either running or stopped (-a)
# with a matching name (-q, name only instead of verbose);
# if any is found (xargs -r), remove it (docker rm) even if running (-f)
echo "finding any matching container process to stop and remove ..."
docker ps -aq --filter "name=ppcov" | xargs -r docker rm -f
# re-enable exit on errors
set -e

TPDIR=$(node -p "require('./server/serverconfig.json').tpmasterdir")
APPDIR=$PWD/server
CONTAPP=/home/root/pp/app/active/server
HOSTPORT=$(node -p "require('./server/serverconfig.json').URL?.split(':')[2]")
EXPOSED_PORT=3000
IMGNAME="ppcov:latest"

docker run -d \
  --name ppcov \
  --mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
  --mount type=bind,source=$APPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
  --mount type=bind,source=$APPDIR/dataset,target=$CONTAPP/dataset \
  --publish $HOSTPORT:$EXPOSED_PORT \
  -e PP_MODE=container-prod \
  -e PP_PORT=$EXPOSED_PORT \
  $IMGNAME

# ../verify.sh ppcov $HOSTPORT $EXPOSED_PORT
sleep 12

cd $COVDIR/../../client
$XVFB npm run $COVTYPE:coverage

cd $COVDIR
# close the server to trigger c8 to generate the coverage report for server tests
curl -s http://localhost:3000/coverage/close?key=test 
# give enough time for c8 to generate report
sleep 15
docker cp ppcov:/home/root/pp/app/active/server/.coverage ./
sleep 10
exit 0
