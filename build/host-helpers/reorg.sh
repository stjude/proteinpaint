#!/bin/bash


##########################
# Reorganize the PP host
# app directory structure  
##########################

set -e
ln -sfn /opt/data/pp/pp-log log

if [[ ! -d available ]]; then
	mkdir available
fi

if [[ ! -d erased ]]; then
	mkdir erased
fi

touch history.txt

if [[ -d es6_proteinpaint-prev ]]; then
	rev=$(cat es6_proteinpaint-prev/public/rev.txt | cut -d' ' -f 2)
	if [[ ! -d "available/pp-$rev" ]]; then
		mv es6_proteinpaint-prev available/pp-$rev
		ln -s available/pp-$rev previous
	fi
fi

if [[ -d es6_proteinpaint ]]; then
	rev=$(cat es6_proteinpaint/public/rev.txt | cut -d' ' -f 2)
	if [[ ! -d "available/pp-$rev" ]]; then
		mv es6_proteinpaint available/pp-$rev
		ln -sfn available/pp-$rev active
	fi
fi
