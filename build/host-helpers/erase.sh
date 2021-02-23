#!/bin/bash

###################################
# Activate the +/- N deployment(s) 
# preceding from or subsequent to 
# the active deployment 
###################################

set -e

ACTIVEREV=$(cat active/public/rev.txt | cut -d' ' -f 2)
dir=$(./helpers/find.sh "$@")

if [[ "$dir" == "available/pp-$ACTIVEREV" ]]; then
	echo "You may not erase an active deployment."
	echo "First, activate a different build using helpers/activate.sh, then you may './build/help HOST erase $ACTIVEREV'."
	exit 1
else
	echo "moving pp-$ACTIVEREV to erased/"
	mv available/pp-$ACTIVEREV erased/
fi
