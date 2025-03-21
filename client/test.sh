#!/bin/bash

set -euxo pipefail

# glob string pattern for matching filenames to test
NAMEPATTERN=$1
DIRPATTERN=""
if (($# == 2)); then
 DIRPATTERN=$2
fi

TESTHOST=http://localhost:3000
if [[ "$NAMEPATTERN" == *"integration"* ]]; then
	./test/pretest.js $TESTHOST
fi

if [[ ! -f "./test/tape.bundle.js" ]]; then
	# NOTES:
  # - webpack bundling is still needed in github CI, but not for local dev/test spec bundles
	# - assume that the tape lib rarely changes in local testing environment;
	#   this does not affect the CI environment, where the runner will install
	#   from a freshly cloned repo and will always have to create the tape.bundle
	#
	# TODO: 
	# - use a good esbuild node polyfill plugin to avoid having to use webpack,
	#   to bundle and supply tape lib with missing node libs
	npx webpack --config=./webpack.tape.config.mjs
fi

rm -rf ../public/bin/test

TESTFILE=test/internals-test.js
node emitImports.mjs $NAMEPATTERN > ./$TESTFILE

ENV=test node esbuild.config.mjs

# puppeteer needs headless chrome, as needed
set +u # disable unbound variable check
if [[ "$PUPPETEER_SKIP_DOWNLOAD" != "" ]]; then
	NODE_TLS_REJECT_UNAUTHORIZED=0 npx puppeteer browsers install chrome
fi
set -u # reenable unbound variable check

rm -rf .nyc_output 
node test/puppet.js "dir=$DIRPATTERN&name=$NAMEPATTERN"
