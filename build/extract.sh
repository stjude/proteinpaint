#!/bin/bash

set -e

###############
# ARGUMENTS
###############

usage() {
	echo "Usage:

	./targets/pp-dist/build.sh [-t] [-r]

	-t tpmasterdir: your local serverconfig.json's tpmasterdir
	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
TPDIR=''
while getopts "r:h:" opt; do
	case "${opt}" in
	r)
		REV=$OPTARG
		;;
	h)
		usage
		exit 1
		;;
	esac
done

#######################################
# EXTRACT FROM COMMIT OR TRACKED FILES
#######################################

FILE=archive.tar
if [[ "$REV" != 'latest' ]]; then
	if [[ $REV == "HEAD" ]]; then
		if [[ -d .git ]]; then
			REV=$(git rev-parse --short HEAD)
		fi
	fi

	if [[ "$REV" == "HEAD" || "$REV" == "" ]]; then
		echo "Unable to convert the HEAD revision into a Git commit hash."
		exit 1
	fi

	echo "Extracting from commit='$REV' ... "
	git archive --output=$FILE $REV
else 	
	HASH=$(git stash create)
	echo "Extracting from git-tracked files (stash=$HASH) ..."
	git archive --output=$FILE $HASH
	#git ls-files | tar Tzcf - archive.tgz
fi

rm -rf tmppack
mkdir tmppack

printf "Copying selected directories and files ..."
tar -C tmppack/ -xf $FILE server
tar -C tmppack/ -xf $FILE client
tar -C tmppack/ -xf $FILE package.json
tar -C tmppack/ -xvf $FILE targets
tar -C tmppack/ -xvf $FILE build/Dockerfile
tar -C tmppack/ -xvf $FILE .dockerignore
tar -C tmppack/ -xvf $FILE LICENSE
echo $REV > tmppack/rev.txt
