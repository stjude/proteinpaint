#!/bin/bash

set -e

mkdir server
mkdir client
mkdir shared
mkdir targets 

mkdir server/src
mv modules/* server/src/
mv genome server/
mv dataset server/
mv utils server/
mv app server/src/app
cp serverconfig.json server/

mkdir shared/src
mv src/common.js shared/src
mv src/mds.termdb.termvaluesetting.js shared/src
mv src/tree.js shared/src
mv src/vcf.js shared/src
mv src/bulk.* shared/src
mv server/src/termdb.bins.js shared/src
mv server/src/filter.js shared/src
# move back
mv shared/src/bulk.project* src/
mv shared/src/bulk.ui* src/

mv src client/src 


mkdir targets/sj
mkdir targets/gdc
mkdir targets/pp-dist
