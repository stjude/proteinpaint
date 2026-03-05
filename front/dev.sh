#!/bin/bash

set -euxo pipefail

rm -rf $(pwd)/public/bin

if [[ ! -d ../public/bin ]]; then
	mkdir ../public/bin
fi

ln -sf $(pwd)/public/bin ../public/bin/front
webpack --env NODE_ENV=development --watch --progress --color
