#!/bin/bash

set -euxo pipefail

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
		echo "$USAGE"
		exit 1
		;;
  *)
  	echo "Unrecognized parameter. Use -h to display usage."
  	exit 1
  	;;
	esac
done

#######################################
# EXTRACT FROM COMMIT OR TRACKED FILES
#######################################

FILE=archive.tar
if [[ $REV != 'latest' ]]; then
	if [[ $REV == "HEAD" ]]; then
		REV=$(git rev-parse --short HEAD)
	fi

	if [[ $REV == "HEAD" || $REV == "" ]]; then
		echo "Unable to convert the HEAD revision into a Git commit hash."
		exit 1
	fi

	echo "Extracting from commit='$REV' ... "
	git archive --output=$FILE "$REV"
elif [[ "$(git status --porcelain)" == "" ]]; then
	# clean git workspace
	echo "Extracting from latest commit ... "
	git archive --output=$FILE "$(git rev-parse --short HEAD)"
else
	# dirty git workspace
	HASH=$(git stash create)
	if [[ "$HASH" == "" ]]; then
		HASH="HEAD"
	fi
	echo "Extracting from git-tracked files (stash=$HASH) ..."
	git archive --output=$FILE "$HASH"
	#git ls-files | tar Tzcf - archive.tgz
fi

rm -rf tmppack
mkdir tmppack

printf "Copying selected directories and files ..."
tar -C tmppack/ -xf $FILE package.json
tar -C tmppack/ -xf $FILE server
tar -C tmppack/ -xf $FILE client
tar -C tmppack/ -xf $FILE front
tar -C tmppack/ -xf $FILE rust
tar -C tmppack/ -xvf $FILE $TARGETDIR
if [[ "$TARGETDIR" == "build/full" ]]; then
	# the full build requires the server build
	tar -C tmppack/ -xvf $FILE build/server
fi
tar -C tmppack/ -xvf $FILE build/Dockerfile
tar -C tmppack/ -xvf $FILE build/minpkgjson.cjs
tar -C tmppack/ -xvf $FILE public/index.html
tar -C tmppack/ -xvf $FILE utils/install.pp.cjs
tar -C tmppack/ -xvf $FILE .dockerignore
tar -C tmppack/ -xvf $FILE LICENSE
echo "$REV" > tmppack/rev.txt
