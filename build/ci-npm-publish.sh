#!/bin/bash

# Publish latest unpublished npm packages for every changed workspace

# call from the project root

set -euo pipefail

WORKSPACES=$1

for WS in ${WORKSPACES}; do
  PRIVATE=$(node -p "require('./$WS/package.json').private")
  if [ "$PRIVATE" = true ]; then
    echo "not publishing '$WS': private package"
    continue
  fi
  PUBLISHEDVER=$(npm view @sjcrh/proteinpaint-$WS version | tail -n1)
  CURRENTVER=$(node -p "require('./$WS/package.json').version")
  echo "$WS [$PUBLISHEDVER] [$CURRENTVER]"
  if [[ "$PUBLISHEDVER" != "$CURRENTVER" ]]; then
    cd $WS
    echo "publishing $WS-$CURRENTVER"
     npm publish --access public
    cd ..
  fi
done
