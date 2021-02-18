#!/bin/bash

set -e

#######################################
# delete unneeded deployed revisions
# in an SJ host: `scp purge.sh host:/opt/app/pp/`
#######################################

if (($# == 1)); then
	PATTERN=$1
	MAXRETAINED=5
elif (($# == 2)); then
	PATTERN=$1
	MAXRETAINED=$2
else
	echo "Usage: ./purge.sh PATTERN [MAXRETAINED]"
	echo "PATTERN glob pattern to match directory names that can be deleted"
	echo "MAXRETAINED (optional) maximum number of directories to retain"
	exit 1
fi

NUMMATCHEDDIRS=$(find . -maxdepth 1 -type d -name "$PATTERN" | wc -l)

if (($NUMMATCHEDDIRS < $MAXRETAINED + 1)); then
	echo "No directories purged: counted $NUMMATCHEDDIRS matching directories, $MAXRETAINED allowed"
	exit 1
fi

IFS= read -r -d $'\0' line < <(find . -maxdepth 1 -type d -name "$PATTERN" -printf '%T@ %p\0' 2>/dev/null | sort -z -n)
oldestdir="${line#* }"
echo "deleting $oldestdir"
rm -rf $oldestdir
