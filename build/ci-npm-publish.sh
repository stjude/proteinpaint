#!/bin/bash

# Publish latest unpublished npm packages for every changed workspace

# call from the project root (proteinpaint dir)

set -euo pipefail

WORKSPACES=""
if [[ "$1" != "" ]]; then
  WORKSPACES=$1
elif [[ -f ./build/unpublishedPkgs.txt ]]; then
  # support the recovery of interruped publish step
  WORKSPACES="$(cat ./build/unpublishedPkgs.txt)"
  rm ./build/unpublishedPkgs.txt
fi

PPDIR=$PWD
for WS in ${WORKSPACES}; do
  PRIVATE=$(node -p "require('./$WS/package.json').private")
  if [ "$PRIVATE" = true ]; then
    echo "not publishing '$WS': private package"
    continue
  fi
  PKGNAME=$(node -p "require('./$WS/package.json').name")
  PUBLISHEDVER=$(npm view $PKGNAME version | tail -n1)
  CURRENTVER=$(node -p "require('./$WS/package.json').version")
  
  echo "$WS [$PUBLISHEDVER] [$CURRENTVER]"
  if [[ "$PUBLISHEDVER" != "$CURRENTVER" ]]; then
    cd $WS
    echo "publishing $WS-$CURRENTVER"
    # npm 11 requires a tag for pre-release version, default to latest regardless of type of release
    npm publish --provenance --access public --tag latest
    cd $PPDIR
  fi
done
