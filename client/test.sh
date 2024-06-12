#!/bin/bash

NAMEPATTERN=$1

rm -rf ../public/bin/test

TESTFILE=test/internals-test.js
node emitImports.mjs $NAMEPATTERN > ./$TESTFILE

ENV=test node esbuild.config.mjs 

echo "window.testHost='http://localhost:3000'; import('/bin/test/_.._/$TESTFILE')" | npx tape-run --static ../public
