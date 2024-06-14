#!/bin/bash

set -euxo pipefail

rm -rf ./dist

# TODO: 
# use a good esbuild node polyfill plugin to avoid having to use webpack,
# to bundle and supplies tape lib with missing node libs  
npx webpack --config=./webpack.tape.config.mjs
node emitImports.mjs > ./test/internals-dev.js
ln -sf $(pwd)/dist ../public/bin/
ENV=dev node esbuild.config.mjs
