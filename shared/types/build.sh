#!/bin/bash

set -euxo pipefail

npx tsx emitCheckers.ts 
npx typia generate --input ./checkers --output ./dist
# esbuild will emit js files from ts files,
# note that package.json:files[] only include dist/*.js;
node esbuild.config.mjs
# after packing, should remove dist/*.js except dist/index.js
# see package.json:scripts.postpack
