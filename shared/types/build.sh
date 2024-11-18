#!/bin/bash

set -euxo pipefail

# npx tsx emitCheckers.ts # this is done only as needed
npx typia generate --input ./checkers --output ./dist
cp ./checkers/index.js ./dist
# esbuild will emit js files from ts files,
# note that package.json:files[] only include dist/*.js;
node esbuild.config.mjs
# after packing, should remove dist/*.js except dist/index.js
# see package.json:scripts.postpack
