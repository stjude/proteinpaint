#!/bin/bash

# Publish latest unpublished npm packages for every changed workspace

# call from the project root

set -e

WORKSPACES="rust server client front"

for WS in ${WORKSPACES}; do
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
