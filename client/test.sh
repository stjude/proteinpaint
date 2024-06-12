#!/bin/bash

set -euxo pipefail

NAMEPATTERN=$1

rm -rf ../public/bin/test

TESTFILE=test/internals-test.js
node emitImports.mjs $NAMEPATTERN > ./$TESTFILE

ENV=test node esbuild.config.mjs 
ls -al ../public/bin/test/_.._/test
cat ../public/bin/test/_.._/test/internals-test.js
INITJS='window.testHost="http://localhost:3000"; import("/bin/test/_.._/test/internals-test.js");'
# echo 'console.log("---TEST---")' > ../public/bin/pretest.js
# INITJS='import("/bin/pretest.js")' 
echo "$INITJS" > test.js
cat test.js
