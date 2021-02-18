#!/bin/bash

# get the list of available builds
# in descending order of deployment

dir=active

while [[ -f $dir/public/next.txt ]];
do
	REV=$(cat $dir/public/next.txt | cut -d' ' -f 2)
	dir=available/pp-$REV
done

recent=$(cat $dir/public/rev.txt | cut -d' ' -f 2)

while [[ -f $dir/public/prev.txt ]];
do
	REV=$(cat $dir/public/prev.txt | cut -d' ' -f 2)
	recent="$recent\n$REV"
	dir=available/pp-$REV
done
echo -e $recent
