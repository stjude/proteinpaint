#!/bin/bash

set -euxo pipefail

# glob string pattern for matching filenames to test
NAMEPATTERN=$1

TESTHOST=http://localhost:3000
if [[ "$NAMEPATTERN" == *"integration"* ]]; then
	./test/pretest.js $TESTHOST
fi

rm -rf ../public/bin/test

TESTFILE=test/internals-test.js
node emitImports.mjs $NAMEPATTERN > ./$TESTFILE

if [[ ! -f "./test/tape.bundle.js" ]]; then 
	# assume that the tape lib rarely changes in local testing environment;
	# this does not affect the CI environment, where the runner will install
	# from a freshly cloned repo and will always have to create the tape.bundle
	# TODO: 
	# use a good esbuild node polyfill plugin to avoid having to use webpack,
	# to bundle and supplies tape lib with missing node libs  
	npx webpack --config=./webpack.tape.config.mjs
fi


ENV=test node esbuild.config.mjs
INITJS="window.testHost='$TESTHOST';import('/bin/test/_.._/test/internals-test.js');"
echo "$INITJS" | npx tape-run --static ../public
