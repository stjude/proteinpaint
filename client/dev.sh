#!/bin/bash

set -euxo pipefail

rm -rf ./dist
node emitImports.mjs > ./test/internals-dev.js

if [[ ! -d ../public/bin ]]; then
	mkdir ../public/bin
fi
ln -sf $(pwd)/dist ../public/bin/
ln -sf $(pwd)/../front/src/app.js ../public/bin/proteinpaint.js

ENV=dev node esbuild.config.mjs
