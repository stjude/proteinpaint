#!/bin/bash

set -e

DIRS="genome dataset routes"
if [[ "$1" != "" ]]; then
	DIRS="$1"
fi

for dir in $DIRS 
do 
	cd $dir
	rm -f *.bak
	for f in *.js
	do 
		if [ -f "${f%.js}.ts" ]; then
			echo "deleting $dir/$f"
	 		rm "$f" 
	 	fi
	done
	cd ..
done
