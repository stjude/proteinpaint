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

if [[ -d es6_proteinpaint-prev ]]; then
	REV=$(cat es6_proteinpaint-prev/public/rev.txt | cut -d' ' -f 2)
	if [[ ! -d "available/pp-$REV" ]]; then
		mv es6_proteinpaint-prev available/pp-$REV
		ln -s available/pp-$REV previous
	fi
	if [[ $(grep -l "$REV" history.txt) != "" ]]; then
		echo $(cat previous/public/rev.txt) >> history.txt
	fi
fi

if [[ -d es6_proteinpaint ]]; then
	REV=$(cat es6_proteinpaint/public/rev.txt | cut -d' ' -f 2)
	if [[ ! -d "available/pp-$REV" ]]; then
		mv es6_proteinpaint available/pp-$REV
		ln -sfn available/pp-$REV active
		if [[ -d previous ]]; then
			cp previous/public/rev.txt active/public/prev.txt
			cp active/public/rev.txt previous/public/next.txt
		fi
	fi
	if [[ $(grep -l "$REV" history.txt) != "" ]]; then
		echo $(cat active/public/rev.txt) >> history.txt
	fi
fi

mv proteinpaint_run_node.sh proteinpaint_run_node.sh.bk
sed "s%/es6_proteinpaint%/active%" < proteinpaint_run_node.sh.bk > proteinpaint_run_node.sh
