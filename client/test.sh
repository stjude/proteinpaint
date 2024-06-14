#!/bin/bash

set -euxo pipefail

NAMEPATTERN=$1

rm -rf ../public/bin/test

TESTFILE=test/internals-test.js
node emitImports.mjs $NAMEPATTERN > ./$TESTFILE

# TODO: 
# use a good esbuild node polyfill plugin to avoid having to use webpack,
# to bundle and supplies tape lib with missing node libs  
npx webpack --config=./webpack.tape.config.mjs
ENV=test node esbuild.config.mjs 

INITJS='window.testHost="http://localhost:3000";import("/bin/test/_.._/test/internals-test.js");'
echo "$INITJS" | npx tape-run --static ../public