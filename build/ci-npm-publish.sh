#!/bin/bash

# Publish latest unpublished npm packages for every changed workspace

# call from the project root (proteinpaint dir)

set -euo pipefail

WORKSPACES=$1
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
    npm publish --provenance --access public
    cd $PPDIR
  fi
done
