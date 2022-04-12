#!/bin/bash

WORKDIR=
if [[ "${pwd}" =~ ^.client\/rx ]]; then
	echo "this script must be called from the [proteinpaint]/client/rx directory"
	exit 1
fi

rsync -av ./ ../../../rx
