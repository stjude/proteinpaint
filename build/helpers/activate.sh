#!/bin/bash

###################################
# Activate the +/- N deployment(s) 
# preceding from or subsequent to 
# the active deployment 
###################################

set -e

ACTIVEREV=$(cat active/public/rev.txt | cut -d' ' -f 2)
dir=$(./helpers/find.sh "$@")

if [[ "$dir" == "active" ]]; then 
	echo "No matching deployment found for N='$N'."
	exit 1
elif [[ "$dir" == "available/pp-$ACTIVEREV" ]]; then
	echo "The matching version '$dir' is already active."
	exit 0
else
	echo "activating $dir"
	ln -sfn $dir active
	./proteinpaint_run_node.sh
fi
