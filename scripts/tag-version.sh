#!/bin/bash

set -e

if (($# != 1)); then
	echo "Usage: $ ./scripts/tag-version.sh [ \"patch\" | \"minor\" ]"
	exit 1
fi

UPDATETYPE=$1
LASTCOMMIT=$(git log --format=%B -n 1 HEAD)
git reset --soft HEAD~1
npm version -f "$UPDATETYPE" -m "$LASTCOMMIT" 
