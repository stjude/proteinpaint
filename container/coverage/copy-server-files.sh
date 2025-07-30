#!/bin/bash

# This script is called by generate.sh and CI-coverage.yml
# from the container/coverage dir

set -exo pipefail

##############################
# COPY SOURCE CODE, ARTIFACTS
##############################

rm -rf python
mkdir python
cp -r ../../python python/

rm -rf server
mkdir server

# will use the ppserver:latest @sjcrh/proteinpaint-server/package.json,
# which has the applicable abs path to packed tgz for updated workspaces 
# cp -r ../../server/package.json server/
cp -r ../../server/coverage.js server/
cp -r ../ci/serverconfig.json server/
cp -r ../../server/emitImports.js server/
cp -r ../../server/routes server/
cp -r ../../server/src server/
cp -r ../../server/test server/
cp -r ../../server/utils server/
cp ../../test/evalAllSpecCovResults.mjs server/test/

mkdir server/genome
cp -r ../../server/genome/copyDataFilesFromRepo2Tp.js server/genome
cp -r ../../server/genome/*.ts server/genome
npx esbuild "server/genome/*.ts" --platform=node --outdir=server/genome --format=esm
mkdir server/dataset
cp -r ../../server/dataset/*.ts server/dataset
npx esbuild "server/dataset/*.ts" --platform=node --outdir=server/dataset --format=esm

serverParentDir=/home/runner/work/proteinpaint/proteinpaint
if [[ ! -d "$serverParentDir" ]]; then
  sed -i.bak "s|$serverParentDir\/|$PWD\/|g" server/serverconfig.json
fi
