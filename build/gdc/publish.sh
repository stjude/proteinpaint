#!/bin/bash

set -e

######## 
# NOTES
# - called from project root, e.g., `./build/gdc/publish.sh $TYPE`
########

###############
# ARGUMENTS
###############

ENV=""
if [[ "$1" != "" ]]; then
	ENV=$1
fi

VERSIONTYPE=prerelease
if [[ "$2" != "" ]]; then
	VERSIONTYPE=$2
fi

MODE=$3

###########
# VERSION
###########

# workspace must be clean to deploy
if [ ! -z "$(git status --porcelain)" ]; then
	ERRORMSG="!!! There are untracked changes, either commit or delete them, or 'npm run clean'."
	if [[ "$MODE" == *"dry"* ]]; then
		echo "(SKIPPED in dry-mode) $ERRORMSG"
	else
		echo $ERRORMSG
		exit 1
	fi
fi

./build/version.sh $VERSIONTYPE "" $MODE
exit 1
##############################
# PUBLISH SELECTED WORKSPACES 
##############################

cd client
npm pack
scp stjude-proteinpaint-*.tgz prp1:/opt/data/pecan/Pk983gP.Rl2410y45/ydbD5DBW0BdkjXJq/
rm stjude-proteinpaint-*.tgz
