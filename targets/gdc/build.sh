#!/bin/bash

set -e

###############
# ARGUMENTS
###############

usage() {
	echo "Usage:

	./targets/pp-dist/build.sh [-r]

	-r REV: git revision to checkout, if empty will use the current code state
	"
}

REV=latest
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
fi

rm -rf tmppack
mkdir tmppack

echo "Copying selected directories and files from the git archive ..."
tar -C tmppack/ -xf $FILE server
tar -C tmppack/ -xf $FILE client
tar -C tmppack/ -xf $FILE package.json
tar -C tmppack/ -xvf $FILE targets/gdc
tar -C tmppack/ -xvf $FILE build/Dockerfile

#####################
# Build the image
#####################

cd tmppack
# get the current tag
# TAG="$(node -p "require('./package.json').version")"
docker build --file ./build/Dockerfile --tag ppbase:$REV .
docker build --file ./targets/gdc/Dockerfile --tag ppgdc:$REV --build-arg PKGVER=$REV .
