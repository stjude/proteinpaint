#!/bin/bash

set -e

###############
# ARGUMENTS
###############

if (($# == 0)); then
	REV="HEAD"
else
	REV=$1
fi

########################
# PROCESS COMMIT INFO
########################

# convert $REV to standard numeric notation
if [[ $REV == "HEAD" ]]; then
	if git tag > /dev/null 2>&1 && [ $? -eq 0 ]; then
		REV=$(git rev-parse --short HEAD)
	fi
fi

if [[ "$REV" == "HEAD" || "$REV" == "" ]]; then
	echo "Unable to convert the HEAD revision into a Git commit hash."
	exit 1
fi

#############################
# EXTRACT FROM COMMIT
# 
# ensure recoverability
#############################

# get commit sha1
rm -Rf tmppack 
mkdir tmppack # temporary empty workspace for checkedout commit
git archive HEAD | tar -x -C tmppack/
