#!/bin/bash

# Synchronize the version bumps on changed workspaces and related portals,
# using human readable semantic version numbers instead of commit hashes

# call from the project root

###############
# ARGUMENTS
###############

set -e

# see the allowed version types in https://docs.npmjs.com/cli/v8/commands/npm-version
# e.g., <newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git
TYPE=prerelease
if [[ "$1" != "" ]]; then
  TYPE=$1
fi

##########
# CONTEXT
##########

CURRDIR=$(pwd)
handlePkg=$CURRDIR/build/handlePkg.js

WORKSPACES="rust server client front"

ROOTVERSION=$(node -p "require('./package.json').version")
if [[ ! $(git tag -l "v$ROOTVERSION") ]]; then
  git fetch origin v$ROOTVERSION
fi

COMMITMSG=$(git log --format=%B -n 1 v$ROOTVERSION)
if [[ "$COMMITMSG" != "v$ROOTVERSION" && "$COMMITMSG" != "v$ROOTVERSION "* && "$COMMITMSG" != "release $ROOTVERSION"* ]]; then
  echo "tag=v$ROOTVERSION should be the starting substring in its commit message"
  echo "you may need to move back the tag to the correct commit"
  exit 1
fi

################
# FUNCTIONS
###############

UPDATED=""
SP='@stjude/proteinpaint'
WSPKG=$(npm pkg get version dependencies devDependencies --workspaces)
# reduce the pacakge deps to only this project's workspaces
WSPKG=$($handlePkg "$WSPKG")
echo $WSPKG

mayBumpVersionOnDiff() {
  local WS=$1
  local REFVER=$2 # a potentially higher reference version that this package has fallen behind
  set +e
  local PREVIOUS=$(git rev-parse --verify -q v$ROOTVERSION^{commit}:$WS)
  local CURRENT=$(git rev-parse --verify -q HEAD:$WS)
  echo "$OKG [$PREVIOUS] [$CURRENT]"
  set -e
  if [[ "$PREVIOUS" != "$CURRENT" ]]; then
    if [[ "$REFVER" != "" ]]; then
      # catch up to the reference version first, before applying the version $TYPE change
      npm pkg set version=$REFVER
    fi
    # echo "Bumping $WS version => $TYPE (diff)"
    npm version $TYPE --no-git-tag-version --no-workspaces-update
    local VERSION=$(node -p "require('./package.json').version")
    UPDATED="$UPDATED $WS-$VERSION"
    updatePkg "[\"$SP-$WS\", \"version\", \"$VERSION\"]"
  fi
  HASH=$(echo $CURRENT | cut -c1-6)
  updatePkg "[\"$SP-$WS\", \"hash\", \"$HASH\"]"
}

maySetDepVer() {
  local WS=$1
  local IMPORTER=$2
  local DEPTYPE=$3
  local DEPVERSION=$4
  # echo "(...)['$SP-$IMPORTER'].$DEPTYPE?.['$SP-$WS']"
  local VERSION=$(node -p "($WSPKG)['$SP-$IMPORTER'].$DEPTYPE?.['$SP-$WS']")
  # echo "80 VERSION=[$VERSION] [$IMPORTER] [$DEPTYPE] [$WS]"
  if [[ "$VERSION" != "undefined" ]]; then
    if [[ "$DEPVERSION" == "" ]]; then
      DEPVERSION=$(node -p "($WSPKG)['$SP-$WS'].version")
    fi
    echo "setting $IMPORTER $DEPTYPE to use $WS@$DEPVERSION [$(pwd)]"
    npm pkg set $DEPTYPE.$SP-$WS=$DEPVERSION
    UPDATED="$UPDATED $IMPORTER:@$WS"
    updatePkg "[\"$SP-$IMPORTER\", \"$DEPTYPE\", \"$SP-$WS\", \"$DEPVERSION\"]"
  fi
}

mayBumpImporterVersion() {
  local IMPORTER=$1
  local REFVER=$2
  if [[ "$UPDATED" == *" $IMPORTER:@"* && "$UPDATED" != *" $IMPORTER-"* ]]; then
    if [[ "$REFVER" != "" ]]; then
      # catch up to the reference version first, before applying the version $TYPE change
      npm pkg set version=$REFVER
    fi
    if [[ "$IMPORTER" == "front" ]]; then
      echo "Bumping the $IMPORTER version => $TYPE [$REFVER] [$TYPE]"
    fi
    npm version $TYPE --no-git-tag-version --no-workspaces-update
    local VERSION=$(node -p "require('./package.json').version")
    UPDATED="$UPDATED $IMPORTER-$VERSION"
    updatePkg "[\"$SP-$IMPORTER\", \"version\", \"$VERSION\"]"
  fi
}

# arguments: a list of subnested keys
updatePkg() {
  local PATCH=$1
  WSPKG=$($handlePkg "$WSPKG" "$PATCH")
}

###############################
# CHECK FOR UPDATED WORKSPACES
###############################

for WS in ${WORKSPACES}; do
  cd $WS
  mayBumpVersionOnDiff $WS
  cd ..
done

##################################
# UPDATE THE IMPORTER WORKSPACES
##################################

for WS in ${WORKSPACES}; do
  for WSP in ${WORKSPACES}; do
    if [[ "$WSP" != "$WS" && "$UPDATED" == *" $WS-"* ]]; then
      cd $WSP
      maySetDepVer $WS $WSP devDependencies
      maySetDepVer $WS $WSP dependencies
      cd ..
    fi
  done
  cd $WSP
  mayBumpImporterVersion $WSP
  cd ..
done

if [[ "$UPDATED" == "" ]]; then
  echo "No workspace package updates, exiting script with code 1"
  exit 1
fi

##########################
# UPDATE package-lock.json
##########################
npm i --package-lock-only

##########################
# UPDATE THE ROOT PACKAGE
##########################
npm version $TYPE --no-git-tag-version --no-workspaces-update

# display the current versions as JSON
$handlePkg "$WSPKG"

#################
# Generate change log
#################

node build/changeLogGenerator.js

#################
# COMMIT CHANGES
#################

TAG="v$(node -p "require('./package.json').version")"
COMMITMSG="$TAG $UPDATED"
echo "$COMMITMSG"
echo "committing version change ..."
git config --global user.email "PPTeam@STJUDE.ORG"
git config --global user.name "PPTeam CI"
git add --all
git commit -m "$COMMITMSG"
git tag $TAG
#git push origin master
#git push origin $TAG
