#!/bin/bash

# Publish latest unpublished npm packages for every changed workspace

# call from the project root (proteinpaint dir)

set -euo pipefail

WORKSPACES=""

if (( "$#" > 0 )); then
  WORKSPACES=$1
elif [[ -f ./build/unpublishedPkgs.txt ]]; then
  # support the recovery of interruped publish step,
  # /build/bump.cjs may generate ./build/unpublishedPkgs.txt if applicable
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
  CURRENTVER=$(node -p "require('./$WS/package.json').version")
  PUBLISHEDVER=""
  if (( "$#" > 0 )); then
    # when there is an argument, it means ./build/unpublishedPkgs.txt was not used,
    # so the registry's latest published version has not been checked yet in this runtime
    # by ./build/bump.cjs
    PUBLISHEDVER=$(npm view $PKGNAME version | tail -n1)
  fi
  
  echo "$WS [$PUBLISHEDVER] [$CURRENTVER]"
  if [[ "$PUBLISHEDVER" != "$CURRENTVER" ]]; then
    cd $WS
    echo "publishing $WS-$CURRENTVER"
    # npm 11 requires a tag for pre-release version, default to latest regardless of type of release
    npm publish --provenance --access public --tag latest
    cd $PPDIR
  fi
done
