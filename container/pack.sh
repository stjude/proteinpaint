#!/bin/bash

# this script:
# - will pack workspaces 
# - replace each workspace package.json's dependency versions
#   with the tarball location as copied into the Docker build

# from the proteinpaint/container dir
rm -rf tmppack
mkdir tmppack

cd ../client
echo "packing client ..."
npm pack
CLIENTPKGVER=$(node -p "require('./package.json').version")
CLIENTTGZ=sjcrh-proteinpaint-client-$CLIENTPKGVER.tgz
mv $CLIENTTGZ ../container/tmppack/

cd ../front
CLIENTDEPNAME="@sjcrh/proteinpaint-client"
# may reset the dep new version temporarily, for package testing 
npm pkg set "devDependencies.$CLIENTDEPNAME"=/home/root/pp/tmppack/$CLIENTTGZ
echo "packing front ..."
npm pack
FRONTTGZ=sjcrh-proteinpaint-front-*.tgz
mv $FRONTTGZ ../container/tmppack/
git restore package.json


cd ../rust
echo "packing rust ..."
npm pack
RUSTPKGVER=$(node -p "require('./package.json').version")
RUSTTGZ=sjcrh-proteinpaint-rust-$RUSTPKGVER.tgz
mv $RUSTTGZ ../container/tmppack/

cd ../server
RUSTDEPNAME="@sjcrh/proteinpaint-rust"
# may reset the dep new version temporarily, for package testing 
npm pkg set "dependencies.$RUSTDEPNAME"=/home/root/pp/tmppack/$RUSTTGZ
echo "packing server ..."
npm pack
SERVERTGZ=sjcrh-proteinpaint-server-*.tgz
mv $SERVERTGZ ../container/tmppack/
git restore package.json

