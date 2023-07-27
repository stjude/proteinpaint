#!/bin/bash

# Synchronize the version bumps on changed workspaces and related portals,
# using human readable semantic version numbers instead of commit hashes

# call from the project root

###############
# ARGUMENTS
###############

set -euxo pipefail

# see the allowed version types in https://docs.npmjs.com/cli/v8/commands/npm-version
# e.g., <newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git
TYPE=prerelease
if [[ "$1" != "" ]]; then
  TYPE=$1
fi

##########
# CONTEXT
##########

UPDATED=$(./build/jump.js "$@")
if [[ "UPDATED" == "" ]]; then
  echo "No workspace package updates, exiting script with code 1"
  exit 1
fi


######################
# Generate change log
######################

node build/changeLogGenerator.js

#################
# COMMIT CHANGES
#################

TAG="v$(node -p "require('./package.json').version")"
COMMITMSG="$UPDATED"
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
