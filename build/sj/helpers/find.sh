#!/bin/bash

###################################
# Find the +/- N deployment(s) 
# preceding from or subsequent to 
# the active deployment 
###################################

set -e

RECENT=$(./helpers/recent.sh)
dir=""

if (($# == 0)); then
	N=0
elif (($# == 1)); then
	N=$1
	if [[ -d "available/pp-$N" ]]; then
		dir="available/pp-$N"
	fi
else 
	echo "Usage: find.sh [N=0]"
	echo "N: find one of the following under /opt/app/pp/available/"
	echo "- \"tip\" which is the latest deployed build"
	echo "- an 8-digit git commit hash of the deployed build name, - OR -" 
	echo "- the target number of preceding (negative) or subsequent (positive) deployment from the active deployment"
fi

if [[ "$N" == "tip" ]]; then
	rev=$(echo -e "$RECENT" | head -n1)
	dir="available/pp-$rev"
elif [[ "$dir" == "" ]]; then
	ACTIVEREV=$(cat active/public/rev.txt | cut -d' ' -f 2)
	M=$(echo -e "$RECENT" | grep -n "$ACTIVEREV"  | head -n1 | cut -d: -f1)
	let T=M-N
	# echo "[$ACTIVEREV,$N,$M,$T]"
	NUMLINES=$(echo -e "$RECENT" | wc -l)
	if (($T > NUMLINES || $T < 1)); then
		if (($N > 0)); then
			S="+$N"
		else 
			S="$N"
		fi
		echo "There is no available N$S deployment from the active version."
		exit 1
	fi
	rev="$(echo -e "$RECENT" | tail -n$T deployments.txt | head -n1 | cut -d' ' -f 2)"
	dir="available/pp-$rev"
fi

echo "$dir"
