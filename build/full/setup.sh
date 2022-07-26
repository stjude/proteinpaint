#!/bin/bash

# link from mounted optional working dirs
# to the pp/app directory
if [[ -d ../active/genome ]]; then
	ln -s ../active/genome .
fi

if [[ -d ../active/dataset ]]; then
	ln -s ../active/dataset .
fi

if [[ -d ../active/public ]]; then
	cp -r ../active/public .
fi

# note: server/src/serverconfig.js will adjust the
# tpmasterdir, cacherdir, etc to the expected container locations
# if the process.env.PP_MODE.startsWith('container')

cp ../active/serverconfig.json .
