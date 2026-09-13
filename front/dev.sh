#!/bin/bash

set -euxo pipefail

rm -rf $(pwd)/public/bin

# disabled symlinked front dev bundles to not clobber client dev bundles;
# follow front/README.md to use a non-pp server like python3 -m http.server
# if [[ ! -d ../public/bin ]]; then
# 	mkdir ../public/bin
# fi
# ln -sf ../public/bin/front $(pwd)/public/bin

webpack --env NODE_ENV=development --watch --progress --color
