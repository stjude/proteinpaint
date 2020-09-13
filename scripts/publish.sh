#!/bin/bash

set -e

# 
# Intended as a postversion hook when calling `npm version`
# or run as `$ ./scripts/publish.sh`
# 
# This runs a build from a clean work space to ensure that
# all published artifacts are traceable to a git commit.
#

#######################
# EXTRACT FROM COMMIT
#######################

# get commit sha1
REV=$(git rev-parse --short HEAD)
rm -Rf tmppack 
mkdir tmppack # temporary workspace
git archive HEAD | tar -x -C tmppack/
cp package.json tmppack/
cd tmppack
echo "$(git rev-parse HEAD) $(date)" > public/rev.txt

# save some time by reusing parent folder's node_modules
# but making sure to update to the committed package.json
ln -s ../node_modules node_modules
# npm update

########
# BUILD
########

# create webpack bundles
echo "Packing the server bundle ..."
npm run build-server
echo "Packing the client bundle ..."
npx webpack --config=scripts/webpack.config.build.js --env.subdomain=""


#######################
# PUBLISH TO REGISTRY
#######################

echo "Delivering the package ..."

npm publish # --dry-run # to jsut displayed what would have been published
# - OR -
# npm pack # to create just the tar without publishing to registry

cd ..
rm -r tmppack
