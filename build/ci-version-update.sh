#!/bin/bash

# Synchronize the version bumps on changed workspaces and related portals,
# using human readable semantic version numbers instead of commit hashes

# call from the project root

###############
# ARGUMENTS
###############

set -euxo pipefail

if [[ "$1" == "" ]]; then
  echo "missing the version type value"
  exit 1
fi

##########
# CONTEXT
##########

UPDATED=$(./build/bump.js "$@")
if [[ "$UPDATED" == "" ]]; then
  echo "No workspace package updates, exiting script with code 1"
  exit 1
fi


########################
# Update the change log
########################

VERSION="$(node -p "require('./package.json').version")"
if [[ "$(grep 'Unreleased' CHANGELOG.md)" == "" ]]; then
  echo "No unreleased changes to publish"
  exit 1
fi
sed -i.bak "s|Unreleased|$VERSION|" CHANGELOG.md

#################
# COMMIT CHANGES
#################

npm i --package-lock-only
TAG="v$VERSION"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "release" || "$BRANCH" == "stage" ]]; then
  HASH=$(git rev-parse --short HEAD)
  TAG="$TAG-$HASH"
fi
COMMITMSG="$TAG $UPDATED"
echo "$COMMITMSG"
echo "committing version change ..."
git config --global user.email "PPTeam@STJUDE.ORG"
git config --global user.name "PPTeam CI"
git add --all
git commit -m "$COMMITMSG"
git tag $TAG
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin $BRANCH
git push origin $TAG
