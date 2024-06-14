#!/bin/bash

set -euxo pipefail

rm -rf ./dist

node emitImports.mjs > ./test/internals-dev.js
ln -sf $(pwd)/dist ../public/bin/
ENV=dev node esbuild.config.mjs
