#!/bin/bash

####################################
# get the list of available builds
# in descending order of deployment
####################################

recent=""
FILE=deployments.txt

while IFS="" read -r p || [ -n "$p" ]
do
  rev=$(echo "$p" | cut -d' ' -f 2)
  if [[ -d available/pp-$rev ]]; then
  	if [[ "$recent" == "" ]]; then 
  		recent="$rev"
  	elif [[ "$recent" != *"$rev"* ]]; then
  		recent="$rev\n$recent"
  	fi
  fi
done < "$FILE"

echo -e $recent
