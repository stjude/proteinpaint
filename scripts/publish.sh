#!/bin/bash

set -e

######## 
# NOTES

# This is called from project root, e.g., `./scripts/publish.sh`

# - You must have a `//npm.pkg.github.com/:_authToken=PERSONAL_ACCESS_TOKEN` entry in your $HOME/.npmrc
#   See https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token
########

if (($# == 1)); then 
	REV="minor"
	MESSAGE=""
elif (($# == 2)); then
	REV=$1
	MESSAGE=$@
else 
	echo "USAGE:
  ./scripts/publish.sh [ patch | minor | major ] [ \"optional commit message\" ]
  "
	exit 1
fi

echo "$(git rev-parse HEAD) $(date)" > public/rev.txt

# for traceability, npm will not change the version unless
# the git working directory is clean (i.e., there are no pending file changes)
npm version "$REV"
npm publish
