#!/bin/bash

ROOTPKGVER=$(node -p "require('../../package.json').version")
SERVERPKGVER=$(node -p "require('../../server/package.json').version")
FRONTPKGVER=$(node -p "require('../../front/package.json').version")

echo "ROOTPKGVER=[$ROOTPKGVER] FRONTPKGVER=[$FRONTPKGVER] SERVERPKGVER=[$SERVERPKGVER]"

npm pkg set version=$ROOTPKGVER
npm pkg set "containerDeps.server"=$SERVERPKGVER
npm pkg set "containerDeps.front"=$FRONTPKGVER

if [[ "$MODE" == "-c" ]]; then
	echo "committing version changes"
	git add package.json
	git commit -m "dep image v$ROOTPKGVER front=$FRONTPKGVER server=$SERVERPKGVER"
	# this will trigger the CI-publish-deps-image action
fi
