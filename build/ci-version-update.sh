#!/bin/bash

# Synchronize the version bumps on changed workspaces and related portals,
# using human readable semantic version numbers instead of commit hashes

# call from the project root

###############
# ARGUMENTS
###############

set -euxo pipefail

VERTYPE=prerelease # default
NOTES=$(node ./build/changeLogGenerator.js -u)
if [[ "$NOTES" == *"Features:"* ]]; then
  VERTYPE=minor
elif [[ "$NOTES" == *"Fixes:"* ]]; then
  VERTYPE=patch
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$VERTYPE" != "pre"* && "$BRANCH" != "publish-"* && "$BRANCH" != "release-chain"* && "$BRANCH" != "master" ]]; then
  VERTYPE="pre$VERTYPE"
fi

##########
# CONTEXT
##########

UPDATED=$(./build/bump.js $VERTYPE "$@")
if [[ "$UPDATED" == "" ]]; then
  echo "No workspace package updates, exiting script with code 1"
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
if [[ $UPDATED == *"rust"* ]]; then
  cd rust
  npm pkg set "pp_release_tag"="v$VERSION"
  cd ..
fi

########################
# Update the change log
########################

if [[ "$VERTYPE" != "pre"* ]]; then
  if [[ "$(grep 'Unreleased' CHANGELOG.md)" == "" ]]; then
    echo "No unreleased changes to publish"
    exit 1
  fi

  # only update the change log if the version type is not prepatch, preminor, prerelease, pre*
  sed -i.bak "s|Unreleased|$VERSION|" CHANGELOG.md
fi

#################
# COMMIT CHANGES
#################

npm i --package-lock-only
TAG="v$VERSION"
COMMITMSG="$TAG $UPDATED"
echo "$COMMITMSG"
echo "committing version change ..."
git config --global user.email "PPTeam@STJUDE.ORG"
git config --global user.name "PPTeam CI"
git add --all
git commit -m "$COMMITMSG"
echo "VERTYPE=[$VERTYPE]"

EXISTINGTAG=$(git tag -l "$TAG")
if [[ "$VERTYPE" == "pre"* ]]; then
  # delete existing tags that match
  if [[ "$EXISTINGTAG" != "" ]]; then
    git tag -d $TAG
  fi
  git pull --rebase
  git push origin :refs/tags/$TAG
elif [[ "$EXISTINGTAG" != "" ]]; then
  echo "Tag='$TAG' already exists"
  exit 1
fi

git tag $TAG
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git pull --rebase
git push origin $BRANCH
git push origin $TAG
