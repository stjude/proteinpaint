#!/bin/bash

set -e
set -x

###############
# ARGUMENTS
###############

USAGE="Usage:

	./build/extract.sh [-r] [-t] [-h]

	-r REV: git revision to checkout, if empty will use the current code state
	-t TARGETDIR: 
	-h help manual
"

REV=latest
TARGETDIR="build"
while getopts "t:r:h:" opt; do
	case "${opt}" in
	t)
		TARGETDIR=$TARGETDIR/$OPTARG
		;;
	r)
		REV=$OPTARG
		;;
	h)
		echo $USAGE
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
		REV=$(git rev-parse --short HEAD)
	fi

	if [[ "$REV" == "HEAD" || "$REV" == "" ]]; then
		echo "Unable to convert the HEAD revision into a Git commit hash."
		exit 1
	fi

	echo "Extracting from commit='$REV' ... "
	git archive --output=$FILE $REV
elif [[ "$(git status --porcelain)" == "" ]]; then
	# clean git workspace
	echo "Extracting from latest commit ... "
	git archive --output=$FILE "$(git rev-parse --short HEAD)"
else
	# dirty git workspace
	HASH=$(git stash create)
	echo "Extracting from git-tracked files (stash=$HASH) ..."
	git archive --output=$FILE $HASH
	#git ls-files | tar Tzcf - archive.tgz
fi

rm -rf tmppack
mkdir tmppack

printf "Copying selected directories and files ..."
tar -C tmppack/ -xf $FILE package.json
tar -C tmppack/ -xf $FILE server
tar -C tmppack/ -xf $FILE client
tar -C tmppack/ -xvf $FILE $TARGETDIR
tar -C tmppack/ -xvf $FILE build/Dockerfile
tar -C tmppack/ -xvf $FILE build/compile-rust.sh
tar -C tmppack/ -xvf $FILE .dockerignore
tar -C tmppack/ -xvf $FILE LICENSE
echo $REV > tmppack/rev.txt

mkdir -p tmppack/minpkgjsons/server
mkdir tmppack/minpkgjsons/client
./build/minpkgjson.js tmppack/package.json > tmppack/minpkgjsons/package.json
./build/minpkgjson.js tmppack/server/package.json > tmppack/minpkgjsons/server/package.json
./build/minpkgjson.js tmppack/client/package.json > tmppack/minpkgjsons/client/package.json

