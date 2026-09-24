#!/bin/bash

# Publish latest unpublished npm packages for every changed workspace

# call from the project root (proteinpaint dir)

set -euo pipefail

WORKSPACES=""
if (( "$#" > 0 )); then
	WORKSPACES="$1"
fi

if [[ -f ./build/unpublishedPkgs.txt ]]; then
  # support the recovery of interruped publish step,
  # /build/bump.cjs may generate ./build/unpublishedPkgs.txt if applicable
  WORKSPACES="$WORKSPACES $(cat ./build/unpublishedPkgs.txt)"
  rm ./build/unpublishedPkgs.txt
fi

# ensure that shared for any updated workspace that needs
# to bundle it when packing
cd shared/types
npm run prepack
cd ../utils
npm run build
cd ../..

PPDIR=$PWD
PUBLISHED=""
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
    PUBLISHED="$PUBLISHED $PKGNAME@$CURRENTVER"
    cd $PPDIR
  fi
done

# The npm registry may take a while before a newly published version is visible
# to installers. Wait until every published package version can be resolved, so that
# downstream jobs (such as the docker image build's `npm install`) do not fail.
MAX_ATTEMPTS=30
WAIT_SECONDS=10
for PKGVER in ${PUBLISHED}; do
  ATTEMPT=1
  # --prefer-online bypasses the local npm cache to query the registry directly
  until [[ "$(npm view "$PKGVER" version --prefer-online 2>/dev/null | tail -n1)" == "${PKGVER##*@}" ]]; do
    if (( ATTEMPT >= MAX_ATTEMPTS )); then
      echo "timed out waiting for $PKGVER to be visible in the npm registry"
      exit 1
    fi
    echo "waiting for $PKGVER to be visible in the npm registry (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    ATTEMPT=$((ATTEMPT + 1))
    sleep $WAIT_SECONDS
  done
  echo "verified $PKGVER is visible in the npm registry"
done

if [[ "$PUBLISHED" != "" ]]; then
  # extra buffer for registry CDN edges that may lag behind the one queried above
  echo "waiting 60s for the npm registry CDN to propagate the published packages"
  sleep 60
fi
