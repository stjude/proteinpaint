#!/bin/bash

# Synchronize the version bumps on changed workspaces and related portals,
# using human readable semantic version numbers instead of commit hashes

# call from the project root

###############
# ARGUMENTS
###############

set -euxo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
VERTYPE=prerelease # default

# second argument is the recover string (may be empty)
RECOVER="${2:-}"

if [[ "$1" == "pre"* ]]; then
  # respect user-selected prerelease, prepatch, preminor, premajor
  VERTYPE=$1
elif [[ "$BRANCH" == "prerelease"* && "$1" == "auto-detect" ]]; then
  # in case the CI UI input was not changed to 'prerelease'
  VERTYPE=prerelease
else
  # non pre* version type will be ignored, instead auto-detect 
  # the version type based on unreleased changelog entries 
  NOTES=$(node ./build/changeLogGenerator.cjs -u)
  if [[ "$NOTES" == *"Features:"* ]]; then
    VERTYPE=minor
  elif [[ "$NOTES" == *"Fixes:"* ]]; then
    VERTYPE=patch
  # else # devops, docs changelog defaults to prerelease 
  #   VERTYPE=prerelease
  fi
fi

if [[ "$VERTYPE" != "pre"* && "$BRANCH" != "master" && "$BRANCH" != "publish-"* && "$BRANCH" != "release"* && "$BRANCH" != "prerelease"* ]]; then
  VERTYPE="pre$VERTYPE"
fi

##########
# CONTEXT
##########

# version before calling bump.cjs
PREVIOUS_VERSION="$(node -p "require('./package.json').version")"

UPDATED=$(./build/bump.cjs $VERTYPE "$@")

if [[ -z "$UPDATED" ]]; then
  msg="No workspace package updates"
  [[ -n "$RECOVER" ]] && msg+=" - assume a release was interrupted and needs to be resumed."
  echo "$msg"
  [[ -z "$RECOVER" ]] && exit 0
fi


# this is the version that was assigned after ./build/bump.cjs [...] -w
VERSION="$(node -p "require('./package.json').version")"

########################
# Update the change log
########################

if [[ "$VERTYPE" != "pre"* ]]; then
  if [[ "$(grep $VERSION CHANGELOG.md)" != "" ]]; then
    echo "The changelog has already been updated with this version as released."
  elif [[ "$(grep 'Unreleased' CHANGELOG.md)" == "" ]]; then
    # non-pre* releases must have unreleased changelog entries to release
    echo "No unreleased change logs to publish."
    exit 1
  else
    # only update the change log if the version type is not prepatch, preminor, prerelease, pre*
    sed -i.bak "s|Unreleased|$VERSION|" CHANGELOG.md
  fi
fi

#################
# COMMIT CHANGES
#################

npm i --package-lock-only
TAG="v$VERSION"

EXISTINGTAG=$(git tag -l "$TAG")
if [[ "$EXISTINGTAG" != "" ]]; then
  echo "Tag='$TAG' already exists"
  # assume an interrupted release that needs to be resumed
  # if the tag exists, then the commit must also exist since a 
  # new tag is pushed after the branch commit
else
  COMMITMSG="$TAG $UPDATED"
  echo "$COMMITMSG"
  echo "committing version change ..."
  git config --global user.email "PPTeam@STJUDE.ORG"
  git config --global user.name "PPTeam CI"
  git add --all
  git commit -m "$COMMITMSG"

  git tag $TAG # the absolute reference to the repo state at the time of build

  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  git reset --hard HEAD~1 # go back one commit on the current branch
                          # to allow local branch to get fast-forwarded after pull, if applicable;
                          # tag will now be ahead of branch by one commit

  git pull # may already be at current tip or new commits may have been added
  # at this point, the local commit history will look like one of these
  # (A)
  # fast-forward         (B)
  # where both are       merge
  # at same commit     
  #                          branch fast-forwarded to a new commit from remote
  # tag,branch           tag |
  #    |                    \| 
  #    |                     |
  #    |                     |
  #

  # check in case another CI bumped the version in github while this CI was running
  PULLED_VERSION="$(node -p "require('./package.json').version")"
  if [[ "$PULLED_VERSION" != "$PREVIOUS_VERSION" ]]; then
    echo "!!! Error: !!!"
    echo "the remote version has changed from '$PREVIOUS_VERSION' to '$PULLED_VERSION' while this CI workflow/action was running"
    echo "!!! ------ !!!"
    exit 1
  fi

  # !!! DO NOT REBASE !!!
  git merge $TAG # can either fast-forward, or merge if there are new commits from remote
  # after merge,
  # (A) tag and branch will remain at the same commit if no new branch commits were pulled from remote
  #     - OR -
  # (B) if new commits were pulled, the commit history will now look like this
  #
  #     branch, after tag is merged into a new commit tip from remote
  #    /|
  # tag |
  #    \| 
  #     |
  #     |
  # 

  if [[ "$PWD" != *"/sjpp/"* ]]; then
    # must be in the remote ci environment
    git push origin $BRANCH # synchronize branch tip with remote, may already be up-to-date 
                            # or will update remote commit history to look like (B) after git merge diagram
    git push origin $TAG    # remote should not have this tag yet, should error if it's already there (non-fast-forward)

    # IMPORTANT:
    # subsequent steps after this script must use the tagged commit, since the pulled branch tip may have moved
    git reset --hard $TAG # if the branch tip did not move after pull, then nothing changes with this reset;
                   # if it moved, this will revert to the tagged commit and the commit history will look like (A) in the diagram above after git pull
  else 
    # /sjpp/ in the path means a dev environment
    echo "to undo release steps in dev, run: 'git reset --hard HEAD^1 && git tag -d $TAG'"
  fi
fi