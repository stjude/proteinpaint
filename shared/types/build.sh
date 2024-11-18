#!/bin/bash

set -euxo pipefail

# npx tsx emitCheckers.ts # this is done only as needed
rm -rf dist
npx typia generate --input ./checkers --output ./dist
cp ./checkers/index.js ./dist/index.ts
# esbuild will emit js files from ts files,
# note that package.json:files[] only include dist/*.js;
node esbuild.config.mjs
# sed -i.bk "s|.ts'|.js'|g" dist/index.js
# rm dist/index.js
# mv dist/index.js.bk dist/index.js
# after packing, should remove dist/*.js except dist/index.js
# see package.json:scripts.postpack
