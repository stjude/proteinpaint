#!/bin/bash

set -e

#######################################
# delete unneeded deployed revisions
# in an SJ host: `scp purge.sh host:/opt/app/pp/`
#######################################

PATTERN="pp-*"
MAXRETAINED=7

if (($# == 1)); then
	PATTERN=$1
elif (($# == 2)); then
	PATTERN=$1
	MAXRETAINED=$2
# else
	# echo "Usage: ./helpers/purge.sh PATTERN [MAXRETAINED=$MAXRETAINED]"
	# echo "PATTERN quoted glob pattern to match directory names that can be deleted"
	# echo "MAXRETAINED (optional) maximum number of directories to retain"
	# exit 1
fi

NUMMATCHEDDIRS=$(./helpers/recent.sh | wc -l)

if (($NUMMATCHEDDIRS < $MAXRETAINED + 1)); then
	echo "No deployed builds purged: counted $NUMMATCHEDDIRS matching directories, $MAXRETAINED allowed"
	exit 0
fi

oldestdir="pp-$(./helpers/recent.sh | tail -n1)"
echo "deleting $oldestdir"
rm -rf $oldestdir
