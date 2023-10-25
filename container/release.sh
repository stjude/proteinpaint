#!/bin/bash

# call from the container dir
# ./publish.sh [-w]
# -w  option to commit changes

MODE="$1"
HASH="$(git rev-parse --short HEAD)"

./version.sh server
if [[ "$MODE" == "-w" ]]; then
  ./build2.sh -r "ghcr.io/stjude/" server
  TAG="$(node -p "require('./server/package.json').version")"  
  docker push ghcr.io/stjude/ppserver:$TAG-$HASH
  docker push ghcr.io/stjude/ppserver:latest
fi

./version.sh full
if [[ "$MODE" == "-w" ]]; then
  ./build2.sh -r "ghcr.io/stjude/" full
  TAG="$(node -p "require('./full/package.json').version")"
  docker push ghcr.io/stjude/ppfull:$TAG-$HASH
  docker push ghcr.io/stjude/ppfull:latest
fi

if [[ "$MODE" == "-w" ]]; then
  echo "committing version changes"
  git config --global user.email "PPTeam@STJUDE.ORG"
  git config --global user.name "PPTeam CI"
  git add --all
  ROOTPKGVER=$(node -p "require('../package.json').version")
  SERVERPKGVER=$(node -p "require('../server/package.json').version")
  FRONTPKGVER=$(node -p "require('../front/package.json').version")
  git commit -m "image v$ROOTPKGVER server=$SERVERPKGVER front=$FRONTPKGVER"
  git push
fi