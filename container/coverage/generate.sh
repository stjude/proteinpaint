#!/bin/bash

set -exo pipefail

##############################
# COPY SOURCE CODE, ARTIFACTS
##############################

COVDIR=$PWD

rm -rf server
mkdir server

cp -r ../../server/coverage.js server/
cp -r ../ci/serverconfig.json server/
cp -r ../../server/package.json server/
cp -r ../../server/emitImports.js server/
cp -r ../../server/routes server/
cp -r ../../server/src server/
cp -r ../../server/test server/
cp -r ../../server/utils server/

mkdir server/genome
cp -r ../../server/genome/*.ts server/genome
npx esbuild "server/genome/*.ts" --platform=node --outdir=server/genome --format=esm
mkdir server/dataset
cp -r ../../server/dataset/*.ts server/dataset
npx esbuild "server/dataset/*.ts" --platform=node --outdir=server/dataset --format=esm

serverParentDir=/home/runner/work/proteinpaint/proteinpaint
if [[ ! -d "$serverParentDir" ]]; then
  sed -i.bak "s|$serverParentDir\/|$PWD\/|g" server/serverconfig.json
fi

cd ../../augen
rm sjcrh-augen*
npm pack
mv sjcrh-augen*.tgz sjcrh-augen.tgz
cp sjcrh-augen* ../container/coverage/server/
cd $COVDIR/server
npm pkg set dependencies."@sjcrh/augen"=/home/root/pp/app/active/server/sjcrh-augen.tgz
sed -i.bak "s|coverage.js & |coverage.js|g" package.json
cd $COVDIR

# TODO: copy rust code/build if applicable

##############################
# BUILD IMAGE
##############################

PLATFORM=""
# ARCH=$( uname -m )
if [[ ${ARCH} == "arm64" ]]; then 
  # ARCH="aarch64";
  PLATFORM="--platform=linux/arm64"
fi

IMGNAME="ppcov:latest"

docker buildx build . \
  --file ./Dockerfile \
  --tag $IMGNAME $PLATFORM \
  --output type=docker


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

docker run -d \
  --name ppcov \
  --network pp_network \
  --mount type=bind,source=$TPDIR,target=/home/root/pp/tp,readonly \
  --mount type=bind,source=$APPDIR/serverconfig.json,target=$CONTAPP/serverconfig.json \
  --mount type=bind,source=$APPDIR/dataset,target=$CONTAPP/dataset \
  --publish $HOSTPORT:$EXPOSED_PORT \
  -e PP_MODE=container-prod \
  -e PP_PORT=$EXPOSED_PORT \
  $IMGNAME

sleep 12
cd $COVDIR/../../client
npm run combined:coverage

cd $COVDIR
# close the server to trigger c8 to generate the coverage report 
curl http://localhost:3000/closeCoverage?key=test 
# give enough time for c8 to generate report
sleep 15
docker cp ppcov:/home/root/pp/app/active/server/.coverage ./
# give enough time for the subsequent server instance to listen
sleep 10
# close the subsequent non-test/non-coverage server,
# so that the container process will stop
curl -s http://localhost:3000/closeCoverage?key=test
