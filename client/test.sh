#!/bin/bash

set -euxo pipefail

NAMEPATTERN=$1

rm -rf ../public/bin/test

TESTFILE=test/internals-test.js
node emitImports.mjs $NAMEPATTERN > ./$TESTFILE

npx webpack --config=./webpack.tape.config.mjs
ENV=test node esbuild.config.mjs 

INITJS='window.testHost="http://localhost:3000";import("/bin/test/_.._/test/internals-test.js");'
echo "$INITJS" > test/init-esm.js
