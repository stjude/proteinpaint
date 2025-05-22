#!/bin/bash

# Synchronize the version bumps on changed workspaces and related portals,
# using human readable semantic version numbers instead of commit hashes

# call from the project root

###############
# ARGUMENTS
###############

set -euxo pipefail

VERTYPE=prerelease # default
if [[ "$1" == "pre"* ]]; then
  # respect user-selected prerelease, prepatch, preminor, premajor
  VERTYPE=$1
else
  # non pre* version type will be ignored, instead auto-detect 
  # the version type based on unreleased changelog entries 
  NOTES=$(node ./build/changeLogGenerator.js -u)
  if [[ "$NOTES" == *"Features:"* ]]; then
    VERTYPE=minor
  elif [[ "$NOTES" == *"Fixes:"* ]]; then
    VERTYPE=patch
  # else # devops, docs changelog defaults to prerelease 
  #   VERTYPE=prerelease
  fi
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$VERTYPE" != "pre"* && "$BRANCH" != "publish-"* && "$BRANCH" != "release"* && "$BRANCH" != "prerelease"* && "$BRANCH" != "master" ]]; then
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
git pull --merge
git push origin $BRANCH
git push origin $TAG
