#!/bin/bash

############################
# revert the running server
# N preceding deployment(s) 
# from the active deployment 
############################

if (($# == 0)); then
	N=-1
elif (($# == 1)); then
	N=$1
	if [[ -d "available/pp-$N" ]]; then
		echo "reactivating pp-$N"
		ls -sfn available/pp-$N active
		./proteinpaint_run_node.sh
		exit 1
	fi
	if (($N == 0)); then
		echo "N must not equal 0"
		exit 1
	fi
else 
	echo "Usage: ./revert.sh [N=-1]"
	echo "N: either"
	echo "- an 8-digit git commit hash in the deployed build name, - OR -" 
	echo "- target number of preceding (negative) or subsequent (positive) deployments to revert to"
fi

if (($N < 0)); then
	FILENAME=prev.txt
else
	FILENAME=next.txt
fi 

dir=active
i=${N#-}
while [[ -f $dir/public/$FILENAME ]] && (($i > 0));
do
	REV=$(cat $dir/public/$FILENAME | cut -d' ' -f 2)
	i=$((i-1))
	dir=available/pp-$REV
done

if [[ DIR == "active" ]]; then 
	echo "No matching previous deployment found."
	exit 1
else 
	echo "reactivating pp-$REV"
	ls -sfn available/pp-$REV active
	./proteinpaint_run_node.sh
fi
