#!/bin/bash

if [[ "${PWD}" != *client\/rx ]]; then
	echo "this script must be called from the [proteinpaint]/client/rx directory, called from '${PWD}'"
	exit 1
fi

# synchronize the code in the rx directory 
# with the isolated rx git repo (local copy)
RXCOPY=../../../rx
rsync -av ./ $RXCOPY --delete
if [[ "$1" != "" ]]; then
	cd $RXCOPY
	git add -A
	git commit -m "$1"
	git push
fi
