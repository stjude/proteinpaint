#!/bin/bash

set -e

DIRS="genome dataset routes"
if [[ "$1" != "" ]]; then
	DIRS="$1"
fi

# Previously this deleted each generated *.js that had a *.ts sibling. We now KEEP BOTH:
# Node 24 runs the .ts sources directly (outside node_modules), and datasets may be split
# into sibling modules (e.g. ppgdc/active/dataset/gdc.hg38.ts imports ./gdc.buildDictionary.js)
# whose imports must resolve whether a deploy references the .ts source or the generated .js.
# Only stale *.bak files are cleaned up now. This script is slated for retirement once all
# serverconfig.json datasets[] entries reference .ts directly.
for dir in $DIRS
do
	cd $dir
	rm -f *.bak
	cd ..
done
